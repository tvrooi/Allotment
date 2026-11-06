import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetHolds,
  budgetMonths,
  budgetMoves,
  budgetSettings,
  cardFunding,
  categories,
  categoryGroups,
  transactions,
} from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { budgetSummary } from '../services/budgetService.js';
import { ratesChanged } from '../services/mainAmountService.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';
import { budgetRouter } from './budget.js';

// ACT-03: hold money for the next month (docs/ENVELOPE-FUNDING.md, "Holding money for next
// month"). budgetProperties.test.ts checks the arithmetic on random budgets; this is the scenario.

const NOVEMBER = '2026-11-05';
const DECEMBER = '2026-12-02';

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  const app = express();
  app.use(express.json());
  app.use('/api/budget', budgetRouter);
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
afterEach(() => vi.setSystemTime(new Date(`${NOVEMBER}T02:00:00Z`)));

const put = async (path: string, body: unknown) => {
  const res = await fetch(base + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const hold = (month: string, amount: unknown) => put(`/budget/${month}/hold`, { amount });
const assign = (month: string, categoryId: string, budgeted: number) =>
  put(`/budget/${month}/${categoryId}`, { budgeted });
const setDate = (date: string) => vi.setSystemTime(new Date(`${date}T02:00:00Z`));
const rta = (month: string) => budgetSummary(month).toBeBudgeted;

beforeEach(() => {
  setDate(NOVEMBER);
  for (const table of [
    budgetHolds,
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
  // $1,000 of pay in November, all of it ready to assign
  db.insert(transactions)
    .values({
      id: 'pay',
      accountId: 'spending',
      date: '2026-11-02',
      amount: 100000,
      categoryId: 'salary',
    })
    .run();
});

describe('holding money for next month', () => {
  it('takes it from this month’s Ready to assign and gives it to the next', async () => {
    expect(rta('2026-11')).toBe(100000);
    const res = await hold('2026-11', 30000);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ month: '2026-11', amount: 30000, previous: 0 });

    const november = budgetSummary('2026-11');
    expect(november.toBeBudgeted).toBe(70000);
    expect(november.held).toBe(30000);
    expect(november.holdAmount).toBe(30000);
    expect(november.available).toBe(70000);
    // The money is not spent or assigned: the accounts still hold all of it
    expect(november.resources).toBe(100000);
    // Next month sees it again, whole
    expect(rta('2026-12')).toBe(100000);
    expect(budgetSummary('2026-12').holdAmount).toBe(0);
  });

  it('is replaced, not added to, and released by zero', async () => {
    await hold('2026-11', 30000);
    await hold('2026-11', 20000);
    expect(rta('2026-11')).toBe(80000);
    await hold('2026-11', 0);
    expect(rta('2026-11')).toBe(100000);
    expect(db.select().from(budgetHolds).all()).toEqual([]);
  });

  it('keeps assignments out of the held money, and lets a release free it', async () => {
    await hold('2026-11', 30000);
    // $700 is ready to assign: all of it goes, a cent more is refused by the funded-write guard
    expect((await assign('2026-11', 'food', 70000)).status).toBe(200);
    const refused = await assign('2026-11', 'food', 70001);
    expect(refused.status).toBe(409);
    expect(rta('2026-11')).toBe(0);
    await hold('2026-11', 0);
    expect(rta('2026-11')).toBe(30000);
    expect((await assign('2026-11', 'food', 100000)).status).toBe(200);
  });

  it('refuses to hold more than is ready to assign, and keeps what was held', async () => {
    await hold('2026-11', 30000);
    const tooMuch = await hold('2026-11', 100001);
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.error).toMatch(/Not enough Ready to assign/);
    expect(budgetSummary('2026-11').holdAmount).toBe(30000);
    // Exactly everything that is ready to assign is allowed
    expect((await hold('2026-11', 100000)).status).toBe(200);
    expect(rta('2026-11')).toBe(0);
    // Money already assigned is not ready to assign
    await hold('2026-11', 0);
    await assign('2026-11', 'food', 60000);
    expect((await hold('2026-11', 40001)).status).toBe(409);
    expect((await hold('2026-11', 40000)).status).toBe(200);
  });

  it('holds only what is left after next month’s assignments, and keeps both apart', async () => {
    await assign('2026-12', 'food', 60000);
    expect(rta('2026-11')).toBe(40000);
    // Only the $400 beyond December's assignment can be held
    expect((await hold('2026-11', 40001)).status).toBe(409);
    expect((await hold('2026-11', 40000)).status).toBe(200);
    expect(rta('2026-11')).toBe(0);
    expect(budgetSummary('2026-11').held).toBe(40000);
    // Held money can't be assigned to December from November either
    expect((await assign('2026-12', 'food', 60001)).status).toBe(409);
    // December sees the $400 again, with its own $600 assigned
    expect(rta('2026-12')).toBe(40000);
    await hold('2026-11', 0);
    expect((await assign('2026-12', 'food', 100000)).status).toBe(200);
  });

  it('only holds in the current month, with a whole, non-negative amount', async () => {
    expect((await hold('2026-12', 100)).status).toBe(400);
    expect((await hold('2026-10', 100)).status).toBe(400);
    expect((await hold('2026-11', -1)).status).toBe(400);
    expect((await hold('2026-11', 1.5)).status).toBe(400);
    expect((await hold('2026-11', '100')).status).toBe(400);
    expect((await hold('2026-11', 1e14)).status).toBe(400);
    expect((await put('/budget/2026-11/hold', {})).status).toBe(400);
    expect((await hold('not-a-month', 100)).status).toBe(400);
    expect(db.select().from(budgetHolds).all()).toEqual([]);
  });

  it('refuses a stale revision', async () => {
    const stale = await put('/budget/2026-11/hold', { amount: 100, revision: 'old' });
    expect(stale.status).toBe(409);
    expect(budgetSummary('2026-11').holdAmount).toBe(0);
  });

  it('is released when the month ends, and November still shows it set aside', async () => {
    await hold('2026-11', 30000);
    setDate(DECEMBER);
    expect(rta('2026-12')).toBe(100000);
    // November closed with the $300 held for December, so it shows $700
    expect(rta('2026-11')).toBe(70000);
    // Only the current month can take a new hold; November's can no longer change
    expect((await hold('2026-11', 0)).status).toBe(400);
    expect(db.select().from(budgetHolds).all()).toHaveLength(1);
  });

  it('survives a backup and restore', async () => {
    await hold('2026-11', 30000);
    const backup = JSON.parse(JSON.stringify(createBackup()));
    expect(backup.budgetHolds).toHaveLength(1);
    await hold('2026-11', 0);
    expect(rta('2026-11')).toBe(100000);
    restoreBackup(parseBackup(backup));
    expect(rta('2026-11')).toBe(70000);
    expect(budgetSummary('2026-11').holdAmount).toBe(30000);
    // A backup from before holds existed restores with none
    delete backup.budgetHolds;
    restoreBackup(parseBackup(backup));
    expect(rta('2026-11')).toBe(100000);
  });
});
