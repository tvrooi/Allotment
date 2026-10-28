import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { and, eq, gte, lte, lt, sql } from 'drizzle-orm';
import { db, sqlite } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  budgetSettings,
  cardFunding,
  categories,
  categoryGroups,
  exchangeRates,
  householdGroups,
  householdPoolAccounts,
  transactions,
} from '../db/schema.js';
import {
  LIQUID_ACCOUNT_TYPES,
  budgetGroups,
  budgetSummary,
  clearBudgetCache,
  fundingRevision,
  fundingState,
  receivedActivity,
  rollOver,
} from './budgetService.js';
import { BudgetError, fundedWrite } from './budgetMoves.js';
import { calculateCardFunding } from './cardFunding.js';
import {
  budgetStartDate,
  inAccountBalance,
  mainAmount,
  personalBudgetAccount,
} from './balances.js';
import { convertAmount, currencyContext, ratesChanged, todayIso } from './mainAmountService.js';
import { monthBounds } from '../utils/date.js';

// The budget engine computes every month's envelopes in one pass and keeps the result until
// the budget changes. These tests hold that to the previous engine, which rebuilt each month
// from SQL: the same figures on generated budgets, the same accept/reject decisions from the
// assignment guard, and a cache that never serves state from before a write.

// --- The previous engine, kept verbatim as the oracle ------------------------------------

function rawBudgetGroups(month: string, today = todayIso()) {
  const { from, to: end } = monthBounds(month);
  const to = end < today ? end : today;
  const startMonth = budgetStartDate().slice(0, 7);

  const groups = db.select().from(categoryGroups).orderBy(categoryGroups.sortOrder).all();
  const cats = db.select().from(categories).orderBy(categories.sortOrder).all();
  // Before the budget start a month shows no assignments, like its activity
  const budgeted =
    month < startMonth
      ? []
      : db.select().from(budgetMonths).where(eq(budgetMonths.month, month)).all();

  const spentRows = db
    .select({
      categoryId: transactions.categoryId,
      spent: sql<number>`coalesce(sum(${mainAmount}), 0)`,
    })
    .from(transactions)
    .where(and(gte(transactions.date, from), lte(transactions.date, to), receivedActivity))
    .groupBy(transactions.categoryId)
    .all();

  // Earlier months, one net change (assigned + activity) per category and month
  const priorBudgetedRows = db
    .select({
      categoryId: budgetMonths.categoryId,
      month: budgetMonths.month,
      total: sql<number>`coalesce(sum(${budgetMonths.budgeted}), 0)`,
    })
    .from(budgetMonths)
    .where(and(lt(budgetMonths.month, month), gte(budgetMonths.month, startMonth)))
    .groupBy(budgetMonths.categoryId, budgetMonths.month)
    .all();

  const priorActivityRows = db
    .select({
      categoryId: transactions.categoryId,
      month: sql<string>`substr(${transactions.date}, 1, 7)`,
      total: sql<number>`coalesce(sum(${mainAmount}), 0)`,
    })
    .from(transactions)
    .where(and(lt(transactions.date, from), lte(transactions.date, today), receivedActivity))
    .groupBy(transactions.categoryId, sql`substr(${transactions.date}, 1, 7)`)
    .all();

  const spentMap = Object.fromEntries(spentRows.map((r) => [r.categoryId, r.spent]));
  const budgetMap = Object.fromEntries(budgeted.map((b) => [b.categoryId, b]));
  const history = new Map<string, Map<string, number>>();
  for (const r of [...priorBudgetedRows, ...priorActivityRows]) {
    if (!r.categoryId) continue;
    const months = history.get(r.categoryId) ?? new Map<string, number>();
    months.set(r.month, (months.get(r.month) ?? 0) + r.total);
    history.set(r.categoryId, months);
  }
  const incomeGroups = new Set(groups.filter((g) => g.isIncome).map((g) => g.id));
  const paymentIds = new Set(
    db
      .select()
      .from(cardFunding)
      .all()
      .map((m) => m.categoryId),
  );

  const result = groups.map((g) => ({
    ...g,
    categories: cats
      .filter((c) => c.groupId === g.id)
      .map((c) => {
        const bm = budgetMap[c.id];
        const budgetedAmt = bm?.budgeted ?? 0;
        const activity = spentMap[c.id] ?? 0;
        const months = history.get(c.id) ?? new Map<string, number>();
        const resets = !incomeGroups.has(c.groupId) && !paymentIds.has(c.id);
        const carryOver = rollOver(months, resets);
        return {
          ...c,
          budgeted: budgetedAmt,
          activity,
          spent: Math.abs(Math.min(activity, 0)),
          carryOver,
          balance: carryOver + budgetedAmt + activity,
          history: months,
          resets,
        };
      }),
  }));

  return result;
}

