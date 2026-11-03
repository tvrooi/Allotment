import { calculateCardFunding, loadCardData } from './cardFunding.js';
import { budgetStartDate, LIQUID_ACCOUNT_TYPES } from './balances.js';
import { accountIssues as checkAccounts } from './accountIntegrity.js';
import {
  activityAt,
  assignedAfter,
  envelopeGroups,
  fundingRevision,
  ledger,
  receivedActivity,
  receivedSpending,
  resourcesAt,
  rollOver,
  type Ledger,
} from './budgetLedger.js';
import { todayIso } from './mainAmountService.js';
import { monthBounds } from '../utils/date.js';

export { LIQUID_ACCOUNT_TYPES } from './balances.js';
export { clearLedger as clearBudgetCache } from './budgetLedger.js';
export { fundingRevision, receivedActivity, receivedSpending, rollOver };

/**
 * Card funding as of a date, replayed once per budget revision and date. It follows the
 * envelopes of the month the date is in, which already carry the monthly reset.
 */
function cardAt(l: Ledger, asOf: string) {
  let card = l.cards.get(asOf);
  if (!card) {
    card = calculateCardFunding(
      asOf,
      envelopeGroups(l, asOf.slice(0, 7), asOf)
        .filter((g) => !g.isIncome)
        .flatMap((g) => g.categories)
        .map((c) => ({
          id: c.id,
          balance: c.balance,
          // Month by month, so funding follows the same monthly reset as the envelopes
          get months() {
            return new Map(c.history()).set(
              asOf.slice(0, 7),
              c.budgeted + c.transferred + c.activity,
            );
          },
        })),
      (l.cardData ??= loadCardData()),
    );
    l.cards.set(asOf, card);
  }
  return card;
}

function assessment(month: string, today = todayIso()) {
  const end = monthBounds(month).to;
  const asOf = end < today ? end : today;
  const l = ledger();
  const raw = envelopeGroups(l, month, today);
  const card = cardAt(l, asOf);
  const adjustments = new Map<string, typeof card.adjustments>();
  for (const a of card.adjustments) {
    const list = adjustments.get(a.categoryId) ?? [];
    list.push(a);
    adjustments.set(a.categoryId, list);
  }
  const groups = raw.map((g) => ({
    ...g,
    categories: g.categories.map((c) => {
      const { history, resets, ...category } = c;
      const changes = adjustments.get(c.id) ?? [];
      const earlier = changes.filter((a) => a.date.slice(0, 7) < month);
      const carryOver = earlier.length
        ? rollOver(
            earlier.reduce(
              (months, a) =>
                months.set(a.date.slice(0, 7), (months.get(a.date.slice(0, 7)) ?? 0) + a.amount),
              history(),
            ),
            resets,
          )
        : c.carryOver;
      const activity = changes
        .filter((a) => a.date.slice(0, 7) === month)
        .reduce((s, a) => s + a.amount, 0);
      return {
        ...category,
        carryOver,
        activity: c.activity + activity,
        balance: carryOver + c.budgeted + c.transferred + c.activity + activity,
        paymentAccountId: l.paymentAccounts.get(c.id) ?? null,
      };
    }),
  }));
  return { groups, card, ledger: l };
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
export function fundingState(asOf = todayIso(), month = asOf.slice(0, 7)) {
  const asOfMonth = asOf.slice(0, 7);
  const { groups, card, ledger: l } = assessment(asOfMonth, asOf);
  const enrolledCards = new Set(card.positions.map((p) => p.accountId));
  const cats = groups.filter((g) => !g.isIncome).flatMap((g) => g.categories);
  const balances = new Map(cats.map((c) => [c.id, c.balance]));
  const viewMonth = month > asOfMonth ? month : asOfMonth;
  const viewed =
    viewMonth === asOfMonth
      ? cats
      : assessment(viewMonth, asOf)
          .groups.filter((g) => !g.isIncome)
          .flatMap((g) => g.categories);
  const futureAssigned = assignedAfter(l, viewMonth);
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
  const {
    resources,
    openingFunds,
    complete: accountsComplete,
  } = resourcesAt(l, asOf, enrolledCards, LIQUID_ACCOUNT_TYPES);
  const { uncategorized, missing } = activityAt(l, asOf);
  const complete = card.complete && accountsComplete && !missing;
  const accountIssues = checkAccounts(asOf);
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
    cards: card.positions.map((p) => ({ ...p })),
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
    accountIssues,
    available: complete && accountIssues.length === 0 ? Math.max(0, unassigned) : 0,
    revision: fundingRevision(),
    resolved:
      complete &&
      accountIssues.length === 0 &&
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
    // False until some money has been assigned in any month: a brand-new budget
    anythingAssigned: [...ledger().envelopes.values()].some((h) =>
      [...h.assigned.values()].some((v) => v !== 0),
    ),
  };
}
