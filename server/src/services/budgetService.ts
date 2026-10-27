import { calculateCardFunding } from './cardFunding.js';
import { and, eq, gte, lte, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  categories,
  categoryGroups,
  transactions,
  budgetRevision,
  cardFunding,
} from '../db/schema.js';
import {
  budgetActivity,
  budgetStartDate,
  inAccountBalance,
  mainAmount,
  personalBudgetAccount,
  sinceBudgetStart,
} from './balances.js';
import { currencyContext, convertAmount, todayIso } from './mainAmountService.js';
import { monthBounds } from '../utils/date.js';

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

/**
 * What a category carries into a month from its earlier months' net changes. Like YNAB, an
 * expense envelope that ends a month overspent starts the next month at zero: the money was
 * already spent from the accounts, so resources (and therefore what's left to assign) already
 * show it, and the deficit isn't carried forward forever. Positive balances roll over. Card
 * payment categories and income categories keep a running total.
 */
export function rollOver(months: Map<string, number>, resets: boolean): number {
  let carry = 0;
  for (const month of [...months.keys()].sort()) {
    carry += months.get(month)!;
    if (resets && carry < 0) carry = 0;
  }
  return carry;
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
export function budgetGroups(month: string, today = todayIso()) {
  return assessment(month, today).groups;
}

/**
 * Ready to Assign, like YNAB (docs/ENVELOPE-FUNDING.md). Every dollar in the budget's
 * accounts is in an envelope or ready to assign:
 *
 *   unassigned = resources − Σ envelope Available (signed) − later positive assignments
 *
 * So an inflow counts from its own date, assigning moves money out of Ready to Assign, and
 * moving money between envelopes leaves it unchanged. Overspending is negative Available, so
 * it doesn't lower Ready to Assign in its own month. When the month ends the envelope resets
 * to zero (rollOver) and the spent cash, still missing from resources, comes out of the next
 * month's Ready to Assign: the one rule for cash overspending. Credit overspending (unfunded
 * purchases on a reviewed card) is card debt, which resources leave out, so it is never
 * deducted; it stays a payment shortfall. Payment envelopes count only a positive reserve.
 *
 * Resources: cash and savings count; reviewed cards count only a positive balance; unreviewed
 * debt keeps 6A net-debt treatment. Assets never unlock assignments. See docs/CARD-PAYMENTS.md.
 * Opening funds take effect on the earlier of account creation and its first transaction,
 * matching bookedValue's date policy. Resources stop at `asOf`, never forecasting wages.
 *
 * `month` is the month being viewed (default: asOf's). A later month counts its own envelopes,
 * whose carry has already reset, so this month's cash overspending shows up there. A past
 * month shows what it closed with: later months' assignments take only what it had left.
 */
/** Account types whose balance is spendable cash (or card debt) in the envelope budget. */
export const LIQUID_ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'credit', 'line_of_credit'];

export function fundingState(asOf = todayIso(), month = asOf.slice(0, 7)) {
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

export function budgetSummary(month: string, today = todayIso()) {
  const end = monthBounds(month).to;
  const asOf = end < today ? end : today;
  const state = fundingState(asOf, month);
  const groups = budgetGroups(month, today);
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