function assessment(month: string, today = todayIso()) {
  const end = monthBounds(month).to;
  const asOf = end < today ? end : today;
  const raw = rawBudgetGroups(month, today);
  const current = month === asOf.slice(0, 7) ? raw : rawBudgetGroups(asOf.slice(0, 7), asOf);
  const card = calculateCardFunding(
    asOf,
    // Month by month, so funding follows the same monthly reset as the envelopes
    current
      .filter((g) => !g.isIncome)
      .flatMap((g) => g.categories)
      .map((c) => ({
        id: c.id,
        balance: c.balance,
        months: new Map(c.history).set(asOf.slice(0, 7), c.budgeted + c.activity),
      })),
  );
  const paymentAccounts = new Map(
    db
      .select()
      .from(cardFunding)
      .all()
      .map((m) => [m.categoryId, m.accountId]),
  );
  const groups = raw.map((g) => ({
    ...g,
    categories: g.categories.map((c) => {
      const { history, resets, ...category } = c;
      const changes = card.adjustments.filter((a) => a.categoryId === c.id);
      const months = new Map(history);
      for (const a of changes.filter((a) => a.date.slice(0, 7) < month))
        months.set(a.date.slice(0, 7), (months.get(a.date.slice(0, 7)) ?? 0) + a.amount);
      const carryOver = changes.some((a) => a.date.slice(0, 7) < month)
        ? rollOver(months, resets)
        : c.carryOver;
      const activity = changes
        .filter((a) => a.date.slice(0, 7) === month)
        .reduce((s, a) => s + a.amount, 0);
      return {
        ...category,
        carryOver,
        activity: c.activity + activity,
        balance: carryOver + c.budgeted + c.activity + activity,
        paymentAccountId: paymentAccounts.get(c.id) ?? null,
      };
    }),
  }));
  return { groups, card };
}
export function legacyBudgetGroups(month: string, today = todayIso()) {
  return assessment(month, today).groups;
}
export function legacyFundingState(asOf = todayIso(), month = asOf.slice(0, 7)) {
  const asOfMonth = asOf.slice(0, 7);
  const { groups, card } = assessment(asOfMonth, asOf);
  const enrolledCards = new Set(card.positions.map((p) => p.accountId));
  const cats = groups.filter((g) => !g.isIncome).flatMap((g) => g.categories);
  const balances = new Map(cats.map((c) => [c.id, c.balance]));
  const expenseIds = new Set(cats.map((c) => c.id));
  const viewMonth = month > asOfMonth ? month : asOfMonth;
  const viewed =
    viewMonth === asOfMonth
      ? cats
      : assessment(viewMonth, asOf)
          .groups.filter((g) => !g.isIncome)
          .flatMap((g) => g.categories);
  const futureAssigned = db
    .select()
    .from(budgetMonths)
    .all()
    .filter((r) => r.month > viewMonth && expenseIds.has(r.categoryId))
    .reduce((s, r) => s + Math.max(0, r.budgeted), 0);
  const reserved = viewed.reduce((s, c) => s + Math.max(0, c.balance), 0) + futureAssigned;
  // What each envelope holds of the accounts' money. A deficit is cash already spent, except
  // the part unfunded card purchases explain: that is card debt, outside resources. In a later
  // month only a negative assignment can leave a deficit, and a release is not received cash.
  const credit = (c: (typeof cats)[number]) =>
    Math.min(Math.max(0, -c.balance), card.unfunded.get(c.id) ?? 0);
  const held = (c: (typeof cats)[number]) =>
    c.paymentAccountId || viewMonth > asOfMonth ? Math.max(0, c.balance) : c.balance + credit(c);
  const envelopes = viewed.reduce((s, c) => s + held(c), 0);
  const cashOverspent = viewed.reduce((s, c) => s + Math.max(0, -held(c)), 0);
  const ctx = currencyContext();
  let resources = 0;
  let openingFunds = 0;
  let complete = card.complete;
  for (const account of db.select().from(accounts).where(personalBudgetAccount).all()) {
    const liquid = LIQUID_ACCOUNT_TYPES.includes(account.type);
    const rows = db
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, account.id), inAccountBalance))
      .all();
    const effective = rows.reduce(
      (d, r) => (r.date < d ? r.date : d),
      account.createdAt.slice(0, 10),
    );
    if (effective > asOf) continue;
    const eligible = rows.filter(
      (r) =>
        r.date <= asOf && !(r.amount > 0 && r.importedId?.startsWith('schedule:') && !r.reconciled),
    );
    const value = convertAmount(
      account.startingBalance + eligible.reduce((s, r) => s + r.amount, 0),
      account.currency ?? ctx.budget,
      ctx.budget,
      asOf,
      ctx,
    );
    const opening =
      account.startingBalance === 0
        ? 0
        : convertAmount(
            account.startingBalance,
            account.currency ?? ctx.budget,
            ctx.budget,
            effective,
            ctx,
          );
    if (value === null || opening === null) complete = false;
    else {
      resources += enrolledCards.has(account.id)
        ? Math.max(0, value)
        : liquid
          ? value
          : Math.min(0, value);
      openingFunds += enrolledCards.has(account.id)
        ? Math.max(0, opening)
        : liquid
          ? opening
          : Math.min(0, opening);
    }
  }
  const activity = db
    .select({
      categoryId: transactions.categoryId,
      amount: mainAmount,
      missing: transactions.mainAmountSource,
    })
    .from(transactions)
    .where(and(receivedActivity, lte(transactions.date, asOf)))
    .all();
  if (activity.some((r) => r.missing === 'missing')) complete = false;
  const uncategorized = activity
    .filter((r) => !r.categoryId && r.amount < 0)
    .reduce((s, r) => s - r.amount, 0);
  const overspent = cats
    .filter((c) => !c.paymentAccountId)
    .reduce((s, c) => s + Math.max(0, -c.balance), 0);
  // Before later months' assignments: a past month's own closing position, which the
  // assignment guard checks (budgetMoves.ts fundedWrite)
  const unassignedBeforeLater = resources - envelopes;
  const past = asOfMonth < todayIso().slice(0, 7);
  const laterDeduction = past
    ? Math.min(futureAssigned, Math.max(0, unassignedBeforeLater))
    : futureAssigned;
  const unassigned = unassignedBeforeLater - laterDeduction;
  return {
    balances,
    cards: card.positions,
    paymentShortfall: card.positions.reduce((s, p) => s + p.shortfall, 0),
    uncoveredCardPayments: card.positions.reduce((s, p) => s + p.uncoveredPayments, 0),
    asOf,
    resources,
    openingFunds,
    reserved,
    envelopes,
    cashOverspent,
    futureAssigned,
    laterDeduction,
    uncategorized,
    overspent,
    complete,
    unassignedBeforeLater,
    unassigned,
    available: complete ? Math.max(0, unassigned) : 0,
    revision: fundingRevision(),
    resolved:
      complete &&
      uncategorized === 0 &&
      overspent === 0 &&
      unassigned >= 0 &&
      card.positions.every((p) => p.shortfall === 0 && p.uncoveredPayments === 0),
  };
}

