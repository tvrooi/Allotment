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
  categoryTargets,
  goals,
} from '../db/schema.js';
import { budgetGroups, budgetSummary } from './budgetService.js';
import {
  applyMove,
  BudgetError,
  fundedWrite,
  previewMove,
  READY_TO_ASSIGN,
  undoMove,
} from './budgetMoves.js';
import { ratesChanged, startBudgetIfNew } from './mainAmountService.js';
import { monthBounds } from '../utils/date.js';
import { lt } from 'drizzle-orm';

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
    goals,
    categoryTargets,
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
  expect(() => assign('fun', '2026-10', 25000)).toThrow(/Not enough Ready to assign/);
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

it('gives money back to Ready to assign, once, and the owner can assign it elsewhere once (BUD-06)', () => {
  account('cash', '2026-10-01');
  txn('cash', '2026-10-05', 100000, 'salary');
  assign('food', '2026-10', 70000);
  assign('rent', '2026-10', 30000);
  expect(rta('2026-10')).toBe(0);
  const request = { sourceId: 'food', destinationId: READY_TO_ASSIGN, amount: 1000 };
  const preview = previewMove('2026-10', request);
  // The preview names the figures a person sees: Food's available, and Ready to assign
  expect(preview).toMatchObject({
    toReady: true,
    sourceAfter: 69000,
    destinationAvailable: 0,
    destinationAfter: 1000,
  });
  // Cancel writes nothing: a preview alone changes no assignment
  expect(rta('2026-10')).toBe(0);
  const operation = applyMove('2026-10', request, preview.revision);
  expect(rta('2026-10')).toBe(1000);
  expect(available('2026-10', 'food')).toBe(69000);
  expect(available('2026-10', 'rent')).toBe(30000);
  // That $10 can be assigned once; a second $10 isn't there
  assign('fun', '2026-10', 1000);
  expect(rta('2026-10')).toBe(0);
  expect(() => assign('fun', '2026-10', 2000)).toThrow(/Not enough Ready to assign/);
  // No ledger row for the pseudo destination
  expect(
    db
      .select()
      .from(budgetMonths)
      .all()
      .map((r) => r.categoryId)
      .sort(),
  ).toEqual(['food', 'fun', 'rent']);
  // The audit trail keeps what was done, and undo is refused once the budget moved on
  expect(db.select().from(budgetMoves).get()).toMatchObject({
    destinationId: READY_TO_ASSIGN,
    amount: 1000,
  });
  expect(() => undoMove(operation.id)).toThrow(/budget changed/);
});

it('refuses giving back more than the envelope holds, a stale preview, and a future month', () => {
  account('cash', '2026-10-01');
  txn('cash', '2026-10-05', 100000, 'salary');
  assign('food', '2026-10', 5000);
  const request = { sourceId: 'food', destinationId: READY_TO_ASSIGN, amount: 5001 };
  expect(() => previewMove('2026-10', request)).toThrow(/insufficient availability/);
  expect(() => previewMove('2026-11', { ...request, amount: 100 })).toThrow(
    /current or a historical/,
  );
  // Ready to assign is a destination only
  expect(() =>
    previewMove('2026-10', { sourceId: READY_TO_ASSIGN, destinationId: 'food', amount: 100 }),
  ).toThrow(BudgetError);
  const ok = { ...request, amount: 100 };
  const { revision } = previewMove('2026-10', ok);
  assign('rent', '2026-10', 1);
  expect(() => applyMove('2026-10', ok, revision)).toThrow(/budget changed/);
  expect(available('2026-10', 'food')).toBe(5000);
});

it('reports what a move does to each funding target, and nothing when it changes none (BUD-02)', () => {
  account('cash', '2026-10-01');
  txn('cash', '2026-10-05', 100000, 'salary');
  db.insert(categoryTargets)
    .values([
      { categoryId: 'food', type: 'monthly', amount: 50000, createdMonth: '2026-10' },
      { categoryId: 'rent', type: 'monthly', amount: 40000, createdMonth: '2026-10' },
    ])
    .run();
  assign('food', '2026-10', 50000);
  assign('rent', '2026-10', 20000);
  const toRent = previewMove('2026-10', { sourceId: 'food', destinationId: 'rent', amount: 5000 });
  expect(toRent.sourceTarget).toEqual({ before: 0, after: 5000 });
  expect(toRent.destinationTarget).toEqual({ before: 20000, after: 15000 });
  // Fun has no target, and giving back money still shows what it does to Food's
  const back = previewMove('2026-10', {
    sourceId: 'food',
    destinationId: READY_TO_ASSIGN,
    amount: 2000,
  });
  expect(back.sourceTarget).toEqual({ before: 0, after: 2000 });
  expect(back.destinationTarget).toBeNull();
  const none = previewMove('2026-10', { sourceId: 'rent', destinationId: 'fun', amount: 1000 });
  expect(none.destinationTarget).toBeNull();
  // Rent was short of its target by $200; taking $10 more makes that $300 and Fun has none
  expect(none.sourceTarget).toEqual({ before: 20000, after: 21000 });
});

