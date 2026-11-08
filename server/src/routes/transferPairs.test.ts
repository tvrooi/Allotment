import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, categories, categoryGroups, transactions } from '../db/schema.js';
import { transactionsRouter } from './transactions.js';

// A linked transfer between two listed accounts reads as one row, "Transfer from X to Y"
// (owner-requested 8 November 2026). Mock data only.

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  db.insert(accounts)
    .values([
      { id: 'spending', name: 'Spending', type: 'checking' },
      { id: 'saver', name: 'Saver', type: 'savings' },
      { id: 'pool', name: 'Shared Essentials', type: 'savings' },
    ])
    .run();
  db.insert(categoryGroups).values({ id: 'bills', name: 'Bills' }).run();
  db.insert(categories).values({ id: 'share', name: 'My share', groupId: 'bills' }).run();
  const pair = (
    out: string,
    into: string,
    from: string,
    to: string,
    amount: number,
    date: string,
    categoryIn: string | null = null,
  ) => [
    {
      id: out,
      accountId: from,
      date,
      amount: -amount,
      payeeName: `Transfer: ${to}`,
      transferTransactionId: into,
    },
    {
      id: into,
      accountId: to,
      date,
      amount,
      payeeName: `Transfer: ${from}`,
      transferTransactionId: out,
      categoryId: categoryIn,
    },
  ];
  db.insert(transactions)
    .values([
      ...pair('to-saver', 'from-spending', 'spending', 'saver', 5000, '2026-11-06'),
      // The budget side carries the category: that side is the one listed
      ...pair('to-pool', 'pool-in', 'pool', 'spending', 8800, '2026-11-06', 'share'),
      // Across a month end: in November only the October side's partner is listed
      ...pair('late-out', 'late-in', 'spending', 'saver', 300, '2026-10-31'),
      { id: 'coffee', accountId: 'spending', date: '2026-11-06', amount: -450, payeeName: 'Cafe' },
    ])
    .run();
  db.update(transactions).set({ date: '2026-11-01' }).where(eq(transactions.id, 'late-in')).run();

  const app = express();
  app.use(express.json());
  app.use('/transactions', transactionsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/transactions`;
});
afterAll(() => server.close());

type Row = { id: string; transferPair: boolean; transferAccountId: string | null };
const list = async (q = ''): Promise<Row[]> => (await fetch(`${base}?${q}`)).json();
const ids = (rows: Row[]) => rows.map((r) => r.id).sort();

describe('linked transfers as one row', () => {
  it('lists a pair once across all accounts, from the side that reads "from"', async () => {
    const rows = await list('from=2026-11-01&to=2026-11-30');
    // to-saver (money out) for the plain pair; pool-in (it has the category) for the other;
    // late-in stays because its partner is in October, outside the view
    expect(ids(rows)).toEqual(['coffee', 'late-in', 'pool-in', 'to-saver']);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get('to-saver')).toMatchObject({ transferPair: true, transferAccountId: 'saver' });
    expect(byId.get('pool-in')).toMatchObject({ transferPair: true, transferAccountId: 'pool' });
    expect(byId.get('late-in')!.transferPair).toBe(false);
    expect(byId.get('coffee')).toMatchObject({ transferPair: false, transferAccountId: null });
  });

  it("keeps both sides in one account's register and in a view holding only one side", async () => {
    expect(ids(await list('account_id=saver'))).toEqual(['from-spending', 'late-in']);
    expect(ids(await list('account_ids=spending,pool&from=2026-11-01'))).toEqual([
      'coffee',
      'pool-in',
      'to-saver',
    ]);
    // Saver and pool: no pair has both sides here
    expect(ids(await list('account_ids=saver,pool&from=2026-11-01'))).toEqual([
      'from-spending',
      'late-in',
      'to-pool',
    ]);
  });

  it('shows both sides when asked or when any other filter is set', async () => {
    expect(await list('from=2026-11-01&transfer_pairs=show')).toHaveLength(6);
    expect(await list('from=2026-11-01&search=Transfer')).toHaveLength(5);
  });

  it('counts the pair once and keeps all the money', async () => {
    const summary = await (await fetch(`${base}/summary?from=2026-11-01`)).json();
    expect(summary).toMatchObject({ count: 4, leafCount: 6 });
    expect(summary.moneyIn).toBe(5000 + 8800 + 300);
    expect(summary.moneyOut).toBe(5000 + 8800 + 450);
  });
});
