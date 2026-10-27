import { beforeAll, beforeEach, afterAll, afterEach, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  budgetMonths,
  transactions,
  budgetMoves,
  budgetSettings,
} from '../db/schema.js';
import { budgetGroups, budgetSummary } from './budgetService.js';
import { applyMove, fundedWrite, previewMove } from './budgetMoves.js';
import { ratesChanged } from './mainAmountService.js';
import { monthBounds } from '../utils/date.js';

// Ready to Assign, the YNAB way (docs/ENVELOPE-FUNDING.md): the acceptance cases, then a
// from-scratch ledger recompute that has to agree with every figure the budget displays.

const TODAY = '2026-10-21';
beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterAll(() => vi.useRealTimers());
afterEach(() => vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`)));
beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`));
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
      { id: 'fun', name: 'Fun', groupId: 'expense' },
      { id: 'salary', name: 'Salary', groupId: 'income' },
    ])
    .run();
});

let seq = 0;
function account(id: string, createdAt: string, startingBalance = 0) {
  db.insert(accounts).values({ id, name: id, type: 'checking', startingBalance, createdAt }).run();
}
function txn(accountId: string, date: string, amount: number, categoryId: string | null) {
  db.insert(transactions)
    .values({ id: `t${++seq}`, accountId, date, amount, categoryId })
    .run();
}
/** Assigns through the same guarded write the Budget page uses */
function assign(categoryId: string, month: string, budgeted: number) {
  fundedWrite(() => {
    db.insert(budgetMonths)
      .values({ id: `${categoryId}:${month}`, month, categoryId, budgeted })
      .onConflictDoUpdate({
        target: [budgetMonths.month, budgetMonths.categoryId],
        set: { budgeted },
      })
      .run();
  });
}
const rta = (month: string) => budgetSummary(month).toBeBudgeted;
const available = (month: string, id: string) =>
  budgetGroups(month)
    .flatMap((g) => g.categories)
    .find((c) => c.id === id)!.balance;
const MONTHS = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01'];

it('assigning 700 and 300 from a 1000 inflow leaves exactly zero, across refreshes and months', () => {
  account('cash', '2026-10-01');
  txn('cash', '2026-10-05', 100000, 'salary');
  expect(rta('2026-10')).toBe(100000);
  assign('food', '2026-10', 70000);
  assign('rent', '2026-10', 30000);
  for (let refresh = 0; refresh < 3; refresh++)
    for (const month of MONTHS) expect(rta(month), month).toBe(0);
  // Months before the inflow had nothing to assign, and later commitments don't make them negative
  expect(budgetSummary('2026-09')).toMatchObject({ toBeBudgeted: 0, futureAssigned: 100000 });

  // Still zero once November arrives, viewed from either side
  vi.setSystemTime(new Date('2026-11-15T02:00:00Z'));
  for (const month of MONTHS) expect(rta(month), month).toBe(0);
  expect(available('2026-11', 'food')).toBe(70000);
});

it('an inflow enters Ready to Assign only from its own month', () => {
  account('cash', '2026-09-01');
  txn('cash', '2026-10-05', 100000, 'salary');
  txn('cash', '2026-11-03', 50000, 'salary'); // dated after today: not received yet
  expect(rta('2026-09')).toBe(0);
  expect(rta('2026-10')).toBe(100000);
  expect(rta('2026-11')).toBe(100000);
  // September never had October's money
  expect(() => assign('food', '2026-09', 1)).toThrow(/end of 2026-09/);
  vi.setSystemTime(new Date('2026-11-04T02:00:00Z'));
  expect(rta('2026-10')).toBe(100000);
  expect(rta('2026-11')).toBe(150000);
});

it('assigns in a past month only money that month had and no later month has used', () => {
  account('cash', '2026-09-01');
  txn('cash', '2026-09-05', 30000, 'salary');
  txn('cash', '2026-10-05', 100000, 'salary');
  assign('rent', '2026-10', 100000);
  expect(rta('2026-09')).toBe(0); // October's assignment took what September had left too
  expect(rta('2026-10')).toBe(30000);
  assign('food', '2026-09', 10000); // September did have $300
  expect(rta('2026-10')).toBe(20000);
  expect(() => assign('fun', '2026-09', 25000)).toThrow(/end of 2026-09/);
  expect(() => assign('fun', '2026-10', 25000)).toThrow(/Insufficient/);
  assign('fun', '2026-10', 20000);
  for (const month of ['2026-10', '2026-11']) expect(rta(month), month).toBe(0);
});

