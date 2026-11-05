import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { transactions } from '../db/schema.js';
import { accountsRouter } from './accounts.js';
import { transactionsRouter } from './transactions.js';

// SEC-01: a statement file that overlaps rows typed by hand, synced from a bank or posted by a
// schedule is flagged in the preview, and the import still does what the person chose.

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transactions', transactionsRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const newAccount = async (name: string) =>
  (await call('POST', '/accounts', { name, type: 'checking', startingBalance: 0 })).body
    .id as string;

const typed = (accountId: string, date: string, amount: number, payeeName: string) =>
  call('POST', '/transactions', { accountId, date, amount, payeeName });

let ids = 0;
const row = (date: string, amount: number, payeeName: string) => ({
  date,
  amount,
  payeeName,
  importedId: `${date}|${amount}|${payeeName}#${ids++}`,
});

interface Previewed {
  importedId: string;
  isDuplicate: boolean;
  possibleDuplicate: { transactionId: string; date: string; source: string } | null;
}
const preview = async (accountId: string, rows: unknown[]) =>
  (await call('POST', '/transactions/import/preview', { accountId, rows })).body as Previewed[];

describe('file import against rows the account already has', () => {
  it('flags a row typed by hand and says so', async () => {
    const a = await newAccount('Typed');
    const { body: tx } = await typed(a, '2026-11-02', -4_550, 'Woolworths');
    const fresh = row('2026-11-03', -1_200, 'Bakery');
    const lookalike = row('2026-11-03', -4_550, 'WOOLWORTHS 1234 SYDNEY');

    const rows = await preview(a, [lookalike, fresh]);
    expect(rows[0].isDuplicate).toBe(false);
    expect(rows[0].possibleDuplicate).toMatchObject({
      transactionId: tx.id,
      date: '2026-11-02',
      source: 'manual',
    });
    expect(rows[1].possibleDuplicate).toBeNull();
  });

  it('flags a row a bank sync already brought in', async () => {
    const a = await newAccount('Synced');
    const id = 'up:acct-1:txn-1';
    db.insert(transactions)
      .values({
        id: 'synced-1',
        accountId: a,
        date: '2026-11-04',
        amount: -990,
        payeeName: 'Spotify',
        importedPayee: 'SPOTIFY',
        importedId: id,
      })
      .run();
    const [r] = await preview(a, [row('2026-11-05', -990, 'SPOTIFY AB')]);
    expect(r.possibleDuplicate).toMatchObject({ transactionId: 'synced-1', source: 'synced' });
  });

  it('flags a row a schedule already posted', async () => {
    const a = await newAccount('Scheduled');
    db.insert(transactions)
      .values({
        id: 'sched-1',
        accountId: a,
        date: '2026-11-01',
        amount: -50_000,
        payeeName: 'Rent',
        importedId: 'schedule:s1:o1',
      })
      .run();
    const [r] = await preview(a, [row('2026-11-01', -50_000, 'RENT PAYMENT')]);
    expect(r.possibleDuplicate?.source).toBe('scheduled');
  });

  it('ignores other accounts, parts of a split, and balance corrections', async () => {
    const a = await newAccount('Mine');
    const other = await newAccount('Other');
    await typed(other, '2026-11-02', -700, 'Kiosk');
    db.insert(transactions)
      .values([
        {
          id: 'part-1',
          accountId: a,
          date: '2026-11-02',
          amount: -700,
          payeeName: 'Kiosk',
          parentTransactionId: 'some-parent',
        },
        {
          id: 'fix-1',
          accountId: a,
          date: '2026-11-02',
          amount: -700,
          payeeName: 'Kiosk',
          isAdjustment: 1,
        },
      ])
      .run();
    const [r] = await preview(a, [row('2026-11-02', -700, 'Kiosk')]);
    expect(r.possibleDuplicate).toBeNull();
  });

  it('keeps an exact repeat as a duplicate, with no lookalike flag', async () => {
    const a = await newAccount('Repeat');
    const first = row('2026-11-02', -300, 'Tolls');
    await call('POST', '/transactions/import/confirm', { accountId: a, rows: [first] });
    const [r] = await preview(a, [first]);
    expect(r.isDuplicate).toBe(true);
    expect(r.possibleDuplicate).toBeNull();
  });

  it('flags a different-format re-import of days that were imported before', async () => {
    const a = await newAccount('Reimport');
    await call('POST', '/transactions/import/confirm', {
      accountId: a,
      rows: [row('2026-11-02', -300, 'Tolls')],
    });
    const [r] = await preview(a, [row('2026-11-02', -300, 'TOLLS')]);
    expect(r.isDuplicate).toBe(false);
    expect(r.possibleDuplicate?.source).toBe('file');
  });

  it('never skips a flagged row: confirm imports it and counts it', async () => {
    const a = await newAccount('Confirm');
    await typed(a, '2026-11-02', -4_550, 'Woolworths');
    const flagged = row('2026-11-02', -4_550, 'WOOLWORTHS 1234');
    const clean = row('2026-11-03', -1_200, 'Bakery');

    const result = (
      await call('POST', '/transactions/import/confirm', { accountId: a, rows: [flagged, clean] })
    ).body;
    expect(result).toMatchObject({ imported: 2, skipped: 0, possibleDuplicates: 1 });
    expect(db.select().from(transactions).where(eq(transactions.accountId, a)).all()).toHaveLength(
      3,
    );
  });

  it('counts none when the person leaves the lookalike out', async () => {
    const a = await newAccount('Unticked');
    await typed(a, '2026-11-02', -4_550, 'Woolworths');
    const result = (
      await call('POST', '/transactions/import/confirm', {
        accountId: a,
        rows: [row('2026-11-03', -1_200, 'Bakery')],
      })
    ).body;
    expect(result).toMatchObject({ imported: 1, possibleDuplicates: 0 });
  });

  it('copes with a large file', async () => {
    const a = await newAccount('Large');
    const rows = Array.from({ length: 3_000 }, (_, i) => row('2026-10-01', -(i + 1), `Payee ${i}`));
    const result = (await call('POST', '/transactions/import/confirm', { accountId: a, rows }))
      .body;
    expect(result).toMatchObject({ imported: 3_000, possibleDuplicates: 0 });
    const again = await preview(a, rows);
    expect(again.every((r) => r.isDuplicate)).toBe(true);
  });
});
