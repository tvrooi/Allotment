import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accountReconciliations,
  accounts,
  budgetMonths,
  categories,
  categoryGroups,
  transactions,
} from '../db/schema.js';
import { accountsRouter } from './accounts.js';
import { transactionsRouter } from './transactions.js';
import { reconciliationSnapshot } from '../services/reconciliationService.js';

// Undo of a reconciliation, unlocking one row, and the edits a reconciled row still takes.
let server: Server;
let base: string;
const date = '2026-10-21';
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T12:00:00Z'));
  const app = express();
  app.use(express.json());
  app.use('/accounts', accountsRouter);
  app.use('/transactions', transactionsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  vi.useRealTimers();
});
beforeEach(() => {
  for (const table of [
    transactions,
    accountReconciliations,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
  ])
    db.delete(table).run();
  db.insert(accounts)
    .values([
      {
        id: 'cash',
        name: 'Checking',
        type: 'checking',
        startingBalance: 100000,
        createdAt: '2026-10-01',
      },
      {
        id: 'other',
        name: 'Savings',
        type: 'savings',
        startingBalance: 0,
        createdAt: '2026-10-01',
      },
    ])
    .run();
  db.insert(categoryGroups).values({ id: 'expense', name: 'Expenses' }).run();
  db.insert(categories)
    .values([
      { id: 'food', groupId: 'expense', name: 'Food' },
      { id: 'fun', groupId: 'expense', name: 'Fun' },
    ])
    .run();
});
const add = (id: string, amount: number, extra: Partial<typeof transactions.$inferInsert> = {}) =>
  db
    .insert(transactions)
    .values({ id, accountId: 'cash', date, amount, ...extra })
    .run();
const row = (id: string) => db.select().from(transactions).where(eq(transactions.id, id)).get();
async function send(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}
async function reconcileAll(statementBalance?: number, createAdjustment = false) {
  const snap = reconciliationSnapshot('cash');
  return send('POST', '/accounts/cash/reconcile', {
    transactionIds: snap.transactions.map((t) => t.id),
    statementBalance:
      statementBalance ?? snap.reconciledBase + snap.transactions.reduce((s, t) => s + t.amount, 0),
    expectedBalance: snap.account.balance,
    revision: snap.revision,
    createAdjustment,
  });
}

it('undo unlocks exactly the rows the last reconciliation locked and removes its untouched adjustment', async () => {
  add('old', -1000, { reconciled: 1 }); // locked before, by something else
  add('a', -2000);
  add('b', -3000);
  add('elsewhere', -500, { accountId: 'other' });
  const done = await reconcileAll(100000 - 1000 - 2000 - 3000 + 700, true);
  expect(done.body).toMatchObject({ reconciled: 3, adjustment: 700 });
  expect((await send('GET', '/accounts/cash/reconcile/last')).body).toMatchObject({
    transactions: 2,
    adjustment: 700,
  });
  const result = await send('POST', '/accounts/cash/reconcile/undo');
  expect(result.body).toMatchObject({ unlocked: 2, adjustment: 'removed' });
  expect([row('a')!.reconciled, row('b')!.reconciled]).toEqual([0, 0]);
  expect(row('old')!.reconciled).toBe(1);
  expect(row('elsewhere')!.reconciled).toBe(0);
  expect(
    db
      .select()
      .from(transactions)
      .all()
      .filter((t) => t.isAdjustment),
  ).toHaveLength(0);
  expect((await send('GET', '/accounts/cash/reconcile/last')).body).toBeNull();
  expect((await send('POST', '/accounts/cash/reconcile/undo')).status).toBe(404);
});

it('keeps an adjustment that was edited since, and skips rows no longer locked or moved', async () => {
  add('a', -2000);
  add('b', -3000);
  await reconcileAll(100000 - 2000 - 3000 + 700, true);
  const adjustment = db
    .select()
    .from(transactions)
    .all()
    .find((t) => t.isAdjustment)!;
  // categorised after reconciling (allowed), one row unlocked and another moved by hand
  expect((await send('PUT', `/transactions/${adjustment.id}`, { categoryId: 'food' })).status).toBe(
    200,
  );
  await send('POST', '/transactions/a/unlock');
  db.update(transactions).set({ accountId: 'other' }).where(eq(transactions.id, 'b')).run();
  const result = await send('POST', '/accounts/cash/reconcile/undo');
  expect(result.body).toMatchObject({ unlocked: 0, alreadyChanged: 2, adjustment: 'kept' });
  expect(row(adjustment.id)).toMatchObject({ reconciled: 0, categoryId: 'food', amount: 700 });
  expect(row('b')!.reconciled).toBe(1); // not in this account any more: left alone
});

it('only the most recent reconciliation can be undone, one at a time', async () => {
  add('a', -2000);
  await reconcileAll();
  add('b', -3000);
  await reconcileAll();
  await send('POST', '/accounts/cash/reconcile/undo');
  expect([row('a')!.reconciled, row('b')!.reconciled]).toEqual([1, 0]);
  await send('POST', '/accounts/cash/reconcile/undo');
  expect([row('a')!.reconciled, row('b')!.reconciled]).toEqual([0, 0]);
});

it('a reconciled row takes category, notes and payee edits but not amount, date or account', async () => {
  add('rec', -2000, { reconciled: 1, payeeName: 'Coles' });
  const ok = await send('PUT', '/transactions/rec', {
    categoryId: 'food',
    notes: 'weekly shop',
    payeeName: 'Coles Supermarkets',
    amount: -2000,
    date,
  });
  expect(ok.status).toBe(200);
  expect(row('rec')).toMatchObject({ categoryId: 'food', notes: 'weekly shop', reconciled: 1 });
  for (const body of [{ amount: -2500 }, { date: '2026-10-20' }, { accountId: 'other' }]) {
    const refused = await send('PUT', '/transactions/rec', body);
    expect(refused.status).toBe(403);
    expect(refused.body.error).toMatch(/Unlock it first/);
  }
  expect(row('rec')).toMatchObject({ amount: -2000, date, accountId: 'cash' });
  expect((await send('DELETE', '/transactions/rec')).status).toBe(403);
});

it('unlocking one row lets its amount change and leaves the others locked', async () => {
  add('rec', -2000, { reconciled: 1 });
  add('rec2', -100, { reconciled: 1 });
  expect((await send('POST', '/transactions/rec/unlock')).body.reconciled).toBe(0);
  expect((await send('PUT', '/transactions/rec', { amount: -2500 })).status).toBe(200);
  expect(row('rec2')!.reconciled).toBe(1);
  expect((await send('POST', '/transactions/missing/unlock')).status).toBe(404);
});
