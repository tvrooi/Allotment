import { previewCardSetup } from '../services/cardFundingSetup.js';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db, sqlite } from '../db/index.js';
import {
  accounts,
  transactions,
  budgetMonths,
  categories,
  categoryGroups,
  upConnections,
  upAccountMappings,
  schedules,
  scheduleOccurrences,
} from '../db/schema.js';
import { accountsRouter } from './accounts.js';
import { fundingState } from '../services/budgetService.js';
import { fundedWrite } from '../services/budgetMoves.js';
import { reconciliationSnapshot, reconcile } from '../services/reconciliationService.js';
import { autoCreateDueScheduled } from '../services/scheduleService.js';

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
    schedules,
    transactions,
    upConnections,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
  ])
    db.delete(table).run();
  db.insert(accounts)
    .values({
      id: 'cash',
      name: 'Checking',
      type: 'checking',
      startingBalance: 100000,
      createdAt: '2026-10-01',
    })
    .run();
  db.insert(categoryGroups).values({ id: 'expense', name: 'Expenses' }).run();
  db.insert(categories).values({ id: 'food', groupId: 'expense', name: 'Food' }).run();
});
const add = (id: string, amount: number, extra: Partial<typeof transactions.$inferInsert> = {}) =>
  db
    .insert(transactions)
    .values({ id, accountId: 'cash', date, amount, ...extra })
    .run();
