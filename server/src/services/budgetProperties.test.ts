import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
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
  householdGroups,
  transactions,
} from '../db/schema.js';
import { budgetGroups, budgetSummary } from './budgetService.js';
import { applyAutoAssign, AUTO_ASSIGN_STRATEGIES, previewAutoAssign } from './autoAssign.js';
import { applyCardSetup, previewCardSetup } from './cardFundingSetup.js';
import {
  applyMove,
  BudgetError,
  fundedWrite,
  previewMove,
  READY_TO_ASSIGN,
  undoMove,
} from './budgetMoves.js';
import { ratesChanged } from './mainAmountService.js';
import { monthBounds } from '../utils/date.js';

// Audit F-16 (docs/AUDIT-2026-11.md): readyToAssign.test.ts recomputes the budget for one
// currency and two cash accounts. These properties widen it to internal and boundary transfers,
// splits, refunds, an unreviewed card, an envelope linked to a saver, a budget start (a month or
// a day), a household pool and an off-budget account, and check every figure against a recompute
// written from docs/ENVELOPE-FUNDING.md alone (no service code). A reviewed card is checked by its
// own invariant from docs/CARD-PAYMENTS.md. fast-check prints the seed and the shrunk scenario
// of any failure.

const TODAY = '2026-10-21';
const MONTHS = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
const CURRENT = TODAY.slice(0, 7);
const EXPENSES = ['food', 'rent', 'fun'];
/** An expense envelope linked to the saver: confirmed transfers into it count as `transferred` */
const LINKED = 'goal';
const ENVELOPES = [...EXPENSES, LINKED];
/** Personal budget accounts: the ones whose balances are resources */
const PERSONAL = ['everyday', 'saver', 'card'];
/** Outside the personal budget: a household pool and an off-budget account */
const OUTSIDE = ['pool', 'offbudget'];
const RUNS = Number(process.env.PROPERTY_RUNS ?? 60);
/** Each run rebuilds a budget in SQLite; PROPERTY_RUNS=500 searches harder */
const TIMEOUT = Math.max(60_000, RUNS * 250);

beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`));
});
afterAll(() => vi.useRealTimers());

function reset() {
  for (const table of [
    budgetHolds,
    budgetMoves,
    cardFunding,
    transactions,
    budgetMonths,
    householdGroups,
    categories,
    categoryGroups,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
  ratesChanged();
}

function baseBudget(raw: Raw) {
  reset();
  db.insert(categoryGroups)
    .values([
      { id: 'expense', name: 'Expenses' },
      { id: 'income', name: 'Income', isIncome: 1 },
    ])
    .run();
  for (const a of raw.accounts)
    db.insert(accounts)
      .values({
        id: a.id,
        name: a.id,
        type: a.id === 'card' ? 'credit' : a.id === 'saver' ? 'savings' : 'checking',
        startingBalance: a.startingBalance,
        createdAt: a.createdAt,
        isOffBudget: a.id === 'offbudget' ? 1 : 0,
      })
      .run();
  db.insert(householdGroups)
    .values({ id: 'home', name: 'Home', currency: 'AUD', accountId: 'pool' })
    .run();
  db.insert(categories)
    .values([
      ...EXPENSES.map((id) => ({
        id,
        name: id,
        groupId: 'expense',
        keepOverspending: raw.kept.includes(id) ? 1 : 0,
      })),
      {
        id: LINKED,
        name: 'Saver goal',
        groupId: 'expense',
        linkedAccountId: 'saver',
        keepOverspending: raw.kept.includes(LINKED) ? 1 : 0,
      },
      { id: 'salary', name: 'Salary', groupId: 'income' },
    ])
    .run();
  if (raw.start)
    db.insert(budgetSettings)
      .values({ id: 'budget', budgetStartMonth: raw.start.month, budgetStartDay: raw.start.day })
      .run();
  for (const t of raw.txns) db.insert(transactions).values(t).run();
  // Written directly, so scenarios include overassignment the guard would refuse today
  for (const a of raw.assigned)
    db.insert(budgetMonths)
      .values({ id: `${a.categoryId}:${a.month}`, ...a })
      .run();
  for (const h of raw.holds)
    db.insert(budgetHolds)
      .values({ ...h, createdAt: `${h.month}-01T00:00:00.000Z` })
      .run();
}

// --- Scenarios -------------------------------------------------------------------------------

type Row = typeof transactions.$inferInsert & {
  id: string;
  accountId: string;
  date: string;
  amount: number;
};
interface Raw {
  accounts: { id: string; createdAt: string; startingBalance: number }[];
  start: { month: string; day: string | null } | null;
  txns: Row[];
  assigned: { month: string; categoryId: string; budgeted: number }[];
  /** Envelopes that keep an overspent month's deficit instead of starting the next at zero */
  kept: string[];
  /** Money held in a month for the next (ACT-03), written directly like the assignments */
  holds: { month: string; amount: number }[];
}

const day = (month: string, d: number) => `${month}-${String(d).padStart(2, '0')}`;
const dateArb = fc
  .record({ m: fc.integer({ min: 0, max: 4 }), d: fc.integer({ min: 1, max: 28 }) })
  .map(({ m, d }) => day(MONTHS[m], d));
const category = fc.constantFrom<string | null>(null, 'salary', ...ENVELOPES);
const leafCategory = fc.constantFrom<string | null>(null, ...ENVELOPES);
const anyAccount = fc.constantFrom(...PERSONAL, ...OUTSIDE);
/** Mostly spending, with refunds; odd cents so rounding slips show */
const spend = fc.integer({ min: -6000, max: 1500 }).map((n) => n * 10 + 1);

const op = fc.oneof(
  fc.record({
    kind: fc.constant('plain' as const),
    account: fc.constantFrom(...PERSONAL),
    date: dateArb,
    category,
    amount: spend,
    pay: fc.integer({ min: 1, max: 8 }),
  }),
  fc.record({
    kind: fc.constant('split' as const),
    account: fc.constantFrom(...PERSONAL),
    date: dateArb,
    parts: fc.array(fc.record({ category: leafCategory, amount: spend }), {
      minLength: 2,
      maxLength: 3,
    }),
  }),
  fc.record({
    kind: fc.constant('transfer' as const),
    from: anyAccount,
    to: anyAccount,
    date: dateArb,
    amount: fc.integer({ min: 1, max: 5000 }).map((n) => n * 10 + 3),
    // Each side keeps its own; an internal transfer must ignore both
    category,
    otherCategory: category,
  }),
  fc.record({
    kind: fc.constant('outside' as const),
    account: fc.constantFrom(...OUTSIDE),
    date: dateArb,
    category,
    amount: spend,
  }),
);

const startArb = fc.oneof(
  fc.constant(null),
  fc.record({
    m: fc.integer({ min: 0, max: 3 }),
    d: fc.option(fc.integer({ min: 2, max: 20 }), { nil: null }),
  }),
);

const scenarioArb = fc
  .record({
    created: fc.array(
      fc.record({ m: fc.integer({ min: 0, max: 2 }), d: fc.integer({ min: 1, max: 28 }) }),
      { minLength: 5, maxLength: 5 },
    ),
    opening: fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 5, maxLength: 5 }),
    start: startArb,
    ops: fc.array(op, { minLength: 4, maxLength: 24 }),
    assigned: fc.array(
      fc.record({
        m: fc.integer({ min: 0, max: 5 }),
        categoryId: fc.constantFrom(...ENVELOPES),
        units: fc.integer({ min: -50, max: 400 }),
      }),
      { maxLength: 14 },
    ),
    kept: fc.subarray(ENVELOPES),
    holds: fc.array(
      fc.record({ m: fc.integer({ min: 0, max: 5 }), units: fc.integer({ min: 1, max: 300 }) }),
      { maxLength: 3 },
    ),
  })
  .map((s): Raw => {
    const ids = [...PERSONAL, ...OUTSIDE];
    const raw: Raw = {
      accounts: ids.map((id, i) => ({
        id,
        createdAt: day(MONTHS[s.created[i].m], s.created[i].d),
        // The card opens in debt; the others with cash
        startingBalance: (id === 'card' ? -10_000 : 25_000) * s.opening[i],
      })),
      start: s.start && {
        month: MONTHS[s.start.m],
        day: s.start.d === null ? null : day(MONTHS[s.start.m], s.start.d),
      },
      txns: [],
      assigned: [],
      kept: s.kept,
      holds: [],
    };
    const created = new Map(raw.accounts.map((a) => [a.id, a.createdAt]));
    // Accounts open with their first transaction, as in readyToAssign.test.ts
    const open = (account: string, date: string) => date >= created.get(account)!;
    let seq = 0;
    const id = () => `t${++seq}`;
    for (const o of s.ops) {
      if (o.kind === 'plain' || o.kind === 'outside') {
        if (!open(o.account, o.date)) continue;
        const amount = o.category === 'salary' && o.kind === 'plain' ? o.pay * 10_000 : o.amount;
        raw.txns.push({
          id: id(),
          accountId: o.account,
          date: o.date,
          amount,
          categoryId: o.category,
        });
      } else if (o.kind === 'split') {
        if (!open(o.account, o.date)) continue;
        const parent = id();
        raw.txns.push({
          id: parent,
          accountId: o.account,
          date: o.date,
          amount: o.parts.reduce((t, p) => t + p.amount, 0),
          categoryId: null,
          isParent: 1,
        });
        for (const p of o.parts)
          raw.txns.push({
            id: id(),
            accountId: o.account,
            date: o.date,
            amount: p.amount,
            categoryId: p.category,
            parentTransactionId: parent,
          });
      } else {
        if (o.from === o.to || !open(o.from, o.date) || !open(o.to, o.date)) continue;
        const out = id();
        const into = id();
        raw.txns.push(
          {
            id: out,
            accountId: o.from,
            date: o.date,
            amount: -o.amount,
            categoryId: o.category,
            transferTransactionId: into,
          },
          {
            id: into,
            accountId: o.to,
            date: o.date,
            amount: o.amount,
            categoryId: o.otherCategory,
            transferTransactionId: out,
          },
        );
      }
    }
    // Envelopes exist from the budget start; one assignment per category and month
    const assigned = new Map<string, Raw['assigned'][number]>();
    for (const a of s.assigned) {
      const month = MONTHS[a.m];
      if (raw.start && month < raw.start.month) continue;
      assigned.set(`${a.categoryId}:${month}`, {
        month,
        categoryId: a.categoryId,
        budgeted: a.units * 101,
      });
    }
    raw.assigned = [...assigned.values()];
    // One hold a month, none before the budget start
    const holds = new Map<string, number>();
    for (const h of s.holds)
      if (!raw.start || MONTHS[h.m] >= raw.start.month) holds.set(MONTHS[h.m], h.units * 101);
    raw.holds = [...holds].map(([month, amount]) => ({ month, amount }));
    return raw;
  });

// --- The recompute: docs/ENVELOPE-FUNDING.md, from the raw records alone ----------------------

const minDate = (a: string, b: string) => (a < b ? a : b);

function recompute(raw: Raw, month: string) {
  const asOf = minDate(monthBounds(month).to, TODAY);
  const startDay = raw.start ? (raw.start.day ?? `${raw.start.month}-01`) : '';
  const startMonth = startDay.slice(0, 7);
  const byId = new Map(raw.txns.map((t) => [t.id, t]));
  const personal = (accountId: string) => PERSONAL.includes(accountId);
  const counterpartAccount = (t: Row) =>
    t.transferTransactionId ? byId.get(t.transferTransactionId)!.accountId : null;

  // Resources: the personal accounts' balances (a split counts once, by its parent), received
  // by the assessment date. The pool and the off-budget account are neither cash nor debt.
  const resources = raw.accounts
    .filter((a) => personal(a.id) && a.createdAt <= asOf)
    .reduce(
      (sum, a) =>
        sum +
        a.startingBalance +
        raw.txns
          .filter((t) => t.accountId === a.id && !t.parentTransactionId && t.date <= asOf)
          .reduce((s, t) => s + t.amount, 0),
      0,
    );

  // Envelope activity: leaf rows in personal accounts, from the budget start, received. An
  // internal transfer is no activity, whatever its category; the personal side of a transfer
  // with the pool or the off-budget account is.
  const counts = (t: Row, m: string) =>
    personal(t.accountId) &&
    !t.isParent &&
    t.date.slice(0, 7) === m &&
    t.date >= startDay &&
    t.date <= TODAY;
  const activity = (c: string, m: string) =>
    raw.txns
      .filter((t) => counts(t, m) && t.categoryId === c)
      .filter((t) => {
        const other = counterpartAccount(t);
        return other === null || !personal(other);
      })
      .reduce((s, t) => s + t.amount, 0);
  // The linked envelope also counts the saver's side of a transfer with another personal account
  const transferred = (c: string, m: string) =>
    c !== LINKED
      ? 0
      : raw.txns
          .filter((t) => t.accountId === 'saver' && counts(t, m))
          .filter((t) => {
            const other = counterpartAccount(t);
            return other !== null && other !== 'saver' && personal(other);
          })
          .reduce((s, t) => s + t.amount, 0);
  const assignedIn = (c: string, m: string) =>
    raw.assigned
      .filter((a) => a.categoryId === c && a.month === m)
      .reduce((s, a) => s + a.budgeted, 0);

  // Each envelope month by month: a month that ends below zero starts the next at zero, unless
  // the envelope keeps its overspending
  const available = new Map<string, number>();
  const byMonth = new Map<string, Map<string, number>>();
  for (const c of ENVELOPES) {
    let avail = 0;
    const months = new Map<string, number>();
    for (const m of MONTHS.filter((m) => m >= startMonth && m <= month)) {
      const carriedIn = raw.kept.includes(c) ? avail : Math.max(0, avail);
      avail = carriedIn + assignedIn(c, m) + transferred(c, m) + activity(c, m);
      months.set(m, avail);
    }
    available.set(c, avail);
    byMonth.set(c, months);
  }
  // A later month than today's holds only what its envelopes hold: there a deficit can only be
  // a negative assignment, which releases no received cash. An envelope that keeps its
  // overspending also holds the cash it really overspent by today; later months can only cover
  // that, and a release after it adds nothing to it.
  const later = month > CURRENT;
  const held = (c: string) => {
    const v = available.get(c)!;
    if (!later || v >= 0) return v;
    if (!raw.kept.includes(c)) return 0;
    const months = byMonth.get(c)!;
    let cash = Math.max(0, -(months.get(CURRENT) ?? 0));
    for (const m of MONTHS.filter((m) => m > CURRENT && m < month))
      cash = Math.min(cash, Math.max(0, -(months.get(m) ?? 0)));
    return -Math.min(cash, -v);
  };
  const envelopes = ENVELOPES.reduce((s, c) => s + held(c), 0);
  const cashOverspent = ENVELOPES.reduce((s, c) => s + Math.max(0, -held(c)), 0);
  const futureAssigned = raw.assigned
    .filter((a) => a.month > month)
    .reduce((s, a) => s + Math.max(0, a.budgeted), 0);
  const pool = resources - envelopes;
  // A past month shows what it closed with; later assignments take only what it had left
  const closed = (amount: number) =>
    month < CURRENT ? Math.min(amount, Math.max(0, pool)) : amount;
  const laterDeduction = closed(futureAssigned);
  // Money held for the next month stays out of Ready to assign in the month it was held in and
  // the months before it, on top of what later months take
  const heldInOrAfter = raw.holds.filter((h) => h.month >= month).reduce((s, h) => s + h.amount, 0);
  const heldBack = closed(futureAssigned + heldInOrAfter) - laterDeduction;
  return {
    resources,
    envelopes,
    cashOverspent,
    laterDeduction,
    heldBack,
    readyToAssign: pool - laterDeduction - heldBack,
    available,
  };
}

const availableOf = (month: string) =>
  new Map(
    budgetGroups(month)
      .flatMap((g) => g.categories)
      .map((c) => [c.id, c.balance]),
  );

function figures() {
  return MONTHS.map((month) => {
    const s = budgetSummary(month);
    const groups = budgetGroups(month).flatMap((g) => g.categories);
    return {
      month,
      toBeBudgeted: s.toBeBudgeted,
      resources: s.resources,
      envelopes: s.envelopes,
      overspent: s.overspent,
      income: s.income,
      categories: groups.map((c) => ({ id: c.id, balance: c.balance, activity: c.activity })),
    };
  });
}

describe('budget properties (audit F-16)', () => {
  beforeEach(reset);

  it(
    'every figure equals a recompute from the raw records, with transfers, splits, a pool and a budget start',
    () => {
      fc.assert(
        fc.property(scenarioArb, (raw) => {
          baseBudget(raw);
          for (const month of MONTHS) {
            const expected = recompute(raw, month);
            const summary = budgetSummary(month);
            const label = month;
            expect(summary.resources, `${label} resources`).toBe(expected.resources);
            expect(summary.envelopes, `${label} envelopes`).toBe(expected.envelopes);
            expect(summary.laterDeduction, `${label} later`).toBe(expected.laterDeduction);
            expect(summary.held, `${label} held back`).toBe(expected.heldBack);
            expect(summary.toBeBudgeted, `${label} ready to assign`).toBe(expected.readyToAssign);
            // No reviewed card: every deficit is cash overspending
            expect(summary.cashOverspent, `${label} cash overspent`).toBe(expected.cashOverspent);
            // `overspent` is today's overspending: a later month reports the current month's
            expect(summary.overspent, `${label} overspent`).toBe(
              recompute(raw, month > CURRENT ? CURRENT : month).cashOverspent,
            );
            const actual = availableOf(month);
            for (const c of ENVELOPES)
              expect(actual.get(c), `${label} ${c}`).toBe(expected.available.get(c));
            // Conservation: every dollar is in an envelope, taken by a later month, held for the
            // next month, or ready to assign
            expect(
              summary.toBeBudgeted + summary.envelopes + summary.laterDeduction + summary.held,
            ).toBe(summary.resources);
            for (const [key, value] of Object.entries(summary))
              if (typeof value === 'number')
                expect(Number.isSafeInteger(value), `${label} ${key}`).toBe(true);
          }
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'holding money for the next month only moves Ready to assign between months (ACT-03)',
    () => {
      fc.assert(
        fc.property(scenarioArb, (raw) => {
          baseBudget(raw);
          const withHolds = MONTHS.map((month) => budgetSummary(month));
          db.delete(budgetHolds).run();
          MONTHS.forEach((month, i) => {
            const held = withHolds[i];
            const none = budgetSummary(month);
            const heldAfter = raw.holds
              .filter((h) => h.month >= month)
              .reduce((s, h) => s + h.amount, 0);
            // A hold never touches an envelope or the money in the accounts...
            expect(held.resources, `${month} resources`).toBe(none.resources);
            expect(held.envelopes, `${month} envelopes`).toBe(none.envelopes);
            expect(held.laterDeduction, `${month} later`).toBe(none.laterDeduction);
            // ...it only takes Ready to assign, never more than was held or more than there was
            expect(none.toBeBudgeted - held.toBeBudgeted, `${month} moved`).toBe(held.held);
            expect(held.held, `${month} held`).toBeGreaterThanOrEqual(0);
            expect(held.held, `${month} within holds`).toBeLessThanOrEqual(heldAfter);
            // A month after the last hold is released and unchanged
            if (!heldAfter) expect(held.toBeBudgeted, `${month} released`).toBe(none.toBeBudgeted);
            expect(held.holdAmount, `${month} hold`).toBe(
              raw.holds.find((h) => h.month === month)?.amount ?? 0,
            );
          });
        }),
        { numRuns: Math.ceil(RUNS / 2) },
      );
    },
    TIMEOUT,
  );

  it(
    'a quick fill changes only the chosen envelopes, by exactly what was previewed (ACT-05, BUD-07)',
    () => {
      fc.assert(
        fc.property(
          scenarioArb,
          fc.constantFrom(...AUTO_ASSIGN_STRATEGIES),
          fc.constantFrom('add' as const, 'replace' as const),
          fc.constantFrom(3 as const, 6 as const, 12 as const),
          fc.option(fc.subarray(ENVELOPES), { nil: undefined }),
          (raw, strategy, mode, months, categoryIds) => {
            baseBudget(raw);
            const options = { strategy, mode, months, categoryIds };
            const rows = () =>
              new Map(
                db
                  .select()
                  .from(budgetMonths)
                  .all()
                  .map((r) => [`${r.month}|${r.categoryId}`, r.budgeted]),
              );
            const before = rows();
            const plan = previewAutoAssign(CURRENT, options, TODAY);
            // Only chosen envelopes; add mode never lowers; lowering stops at zero
            for (const r of plan.rows) {
              if (categoryIds) expect(categoryIds).toContain(r.categoryId);
              if (plan.mode === 'add') expect(r.proposed).toBeGreaterThanOrEqual(0);
              if (strategy === 'zero') expect(r.proposed, r.categoryId).toBeLessThan(0);
              if (r.proposed < 0)
                expect(r.assigned + r.proposed, r.categoryId).toBeGreaterThanOrEqual(0);
            }
            // Additions are capped at what was ready to assign plus what was taken back
            const added = plan.rows.reduce((s, r) => s + Math.max(0, r.proposed), 0);
            const freed = plan.rows.reduce((s, r) => s - Math.min(0, r.proposed), 0);
            expect(added).toBeLessThanOrEqual(Math.max(0, plan.available) + freed);
            expect(plan.total).toBe(added - freed);
            try {
              applyAutoAssign(CURRENT, options, plan.revision, plan.rows, fundedWrite);
            } catch (error) {
              // The funded-write guard refuses a plan that would leave a month short; nothing changes
              if (!(error instanceof BudgetError)) throw error;
              expect(rows()).toEqual(before);
              return;
            }
            const after = rows();
            const changed = new Map(
              plan.rows.map((r) => [`${CURRENT}|${r.categoryId}`, r.proposed]),
            );
            for (const key of new Set([...before.keys(), ...after.keys()]))
              expect((after.get(key) ?? 0) - (before.get(key) ?? 0), key).toBe(
                changed.get(key) ?? 0,
              );
          },
        ),
        { numRuns: Math.ceil(RUNS / 2) },
      );
    },
    TIMEOUT,
  );

  it(
    'giving money back to Ready to assign raises it by exactly that amount and undoes cleanly (BUD-06)',
    () => {
      fc.assert(
        fc.property(
          scenarioArb,
          fc.constantFrom(...ENVELOPES),
          fc.double({ min: 0, max: 1, noNaN: true }),
          (raw, source, share) => {
            baseBudget(raw);
            const balances = () =>
              new Map(
                budgetGroups(CURRENT)
                  .flatMap((g) => g.categories)
                  .map((c) => [c.id, c.balance] as const),
              );
            // A $0 assignment and no row mean the same: undo writes the old value back, so a
            // month that had no row for the envelope can end with one at $0
            const rows = () =>
              new Map(
                db
                  .select()
                  .from(budgetMonths)
                  .all()
                  .filter((r) => r.budgeted !== 0)
                  .map((r) => [`${r.month}|${r.categoryId}`, r.budgeted]),
              );
            const held = balances().get(source) ?? 0;
            const amount = Math.floor(held * share);
            if (amount <= 0) return;
            const request = { sourceId: source, destinationId: READY_TO_ASSIGN, amount };
            const beforeRows = rows();
            const beforeBalances = balances();
            const before = budgetSummary(CURRENT);
            let operation;
            try {
              operation = applyMove(CURRENT, request, previewMove(CURRENT, request).revision);
            } catch (error) {
              // Refused (rates missing, an earlier month short of the money): nothing changes
              if (!(error instanceof BudgetError)) throw error;
              expect(rows()).toEqual(beforeRows);
              return;
            }
            const after = budgetSummary(CURRENT);
            expect(after.toBeBudgeted - before.toBeBudgeted, 'Ready to assign').toBe(amount);
            expect(after.resources).toBe(before.resources);
            for (const [id, balance] of balances())
              expect(balance, id).toBe(
                (beforeBalances.get(id) ?? 0) - (id === source ? amount : 0),
              );
            undoMove(operation.id);
            expect(rows()).toEqual(beforeRows);
            expect(budgetSummary(CURRENT).toBeBudgeted).toBe(before.toBeBudgeted);
          },
        ),
        { numRuns: Math.ceil(RUNS / 2) },
      );
    },
    TIMEOUT,
  );

  it(
    'an internal transfer between unlinked accounts changes no budget figure, income or spending',
    () => {
      fc.assert(
        fc.property(
          scenarioArb,
          fc.constantFrom<[string, string]>(['everyday', 'card'], ['card', 'everyday']),
          dateArb,
          fc.integer({ min: 1, max: 900_000 }),
          category,
          (raw, [from, to], date, amount, categoryId) => {
            baseBudget(raw);
            const before = figures();
            // Both accounts exist from the first scenario month, whatever the scenario chose
            db.update(accounts).set({ createdAt: '2026-06-01' }).run();
            const opened = figures();
            db.insert(transactions)
              .values([
                {
                  id: 'move-out',
                  accountId: from,
                  date,
                  amount: -amount,
                  categoryId,
                  transferTransactionId: 'move-in',
                },
                {
                  id: 'move-in',
                  accountId: to,
                  date,
                  amount,
                  categoryId,
                  transferTransactionId: 'move-out',
                },
              ])
              .run();
            expect(figures()).toEqual(opened);
            // Opening dates only move opening funds, never activity or income
            expect(opened.map((m) => m.categories)).toEqual(before.map((m) => m.categories));
            expect(opened.map((m) => m.income)).toEqual(before.map((m) => m.income));
          },
        ),
        { numRuns: Math.ceil(RUNS / 2) },
      );
    },
    TIMEOUT,
  );

  it(
    'money spent inside the household pool or an off-budget account changes no budget figure',
    () => {
      fc.assert(
        fc.property(
          scenarioArb,
          fc.array(
            fc.record({
              account: fc.constantFrom(...OUTSIDE),
              date: dateArb,
              category,
              amount: spend,
            }),
            {
              minLength: 1,
              maxLength: 6,
            },
          ),
          (raw, extra) => {
            baseBudget(raw);
            db.update(accounts).set({ createdAt: '2026-06-01' }).run();
            const before = figures();
            db.insert(transactions)
              .values(
                extra.map((e, i) => ({
                  id: `outside-${i}`,
                  accountId: e.account,
                  date: e.date,
                  amount: e.amount,
                  categoryId: e.category,
                })),
              )
              .run();
            expect(figures()).toEqual(before);
          },
        ),
        { numRuns: Math.ceil(RUNS / 2) },
      );
    },
    TIMEOUT,
  );
});

// --- A reviewed card: docs/CARD-PAYMENTS.md ---------------------------------------------------

describe('reviewed card properties (audit F-16)', () => {
  beforeEach(() => {
    reset();
    db.insert(categoryGroups)
      .values([
        { id: 'expense', name: 'Expenses' },
        { id: 'income', name: 'Income', isIncome: 1 },
      ])
      .run();
    db.insert(categories)
      .values([
        ...EXPENSES.map((id) => ({ id, name: id, groupId: 'expense', budgetType: 'flexible' })),
        { id: 'salary', name: 'Salary', groupId: 'income' },
      ])
      .run();
    db.insert(accounts)
      .values([
        { id: 'everyday', name: 'Everyday', type: 'checking', createdAt: '2026-09-01' },
        { id: 'card', name: 'Card', type: 'credit', createdAt: '2026-09-01' },
      ])
      .run();
  });

  it(
    'a funded card purchase and its payment never change Ready to Assign, and the identity holds throughout',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }).map((n) => n * 1_000),
          fc.array(
            fc.record({
              categoryId: fc.constantFrom(...EXPENSES),
              assigned: fc.integer({ min: 0, max: 500 }).map((n) => n * 101),
              spent: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 1, maxLength: 3 },
          ),
          fc.integer({ min: 0, max: 100 }),
          (debt, lines, paidPercent) => {
            db.delete(budgetMoves).run();
            db.delete(cardFunding).run();
            db.delete(transactions).run();
            db.delete(budgetMonths).run();
            db.delete(categories).run();
            db.insert(categories)
              .values([
                ...EXPENSES.map((id) => ({
                  id,
                  name: id,
                  groupId: 'expense',
                  budgetType: 'flexible',
                })),
                { id: 'salary', name: 'Salary', groupId: 'income' },
              ])
              .run();
            db.insert(transactions)
              .values([
                {
                  id: 'pay-in',
                  accountId: 'everyday',
                  date: '2026-10-01',
                  amount: 900_000,
                  categoryId: 'salary',
                },
                {
                  id: 'old-debt',
                  accountId: 'card',
                  date: '2026-09-15',
                  amount: -debt,
                  categoryId: 'fun',
                },
              ])
              .run();
            // Review the card with its existing debt left unfunded (the owner's explicit choice)
            applyCardSetup('card', 0, previewCardSetup('card', 0).revision);
            const assigned = new Map<string, number>();
            for (const l of lines) assigned.set(l.categoryId, l.assigned);
            for (const [categoryId, budgeted] of assigned)
              db.insert(budgetMonths)
                .values({ id: `${categoryId}:2026-10`, month: '2026-10', categoryId, budgeted })
                .run();
            const identity = () => {
              const s = budgetSummary(CURRENT);
              expect(s.toBeBudgeted + s.envelopes + s.laterDeduction).toBe(s.resources);
              return s;
            };
            const start = identity();
            const available = availableOf(CURRENT);

            // Purchases within what each envelope holds are funded: Ready to Assign stays
            let funded = 0;
            for (const [i, l] of lines.entries()) {
              const room = Math.max(0, available.get(l.categoryId)!);
              const amount = Math.floor((room * l.spent) / 100);
              if (amount === 0) continue;
              available.set(l.categoryId, room - amount);
              funded += amount;
              db.insert(transactions)
                .values({
                  id: `buy-${i}`,
                  accountId: 'card',
                  date: TODAY,
                  amount: -amount,
                  categoryId: l.categoryId,
                })
                .run();
            }
            const bought = identity();
            expect(bought.toBeBudgeted).toBe(start.toBeBudgeted);
            expect(bought.overspent).toBe(start.overspent);
            const reserve = budgetGroups(CURRENT)
              .flatMap((g) => g.categories)
              .filter((c) => c.paymentAccountId === 'card')
              .reduce((s, c) => s + c.balance, 0);
            expect(reserve).toBe(funded);

            // Paying part of the reserve from cash is an internal transfer: Ready to Assign stays
            const paid = Math.floor((funded * paidPercent) / 100);
            if (paid > 0)
              db.insert(transactions)
                .values([
                  {
                    id: 'pay-out',
                    accountId: 'everyday',
                    date: TODAY,
                    amount: -paid,
                    transferTransactionId: 'pay-card',
                  },
                  {
                    id: 'pay-card',
                    accountId: 'card',
                    date: TODAY,
                    amount: paid,
                    transferTransactionId: 'pay-out',
                  },
                ])
                .run();
            const after = identity();
            expect(after.toBeBudgeted).toBe(start.toBeBudgeted);
            expect(after.uncoveredCardPayments).toBe(0);
          },
        ),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );
});
