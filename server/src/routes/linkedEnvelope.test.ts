import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  budgetMoves,
  budgetSettings,
  cardFunding,
  categories,
  categoryGroups,
  categoryTargets,
  payees,
  rules,
  schedules,
  transactions,
} from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { budgetGroups, budgetSummary } from '../services/budgetService.js';
import { budgetWithTargets } from '../services/targetService.js';
import { ratesChanged } from '../services/mainAmountService.js';
import { categoriesRouter } from './categories.js';

// An envelope linked to an account (docs/ENVELOPE-FUNDING.md): moving rent money into the rent
// account funds the Rent envelope, from Ready to Assign, without a separate assignment.

const TODAY = '2026-10-21';

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  const app = express();
  app.use(express.json());
  app.use('/api/categories', categoriesRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => {
  server.close();
  vi.useRealTimers();
});
afterEach(() => vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`)));

const put = async (path: string, body: unknown) => {
  const res = await fetch(base + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

let seq = 0;
function txn(accountId: string, date: string, amount: number, categoryId: string | null = null) {
  const id = `t${++seq}`;
  db.insert(transactions).values({ id, accountId, date, amount, categoryId }).run();
  return id;
}
/** A confirmed transfer: both legs, each pointing at the other */
function transfer(from: string, to: string, date: string, amount: number) {
  const out = `t${++seq}`;
  const into = `t${++seq}`;
  db.insert(transactions)
    .values([
      { id: out, accountId: from, date, amount: -amount, transferTransactionId: into },
      { id: into, accountId: to, date, amount, transferTransactionId: out },
    ])
    .run();
}
const eqId = (id: string) => eq(categories.id, id);
const link = (categoryId: string, accountId: string | null) =>
  db.update(categories).set({ linkedAccountId: accountId }).where(eqId(categoryId)).run();

const rent = (month: string, today = TODAY) =>
  budgetGroups(month, today)
    .flatMap((g) => g.categories)
    .find((c) => c.id === 'rent')!;
const rta = (month: string) => budgetSummary(month).toBeBudgeted;

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`));
  for (const table of [
    budgetMoves,
    schedules,
    payees,
    rules,
    transactions,
    budgetMonths,
    categoryTargets,
    cardFunding,
    categories,
    categoryGroups,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
  ratesChanged();
  db.insert(categoryGroups)
    .values([
      { id: 'expense', name: 'Expenses' },
      { id: 'income', name: 'Income', isIncome: 1 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'rent', name: 'Rent', groupId: 'expense' },
      { id: 'food', name: 'Food', groupId: 'expense' },
      { id: 'salary', name: 'Salary', groupId: 'income' },
    ])
    .run();
  const account = (id: string, type: string, extra = {}) => ({
    id,
    name: id,
    type,
    startingBalance: 0,
    createdAt: '2026-07-01',
    ...extra,
  });
  db.insert(accounts)
    .values([
      account('spending', 'checking'),
      account('rentSaver', 'savings'),
      account('holiday', 'savings'),
      account('card', 'credit'),
      account('broker', 'investment', { isOffBudget: 1 }),
    ])
    .run();
  txn('spending', '2026-10-03', 300000, 'salary');
});