it('a paused goal’s target asks for nothing, so a move never reports a shortfall for it', () => {
  account('cash', '2026-09-01');
  txn('cash', '2026-09-05', 100000, 'salary'); // the money is carried into October
  db.insert(categoryTargets)
    .values({ categoryId: 'food', type: 'monthly', amount: 50000, createdMonth: '2026-10' })
    .run();
  db.insert(goals)
    .values({ id: 'g', name: 'g', targetAmount: 50000, categoryId: 'food', status: 'paused' })
    .run();
  assign('food', '2026-09', 30000);
  const preview = previewMove('2026-10', {
    sourceId: 'food',
    destinationId: READY_TO_ASSIGN,
    amount: 1000,
  });
  expect(preview.sourceTarget).toBeNull();
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
  expect(() => assign('fun', '2026-10', 1)).toThrow(/Not enough Ready to assign/);
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

// A switcher's imported history (categorised, months before the budget start) is real money
// in the accounts but never in the envelopes: it must not move Ready to Assign.
it('categorised history before the budget start leaves Ready to Assign at cash minus assigned', () => {
  db.insert(budgetSettings).values({ id: 'budget', budgetStartMonth: '2026-10' }).run();
  account('cash', '2026-06-01');
  const history = (cat: (id: string) => string | null) => {
    txn('cash', '2026-07-03', 300000, cat('salary'));
    txn('cash', '2026-08-10', -120000, cat('rent'));
    txn('cash', '2026-08-12', -45000, cat('food'));
    txn('cash', '2026-09-10', -150000, cat('rent')); // overspent in a month that has no envelopes
    txn('cash', '2026-09-20', -20000, cat('fun'));
  };
  history((id) => id);
  txn('cash', '2026-10-05', 200000, 'salary');
  const cash = 300000 - 120000 - 45000 - 150000 - 20000 + 200000;
  expect(rta('2026-10')).toBe(cash); // the accounts' cash, nothing assigned yet
  assign('food', '2026-10', 50000);
  expect(rta('2026-10')).toBe(cash - 50000);
  // The same history without categories, or with none at all, gives the same answer
  db.update(transactions)
    .set({ categoryId: null })
    .where(lt(transactions.date, '2026-10-01'))
    .run();
  expect(rta('2026-10')).toBe(cash - 50000);
  // No envelope carries a deficit out of those months
  for (const id of ['rent', 'food', 'fun'])
    expect(available('2026-10', id)).toBeGreaterThanOrEqual(0);
  const summary = budgetSummary('2026-10');
  expect(summary).toMatchObject({ envelopes: 50000, overspent: 0, uncategorized: 0 });
  // Viewing an earlier month shows its Activity read-only without touching the figures
  const before = rta('2026-10');
  budgetGroups('2026-09');
  expect(rta('2026-10')).toBe(before);
});

// What a switcher sees right after linking a bank: this month's spending sits in envelopes that
// were never assigned. By the documented rule (docs/ENVELOPE-FUNDING.md, "The overspending
// rule") that does not lower this month's Ready to Assign; it comes out of next month's, once.
it("this month's unassigned spending is cash overspending: Ready to Assign is cash plus it, then next month pays it", () => {
  db.insert(budgetSettings).values({ id: 'budget', budgetStartMonth: '2026-10' }).run();
  account('cash', '2026-06-01', 1_500_000);
  txn('cash', '2026-10-03', -400_000, 'rent');
  txn('cash', '2026-10-09', -21_110, 'food');
  const cash = 1_500_000 - 400_000 - 21_110;
  const october = budgetSummary('2026-10');
  expect(october).toMatchObject({ cashOverspent: 421_110, overspent: 421_110 });
  expect(october.toBeBudgeted).toBe(cash + 421_110);
  expect(october.resolved).toBe(false);
  vi.setSystemTime(new Date('2026-11-02T02:00:00Z'));
  expect(rta('2026-11')).toBe(cash);
});

// A fresh start mid-month (a new budget connecting its first bank): this month's spending from
// before the start is history, not overspending, so Ready to assign is exactly the cash.
it('a budget started on a day leaves earlier spending in that month out of the envelopes', () => {
  db.insert(budgetSettings)
    .values({ id: 'budget', budgetStartMonth: '2026-10', budgetStartDay: '2026-10-15' })
    .run();
  account('cash', '2026-06-01', 1_500_000);
  txn('cash', '2026-10-03', -400_000, 'rent'); // before the start: history
  txn('cash', '2026-10-09', -21_110, 'food');
  txn('cash', '2026-10-16', -5_000, 'food'); // after it: this envelope's spending
  const cash = 1_500_000 - 400_000 - 21_110 - 5_000;
  const october = budgetSummary('2026-10');
  expect(october.toBeBudgeted).toBe(cash + 5_000);
  expect(october).toMatchObject({
    overspent: 5_000,
    cashOverspent: 5_000,
    budgetStartDay: '2026-10-15',
  });
  expect(available('2026-10', 'rent')).toBe(0);
  expect(available('2026-10', 'food')).toBe(-5_000);
  // Assigning what is there covers it, and nothing is left over
  assign('food', '2026-10', 5_000);
  expect(available('2026-10', 'food')).toBe(0);
  expect(rta('2026-10')).toBe(cash);
  // Counting the whole month instead brings the earlier spending back as overspending
  db.update(budgetSettings).set({ budgetStartDay: null }).run();
  expect(budgetSummary('2026-10').overspent).toBe(400_000 + 21_110);
});

it('a new budget connecting its first bank starts today, and an existing one is left alone', () => {
  expect(startBudgetIfNew('2026-10-21')).toBe('2026-10');
  expect(budgetSummary('2026-10').budgetStartDay).toBe('2026-10-21');
  // Already started: nothing changes
  expect(startBudgetIfNew('2026-11-05')).toBeNull();
  db.delete(budgetSettings).run();
  // The first of the month is just the month
  expect(startBudgetIfNew('2026-10-01')).toBe('2026-10');
  expect(budgetSummary('2026-10').budgetStartDay).toBe('2026-10-01');
  db.delete(budgetSettings).run();
  // Money already assigned: not a new budget
  account('cash', '2026-06-01', 100_000);
  assign('food', '2026-10', 1_000);
  expect(startBudgetIfNew('2026-10-21')).toBeNull();
});
