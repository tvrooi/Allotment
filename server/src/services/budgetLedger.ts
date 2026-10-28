import { and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  budgetRevision,
  cardFunding,
  categories,
  categoryGroups,
  transactions,
} from '../db/schema.js';
import {
  budgetActivity,
  budgetStartDate,
  inAccountBalance,
  mainAmount,
  personalBudgetAccount,
  sinceBudgetStart,
} from './balances.js';
import {
  currencyContext,
  convertAmount,
  ratesVersion,
  todayIso,
  type CurrencyContext,
} from './mainAmountService.js';
import { monthBounds } from '../utils/date.js';
import type { CardData, calculateCardFunding } from './cardFunding.js';

// Everything the budget engine needs from history, computed in one pass and kept until the
// budget changes. Envelope balances used to be rebuilt from SQL for every month asked about,
// so checking an assignment against each month since the first change cost
// (months × all history). Here each category's months are walked once, and a month or a date
// is then a lookup. See docs/ENVELOPE-FUNDING.md for the model the figures follow.

// Generated income remains an expectation until reconciled. Spending is recognised
// when dated, including generated bills, to avoid offering committed cash again.
export const receivedSpending = and(
  budgetActivity,
  sql`not (${transactions.amount} > 0 and coalesce(${transactions.importedId}, '') like 'schedule:%' and ${transactions.reconciled} = 0)`,
)!;
/** What the envelopes count: received activity from the budget start on */
export const receivedActivity = and(receivedSpending, sinceBudgetStart)!;
export const fundingRevision = () =>
  `${todayIso()}:${db.select().from(budgetRevision).get()?.revision ?? 'initial'}`;

type CategoryRow = typeof categories.$inferSelect;
type GroupRow = typeof categoryGroups.$inferSelect;
type CardFunding = ReturnType<typeof calculateCardFunding>;

/** One category's months, from the budget start on */
interface CategoryHistory {
  category: CategoryRow;
  /** An expense envelope that ends a month overspent starts the next at zero (see rollOver) */
  resets: boolean;
  /** Assignments by month, for months from the budget start */
  assigned: Map<string, number>;
  /** Received activity by month, for the whole month (a date cut-off only matters in its own) */
  activity: Map<string, number>;
  /** Every month holding an assignment or activity with what the category carries out of it */
  steps: { month: string; net: number; after: number }[];
  /** The months holding an assignment, oldest first */
  assignedMonths: string[];
}

/** An account's balance by date, for Ready to Assign's resources */
interface AccountHistory {
  account: typeof accounts.$inferSelect;
  /** The earlier of its creation and first transaction: when opening funds take effect */
  effective: string;
  /** The starting balance at the rate of `effective`; null without a rate */
  opening: number | null;
  /** Dates with transactions, and the running sum of those counted as received */
  dates: string[];
  received: number[];
}

export interface Ledger {
  startMonth: string;
  groups: GroupRow[];
  catsByGroup: Map<string, CategoryHistory[]>;
  envelopes: Map<string, CategoryHistory>;
  paymentAccounts: Map<string, string>;
  /** Assigned money by month (any category that is not income) and what lies after each */
  laterMonths: string[];
  laterTotals: number[];
  accounts: AccountHistory[];
  ctx: CurrencyContext;
  /** Received activity by date: uncategorized spending, and rows still awaiting a rate */
  days: { dates: string[]; uncategorized: number[]; missing: number[] };
  /** Category activity in the part of a month up to a date, by date */
  partial: Map<string, Map<string, number>>;
  /** What card funding reads from the database, loaded when the first card figure is asked */
  cardData: CardData | null;
  /** Card funding replayed as of a date */
  cards: Map<string, CardFunding>;
}

/**
 * What a category carries into a month from its earlier months' net changes. Like YNAB, an
 * expense envelope that ends a month overspent starts the next month at zero: the money was
 * already spent from the accounts, so resources (and therefore what's left to assign) already
 * show it, and the deficit isn't carried forward forever. Positive balances roll over. Card
 * payment categories and income categories keep a running total.
 */
