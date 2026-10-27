import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db, sqlite } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  budgetMonths,
  transactions,
  budgetMoves,
  budgetSettings,
} from '../db/schema.js';
import { budgetGroups, budgetSummary, fundingState } from './budgetService.js';
import { applyMove, previewMove, undoMove } from './budgetMoves.js';
import { createBackup, parseBackup, restoreBackup } from './backupService.js';
import { ratesChanged } from './mainAmountService.js';

beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  for (const table of [
    budgetMoves,
    transactions,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
  ratesChanged();
  db.insert(accounts)
    .values({
      id: 'cash',
      name: 'Cash',
      type: 'checking',
      startingBalance: 100000,
      createdAt: '2026-09-01',
    })
    .run();
  db.insert(categoryGroups)
    .values([
      { id: 'expense', name: 'Expenses' },
      { id: 'income', name: 'Income', isIncome: 1 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'food', name: 'Food', groupId: 'expense' },
      { id: 'rent', name: 'Rent', groupId: 'expense' },
      { id: 'salary', name: 'Salary', groupId: 'income' },
    ])
    .run();
});
function assign(id: string, amount: number, month = '2026-10') {
  db.insert(budgetMonths)
    .values({ id: `${id}:${month}`, categoryId: id, month, budgeted: amount })
    .run();
}
function activity(
  id: string,
  amount: number,
  categoryId: string | null,
  date = '2026-10-15',
  extra = {},
) {
  db.insert(transactions)
    .values({ id, accountId: 'cash', amount, categoryId, date, ...extra })
    .run();
}
const move = { sourceId: 'food', destinationId: 'rent', amount: 5000 };
it('makes opening cash assignable without earned income and reserves all future purposes', () => {
  expect(budgetSummary('2026-10')).toMatchObject({
    income: 0,
    toBeBudgeted: 100000,
    complete: true,
  });
  assign('food', 100000, '2026-11');
  expect(budgetSummary('2026-10')).toMatchObject({ toBeBudgeted: 0, futureAssigned: 100000 });
  assign('rent', -100000, '2026-12');
  expect(fundingState().available).toBe(0); // future releases are not received cash
});
it('recognises opening funds only from the earlier of creation or first transaction', () => {
  expect(fundingState('2026-08-31').resources).toBe(0);
  activity('early', 100, 'salary', '2026-08-01');
  expect(fundingState('2026-08-01').resources).toBe(100100);
});
it('excludes future and generated salary, includes refunds and retains rollover-only envelopes', () => {
  assign('food', 60000, '2026-09');
  assign('food', 10000);
  activity('spend', -50000, 'food');
  activity('refund', 5000, 'food');
  activity('future', 999999, 'salary', '2026-11-01');
  activity('expected', 999999, 'salary', '2026-10-15', { importedId: 'schedule:pay:1' });
  expect(budgetGroups('2026-10')[0].categories.find((c) => c.id === 'food')).toMatchObject({
    carryOver: 60000,
    activity: -45000,
    balance: 25000,
  });
  expect(fundingState()).toMatchObject({ resources: 55000, reserved: 25000, unassigned: 30000 });
});
it('discloses deficits and uncategorised activity; overspending leaves next month', () => {
  activity('debit', -20000, 'food', '2026-10-10');
  activity('unknown', -10000, null);
  assign('rent', 70000);
  // Uncategorised spending leaves Ready to Assign at once; Food's deficit is red this month
  expect(budgetSummary('2026-10')).toMatchObject({
    toBeBudgeted: 20000,
    cashOverspent: 20000,
    overspent: 20000,
    uncategorized: 10000,
    resolved: false,
  });
  expect(budgetSummary('2026-11')).toMatchObject({ toBeBudgeted: 0, cashOverspent: 0 });
});
it('resets overspending at the month boundary, like YNAB, without changing what is assignable', () => {
  // September: a $3,000 settlement and a loan payout nobody budgeted for; food rolls $50 over
  assign('food', 10000, '2026-09');
  activity('food-sep', -5000, 'food', '2026-09-05');
  activity('settlement', -300000, 'rent', '2026-09-26');
  const september = fundingState('2026-09-30');
  expect(september).toMatchObject({ overspent: 300000 });
  const rentIn = (month: string) =>
    budgetGroups(month)
      .flatMap((g) => g.categories)
      .find((c) => c.id === 'rent')!;
  const foodIn = (month: string) =>
    budgetGroups(month)
      .flatMap((g) => g.categories)
      .find((c) => c.id === 'food')!;
  expect(rentIn('2026-09')).toMatchObject({ carryOver: 0, balance: -300000 });

  // October starts clean; the spent cash is already out of the accounts
  expect(rentIn('2026-10')).toMatchObject({ carryOver: 0, balance: 0 });
  expect(foodIn('2026-10')).toMatchObject({ carryOver: 5000, balance: 5000 });
  expect(fundingState()).toMatchObject({
    overspent: 0,
    resources: 100000 - 305000,
    unassigned: 100000 - 305000 - 5000,
  });

  // A refund after the reset is available money in the envelope again
  activity('refund', 2000, 'rent', '2026-10-12');
  expect(rentIn('2026-10')).toMatchObject({ carryOver: 0, balance: 2000 });
  // October overspending stays visible within October, then resets in November
  activity('oct', -9000, 'food', '2026-10-13');
  expect(foodIn('2026-10').balance).toBe(-4000);
  expect(fundingState().overspent).toBe(4000);
  expect(foodIn('2026-11')).toMatchObject({ carryOver: 0 });
});
it('does not count off-budget assets or borrowing as free funding', () => {
  // Dated explicitly: the default is the real clock, which can be after the faked today.
  const createdAt = '2026-09-01';
  db.insert(accounts)
    .values([
      { id: 'asset', name: 'Asset', type: 'investment', startingBalance: 999999, createdAt },
      {
        id: 'off',
        name: 'Off',
        type: 'checking',
        startingBalance: 999999,
        isOffBudget: 1,
        createdAt,
      },
      { id: 'card', name: 'Card', type: 'credit', startingBalance: -20000, createdAt },
    ])
    .run();
  expect(fundingState().resources).toBe(80000);
  activity('borrow', 20000, null, '2026-10-15', { transferTransactionId: 'debt' });
  activity('debt', -20000, null, '2026-10-15', {
    accountId: 'card',
    transferTransactionId: 'borrow',
  });
  expect(fundingState().resources).toBe(80000);
});
it('reports incomplete currency assessment and blocks money movement', () => {
  db.insert(budgetSettings).values({ id: 'budget', currency: 'AUD' }).run();
  db.insert(accounts)
    .values({
      id: 'foreign',
      name: 'Foreign',
      type: 'checking',
      currency: 'USD',
      startingBalance: 10000,
      createdAt: '2026-09-01',
    })
    .run();
  expect(fundingState()).toMatchObject({ complete: false, available: 0, resolved: false });
  assign('food', 10000);
  expect(() => previewMove('2026-10', move)).toThrow(/exchange rates/);
});
it('moves and undoes both assignments atomically, retaining resources', () => {
  assign('food', 10000);
  const before = fundingState();
  const preview = previewMove('2026-10', move);
  expect(preview).toMatchObject({ sourceAfter: 5000, destinationAfter: 5000 });
  const operation = applyMove('2026-10', move, preview.revision);
  expect(fundingState()).toMatchObject({ resources: before.resources, reserved: before.reserved });
  undoMove(operation.id);
  expect(
    db
      .select()
      .from(budgetMonths)
      .all()
      .map((r) => r.budgeted)
      .sort(),
  ).toEqual([0, 10000]);
  expect(() => undoMove(operation.id)).toThrow(/already undone/);
});
it('rejects competing clients, ABA edits and stale undo', () => {
  assign('food', 10000);
  const preview = previewMove('2026-10', move);
  const operation = applyMove('2026-10', move, preview.revision);
  expect(() => applyMove('2026-10', move, preview.revision)).toThrow(/changed/);
  db.update(budgetMonths).set({ budgeted: 6000 }).where(eq(budgetMonths.categoryId, 'food')).run();
  db.update(budgetMonths).set({ budgeted: 5000 }).where(eq(budgetMonths.categoryId, 'food')).run();
  expect(() => undoMove(operation.id)).toThrow(/changed/);
  expect(db.select().from(budgetMoves).all()).toHaveLength(1);
});
it('rolls back first write if the second write fails', () => {
  assign('food', 10000);
  const preview = previewMove('2026-10', move);
  sqlite.exec(
    "CREATE TRIGGER fail_move BEFORE INSERT ON budget_months WHEN new.category_id = 'rent' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  );
  try {
    expect(() => applyMove('2026-10', move, preview.revision)).toThrow(/test failure/);
  } finally {
    sqlite.exec('DROP TRIGGER fail_move');
  }
  expect(db.select().from(budgetMonths).all()[0].budgeted).toBe(10000);
  expect(db.select().from(budgetMoves).all()).toEqual([]);
});
it('rejects income sources, insufficient funds, and historical moves against money spent later', () => {
  assign('food', 10000, '2026-09');
  activity('spend', -9000, 'food');
  expect(() => previewMove('2026-09', move)).toThrow(/insufficient/);
  expect(() => previewMove('2026-10', { ...move, sourceId: 'salary' })).toThrow(/expense/);
});
it('preserves operations and old assignments through backup/restore and invalidates pre-restore undo', () => {
  assign('food', 10000);
  const p = previewMove('2026-10', move);
  const op = applyMove('2026-10', move, p.revision);
  restoreBackup(parseBackup(createBackup()));
  expect(db.select().from(budgetMoves).all()[0].id).toBe(op.id);
  expect(fundingState().balances.get('food')).toBe(5000);
  expect(() => undoMove(op.id)).toThrow(/changed/);
});
it('counts split children once and excludes internal cash transfers', () => {
  assign('food', 10000);
  activity('parent', -6000, null, '2026-10-15', { isParent: 1 });
  activity('child1', -4000, 'food', '2026-10-15', { parentTransactionId: 'parent' });
  activity('child2', -2000, 'rent', '2026-10-15', { parentTransactionId: 'parent' });
  expect(fundingState()).toMatchObject({
    resources: 94000,
    uncategorized: 0,
    overspent: 2000,
    reserved: 6000,
  });
});
it('starts envelopes at the budget start, keeping earlier history out of carry-over', () => {
  // Ten months of rent nobody budgeted for, then October budgeted properly
  for (let m = 1; m <= 9; m++) activity(`old${m}`, -478000, 'rent', `2026-0${m}-05`);
  activity('lunch', -1500, null, '2026-09-20');
  assign('rent', 100, '2026-09');
  activity('oct', -478000, 'rent', '2026-10-05');
  assign('rent', 478000);
  const rent = () =>
    budgetGroups('2026-10')
      .flatMap((g) => g.categories)
      .find((c) => c.id === 'rent')!;
  // Each unbudgeted month resets, like YNAB; September's $1 doesn't survive its own rent
  expect(rent()).toMatchObject({ carryOver: 0, balance: 0 });
  expect(fundingState().uncategorized).toBe(1500);

  db.insert(budgetSettings).values({ id: 'budget', budgetStartMonth: '2026-10' }).run();
  expect(rent()).toMatchObject({ carryOver: 0, activity: -478000, balance: 0 });
  expect(fundingState()).toMatchObject({ uncategorized: 0, overspent: 0 });
  expect(budgetSummary('2026-10').budgetStartMonth).toBe('2026-10');
  // Earlier months show nothing assigned or spent; cash is still what the accounts hold
  const september = budgetGroups('2026-09')
    .flatMap((g) => g.categories)
    .find((c) => c.id === 'rent')!;
  expect(september).toMatchObject({ budgeted: 0, activity: 0, balance: 0 });
  expect(fundingState().resources).toBe(100000 - 9 * 478000 - 1500 - 478000);

  // Clearing it counts all history again
  db.update(budgetSettings).set({ budgetStartMonth: null }).run();
  expect(fundingState().uncategorized).toBe(1500);
});
it('keeps an invalid budget start out of the database and backups', () => {
  expect(() =>
    db.insert(budgetSettings).values({ id: 'budget', budgetStartMonth: 'soon' }).run(),
  ).toThrow(/CHECK/);
  const backup = createBackup() as Record<string, unknown>;
  backup.budgetSettings = [{ id: 'budget', budgetStartMonth: '2026-13' }];
  expect(() => parseBackup(backup)).toThrow(/budget start/);
  backup.budgetSettings = [{ id: 'budget', budgetStartMonth: '2026-10' }];
  restoreBackup(parseBackup(backup));
  expect(budgetSummary('2026-10').budgetStartMonth).toBe('2026-10');
});