it('moving money changes exactly those two categories and never Ready to Assign', () => {
  account('cash', '2026-10-01');
  txn('cash', '2026-10-05', 100000, 'salary');
  assign('food', '2026-10', 70000);
  assign('rent', '2026-10', 20000);
  txn('cash', '2026-10-10', -30000, 'rent'); // Rent overspent by $100
  const before = { rta: rta('2026-10'), fun: available('2026-10', 'fun') };
  const request = { sourceId: 'food', destinationId: 'rent', amount: 10000 };
  applyMove('2026-10', request, previewMove('2026-10', request).revision);
  expect(rta('2026-10')).toBe(before.rta);
  expect(available('2026-10', 'food')).toBe(60000);
  expect(available('2026-10', 'rent')).toBe(0);
  expect(available('2026-10', 'fun')).toBe(before.fun);
  expect(rta('2026-11')).toBe(before.rta); // the covered deficit no longer leaves next month
});

it('cash overspending is red in its month and comes out of the next month only', () => {
  account('cash', '2026-10-01');
  txn('cash', '2026-10-05', 100000, 'salary');
  assign('food', '2026-10', 70000);
  assign('rent', '2026-10', 30000);
  txn('cash', '2026-10-12', -80000, 'food');
  expect(rta('2026-10')).toBe(0);
  expect(available('2026-10', 'food')).toBe(-10000);
  expect(budgetSummary('2026-10')).toMatchObject({ overspent: 10000, cashOverspent: 10000 });
  expect(rta('2026-11')).toBe(-10000);
  expect(available('2026-11', 'food')).toBe(0);
  expect(rta('2026-12')).toBe(-10000); // deducted once, not every month
});

it('overspending never blocks assigning what Ready to Assign shows; next month absorbs it', () => {
  account('cash', '2026-10-01');
  txn('cash', '2026-10-05', 100000, 'salary');
  assign('food', '2026-10', 70000);
  txn('cash', '2026-10-12', -80000, 'food'); // Food overspent by $100
  expect(rta('2026-10')).toBe(30000);
  assign('rent', '2026-10', 30000); // the whole figure shown, as YNAB allows
  expect(rta('2026-10')).toBe(0);
  expect(rta('2026-11')).toBe(-10000);
  // Money that isn't there is still refused
  expect(() => assign('fun', '2026-10', 1)).toThrow(/Insufficient/);
});

// --- From-scratch recompute ---------------------------------------------------------------

/** A small deterministic generator, so a failure names a reproducible seed */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const EXPENSES = ['food', 'rent', 'fun'];
const SCENARIO_MONTHS = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
const day = (month: string, d: number) => `${month}-${String(d).padStart(2, '0')}`;
const minDate = (a: string, b: string) => (a < b ? a : b);

type Raw = {
  accounts: { id: string; createdAt: string; startingBalance: number }[];
  txns: { accountId: string; date: string; amount: number; categoryId: string | null }[];
  assigned: { month: string; categoryId: string; budgeted: number }[];
};