export function rollOver(months: Map<string, number>, resets: boolean): number {
  let carry = 0;
  for (const month of [...months.keys()].sort()) carry = settle(carry, months.get(month)!, resets);
  return carry;
}
const settle = (carry: number, net: number, resets: boolean) =>
  resets && carry + net < 0 ? 0 : carry + net;

/** The index of the first item in a sorted list that is not before `value` (a binary search) */
function lowerBound<T>(items: T[], value: string, key: (item: T) => string): number {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (key(items[mid]) < value) low = mid + 1;
    else high = mid;
  }
  return low;
}
/** How many items of a sorted list are on or before `value` */
const countThrough = <T>(items: T[], value: string, key: (item: T) => string) =>
  lowerBound(items, value + '\u0000', key);

function build(): Ledger {
  const startMonth = budgetStartDate().slice(0, 7);
  const groups = db.select().from(categoryGroups).orderBy(categoryGroups.sortOrder).all();
  const cats = db.select().from(categories).orderBy(categories.sortOrder).all();
  const incomeGroups = new Set(groups.filter((g) => g.isIncome).map((g) => g.id));
  const mappings = db.select().from(cardFunding).all();
  const paymentIds = new Set(mappings.map((m) => m.categoryId));
  const budgetRows = db.select().from(budgetMonths).all();

  const envelopes = new Map<string, CategoryHistory>(
    cats.map((category) => [
      category.id,
      {
        category,
        resets: !incomeGroups.has(category.groupId) && !paymentIds.has(category.id),
        assigned: new Map(),
        activity: new Map(),
        steps: [],
        assignedMonths: [],
      },
    ]),
  );
  // Before the budget start a month shows no assignments, like its activity
  for (const r of budgetRows)
    if (r.month >= startMonth) envelopes.get(r.categoryId)?.assigned.set(r.month, r.budgeted);
  const activityRows = db
    .select({
      categoryId: transactions.categoryId,
      month: sql<string>`substr(${transactions.date}, 1, 7)`,
      total: sql<number>`coalesce(sum(${mainAmount}), 0)`,
    })
    .from(transactions)
    .where(receivedActivity)
    .groupBy(transactions.categoryId, sql`substr(${transactions.date}, 1, 7)`)
    .all();
  for (const r of activityRows)
    if (r.categoryId) envelopes.get(r.categoryId)?.activity.set(r.month, r.total);
  for (const history of envelopes.values()) {
    const months = [...new Set([...history.assigned.keys(), ...history.activity.keys()])].sort();
    let carry = 0;
    history.steps = months.map((month) => {
      const net = (history.assigned.get(month) ?? 0) + (history.activity.get(month) ?? 0);
      carry = settle(carry, net, history.resets);
      return { month, net, after: carry };
    });
    history.assignedMonths = [...history.assigned.keys()].sort();
  }
  const catsByGroup = new Map<string, CategoryHistory[]>();
  for (const c of cats) {
    const list = catsByGroup.get(c.groupId) ?? [];
    list.push(envelopes.get(c.id)!);
    catsByGroup.set(c.groupId, list);
  }

  // Positive assignments after each month, for money already promised to later months
  const expenseGroups = new Set(groups.filter((g) => !g.isIncome).map((g) => g.id));
  const expenseIds = new Set(cats.filter((c) => expenseGroups.has(c.groupId)).map((c) => c.id));
  const promised = new Map<string, number>();
  for (const r of budgetRows)
    if (expenseIds.has(r.categoryId))
      promised.set(r.month, (promised.get(r.month) ?? 0) + Math.max(0, r.budgeted));
  const laterMonths = [...promised.keys()].sort();
  const laterTotals = new Array<number>(laterMonths.length + 1).fill(0);
  for (let i = laterMonths.length - 1; i >= 0; i--)
    laterTotals[i] = laterTotals[i + 1] + promised.get(laterMonths[i])!;

  const ctx = currencyContext();
  const received = db
    .select({
      accountId: transactions.accountId,
      date: transactions.date,
      // Matches the received-activity rule above, in the account's own currency
      amount: sql<number>`sum(case when ${transactions.amount} > 0 and substr(${transactions.importedId}, 1, 9) = 'schedule:' and not ${transactions.reconciled} then 0 else ${transactions.amount} end)`,
    })
    .from(transactions)
    .where(inAccountBalance)
    .groupBy(transactions.accountId, transactions.date)
    .orderBy(transactions.date)
    .all();
  const byAccount = new Map<string, { dates: string[]; received: number[] }>();
  for (const r of received) {
    const rows = byAccount.get(r.accountId) ?? { dates: [], received: [] };
    rows.dates.push(r.date);
    rows.received.push((rows.received.at(-1) ?? 0) + r.amount);
    byAccount.set(r.accountId, rows);
  }
  const accountHistories = db
    .select()
    .from(accounts)
    .where(personalBudgetAccount)
    .all()
    .map((account): AccountHistory => {
      const { dates, received } = byAccount.get(account.id) ?? { dates: [], received: [] };
      const created = account.createdAt.slice(0, 10);
      const effective = dates.length && dates[0] < created ? dates[0] : created;
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
      return { account, effective, opening, dates, received };
    });

  const dayRows = db
    .select({
      date: transactions.date,
      uncategorized: sql<number>`sum(case when (${transactions.categoryId} is null or ${transactions.categoryId} = '') and ${mainAmount} < 0 then -${mainAmount} else 0 end)`,
      missing: sql<number>`sum(case when ${transactions.mainAmountSource} = 'missing' then 1 else 0 end)`,
    })
    .from(transactions)
    .where(receivedActivity)
    .groupBy(transactions.date)
    .orderBy(transactions.date)
    .all();
  const days = { dates: [] as string[], uncategorized: [0], missing: [0] };
  for (const r of dayRows) {
    days.dates.push(r.date);
    days.uncategorized.push(days.uncategorized.at(-1)! + r.uncategorized);
    days.missing.push(days.missing.at(-1)! + r.missing);
  }

  return {
    startMonth,
    groups,
    catsByGroup,
    envelopes,
    paymentAccounts: new Map(mappings.map((m) => [m.categoryId, m.accountId])),
    laterMonths,
    laterTotals,
    accounts: accountHistories,
    ctx,
    days,
    partial: new Map(),
    cardData: null,
    cards: new Map(),
  };
}