export function legacyBudgetSummary(month: string, today = todayIso()) {
  const end = monthBounds(month).to;
  const asOf = end < today ? end : today;
  const state = legacyFundingState(asOf, month);
  const groups = legacyBudgetGroups(month, today);
  const income = groups
    .filter((g) => g.isIncome)
    .flatMap((g) => g.categories)
    .reduce((s, c) => s + c.activity, 0);
  const totalBudgeted = groups
    .filter((g) => !g.isIncome)
    .flatMap((g) => g.categories)
    .reduce((s, c) => s + c.budgeted, 0);
  const { balances, ...summary } = state;
  return {
    ...summary,
    month,
    income,
    totalBudgeted,
    carryOver: state.openingFunds,
    toBeBudgeted: state.unassigned,
    budgetStartMonth: budgetStartDate().slice(0, 7) || null,
  };
}

/** The previous assignment guard (budgetMoves.ts fundedWrite), reading the previous engine.
 * Returns the refusal message, or null when the write is accepted. */
function legacyVerdict(action: () => void): string | null {
  type Row = typeof budgetMonths.$inferSelect;
  const rows = () =>
    new Map(
      db
        .select()
        .from(budgetMonths)
        .all()
        .map((r) => [`${r.month}|${r.categoryId}`, r] as const),
    );
  const restore = (keys: string[], source: Map<string, Row>) => {
    for (const key of keys) {
      const [month, categoryId] = key.split('|');
      db.delete(budgetMonths)
        .where(and(eq(budgetMonths.month, month), eq(budgetMonths.categoryId, categoryId)))
        .run();
      const row = source.get(key);
      if (row) db.insert(budgetMonths).values(row).run();
    }
  };
  const monthAfter = (m: string) => {
    const i = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
  };
  const assignable = (months: string[], today: string) => {
    const current = today.slice(0, 7);
    const result: { month: string; value: number; complete: boolean }[] = [];
    let deferred = 0;
    for (const m of months) {
      const end = monthBounds(m).to;
      const state = legacyFundingState(end < today ? end : today, m);
      result.push({
        month: m,
        value:
          deferred +
          (m < current
            ? state.unassignedBeforeLater
            : state.unassignedBeforeLater - state.futureAssigned),
        complete: state.complete,
      });
      deferred += state.cashOverspent;
    }
    return result;
  };
  const before = rows();
  action();
  const after = rows();
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
    (k) => before.get(k)?.budgeted !== after.get(k)?.budgeted,
  );
  if (!changed.length) return null;
  const today = todayIso();
  const current = today.slice(0, 7);
  const first = changed.map((k) => k.slice(0, 7)).reduce((a, b) => (b < a ? b : a));
  const months = new Set<string>();
  for (let m = first; m < current; m = monthAfter(m)) months.add(m);
  months.add(current).add(monthAfter(current));
  for (const k of [...before.keys(), ...after.keys()])
    if (k.slice(0, 7) > current) months.add(k.slice(0, 7));
  const checked = [...months].sort();
  const now = assignable(checked, today);
  if (now.every((p) => p.complete && p.value >= 0)) return null;
  restore(changed, before);
  const was = assignable(checked, today);
  restore(changed, after);
  const worse = now.find((p, i) => p.value < was[i].value && (!p.complete || p.value < 0));
  if (!worse) return null;
  return worse.complete
    ? worse.month < current
      ? `Not enough money had arrived by the end of ${worse.month}. Assign it in a later month, or move existing money.`
      : 'Insufficient unassigned money. Reduce an assignment or move existing money.'
    : 'Add missing exchange rates before assigning money.';
}