/** YNAB's ledger, from the raw records alone: no account balances, no service code. */
function recompute(raw: Raw, month: string) {
  const current = TODAY.slice(0, 7);
  const asOf = minDate(monthBounds(month).to, TODAY);
  const received = raw.txns.filter((t) => t.date <= asOf);
  const opening = raw.accounts
    .filter((a) => a.createdAt <= asOf)
    .reduce((s, a) => s + a.startingBalance, 0);
  // Ready to Assign's own inflows: income and anything left uncategorised
  const inflows = received
    .filter((t) => t.categoryId === null || t.categoryId === 'salary')
    .reduce((s, t) => s + t.amount, 0);
  const assignedThrough = raw.assigned
    .filter((a) => a.month <= month)
    .reduce((s, a) => s + a.budgeted, 0);
  // Replay each envelope month by month; a month-end deficit resets and leaves Ready to Assign
  let deficits = 0;
  const avail = new Map(EXPENSES.map((c) => [c, 0]));
  for (const m of SCENARIO_MONTHS.filter((m) => m <= month)) {
    const end = minDate(monthBounds(m).to, TODAY);
    for (const c of EXPENSES) {
      const carry = Math.max(0, avail.get(c)!);
      const assigned = raw.assigned
        .filter((a) => a.month === m && a.categoryId === c)
        .reduce((s, a) => s + a.budgeted, 0);
      const activity = raw.txns
        .filter((t) => t.categoryId === c && t.date.slice(0, 7) === m && t.date <= end)
        .reduce((s, t) => s + t.amount, 0);
      avail.set(c, carry + assigned + activity);
      if (m < month) deficits += Math.max(0, -avail.get(c)!);
    }
  }
  const pool = opening + inflows - assignedThrough - deficits;
  const later = raw.assigned
    .filter((a) => a.month > month)
    .reduce((s, a) => s + Math.max(0, a.budgeted), 0);
  const deduction = month < current ? Math.min(later, Math.max(0, pool)) : later;
  return { readyToAssign: pool - deduction, available: avail };
}

function scenario(seed: number): Raw {
  const rand = prng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const raw: Raw = { accounts: [], txns: [], assigned: [] };
  for (const id of ['a1', 'a2']) {
    const created = day(SCENARIO_MONTHS[int(0, 3)], int(1, 28));
    raw.accounts.push({ id, createdAt: created, startingBalance: int(0, 3) * 25000 });
  }
  for (let i = 0; i < 18; i++) {
    const a = raw.accounts[int(0, 1)];
    const date = day(SCENARIO_MONTHS[int(0, 4)], int(1, 28));
    if (date < a.createdAt) continue; // accounts open with their first transaction
    const kind = rand();
    const categoryId =
      kind < 0.3 ? 'salary' : kind < 0.4 ? null : EXPENSES[int(0, EXPENSES.length - 1)];
    // Mostly spending; some refunds and uncategorised inflows
    const amount = categoryId === 'salary' ? int(1, 8) * 10000 : int(-6000, 1500) * 10 + 1;
    raw.txns.push({ accountId: a.id, date, amount, categoryId });
  }
  for (const m of SCENARIO_MONTHS)
    for (const c of EXPENSES)
      if (rand() < 0.45)
        raw.assigned.push({ month: m, categoryId: c, budgeted: int(1, 400) * 101 });
  return raw;
}

it('every displayed figure equals a from-scratch ledger recompute, in integer cents', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const table of [transactions, budgetMonths, accounts]) db.delete(table).run();
    const raw = scenario(seed);
    for (const a of raw.accounts)
      db.insert(accounts)
        .values({ ...a, name: a.id, type: 'checking' })
        .run();
    for (const t of raw.txns) txn(t.accountId, t.date, t.amount, t.categoryId);
    // Written directly, so scenarios include overassignment the guard would refuse today
    for (const a of raw.assigned)
      db.insert(budgetMonths)
        .values({ id: `${a.categoryId}:${a.month}`, ...a })
        .run();

    for (const month of SCENARIO_MONTHS) {
      const label = `seed ${seed}, ${month}`;
      const expected = recompute(raw, month);
      const summary = budgetSummary(month);
      expect(summary.toBeBudgeted, label).toBe(expected.readyToAssign);
      for (const c of EXPENSES)
        expect(available(month, c), `${label}, ${c}`).toBe(expected.available.get(c));
      // Conservation: every dollar is in an envelope, taken by a later month, or ready to assign
      expect(summary.toBeBudgeted + summary.envelopes + summary.laterDeduction, label).toBe(
        summary.resources,
      );
      for (const [key, value] of Object.entries(summary))
        if (typeof value === 'number')
          expect(Number.isSafeInteger(value), `${label}, ${key}`).toBe(true);
    }
  }
});
