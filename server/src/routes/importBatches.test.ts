import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, importBatches, transactions } from '../db/schema.js';
import { accountsRouter } from './accounts.js';
import { transactionsRouter } from './transactions.js';

// SEC-01: every confirmed file import is remembered, and "undo this file" removes exactly its
// rows, keeping any the person has since worked on.

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

const newAccount = async (name: string, startingBalance = 0) =>
  (await call('POST', '/accounts', { name, type: 'checking', startingBalance })).body.id as string;

let ids = 0;
const row = (date: string, amount: number, payeeName: string) => ({
  date,
  amount,
  payeeName,
  importedId: `${date}|${amount}|${payeeName}#${ids++}`,
});

const importFile = (accountId: string, rows: unknown[], fileName?: string) =>
  call('POST', '/transactions/import/confirm', { accountId, rows, fileName });

const inAccount = (accountId: string) =>
  db.select().from(transactions).where(eq(transactions.accountId, accountId)).all();

interface Batch {
  id: string;
  fileName: string | null;
  rowCount: number;
  remaining: number;
  accountId: string;
}
const batches = async (accountId: string) =>
  (await call('GET', `/transactions/import/batches?accountId=${accountId}`)).body as Batch[];

describe('import history', () => {
  it('remembers each file, newest first, with how many of its rows remain', async () => {
    const a = await newAccount('History');
    const first = await importFile(
      a,
      [row('2026-10-01', -500, 'Cafe'), row('2026-10-02', -700, 'Bus')],
      'october.csv',
    );
    const second = await importFile(a, [row('2026-11-01', -900, 'Shop')], 'november.csv');
    expect(first.body.importBatchId).toBeTruthy();
    expect(second.body.importBatchId).not.toBe(first.body.importBatchId);

    const list = await batches(a);
    expect(list.map((b) => [b.fileName, b.rowCount, b.remaining])).toEqual([
      ['november.csv', 1, 1],
      ['october.csv', 2, 2],
    ]);
    // Deleting one row by hand lowers what remains, not what the file added
    const gone = inAccount(a).find((t) => t.payeeName === 'Cafe')!;
    await call('DELETE', `/transactions/${gone.id}`);
    expect((await batches(a)).find((b) => b.fileName === 'october.csv')).toMatchObject({
      rowCount: 2,
      remaining: 1,
    });
  });

  it('writes nothing for a file that added no rows', async () => {
    const a = await newAccount('Empty');
    const rows = [row('2026-10-01', -500, 'Cafe')];
    await importFile(a, rows, 'one.csv');
    const again = await importFile(a, rows, 'one-again.csv');
    expect(again.body.imported).toBe(0);
    expect(again.body.importBatchId).toBeNull();
    expect((await batches(a)).map((b) => b.fileName)).toEqual(['one.csv']);
  });

  it('lists only the account asked for', async () => {
    const a = await newAccount('Only A');
    const b = await newAccount('Only B');
    await importFile(a, [row('2026-10-01', -1, 'A')], 'a.csv');
    await importFile(b, [row('2026-10-01', -2, 'B')], 'b.csv');
    expect((await batches(a)).map((x) => x.fileName)).toEqual(['a.csv']);
    const all = (await call('GET', '/transactions/import/batches')).body as Batch[];
    expect(all.map((x) => x.fileName)).toEqual(expect.arrayContaining(['a.csv', 'b.csv']));
  });
});

