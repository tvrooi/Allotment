import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { like } from 'drizzle-orm';
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
  transactions,
} from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { budgetGroups, budgetSummary } from '../services/budgetService.js';
import { reviewState } from '../services/reviewService.js';
import { ratesChanged } from '../services/mainAmountService.js';
import { categoriesRouter } from './categories.js';

// ACT-04: a category can keep an overspent month's deficit instead of starting the next at zero,
// for spending that will be paid back (docs/ENVELOPE-FUNDING.md, "Keeping overspending").
// budgetProperties.test.ts checks the arithmetic on random budgets; this is the scenario.

const OCTOBER = '2026-10-21';
const NOVEMBER = '2026-11-02';

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
afterEach(() => vi.setSystemTime(new Date(`${OCTOBER}T02:00:00Z`)));

const put = async (path: string, body: unknown) => {
  const res = await fetch(base + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const keep = (id: string, on: boolean) =>
  put(`/categories/${id}`, { keepOverspending: on ? 1 : 0 });
const setDate = (date: string) => vi.setSystemTime(new Date(`${date}T02:00:00Z`));

let seq = 0;
const txn = (date: string, amount: number, categoryId: string | null) =>
  db
    .insert(transactions)
    .values({ id: `t${++seq}`, accountId: 'spending', date, amount, categoryId })
    .run();
const assign = (month: string, categoryId: string, budgeted: number) =>
  db
    .insert(budgetMonths)
    .values({ id: `${categoryId}:${month}`, month, categoryId, budgeted })
    .run();
const trip = (month: string, today: string) =>
  budgetGroups(month, today)
    .flatMap((g) => g.categories)
    .find((c) => c.id === 'trip')!;
const rta = (month: string) => budgetSummary(month).toBeBudgeted;

beforeEach(() => {
  setDate(OCTOBER);
  for (const table of [
    budgetMoves,
    transactions,
    budgetMonths,
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
      { id: 'trip', name: 'Work trip', groupId: 'expense' },
      { id: 'food', name: 'Food', groupId: 'expense' },
      { id: 'salary', name: 'Salary', groupId: 'income' },
    ])
    .run();
  db.insert(accounts)
    .values({
      id: 'spending',
      name: 'Spending',
      type: 'checking',
      startingBalance: 0,
      createdAt: '2026-07-01',
    })
    .run();
  // All of the pay is in Food, then a $50 work expense nobody budgeted for
  txn('2026-10-03', 300000, 'salary');
  assign('2026-10', 'food', 300000);
  txn('2026-10-10', -5000, 'trip');
});

describe('keeping overspending', () => {
  it('is off by default: the deficit resets and November pays for the cash already spent', () => {
    setDate(NOVEMBER);
    expect(trip('2026-10', NOVEMBER).balance).toBe(-5000);
    expect(trip('2026-11', NOVEMBER)).toMatchObject({ carryOver: 0, balance: 0 });
    expect(rta('2026-11')).toBe(-5000);
  });

  it('carries the deficit and leaves Ready to assign alone', async () => {
    expect((await keep('trip', true)).status).toBe(200);
    expect(rta('2026-10')).toBe(0);
    setDate(NOVEMBER);
    expect(trip('2026-11', NOVEMBER)).toMatchObject({ carryOver: -5000, balance: -5000 });
    expect(rta('2026-11')).toBe(0);
    // A month ahead agrees with this one: no assignment, no change
    expect(trip('2026-12', NOVEMBER).carryOver).toBe(-5000);
    expect(rta('2026-12')).toBe(0);
  });

  it('is repaid by the reimbursement, or by assigning from Ready to assign', async () => {
    await keep('trip', true);
    setDate(NOVEMBER);
    txn('2026-11-01', 5000, 'trip');
    expect(trip('2026-11', NOVEMBER).balance).toBe(0);
    expect(rta('2026-11')).toBe(0);

    // Without the reimbursement, assigning covers the deficit from Ready to assign
    db.delete(transactions).where(like(transactions.date, '2026-11-%')).run();
    assign('2026-11', 'trip', 5000);
    expect(trip('2026-11', NOVEMBER).balance).toBe(0);
    expect(rta('2026-11')).toBe(-5000);
  });

  it('keeps the deficit through a month with nothing in it, and resets again when turned off', async () => {
    await keep('trip', true);
    setDate('2027-01-05');
    expect(trip('2027-01', '2027-01-05')).toMatchObject({ carryOver: -5000, balance: -5000 });
    await keep('trip', false);
    expect(trip('2027-01', '2027-01-05')).toMatchObject({ carryOver: 0, balance: 0 });
  });

  it('is listed in Review as overspent and as kept, so the deficit stays disclosed', async () => {
    await keep('trip', true);
    setDate(NOVEMBER);
    const review = reviewState(NOVEMBER);
    expect(review.deficits).toEqual([
      expect.objectContaining({ categoryId: 'trip', amount: 5000, kept: true }),
    ]);
    expect(review.totals.deficits).toBe(5000);
    expect(review.resolved).toBe(false);
  });

  it('only an expense category can keep it', async () => {
    expect((await keep('salary', true)).status).toBe(409);
    expect((await put('/categories/trip', { keepOverspending: 2 })).status).toBe(400);
    expect((await keep('trip', true)).body.keepOverspending).toBe(1);
  });
});
