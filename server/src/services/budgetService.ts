import { assessCredit, type CardPlan } from './creditAccounting.js';
import { and, eq, gte, lte, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  categories,
  categoryGroups,
  transactions,
  budgetRevision,
} from '../db/schema.js';
import { budgetActivity, inAccountBalance, mainAmount, personalBudgetAccount } from './balances.js';
import { currencyContext, convertAmount, todayIso } from './mainAmountService.js';
import { monthBounds } from '../utils/date.js';

// Generated income remains an expectation until reconciled. Spending is recognised
// when dated, including generated bills, to avoid offering committed cash again.
const receivedActivity = and(
  budgetActivity,
  sql`not (${transactions.amount} > 0 and coalesce(${transactions.importedId}, '') like 'schedule:%' and ${transactions.reconciled} = 0)`,
)!;
export const fundingRevision = () =>
  `${todayIso()}:${db.select().from(budgetRevision).get()?.revision ?? 'initial'}`;

export function budgetGroups(
  month: string,
  today = todayIso(),
  credit = assessCredit(monthBounds(month).to < today ? monthBounds(month).to : today),
) {
  const { from, to: end } = monthBounds(month);
  const to = end < today ? end : today;

  const groups = db.select().from(categoryGroups).orderBy(categoryGroups.sortOrder).all();
  const cats = db.select().from(categories).orderBy(categories.sortOrder).all();
  const budgeted = db.select().from(budgetMonths).where(eq(budgetMonths.month, month)).all();

  const spentRows = db
    .select({
      categoryId: transactions.categoryId,
      spent: sql<number>`coalesce(sum(${mainAmount}), 0)`,
    })
    .from(transactions)
    .where(and(gte(transactions.date, from), lte(transactions.date, to), receivedActivity))
    .groupBy(transactions.categoryId)
    .all();

  const priorBudgetedRows = db
    .select({
      categoryId: budgetMonths.categoryId,
      total: sql<number>`coalesce(sum(${budgetMonths.budgeted}), 0)`,
    })
    .from(budgetMonths)
    .where(lt(budgetMonths.month, month))
    .groupBy(budgetMonths.categoryId)
    .all();

  const priorActivityRows = db
    .select({
      categoryId: transactions.categoryId,
      total: sql<number>`coalesce(sum(${mainAmount}), 0)`,
    })
    .from(transactions)
    .where(and(lt(transactions.date, from), lte(transactions.date, today), receivedActivity))
    .groupBy(transactions.categoryId)
    .all();

  const spentMap = Object.fromEntries(spentRows.map((r) => [r.categoryId, r.spent]));
  const budgetMap = Object.fromEntries(budgeted.map((b) => [b.categoryId, b]));
  const priorBudgetMap = Object.fromEntries(priorBudgetedRows.map((r) => [r.categoryId, r.total]));
  const priorActivityMap = Object.fromEntries(
    priorActivityRows.map((r) => [r.categoryId, r.total]),
  );

  const result = groups.map((g) => ({
    ...g,
    categories: cats
      .filter((c) => c.groupId === g.id)
      .map((c) => {
        const bm = budgetMap[c.id];
        const budgetedAmt = bm?.budgeted ?? 0;
        const activity = spentMap[c.id] ?? 0;
        const priorCreditAdjustment =
          (month > to.slice(0, 7) ? credit.adjustments : credit.priorAdjustments).get(c.id) ?? 0;
        const cardCreditAdjustment = (credit.adjustments.get(c.id) ?? 0) - priorCreditAdjustment;
        const carryOver =
          (priorBudgetMap[c.id] ?? 0) + (priorActivityMap[c.id] ?? 0) + priorCreditAdjustment;
        return {
          ...c,
          budgeted: budgetedAmt,
          activity,
          cardCreditAdjustment,
          spent: Math.abs(Math.min(activity, 0)),
          carryOver,
          balance: carryOver + budgetedAmt + activity + cardCreditAdjustment,
        };
      }),
  }));

  return result;
}

/** Existing cash = unassigned + positive envelopes + future commitments + card reserves.
 * Reviewed cards exclude debt/positive store credit from cash resources. Cards awaiting
 * setup retain phase 6A's net-debt policy; historical views before setup remain unchanged.
 */
export function fundingState(
  asOf = todayIso(),
  proposedPlan?: CardPlan,
  proposedFunding?: { id: string; accountId: string; date: string; amount: number },
) {
  const credit = assessCredit(asOf, proposedPlan, proposedFunding);
  const groups = budgetGroups(asOf.slice(0, 7), asOf, credit);
  const cats = groups.filter((g) => !g.isIncome).flatMap((g) => g.categories);
  const balances = new Map(cats.map((c) => [c.id, c.balance]));
  const expenseIds = new Set(cats.map((c) => c.id));
  const futureAssigned = db
    .select()
    .from(budgetMonths)
    .all()
    .filter((r) => r.month > asOf.slice(0, 7) && expenseIds.has(r.categoryId))
    .reduce((s, r) => s + Math.max(0, r.budgeted), 0);
  const reserved =
    cats.reduce((s, c) => s + Math.max(0, c.balance), 0) + futureAssigned + credit.paymentReserved;
  const ctx = currencyContext();
  let resources = 0;
  let openingFunds = 0;
  let complete = credit.complete;
  const reviewedCards = new Set(credit.cards.map((c) => c.accountId));
  for (const account of db.select().from(accounts).where(personalBudgetAccount).all()) {
    const liquid = ['checking', 'savings', 'cash', 'credit', 'line_of_credit'].includes(
      account.type,
    );
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
    const opening = convertAmount(
      account.startingBalance,
      account.currency ?? ctx.budget,
      ctx.budget,
      effective,
      ctx,
    );
    if (value === null || opening === null) complete = false;
    else {
      resources += reviewedCards.has(account.id) ? 0 : liquid ? value : Math.min(0, value);
      openingFunds += reviewedCards.has(account.id) ? 0 : liquid ? opening : Math.min(0, opening);
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
  const overspent = cats.reduce((s, c) => s + Math.max(0, -c.balance), 0);
  const unassigned = resources - reserved;
  return {
    balances,
    cards: credit.cards,
    paymentReserved: credit.paymentReserved,
    paymentShortfall: credit.paymentShortfall,
    creditOverspent: credit.creditOverspent,
    cashOverspent: Math.max(0, overspent - credit.creditOverspent),
    unlinkedCardInflows: credit.unlinkedCardInflows,
    asOf,
    resources,
    openingFunds,
    reserved,
    futureAssigned,
    uncategorized,
    overspent,
    complete,
    unassigned,
    available: complete ? Math.max(0, unassigned) : 0,
    revision: fundingRevision(),
    resolved:
      complete &&
      uncategorized === 0 &&
      overspent === 0 &&
      unassigned >= 0 &&
      credit.paymentShortfall === 0 &&
      credit.unlinkedCardInflows === 0,
  };
}

export function budgetSummary(month: string, today = todayIso()) {
  const end = monthBounds(month).to;
  const asOf = end < today ? end : today;
  const state = fundingState(asOf);
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
  };
}