// --- Generated budgets --------------------------------------------------------------------

const TODAY = '2026-10-21';
const MONTHS = [
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
  '2026-11',
  '2026-12',
  '2027-02',
];

beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`));
  clearAll();
});

function clearAll() {
  for (const table of [
    cardFunding,
    householdPoolAccounts,
    householdGroups,
    transactions,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
    exchangeRates,
    budgetSettings,
  ])
    db.delete(table).run();
  ratesChanged();
}

/** A small deterministic generator, so a failure names a reproducible seed */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const day = (month: string, d: number) => `${month}-${String(d).padStart(2, '0')}`;

/**
 * A budget with what the engine has to get right: several account kinds (one in another
 * currency, one off budget, sometimes a household one), a card with funding, income, splits,
 * transfers, generated and reconciled schedule rows, rows with a missing rate, future-dated
 * rows, assignments before the budget start and in months with no activity.
 */
function generate(seed: number) {
  const rand = prng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T>(items: T[]) => items[int(0, items.length - 1)];
  const months = MONTHS.slice(0, 9);
  let n = 0;
  db.insert(budgetSettings)
    .values({
      id: 'budget',
      currency: 'AUD',
      budgetStartMonth: pick([null, null, '2026-07', '2026-09']),
    })
    .run();
  const foreign = rand() < 0.5;
  if (foreign)
    for (const m of months.slice(0, int(1, 7)))
      db.insert(exchangeRates)
        .values({
          id: `r${n++}`,
          date: day(m, 1),
          base: 'EUR',
          quote: 'AUD',
          rate: '1.6',
          source: 'manual',
        })
        .run();
  ratesChanged();
  const created = () => day(pick(months.slice(0, 5)), int(1, 28));
  db.insert(accounts)
    .values([
      {
        id: 'a1',
        name: 'a1',
        type: 'checking',
        startingBalance: int(0, 4) * 50000,
        createdAt: created(),
      },
      {
        id: 'a2',
        name: 'a2',
        type: 'savings',
        startingBalance: int(0, 2) * 30000,
        createdAt: created(),
      },
      {
        id: 'a3',
        name: 'a3',
        type: 'credit',
        startingBalance: -int(0, 2) * 20000,
        createdAt: created(),
      },
      {
        id: 'a4',
        name: 'a4',
        type: 'checking',
        startingBalance: int(0, 2) * 10000,
        createdAt: created(),
        currency: foreign ? 'EUR' : null,
      },
      {
        id: 'a5',
        name: 'a5',
        type: 'investment',
        startingBalance: 12345,
        createdAt: created(),
        isOffBudget: 1,
      },
      {
        id: 'a7',
        name: 'a7',
        type: 'credit',
        startingBalance: -int(0, 2) * 15000,
        createdAt: created(),
        currency: foreign && rand() < 0.5 ? 'EUR' : null,
      },
      {
        id: 'a6',
        name: 'a6',
        type: 'asset',
        startingBalance: int(0, 1) * 7000,
        createdAt: created(),
      },
    ])
    .run();
  if (rand() < 0.25) {
    db.insert(householdGroups)
      .values({ id: 'h1', name: 'h', currency: 'AUD', accountId: 'a6' })
      .run();
    if (rand() < 0.5) {
      db.insert(householdGroups).values({ id: 'h2', name: 'p', currency: 'AUD' }).run();
      db.insert(householdPoolAccounts).values({ groupId: 'h2', accountId: 'a2' }).run();
    }
  }
  db.insert(categoryGroups)
    .values([
      { id: 'g1', name: 'g1', sortOrder: 2 },
      { id: 'g2', name: 'g2', sortOrder: 1 },
      { id: 'gi', name: 'income', isIncome: 1, sortOrder: 3 },
    ])
    .run();
  const expenses = ['e1', 'e2', 'e3', 'e4', 'e5'];
  db.insert(categories)
    .values([
      ...expenses.map((id, i) => ({ id, name: id, groupId: i % 2 ? 'g1' : 'g2', sortOrder: i })),
      { id: 'pay', name: 'pay', groupId: 'g1', sortOrder: 9 },
      { id: 'pay2', name: 'pay2', groupId: 'g1', sortOrder: 9 },
      { id: 'inc', name: 'inc', groupId: 'gi', sortOrder: 0 },
    ])
    .run();
  const accountIds = ['a1', 'a1', 'a2', 'a3', 'a3', 'a3', 'a4', 'a6', 'a7', 'a7'];
  const cats = [...expenses, 'inc', null, null];
  for (let i = 0; i < 90; i++) {
    const accountId = pick(accountIds);
    const date = day(pick(MONTHS), int(1, 28));
    const categoryId = pick(cats);
    const kind = rand();
    const amount =
      categoryId === 'inc' ? int(1, 9) * 20000 : kind < 0.15 ? int(1, 9) * 1500 : -int(1, 90) * 100;
    const row = {
      id: `t${n++}`,
      accountId,
      date,
      amount,
      categoryId,
      importedId:
        kind > 0.9 ? pick(['schedule:a', 'SCHEDULE:b', 'bank:c']) + n : (null as string | null),
      reconciled: int(0, 1),
      mainAmount: null as number | null,
      mainAmountSource: null as string | null,
    };
    if ((accountId === 'a4' || accountId === 'a7') && foreign) {
      const missing = rand() < 0.15;
      row.mainAmount = missing ? null : Math.round(amount * 1.6);
      row.mainAmountSource = missing ? 'missing' : 'rate';
    }
    db.insert(transactions).values(row).run();
  }
  // Splits: the parent holds the whole, its parts hold the categories
  for (let i = 0; i < 6; i++) {
    const accountId = pick(['a1', 'a3', 'a7']);
    const date = day(pick(MONTHS), int(1, 28));
    const parts = [-int(1, 40) * 100, -int(1, 40) * 100, int(0, 1) * 500];
    const parent = `t${n++}`;
    db.insert(transactions)
      .values({ id: parent, accountId, date, amount: parts.reduce((a, b) => a + b), isParent: 1 })
      .run();
    for (const amount of parts)
      db.insert(transactions)
        .values({
          id: `t${n++}`,
          accountId,
          date,
          amount,
          categoryId: pick(expenses),
          parentTransactionId: parent,
        })
        .run();
  }
  // Transfers: a card payment, a payment to a household account and one across the boundary
  for (const [from, to] of [
    ['a3', 'a7'],
    ['a1', 'a7'],
    ['a1', 'a3'],
    ['a1', 'a3'],
    ['a2', 'a1'],
    ['a1', 'a5'],
    ['a6', 'a1'],
  ]) {
    const date = day(pick(MONTHS), int(1, 28));
    const amount = int(1, 20) * 1000;
    const [out, into] = [`t${n++}`, `t${n++}`];
    db.insert(transactions)
      .values({ id: out, accountId: from, date, amount: -amount, transferTransactionId: into })
      .run();
    db.insert(transactions)
      .values({ id: into, accountId: to, date, amount, transferTransactionId: out })
      .run();
  }
  // Card funding: a reviewed cutover per card, with some earlier rows left out of it
  for (const [accountId, categoryId] of [
    ['a3', 'pay'],
    ['a7', 'pay2'],
  ])
    if (rand() < 0.7) {
      const own = db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.accountId, accountId))
        .all()
        .map((t) => t.id);
      db.insert(cardFunding)
        .values({
          accountId,
          categoryId,
          startDate: pick(['2026-05-01', '2026-07-15', '2026-09-01']),
          baselineIds: JSON.stringify(own.slice(0, int(0, 6))),
          reviewedBalance: 0,
          initialFunding: 0,
          createdAt: '2026-05-01',
        })
        .run();
    }
  for (const m of [...months, '2027-02'])
    for (const categoryId of [...expenses, 'pay', 'pay2', 'inc'])
      if (rand() < 0.45) {
        db.insert(budgetMonths)
          .values({ id: `b${n++}`, month: m, categoryId, budgeted: int(0, 40) * 1000 - 3000 })
          .run();
      }
}

const TODAYS = [TODAY, '2026-08-20', '2026-12-31'];
const AS_OF = ['2026-06-30', '2026-08-31', '2026-09-15', '2026-10-21', '2026-12-31'];

describe('one-pass engine against the previous engine', () => {
  it('gives identical summaries, groups and funding state on generated budgets', () => {
    for (let seed = 1; seed <= 20; seed++) {
      clearAll();
      generate(seed);
      for (const today of TODAYS)
        for (const month of MONTHS) {
          const label = `seed ${seed}, ${month}, today ${today}`;
          expect(budgetSummary(month, today), label).toEqual(legacyBudgetSummary(month, today));
          expect(budgetGroups(month, today), label).toEqual(legacyBudgetGroups(month, today));
        }
      for (const asOf of AS_OF)
        for (const month of [...MONTHS, asOf.slice(0, 7)])
          expect(fundingState(asOf, month), `seed ${seed}, ${asOf}, ${month}`).toEqual(
            legacyFundingState(asOf, month),
          );
      expect(fundingState(), `seed ${seed}`).toEqual(legacyFundingState());
    }
  }, 300_000);

  it('serves the same figures from a rebuilt ledger as from a warm one', () => {
    generate(7);
    const warm = MONTHS.map((m) => budgetSummary(m));
    clearBudgetCache();
    expect(MONTHS.map((m) => budgetSummary(m))).toEqual(warm);
  });

  it('accepts and refuses assignments exactly as the previous guard did', () => {
    const seen = { accepted: 0, refused: 0, messages: new Set<string>() };
    class Undo extends Error {}
    for (let seed = 1; seed <= 20; seed++) {
      clearAll();
      generate(seed);
      const rand = prng(seed * 7919);
      for (let i = 0; i < 8; i++) {
        const month = MONTHS[Math.floor(rand() * MONTHS.length)];
        const categoryId = ['e1', 'e2', 'e3', 'e4', 'e5', 'pay', 'pay2'][Math.floor(rand() * 7)];
        const budgeted = Math.floor(rand() * 60) * 5000 - 10000;
        const write = () =>
          db
            .insert(budgetMonths)
            .values({ id: `w${seed}:${i}`, month, categoryId, budgeted })
            .onConflictDoUpdate({
              target: [budgetMonths.month, budgetMonths.categoryId],
              set: { budgeted },
            })
            .run();
        const label = `seed ${seed}, ${categoryId} ${month} = ${budgeted}`;
        // Each verdict is reached in a transaction that is then rolled back
        const verdict = (guard: () => string | null) => {
          let result: string | null = null;
          try {
            db.transaction(() => {
              result = guard();
              throw new Undo();
            });
          } catch (e) {
            if (!(e instanceof Undo)) throw e;
          }
          return result;
        };
        const expected = verdict(() => legacyVerdict(write));
        const actual = verdict(() => {
          try {
            fundedWrite(write);
            return null;
          } catch (e) {
            if (e instanceof BudgetError) return e.message;
            throw e;
          }
        });
        expect(actual, label).toBe(expected);
        if (actual === null) seen.accepted++;
        else {
          seen.refused++;
          seen.messages.add(actual);
        }
      }
    }
    // The comparison would prove little if every write was accepted (or refused)
    expect(seen.accepted).toBeGreaterThan(10);
    expect(seen.refused).toBeGreaterThan(10);
  }, 300_000);
});

describe('cache invalidation', () => {
  const fresh = (month: string) => {
    const warm = budgetSummary(month);
    clearBudgetCache();
    expect(warm).toEqual(budgetSummary(month));
    return warm;
  };
  beforeEach(() => {
    generate(3);
    db.insert(cardFunding)
      .values({
        accountId: 'a3',
        categoryId: 'pay',
        startDate: '2026-05-01',
        baselineIds: '[]',
        reviewedBalance: 0,
        initialFunding: 0,
        createdAt: '2026-05-01',
      })
      .onConflictDoNothing()
      .run();
  });

  const changes: [string, () => void][] = [
    [
      'an assignment',
      () =>
        db
          .insert(budgetMonths)
          .values({ id: 'x', month: '2026-10', categoryId: 'e1', budgeted: 123456 })
          .onConflictDoUpdate({
            target: [budgetMonths.month, budgetMonths.categoryId],
            set: { budgeted: 123456 },
          })
          .run(),
    ],
    [
      'a transaction',
      () =>
        db
          .insert(transactions)
          .values({
            id: 'x',
            accountId: 'a1',
            date: '2026-10-02',
            amount: -98765,
            categoryId: 'e2',
          })
          .run(),
    ],
    [
      'a transaction edited in place',
      () =>
        db
          .update(transactions)
          .set({ categoryId: 'e3', amount: -222 })
          .where(eq(transactions.accountId, 'a1'))
          .run(),
    ],
    [
      'an opening balance',
      () => db.update(accounts).set({ startingBalance: 777777 }).where(eq(accounts.id, 'a1')).run(),
    ],
    [
      'an account type',
      () => db.update(accounts).set({ type: 'checking' }).where(eq(accounts.id, 'a2')).run(),
    ],
    [
      'the budget start',
      () => db.update(budgetSettings).set({ budgetStartMonth: '2026-10' }).run(),
    ],
    [
      'the budget start cleared',
      () => db.update(budgetSettings).set({ budgetStartMonth: null }).run(),
    ],
    ['a card setup', () => db.delete(cardFunding).run()],
    ['a card start date', () => db.update(cardFunding).set({ startDate: '2026-10-01' }).run()],
    [
      'a household pool account',
      () => {
        db.insert(householdGroups).values({ id: 'hx', name: 'x', currency: 'AUD' }).run();
        db.insert(householdPoolAccounts).values({ groupId: 'hx', accountId: 'a1' }).run();
      },
    ],
    [
      'a category group turned into income',
      () => db.update(categoryGroups).set({ isIncome: 1 }).where(eq(categoryGroups.id, 'g2')).run(),
    ],
    [
      'a category moved to income',
      () => db.update(categories).set({ groupId: 'gi' }).where(eq(categories.id, 'e1')).run(),
    ],
    [
      'assignments removed',
      () => db.delete(budgetMonths).where(eq(budgetMonths.categoryId, 'e2')).run(),
    ],
    [
      'an exchange rate',
      () => {
        db.insert(exchangeRates)
          .values({
            id: 'rx',
            date: '2026-10-01',
            base: 'EUR',
            quote: 'AUD',
            rate: '2',
            source: 'manual',
          })
          .run();
        ratesChanged();
      },
    ],
    ['the budget currency', () => db.update(budgetSettings).set({ currency: 'EUR' }).run()],
    [
      'an account currency',
      () => db.update(accounts).set({ currency: 'EUR' }).where(eq(accounts.id, 'a2')).run(),
    ],
  ];
  for (const [name, change] of changes)
    it(`recomputes after ${name}`, () => {
      for (const month of ['2026-08', '2026-10', '2026-11']) fresh(month); // warm
      change();
      for (const month of ['2026-08', '2026-10', '2026-11']) {
        const warm = budgetSummary(month);
        clearBudgetCache();
        expect(warm, month).toEqual(budgetSummary(month));
        expect(warm, month).toEqual(legacyBudgetSummary(month, TODAY));
      }
    });

  it('changes figures a write really changes', () => {
    const before = fresh('2026-10');
    db.insert(transactions)
      .values({ id: 'x', accountId: 'a1', date: '2026-10-02', amount: 55555, categoryId: 'inc' })
      .run();
    const after = budgetSummary('2026-10');
    expect(after.resources).toBe(before.resources + 55555);
    expect(after.income).toBe(before.income + 55555);
  });

  it('sees raw SQL writes, which only the triggers can announce', () => {
    const before = fresh('2026-10');
    sqlite.exec(`update accounts set starting_balance = starting_balance + 4242 where id = 'a1'`);
    expect(budgetSummary('2026-10').resources).toBe(before.resources + 4242);
    sqlite.exec(`insert into household_groups (id, name, currency) values ('hz', 'z', 'AUD')`);
    sqlite.exec(`insert into household_pool_accounts (group_id, account_id) values ('hz', 'a1')`);
    expect(budgetSummary('2026-10')).toEqual(legacyBudgetSummary('2026-10', TODAY));
  });

  it('never serves state from before a write inside a transaction, or after a rollback', () => {
    class Undo extends Error {}
    const before = fresh('2026-10');
    const revision = fundingRevision();
    try {
      db.transaction(() => {
        db.update(accounts).set({ startingBalance: 1 }).where(eq(accounts.id, 'a1')).run();
        const inside = budgetSummary('2026-10');
        expect(inside.resources).not.toBe(before.resources);
        expect(inside).toEqual(legacyBudgetSummary('2026-10', TODAY));
        db.update(accounts).set({ startingBalance: 2 }).where(eq(accounts.id, 'a1')).run();
        expect(budgetSummary('2026-10')).toEqual(legacyBudgetSummary('2026-10', TODAY));
        throw new Undo();
      });
    } catch (e) {
      if (!(e instanceof Undo)) throw e;
    }
    expect(fundingRevision()).toBe(revision);
    expect(budgetSummary('2026-10')).toEqual(before);
  });

  it('follows the date: a new day is a new revision', () => {
    const today = budgetSummary('2026-10');
    vi.setSystemTime(new Date('2026-11-05T02:00:00Z'));
    expect(budgetSummary('2026-10')).toEqual(legacyBudgetSummary('2026-10', '2026-11-05'));
    expect(budgetSummary('2026-10').asOf).not.toBe(today.asOf);
  });
});