describe('undo this file', () => {
  it('removes the file’s rows and nothing else', async () => {
    const a = await newAccount('Undo');
    await call('POST', '/transactions', {
      accountId: a,
      date: '2026-09-30',
      amount: -1_000,
      payeeName: 'Typed by hand',
    });
    const imported = await importFile(
      a,
      [row('2026-10-01', -500, 'Cafe'), row('2026-10-02', -700, 'Bus')],
      'oct.csv',
    );
    const other = await importFile(a, [row('2026-11-01', -900, 'Shop')], 'nov.csv');

    const undone = await call(
      'DELETE',
      `/transactions/import/batches/${imported.body.importBatchId}`,
    );
    expect(undone.status).toBe(200);
    expect(undone.body.kept).toEqual([]);
    expect(undone.body.removed.map((r: { payeeName: string }) => r.payeeName).sort()).toEqual([
      'Bus',
      'Cafe',
    ]);
    expect(
      inAccount(a)
        .map((t) => t.payeeName)
        .sort(),
    ).toEqual(['Shop', 'Typed by hand']);
    // The history no longer lists it; the other file is untouched
    expect((await batches(a)).map((b) => b.id)).toEqual([other.body.importBatchId]);
    expect(
      db
        .select()
        .from(importBatches)
        .where(eq(importBatches.id, imported.body.importBatchId))
        .get(),
    ).toBeUndefined();
  });

  it('puts back exactly what was imported when the removed rows are imported again', async () => {
    const a = await newAccount('Round trip');
    const rows = [row('2026-10-01', -500, 'Cafe'), row('2026-10-02', 12_000, 'Pay')];
    const imported = await importFile(a, rows, 'oct.csv');
    const before = inAccount(a).map((t) => [t.date, t.amount, t.payeeName, t.importedId]);

    const undone = await call(
      'DELETE',
      `/transactions/import/batches/${imported.body.importBatchId}`,
    );
    expect(inAccount(a)).toHaveLength(0);
    const back = await importFile(a, undone.body.removed, 'oct.csv');
    expect(back.body.imported).toBe(2);
    expect(inAccount(a).map((t) => [t.date, t.amount, t.payeeName, t.importedId])).toEqual(before);
    expect((await batches(a)).map((b) => [b.fileName, b.remaining])).toEqual([['oct.csv', 2]]);
  });

  it('keeps rows the person has worked on, says why, and leaves the file in the history', async () => {
    const a = await newAccount('Keep');
    const imported = await importFile(
      a,
      [
        row('2026-10-01', -100, 'Reconciled one'),
        row('2026-10-02', -200, 'Reviewed one'),
        row('2026-10-03', -300, 'Split one'),
        row('2026-10-04', -400, 'Transfer one'),
        row('2026-10-05', -500, 'Plain one'),
      ],
      'oct.csv',
    );
    const find = (name: string) => inAccount(a).find((t) => t.payeeName === name)!;
    db.update(transactions)
      .set({ reconciled: 1 })
      .where(eq(transactions.id, find('Reconciled one').id))
      .run();
    db.update(transactions)
      .set({ reviewedAt: '2026-11-01T00:00:00.000Z' })
      .where(eq(transactions.id, find('Reviewed one').id))
      .run();
    // A split made by hand: its parts were never part of the import
    const split = find('Split one');
    db.update(transactions).set({ isParent: 1 }).where(eq(transactions.id, split.id)).run();
    db.insert(transactions)
      .values({
        id: 'hand-part-1',
        accountId: a,
        date: split.date,
        amount: -300,
        parentTransactionId: split.id,
      })
      .run();
    db.update(transactions)
      .set({ transferTransactionId: 'somewhere-else' })
      .where(eq(transactions.id, find('Transfer one').id))
      .run();

    const undone = await call(
      'DELETE',
      `/transactions/import/batches/${imported.body.importBatchId}`,
    );
    expect(undone.status).toBe(200);
    expect(undone.body.removed.map((r: { payeeName: string }) => r.payeeName)).toEqual([
      'Plain one',
    ]);
    expect(
      Object.fromEntries(
        undone.body.kept.map((k: { payeeName: string; reason: string }) => [k.payeeName, k.reason]),
      ),
    ).toEqual({
      'Reconciled one': 'It is reconciled',
      'Reviewed one': 'You marked it reviewed',
      'Split one': 'You split it',
      'Transfer one': 'It is linked as a transfer',
    });
    expect(
      inAccount(a)
        .filter((t) => !t.parentTransactionId)
        .map((t) => t.payeeName)
        .sort(),
    ).toEqual(['Reconciled one', 'Reviewed one', 'Split one', 'Transfer one']);
    // Still listed, so the rest can be dealt with; undoing again removes nothing more
    expect((await batches(a)).map((b) => [b.fileName, b.remaining])).toEqual([['oct.csv', 4]]);
    const again = await call(
      'DELETE',
      `/transactions/import/batches/${imported.body.importBatchId}`,
    );
    expect(again.body.removed).toEqual([]);
    expect(again.body.kept).toHaveLength(4);
  });

  it('takes a split a rule made at import with it, but not one made by hand', async () => {
    const a = await newAccount('Rule split');
    const imported = await importFile(a, [row('2026-10-01', -800, 'Rule made')], 'oct.csv');
    const parent = inAccount(a)[0];
    db.update(transactions).set({ isParent: 1 }).where(eq(transactions.id, parent.id)).run();
    db.insert(transactions)
      .values({
        id: 'rule-part-1',
        accountId: a,
        date: parent.date,
        amount: -800,
        parentTransactionId: parent.id,
        importBatchId: imported.body.importBatchId,
      })
      .run();
    const undone = await call(
      'DELETE',
      `/transactions/import/batches/${imported.body.importBatchId}`,
    );
    expect(undone.body.kept).toEqual([]);
    expect(inAccount(a)).toHaveLength(0);
  });

  it('puts the starting balance back when the import had moved it to keep today’s balance', async () => {
    const a = await newAccount('Balance', 100_000);
    db.update(accounts).set({ balanceAsOf: '2026-11-01' }).where(eq(accounts.id, a)).run();
    const imported = await importFile(
      a,
      [row('2026-10-01', -500, 'Old'), row('2026-12-01', -700, 'New')],
      'mixed.csv',
    );
    const startAfter = () => db.select().from(accounts).where(eq(accounts.id, a)).get()!;
    // The old row is history behind a balance already typed in: the start moved, the balance did not
    expect(startAfter().startingBalance).toBe(100_000 + 500);

    const undone = await call(
      'DELETE',
      `/transactions/import/batches/${imported.body.importBatchId}`,
    );
    expect(undone.body.balanceRestored).toBe(true);
    expect(startAfter().startingBalance).toBe(100_000);
    expect(inAccount(a)).toHaveLength(0);
  });

  it('does not touch the starting balance when the import had not moved it', async () => {
    const a = await newAccount('No move', 5_000);
    const imported = await importFile(a, [row('2026-10-01', -500, 'Plain')], 'f.csv');
    const undone = await call(
      'DELETE',
      `/transactions/import/batches/${imported.body.importBatchId}`,
    );
    expect(undone.body.balanceRestored).toBe(false);
    expect(db.select().from(accounts).where(eq(accounts.id, a)).get()!.startingBalance).toBe(5_000);
  });

  it('answers 404 for an import that is not there, and for one already undone', async () => {
    const a = await newAccount('Gone');
    const imported = await importFile(a, [row('2026-10-01', -500, 'Plain')], 'f.csv');
    expect((await call('DELETE', '/transactions/import/batches/nope')).status).toBe(404);
    expect(
      (await call('DELETE', `/transactions/import/batches/${imported.body.importBatchId}`)).status,
    ).toBe(200);
    expect(
      (await call('DELETE', `/transactions/import/batches/${imported.body.importBatchId}`)).status,
    ).toBe(404);
  });
});