describe('an envelope linked to an account', () => {
  it('counts a transfer into the account as money in the envelope, out of Ready to Assign', () => {
    link('rent', 'rentSaver');
    transfer('spending', 'rentSaver', '2026-10-04', 200000);
    expect(rent('2026-10')).toMatchObject({
      budgeted: 0,
      transferred: 200000,
      activity: 0,
      balance: 200000,
    });
    expect(rta('2026-10')).toBe(100000);

    // Paying rent from the rent account spends what the transfer put in
    txn('rentSaver', '2026-10-10', -200000, 'rent');
    expect(rent('2026-10')).toMatchObject({ transferred: 200000, balance: 0, spent: 200000 });
    expect(rta('2026-10')).toBe(100000);
  });

  it('takes a transfer back out of the account from the envelope, and carries what is left', () => {
    link('rent', 'rentSaver');
    transfer('spending', 'rentSaver', '2026-10-04', 200000);
    transfer('rentSaver', 'spending', '2026-10-12', 50000);
    expect(rent('2026-10')).toMatchObject({ transferred: 150000, balance: 150000 });
    expect(rta('2026-10')).toBe(150000);
    // November starts with what October left, like any envelope
    expect(rent('2026-11')).toMatchObject({ carryOver: 150000, transferred: 0, balance: 150000 });
  });

  it('adds to what is assigned, and an assignment still works as before', () => {
    link('rent', 'rentSaver');
    db.insert(budgetMonths)
      .values({ id: 'a', month: '2026-10', categoryId: 'rent', budgeted: 30000 })
      .run();
    transfer('spending', 'rentSaver', '2026-10-04', 200000);
    expect(rent('2026-10')).toMatchObject({ budgeted: 30000, transferred: 200000 });
    expect(rent('2026-10').balance).toBe(230000);
    expect(rta('2026-10')).toBe(70000);
  });

  it('counts only confirmed transfers, from the budget, up to today', () => {
    link('rent', 'rentSaver');
    // Not confirmed as a transfer: an ordinary inflow, ready to assign
    txn('rentSaver', '2026-10-05', 40000);
    // A move from a tracking account is new money in the budget, not a contribution
    transfer('broker', 'rentSaver', '2026-10-06', 10000);
    // Another account's transfer has nothing to do with Rent
    transfer('spending', 'holiday', '2026-10-07', 20000);
    expect(rent('2026-10').transferred).toBe(0);
    expect(rta('2026-10')).toBe(350000);

    // A transfer later this month counts when its day comes
    transfer('spending', 'rentSaver', '2026-10-25', 100000);
    expect(rent('2026-10').transferred).toBe(0);
    expect(rent('2026-10', '2026-10-25').transferred).toBe(100000);
  });

  it('stops counting when unlinked, without rewriting anything', () => {
    link('rent', 'rentSaver');
    transfer('spending', 'rentSaver', '2026-10-04', 200000);
    expect(rta('2026-10')).toBe(100000);
    link('rent', null);
    expect(rent('2026-10')).toMatchObject({ transferred: 0, balance: 0 });
    expect(rta('2026-10')).toBe(300000);
  });

  it('counts toward a monthly target like an assignment', () => {
    link('rent', 'rentSaver');
    db.insert(categoryTargets)
      .values({ categoryId: 'rent', type: 'monthly', amount: 200000, createdMonth: '2026-10' })
      .run();
    const target = () =>
      budgetWithTargets('2026-10')
        .flatMap((g) => g.categories)
        .find((c) => c.id === 'rent')!.target!;
    expect(target().underfunded).toBe(200000);
    transfer('spending', 'rentSaver', '2026-10-04', 150000);
    expect(target()).toMatchObject({ assigned: 150000, underfunded: 50000 });
  });
});

describe('linking a category to an account', () => {
  it('links and unlinks an expense envelope', async () => {
    const linked = await put('/categories/rent', { linkedAccountId: 'rentSaver' });
    expect(linked.status).toBe(200);
    expect(linked.body.linkedAccountId).toBe('rentSaver');
    // Other edits keep the link
    expect((await put('/categories/rent', { name: 'Home' })).body.linkedAccountId).toBe(
      'rentSaver',
    );
    const unlinked = await put('/categories/rent', { linkedAccountId: null });
    expect(unlinked.body.linkedAccountId).toBeNull();
  });

  it('refuses links that would count money wrongly', async () => {
    for (const [id, accountId] of [
      ['salary', 'rentSaver'], // income
      ['rent', 'broker'], // off budget
      ['rent', 'card'], // card debt
      ['rent', 'missing'],
    ])
      expect((await put(`/categories/${id}`, { linkedAccountId: accountId })).status).toBe(409);

    db.update(accounts).set({ closedAt: '2026-09-01' }).where(eq(accounts.id, 'holiday')).run();
    expect((await put('/categories/rent', { linkedAccountId: 'holiday' })).status).toBe(409);

    // One envelope per account, so no transfer counts twice
    expect((await put('/categories/rent', { linkedAccountId: 'rentSaver' })).status).toBe(200);
    const taken = await put('/categories/food', { linkedAccountId: 'rentSaver' });
    expect(taken.status).toBe(409);
    expect(taken.body.error).toMatch(/already funds Rent/);

    // A linked envelope can't move into an income group
    expect((await put('/categories/rent', { groupId: 'income' })).status).toBe(409);
  });

  it('clears the link when the account is deleted', () => {
    link('rent', 'rentSaver');
    db.delete(accounts).where(eq(accounts.id, 'rentSaver')).run();
    expect(db.select().from(categories).where(eqId('rent')).get()?.linkedAccountId).toBeNull();
  });
});