function bank(settledBalance: number | null = 100000) {
  db.insert(upConnections)
    .values({
      id: 'up',
      accessToken: 'mock-token-for-disposable-test',
      lastSyncedAt: '2026-10-21T12:00:00Z',
    })
    .run();
  db.insert(upAccountMappings)
    .values({
      id: 'mapping',
      connectionId: 'up',
      upAccountId: 'mock-account',
      name: 'Checking',
      accountType: 'TRANSACTIONAL',
      accountId: 'cash',
      initializedAt: date,
      settledBalance,
    })
    .run();
}
function request(accountId = 'cash', overrides = {}) {
  const snapshot = reconciliationSnapshot(accountId);
  return {
    transactionIds: snapshot.transactions.map((t) => t.id),
    statementBalance:
      snapshot.reconciledBase + snapshot.transactions.reduce((s, t) => s + t.amount, 0),
    expectedBalance: snapshot.account.balance,
    revision: snapshot.revision,
    createAdjustment: false,
    ...overrides,
  };
}
async function send(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

it('refuses an adjustment based on a partial selection and changes no ledger rows', async () => {
  add('pay', 20000);
  add('bill', -5000);
  const before = db.select().from(transactions).all();
  const result = await send(
    'POST',
    '/accounts/cash/reconcile',
    request('cash', { transactionIds: [], statementBalance: 115000, createAdjustment: true }),
  );
  expect(result.status).toBe(409);
  expect(result.body.error).toMatch(/every current transaction/);
  expect(db.select().from(transactions).all()).toEqual(before);
});

it('records the reviewed correction once, preserves imported amounts and rejects a stale retry', async () => {
  bank();
  add('wrong-adjustment', 6000, { isAdjustment: 1, reconciled: 1 });
  add('imported-pay', 10000, { importedId: 'up:mock-pay' });
  add('imported-bill', -10000, { importedId: 'up:mock-bill' });
  const input = request('cash', { statementBalance: 100000, createAdjustment: true });
  const result = await send('POST', '/accounts/cash/reconcile', input);
  expect(result).toMatchObject({ status: 200, body: { adjustment: -6000, reconciled: 3 } });
  const rows = db.select().from(transactions).all();
  expect(rows).toHaveLength(4);
  expect(rows.find((t) => t.id === 'imported-pay')).toMatchObject({
    amount: 10000,
    importedId: 'up:mock-pay',
    reconciled: 1,
  });
  expect(rows.find((t) => t.id === 'wrong-adjustment')).toMatchObject({
    amount: 6000,
    isAdjustment: 1,
  });
  expect(rows.find((t) => t.notes === 'Reconciliation adjustment')).toMatchObject({
    amount: -6000,
    isAdjustment: 1,
    categoryId: null,
    reconciled: 1,
  });
  expect(fundingState()).toMatchObject({
    resources: 100000,
    accountIssues: [],
    available: 100000,
    uncategorized: 10000,
  });
  expect((await send('POST', '/accounts/cash/reconcile', input)).status).toBe(409);
  expect(db.select().from(transactions).all()).toHaveLength(4);
});

it('rolls back both the adjustment and reconciliation if either write fails', () => {
  add('deposit', 1000);
  const before = db.select().from(transactions).all();
  sqlite.exec(
    "CREATE TRIGGER fail_reconciliation BEFORE UPDATE OF reconciled ON transactions WHEN NEW.notes = 'Reconciliation adjustment' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;",
  );
  try {
    expect(() =>
      reconcile('cash', request('cash', { statementBalance: 100000, createAdjustment: true })),
    ).toThrow(/simulated failure/);
  } finally {
    sqlite.exec('DROP TRIGGER fail_reconciliation');
  }
  expect(db.select().from(transactions).all()).toEqual(before);
});

it('refuses stale balances, foreign ids, duplicate ids, future rows and split children', async () => {
  add('parent', -3000, { isParent: 1 });
  add('child', -3000, { parentTransactionId: 'parent' });
  add('future', 50000, { date: '2026-11-01' });
  const snapshot = reconciliationSnapshot('cash');
  expect(snapshot.transactions.map((t) => t.id)).toEqual(['parent']);
  for (const transactionIds of [['child'], ['future'], ['foreign'], ['parent', 'parent']])
    expect(
      (await send('POST', '/accounts/cash/reconcile', request('cash', { transactionIds }))).status,
    ).toBe(400);
  const stale = request();
  add('new-receipt', 1000);
  expect((await send('POST', '/accounts/cash/reconcile', stale)).status).toBe(409);
});

it('does not reconcile future receipts or count a split twice', () => {
  add('parent', -3000, { isParent: 1 });
  add('child', -3000, { parentTransactionId: 'parent' });
  add('future', 50000, { date: '2026-11-01' });
  expect(request()).toMatchObject({
    transactionIds: ['parent'],
    statementBalance: 97000,
    expectedBalance: 147000,
  });
  reconcile('cash', request());
  expect(
    db.select().from(transactions).where(eq(transactions.id, 'future')).get()?.reconciled,
  ).toBe(0);
  expect(fundingState().resources).toBe(97000);
});

it('accepts a negative statement balance without turning it into positive cash', async () => {
  db.update(accounts).set({ startingBalance: -10000 }).where(eq(accounts.id, 'cash')).run();
  expect(
    await send(
      'POST',
      '/accounts/cash/reconcile',
      request('cash', { statementBalance: -8000, createAdjustment: true }),
    ),
  ).toMatchObject({ status: 200, body: { adjustment: 2000 } });
  expect(fundingState().resources).toBe(-8000);
});

it('requires the synced settled balance before adding an Up correction', async () => {
  bank();
  add('mistake', 1000);
  expect(
    (
      await send(
        'POST',
        '/accounts/cash/reconcile',
        request('cash', { statementBalance: 200000, createAdjustment: true }),
      )
    ).status,
  ).toBe(409);
  expect(db.select().from(transactions).all()).toHaveLength(1);
});

it('prevents positive and negative balances being hidden by closing, while zero closes normally', async () => {
  expect((await send('DELETE', '/accounts/cash')).status).toBe(409);
  db.update(accounts).set({ startingBalance: -100 }).where(eq(accounts.id, 'cash')).run();
  expect((await send('DELETE', '/accounts/cash')).status).toBe(409);
  db.update(accounts).set({ startingBalance: 0 }).where(eq(accounts.id, 'cash')).run();
  expect((await send('DELETE', '/accounts/cash')).status).toBe(204);
  expect((await send('GET', '/accounts')).body).toHaveLength(0);
  expect((await send('GET', '/accounts?include_closed=1')).body).toHaveLength(1);
});

it('discloses old closed balances, blocks new assignments and allows an explicit zero reconciliation', () => {
  db.insert(accounts)
    .values({
      id: 'old',
      name: 'Closed saver',
      type: 'savings',
      startingBalance: 2500,
      createdAt: '2026-10-01',
      closedAt: '2026-10-20T12:00:00Z',
    })
    .run();
  const before = fundingState();
  expect(before).toMatchObject({
    resources: 102500,
    available: 0,
    accountIssues: [{ accountId: 'old', reason: 'closed-balance', registerBalance: 2500 }],
  });
  expect(() =>
    fundedWrite(() => {
      db.insert(budgetMonths)
        .values({ id: 'new', month: '2026-10', categoryId: 'food', budgeted: 1000 })
        .run();
    }),
  ).toThrow(/Reconcile/);
  expect(db.select().from(budgetMonths).all()).toHaveLength(0);
  reconcile('old', request('old', { statementBalance: 0, createAdjustment: true }));
  expect(fundingState()).toMatchObject({ resources: 100000, available: 100000, accountIssues: [] });
  expect(db.select().from(accounts).where(eq(accounts.id, 'old')).get()?.closedAt).not.toBeNull();
});

it('flags an Up mismatch without changing cash or income and permits reducing an assignment', () => {
  bank(90000);
  db.insert(budgetMonths)
    .values({ id: 'food-budget', month: '2026-10', categoryId: 'food', budgeted: 10000 })
    .run();
  expect(fundingState()).toMatchObject({
    resources: 100000,
    available: 0,
    accountIssues: [{ reason: 'bank-mismatch', difference: -10000 }],
  });
  expect(() =>
    fundedWrite(() => {
      db.update(budgetMonths).set({ budgeted: 11000 }).run();
    }),
  ).toThrow(/Reconcile/);
  fundedWrite(() => {
    db.update(budgetMonths).set({ budgeted: 9000 }).run();
  });
  expect(db.select().from(budgetMonths).get()?.budgeted).toBe(9000);
  db.update(upAccountMappings).set({ settledBalance: 100000 }).run();
  expect(fundingState()).toMatchObject({ available: 91000, accountIssues: [] });
});

it('does not compare a historical month with a current bank snapshot or treat future income as cash', () => {
  bank(100000);
  add('future', 50000, { date: '2026-11-01' });
  expect(fundingState()).toMatchObject({ resources: 100000, accountIssues: [] });
  db.update(upAccountMappings).set({ settledBalance: 90000 }).run();
  expect(fundingState('2026-10-20').accountIssues).toEqual([]);
  expect(fundingState().available).toBe(0);
});

it('requires a first bank balance before presenting funding as available', () => {
  bank(null);
  expect(fundingState()).toMatchObject({
    available: 0,
    accountIssues: [{ reason: 'bank-balance-unavailable' }],
  });
});

it('does not auto-create a second salary on a bank feed or any entry on a closed account', async () => {
  bank();
  db.insert(accounts)
    .values([
      { id: 'manual', name: 'Manual account', type: 'checking' },
      { id: 'closed', name: 'Closed', type: 'savings', closedAt: '2026-10-20' },
    ])
    .run();
  for (const [id, accountId] of [
    ['pay', 'cash'],
    ['manual-pay', 'manual'],
    ['closed-pay', 'closed'],
  ]) {
    db.insert(schedules)
      .values({
        id,
        name: 'Expected pay',
        accountId,
        amount: 20000,
        recurrenceType: 'monthly',
        startDate: '2026-10-01',
        autoCreate: 1,
      })
      .run();
    db.insert(scheduleOccurrences)
      .values({
        id: id + '-occ',
        scheduleId: id,
        scheduledDate: date,
        expectedDate: date,
        expectedAmount: 20000,
      })
      .run();
  }
  expect(autoCreateDueScheduled()).toBe(1);
  expect(db.select().from(transactions).all()).toMatchObject([
    { accountId: 'manual', amount: 20000 },
  ]);
  expect(
    db.select().from(scheduleOccurrences).where(eq(scheduleOccurrences.id, 'pay-occ')).get()
      ?.status,
  ).toBe('pending');
  add('bank-pay', 20000, { importedId: 'up:mock-salary' });
  expect(autoCreateDueScheduled()).toBe(0);
  expect(fundingState().resources).toBe(120000);
  add('legacy-expected', 20000, { importedId: 'schedule:legacy:pay' });
  expect(() => reconcile('cash', request())).toThrow(/generated income/);
  expect(
    (await send('PUT', '/accounts/cash/reconcile', { transactionIds: ['legacy-expected'] })).status,
  ).toBe(409);
});

it('cannot fund a new card payment reserve with discrepant bank balances', () => {
  bank(90000);
  db.insert(accounts)
    .values({
      id: 'card',
      name: 'Card',
      type: 'credit',
      startingBalance: -10000,
      createdAt: '2026-10-01',
    })
    .run();
  expect(() => previewCardSetup('card', 1000)).toThrow(/Reconcile account balance/);
  expect(db.select().from(budgetMonths).all()).toEqual([]);
});

it('ignores off-budget closed debt and non-spendable positive assets in the funding check', () => {
  db.insert(accounts)
    .values([
      {
        id: 'tracking',
        name: 'Closed tracking debt',
        type: 'loan',
        isOffBudget: 1,
        startingBalance: -20000,
        createdAt: '2026-10-01',
        closedAt: '2026-10-20',
      },
      {
        id: 'asset',
        name: 'Closed asset',
        type: 'investment',
        isOffBudget: 0,
        startingBalance: 500000,
        createdAt: '2026-10-01',
        closedAt: '2026-10-20',
      },
    ])
    .run();
  expect(fundingState()).toMatchObject({ resources: 100000, available: 100000, accountIssues: [] });
});

it('uses the local closure date when reviewing historical balances', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'Australia/Melbourne';
  try {
    db.insert(accounts)
      .values({
        id: 'closing',
        name: 'Old cash',
        type: 'checking',
        startingBalance: 1000,
        createdAt: '2026-10-01',
        closedAt: '2026-10-20T23:30:00Z',
      })
      .run();
    expect(fundingState('2026-10-20').accountIssues).toEqual([]);
    expect(fundingState('2026-10-21').accountIssues).toMatchObject([
      { accountId: 'closing', reason: 'closed-balance' },
    ]);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