// The ledger is rebuilt when fundingRevision() changes: it combines today with a revision
// that SQLite triggers bump on every write to the tables this reads (transactions, accounts,
// budget_months, categories and groups, exchange rates, budget settings, card funding and the
// household tables behind personalBudgetAccount). A write inside a transaction bumps it
// immediately, so a rolled-back or restored change is never served from before the write.
// The rate book is kept in memory by mainAmountService, so its version is part of the key too.
let cached: { key: string; ledger: Ledger } | null = null;
export function ledger(): Ledger {
  const key = `${fundingRevision()}:${ratesVersion()}`;
  if (cached?.key !== key) cached = { key, ledger: build() };
  return cached.ledger;
}
/** Forgets the ledger, so the next figure is computed from the database again */
export function clearLedger() {
  cached = null;
}

/** Activity in `date`'s month up to and including `date`, by category */
function partialMonth(l: Ledger, date: string): Map<string, number> {
  let found = l.partial.get(date);
  if (!found) {
    const month = date.slice(0, 7);
    found = new Map(
      db
        .select({
          categoryId: transactions.categoryId,
          total: sql<number>`coalesce(sum(${mainAmount}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            sql`${transactions.date} >= ${monthBounds(month).from}`,
            sql`${transactions.date} <= ${date}`,
            receivedActivity,
          ),
        )
        .groupBy(transactions.categoryId)
        .all()
        .flatMap((r) => (r.categoryId ? [[r.categoryId, r.total] as const] : [])),
    );
    l.partial.set(date, found);
  }
  return found;
}

/** Activity in the month `today` falls in, up to and including `today` (undefined: no rows) */
function currentActivity(l: Ledger, h: CategoryHistory, today: string): number | undefined {
  const month = today.slice(0, 7);
  return today >= monthBounds(month).to
    ? h.activity.get(month)
    : partialMonth(l, today).get(h.category.id);
}

/** The category's net change in the month `today` falls in (undefined: no assignment or rows) */
function currentMonthNet(l: Ledger, h: CategoryHistory, today: string): number | undefined {
  const assigned = h.assigned.get(today.slice(0, 7));
  const activity = currentActivity(l, h, today);
  return assigned === undefined && activity === undefined
    ? undefined
    : (assigned ?? 0) + (activity ?? 0);
}

/**
 * Each month before `month` with its net change (assigned + activity), counting activity up
 * to `today` (a date): what the card engine replays, and what the envelope carries from.
 */
function monthlyNet(l: Ledger, h: CategoryHistory, month: string, today: string) {
  const months = new Map<string, number>();
  const current = today.slice(0, 7);
  for (const s of h.steps) {
    if (s.month >= month || s.month >= current) break;
    months.set(s.month, s.net);
  }
  if (current < month) {
    const net = currentMonthNet(l, h, today);
    if (net !== undefined) months.set(current, net);
    // Later months than `today` hold assignments only: their activity is still to come
    for (const m of h.assignedMonths.slice(
      lowerBound(h.assignedMonths, current + '\u0000', (m) => m),
    ))
      if (m < month) months.set(m, h.assigned.get(m)!);
  }
  return months;
}

/** What the category carries into `month`, counting activity up to `today` */
function carryInto(l: Ledger, h: CategoryHistory, month: string, today: string): number {
  const current = today.slice(0, 7);
  const before = (until: string) => {
    const i = lowerBound(h.steps, until, (s) => s.month);
    return i ? h.steps[i - 1].after : 0;
  };
  if (month <= current) return before(month);
  let carry = settle(before(current), currentMonthNet(l, h, today) ?? 0, h.resets);
  for (const m of h.assignedMonths.slice(
    lowerBound(h.assignedMonths, current + '\u0000', (m) => m),
  )) {
    if (m >= month) break;
    carry = settle(carry, h.assigned.get(m)!, h.resets);
  }
  return carry;
}

/**
 * Every category's figures for `month`, counting activity up to the date `today` (later days
 * are still to come). `history` gives the net change of each earlier month, for the card engine.
 */
export function envelopeGroups(l: Ledger, month: string, today: string) {
  const current = today.slice(0, 7);
  return l.groups.map((g) => ({
    ...g,
    categories: (l.catsByGroup.get(g.id) ?? []).map((h) => {
      const budgeted = h.assigned.get(month) ?? 0;
      const activity =
        month < current
          ? (h.activity.get(month) ?? 0)
          : month === current
            ? (currentActivity(l, h, today) ?? 0)
            : 0;
      const carryOver = carryInto(l, h, month, today);
      return {
        ...h.category,
        budgeted,
        activity,
        spent: Math.abs(Math.min(activity, 0)),
        carryOver,
        balance: carryOver + budgeted + activity,
        history: () => monthlyNet(l, h, month, today),
        resets: h.resets,
      };
    }),
  }));
}

/** Ready to Assign's account side: what the accounts hold on `asOf` */
export function resourcesAt(l: Ledger, asOf: string, enrolledCards: Set<string>, liquid: string[]) {
  let resources = 0;
  let openingFunds = 0;
  let complete = true;
  for (const h of l.accounts) {
    const { account } = h;
    if (h.effective > asOf) continue;
    const count = countThrough(h.dates, asOf, (d) => d);
    const value = convertAmount(
      account.startingBalance + (count ? h.received[count - 1] : 0),
      account.currency ?? l.ctx.budget,
      l.ctx.budget,
      asOf,
      l.ctx,
    );
    if (value === null || h.opening === null) {
      complete = false;
      continue;
    }
    const kind = (amount: number) =>
      enrolledCards.has(account.id)
        ? Math.max(0, amount)
        : liquid.includes(account.type)
          ? amount
          : Math.min(0, amount);
    resources += kind(value);
    openingFunds += kind(h.opening);
  }
  return { resources, openingFunds, complete };
}

/** Received activity up to `asOf`: uncategorized spending, and whether any row awaits a rate */
export function activityAt(l: Ledger, asOf: string) {
  const count = countThrough(l.days.dates, asOf, (d) => d);
  return { uncategorized: l.days.uncategorized[count], missing: l.days.missing[count] > 0 };
}

/** Positive assignments to expense categories in months after `month` */
export function assignedAfter(l: Ledger, month: string): number {
  return l.laterTotals[countThrough(l.laterMonths, month, (m) => m)];
}
