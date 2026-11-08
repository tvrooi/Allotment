import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, transactions, upSourceRecords } from '../db/schema.js';
import { accountTransactionSum } from '../services/balances.js';
import { transactionsRouter } from './transactions.js';

// Up round-ups folded into their purchase, as Up's app shows them (owner-requested 8 November
// 2026): lists show the purchase once at its total; the round-up's own rows stay in the ledger.
// Mock bank data only.

let server: Server;
let base: string;

const source = (description: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    status: 'SETTLED',
    amount: 0,
    createdAt: '2026-11-07T08:25:00+11:00',
    settledAt: '2026-11-07T09:00:00+11:00',
    description,
    notes: '',
    roundUpAmount: null,
    boostAmount: null,
    cashbackAmount: null,
    cashbackDescription: null,
    transferAccountId: null,
    ...extra,
  });

beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  db.insert(accounts)
    .values([
      { id: 'spending', name: 'Spending', type: 'checking' },
      { id: 'saver', name: 'Saver', type: 'savings' },
    ])
    .run();
  const row = (
    r: Partial<typeof transactions.$inferInsert> & {
      id: string;
      amount: number;
      accountId: string;
    },
  ) => ({ date: '2026-11-07', ...r });
  db.insert(transactions)
    .values([
      // A settled purchase, the round-up debit made from it, and the Saver credit linked to it
      row({
        id: 'grocer',
        accountId: 'spending',
        amount: -5152,
        payeeName: 'Mock grocer',
        importedId: 'up:spending:grocer',
      }),
      row({
        id: 'grocer-roundup',
        accountId: 'spending',
        amount: -48,
        payeeName: 'Transfer: Saver',
        importedId: 'up:spending:grocer:roundup',
        transferTransactionId: 'grocer-credit',
      }),
      row({
        id: 'grocer-credit',
        accountId: 'saver',
        amount: 48,
        payeeName: 'Transfer: Spending',
        importedId: 'up:saver:grocer-credit',
        transferTransactionId: 'grocer-roundup',
      }),
      // A pending purchase's round-up: Up moved it already; the purchase isn't imported yet
      row({
        id: 'held-credit',
        accountId: 'saver',
        amount: 43,
        payeeName: 'Round Up',
        importedId: 'up:saver:held-credit',
      }),
      // An ordinary move to the Saver: not a round-up, stays listed
      row({
        id: 'plain-credit',
        accountId: 'saver',
        amount: 5000,
        payeeName: 'Transfer from Spending',
        importedId: 'up:saver:plain-credit',
      }),
      // A purchase with no round-up
      row({
        id: 'cafe',
        accountId: 'spending',
        amount: -450,
        payeeName: 'Mock cafe',
        importedId: 'up:spending:cafe',
      }),
    ])
    .run();
  const seen = { lastSeenAt: '2026-11-07T09:00:00Z' };
  db.insert(upSourceRecords)
    .values([
      {
        importedId: 'up:spending:grocer',
        accountId: 'spending',
        transactionId: 'grocer',
        ...seen,
        sourceJson: source('Mock grocer', { roundUpAmount: -48, boostAmount: -20 }),
      },
      {
        importedId: 'up:saver:grocer-credit',
        accountId: 'saver',
        transactionId: 'grocer-credit',
        ...seen,
        sourceJson: source('Round Up', { transferAccountId: 'up-spending' }),
      },
      {
        importedId: 'up:saver:held-credit',
        accountId: 'saver',
        transactionId: 'held-credit',
        ...seen,
        sourceJson: source('Round Up', { transferAccountId: 'up-spending' }),
      },
      {
        importedId: 'up:saver:plain-credit',
        accountId: 'saver',
        transactionId: 'plain-credit',
        ...seen,
        sourceJson: source('Transfer from Spending', { transferAccountId: 'up-spending' }),
      },
    ])
    .run();

  const app = express();
  app.use(express.json());
  app.use('/transactions', transactionsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/transactions`;
});
afterAll(() => server.close());

type Row = {
  id: string;
  amount: number;
  roundUp: { amount: number; transactionId: string; toAccountName: string; boost: number } | null;
  roundUpOf: { transactionId: string; payeeName: string } | null;
};
const list = async (q = ''): Promise<Row[]> => (await fetch(`${base}?${q}`)).json();
const ids = (rows: Row[]) => rows.map((r) => r.id).sort();

describe('Up round-ups folded into their purchase', () => {
  it('lists the purchase once with its round-up, across all accounts', async () => {
    const rows = await list();
    expect(ids(rows)).toEqual(['cafe', 'grocer', 'plain-credit']);
    expect(rows.find((r) => r.id === 'grocer')!.roundUp).toEqual({
      amount: -48,
      transactionId: 'grocer-roundup',
      toAccountName: 'Saver',
      boost: -20,
    });
    expect(rows.find((r) => r.id === 'cafe')!.roundUp).toBeNull();
  });

  it("hides the debit in the spending register and keeps the Saver's own register whole", async () => {
    expect(ids(await list('account_id=spending'))).toEqual(['cafe', 'grocer']);
    expect(ids(await list('account_id=saver'))).toEqual([
      'grocer-credit',
      'held-credit',
      'plain-credit',
    ]);
  });

  it('shows every leg when asked, each round-up naming its purchase', async () => {
    const rows = await list('round_ups=show');
    expect(rows).toHaveLength(6);
    expect(rows.find((r) => r.id === 'grocer-roundup')!.roundUpOf).toEqual({
      transactionId: 'grocer',
      payeeName: 'Mock grocer',
    });
  });

  it('counts the listed rows but keeps all the money in the summary', async () => {
    const summary = await (await fetch(`${base}/summary`)).json();
    expect(summary).toMatchObject({ count: 3, leafCount: 6, moneyOut: 5152 + 48 + 450 });
    expect(summary.moneyIn).toBe(48 + 43 + 5000);
    const shown = await (await fetch(`${base}/summary?round_ups=show`)).json();
    expect(shown.count).toBe(6);
  });

  it('leaves round-up legs out of a bulk edit of the view', async () => {
    const res = await fetch(`${base}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selection: {}, changes: { notes: 'x' }, preview: true }),
    });
    expect((await res.json()).matched).toBe(3);
  });

  it('changes no balance', () => {
    expect(accountTransactionSum('spending')).toBe(-5152 - 48 - 450);
    expect(accountTransactionSum('saver')).toBe(48 + 43 + 5000);
  });
});
