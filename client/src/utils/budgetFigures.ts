import type { BudgetCategory } from '../types';
import { formatCurrency } from './currency';

// How one budget category reads, shared by the desktop table and the phone cards.

/**
 * `actual`: what was spent (expenses) or received (income) this month. `remaining`:
 * planned minus actual; income never shows a negative remainder (earning more than
 * planned isn't a shortfall). Transfers into a linked account fund the envelope like an
 * assignment, so they are not activity.
 */
export function categoryFigures(cat: BudgetCategory, isIncome: boolean) {
  const actual = cat.balance - cat.carryOver - cat.budgeted - (cat.transferred ?? 0);
  const raw = cat.budgeted - actual;
  return { actual, remaining: isIncome ? Math.max(raw, 0) : cat.balance };
}

/**
 * What an envelope's Available figure means, for the desktop table, the phone cards and the
 * progress bar. Wording and colour only: the arithmetic is `categoryFigures`. The bar shows money
 * left (see `barOf`). Spending above this month's assignment can still be fully covered by
 * money carried in: that is `carried`, not a deficit. Only a negative balance is `overspent`.
 */
export type AvailabilityKind =
  'overspent' | 'uncovered' | 'short' | 'carried' | 'available' | 'zero';

/**
 * What recurring debits still to come would leave short: expected minus what is available,
 * 0 when the envelope covers them. The server only expects occurrences that have not arrived
 * (a matched, paid or skipped one is out of `expected` and already in `balance`), so the two
 * never count the same bill twice.
 */
export function expectedShortfall(cat: BudgetCategory): number {
  return Math.max(Math.max(cat.expected ?? 0, 0) - Math.max(cat.balance, 0), 0);
}

/** "$25 short for Food bank", or "$25 short of expected bills" when there are several or none named */
export function uncoveredCaption(cat: BudgetCategory): string {
  const items = cat.expectedItems ?? [];
  const where = items.length === 1 ? `for ${items[0].name}` : 'of expected bills';
  return `${formatCurrency(expectedShortfall(cat))} short ${where}`;
}

export function availability(
  cat: BudgetCategory,
  isIncome: boolean,
): { kind: AvailabilityKind; remaining: number; caption: string | null } {
  const { remaining } = categoryFigures(cat, isIncome);
  if (isIncome) return { kind: remaining > 0 ? 'available' : 'zero', remaining, caption: null };
  if (remaining < 0)
    return {
      kind: 'overspent',
      remaining,
      // An overspent month the category keeps for repayment, carried in from an earlier one
      caption: cat.keepOverspending === 1 && cat.carryOver < 0 ? 'Overspending kept' : 'Overspent',
    };
  // Not overspent yet, but the bills still to come would take it below zero
  if (expectedShortfall(cat) > 0)
    return { kind: 'uncovered', remaining, caption: uncoveredCaption(cat) };
  if (remaining === 0) return { kind: 'zero', remaining, caption: null };
  if (cat.target && cat.target.underfunded > 0)
    return { kind: 'short', remaining, caption: 'Short of target' };
  const funded = cat.budgeted + (cat.transferred ?? 0);
  if (cat.carryOver > 0 && cat.spent > funded)
    return { kind: 'carried', remaining, caption: 'Covered by carried funds' };
  return { kind: 'available', remaining, caption: null };
}

/**
 * The Available figure's colours. Only what needs a decision is a pill, in its own colour
 * (overspent red, short of a target or covered by carried money amber); an envelope with money
 * in it is a plain figure, so the exceptions stand out; $0 is grey.
 */
export function availableTone(kind: AvailabilityKind, remaining: number): string {
  if (kind === 'overspent') return 'font-semibold bg-negative-subtle text-negative';
  if (kind === 'uncovered' || kind === 'short' || kind === 'carried')
    return 'font-semibold bg-caution-subtle text-caution';
  return remaining > 0 ? 'font-medium text-text' : 'text-text-tertiary';
}

/** The caption under the figure ("Overspent", "Short of target") in the same colour */
export function captionTone(kind: AvailabilityKind): string {
  if (kind === 'overspent') return 'text-negative';
  if (kind === 'uncovered' || kind === 'short' || kind === 'carried') return 'text-caution';
  return 'text-text-tertiary';
}

export type PlotState = 'bare' | 'used' | 'growing' | 'planted' | 'overspent';

/** What an envelope had to spend this month: carried in plus assigned plus transferred in */
export function envelopeFunds(cat: BudgetCategory): number {
  return cat.budgeted + (cat.transferred ?? 0) + Math.max(cat.carryOver, 0);
}

/**
 * The spending bar for the Budget page, drawn from the same idea as the plots: the share of
 * what the envelope had this month that is still in it, so spending empties the bar. `fill` and
 * `expectedFill` are 0 to 1 shares of `funded`; recurring debits still expected come out of
 * what is left, so `fill` is the part that is free of them. Income reads the other way: how
 * much of the plan has arrived. `label` is the whole meaning in words, for assistive tech and
 * hover, so colour is never the only carrier. Null when there is nothing to draw.
 */
export type BarState = 'overspent' | 'empty' | 'low' | 'ok' | 'income';

export function barOf(
  cat: BudgetCategory,
  isIncome: boolean,
): { state: BarState; fill: number; expectedFill: number; label: string } | null {
  if (isIncome) {
    const { actual } = categoryFigures(cat, true);
    const planned = cat.budgeted;
    if (planned <= 0 && actual <= 0) return null;
    const fill = planned > 0 ? Math.min(Math.max(actual, 0) / planned, 1) : 1;
    return {
      state: 'income',
      fill,
      expectedFill: 0,
      label:
        planned > 0
          ? `${formatCurrency(actual)} received of ${formatCurrency(planned)} planned`
          : `${formatCurrency(actual)} received`,
    };
  }
  const { state } = plotOf(cat);
  const funded = envelopeFunds(cat);
  const expected = Math.max(cat.expected ?? 0, 0);
  if (state === 'bare' && expected <= 0) return null;
  if (state === 'overspent')
    return {
      state: 'overspent',
      fill: 1,
      expectedFill: 0,
      label: `Overspent by ${formatCurrency(-cat.balance)}`,
    };
  const left = Math.max(cat.balance, 0);
  const share = (cents: number) => (funded > 0 ? Math.min(Math.max(cents / funded, 0), 1) : 0);
  const expectedLeft = Math.min(expected, left);
  const fill = share(left - expectedLeft);
  const expectedFill = Math.min(share(expectedLeft), 1 - fill);
  const gap = expectedShortfall(cat);
  const soon =
    expected > 0
      ? `, ${formatCurrency(expected)} still expected${gap > 0 ? `, ${formatCurrency(gap)} short` : ''}`
      : '';
  const label =
    funded > 0
      ? `${formatCurrency(left)} left of ${formatCurrency(funded)}${soon}`
      : `Nothing in this envelope yet${soon}`;
  const barState: BarState = left === 0 ? 'empty' : share(left) < 0.2 ? 'low' : 'ok';
  return { state: barState, fill, expectedFill, label };
}

/**
 * An envelope as a plot, which the spending bar builds on (`barOf`). `fill` is how much of its money is
 * still in it: what is available over what it was given (plus any shortfall to its target), so
 * spending empties it. Bare: nothing given this month or carried in. Used: given money that has
 * all gone. Growing: short of its target. Overspent: a negative balance.
 */
export function plotOf(cat: BudgetCategory): { state: PlotState; fill: number } {
  if (availability(cat, false).kind === 'overspent') return { state: 'overspent', fill: 1 };
  const funded = envelopeFunds(cat);
  const left = Math.max(cat.balance, 0);
  if (funded <= 0 && left === 0) return { state: 'bare', fill: 0 };
  if (left === 0) return { state: 'used', fill: 0 };
  const short = cat.target?.underfunded ?? 0;
  const fill = Math.min(left / Math.max(funded + short, left), 1);
  return { state: short > 0 ? 'growing' : 'planted', fill };
}

/** A category with nothing planned and no activity is "inactive" and tucked away. */
export function isActiveCategory(cat: BudgetCategory, isIncome: boolean) {
  return (
    cat.balance !== 0 ||
    cat.carryOver !== 0 ||
    cat.budgeted !== 0 ||
    (cat.transferred ?? 0) !== 0 ||
    (cat.expected ?? 0) !== 0 ||
    categoryFigures(cat, isIncome).actual !== 0
  );
}

/** Each budget section always lists at least this many categories */
export const MIN_SHOWN_CATEGORIES = 3;

/**
 * Default categories most people use, most common first. When a section needs topping up,
 * these are picked before the rest, so a new budget shows Groceries and Rent rather than
 * whatever sorts first. Matched by name (ignoring case): renamed or custom categories just
 * keep the section's order.
 */
const COMMON_CATEGORIES = [
  // Income
  'paychecks',
  'other income',
  'interest',
  // Fixed
  'rent / mortgage',
  'electric',
  'phone',
  'internet',
  'car payment',
  'car insurance',
  'streaming services',
  // Flexible
  'groceries',
  'restaurants',
  'gas / fuel',
  'personal care',
  'clothing',
  'coffee shops',
  // Non-monthly
  'savings',
  'doctor / medical',
  'car maintenance',
  'entertainment',
  'vacation',
];

const commonRank = (cat: BudgetCategory) => {
  const rank = COMMON_CATEGORIES.indexOf(cat.name.trim().toLowerCase());
  return rank === -1 ? COMMON_CATEGORIES.length : rank;
};

/**
 * Which categories a budget section lists, and which it tucks away behind "Show N inactive
 * categories": every active one, topped up with inactive ones to at least `min` so no
 * section ever looks empty (common categories first, then the section's order). Both
 * lists keep the section's order.
 */
export function splitCategories(
  categories: BudgetCategory[],
  isIncome: boolean,
  min = MIN_SHOWN_CATEGORIES,
) {
  const inactive = categories.filter((c) => !isActiveCategory(c, isIncome));
  const fill = Math.max(min - (categories.length - inactive.length), 0);
  // A hidden category is only listed while it holds money or activity
  const topUp = new Set(
    inactive
      .filter((c) => !c.hidden)
      .map((cat, index) => ({ cat, index }))
      .sort((a, b) => commonRank(a.cat) - commonRank(b.cat) || a.index - b.index)
      .slice(0, fill)
      .map(({ cat }) => cat),
  );
  const shown = categories.filter((c) => isActiveCategory(c, isIncome) || topUp.has(c));
  const hidden = inactive.filter((c) => !topUp.has(c));
  return { shown, hidden };
}

/**
 * The inspector's figures for some expense envelopes (BUD-10): each is the sum of the table's own
 * figures for those rows, so a selection reconciles with the table, and nothing is counted that
 * isn't selected. `available` is `carriedIn + assigned + transferred + activity`.
 */
export function selectionFigures(cats: BudgetCategory[]) {
  return cats.reduce(
    (sum, c) => ({
      carriedIn: sum.carriedIn + c.carryOver,
      assigned: sum.assigned + c.budgeted,
      transferred: sum.transferred + (c.transferred ?? 0),
      activity: sum.activity + categoryFigures(c, false).actual,
      available: sum.available + categoryFigures(c, false).remaining,
      expected: sum.expected + Math.max(c.expected ?? 0, 0),
      underfunded: sum.underfunded + (c.target?.underfunded ?? 0),
    }),
    {
      carriedIn: 0,
      assigned: 0,
      transferred: 0,
      activity: 0,
      available: 0,
      expected: 0,
      underfunded: 0,
    },
  );
}

/**
 * An envelope total split into what is for spending and what is saved. "Saved" is an envelope
 * whose budget type is Savings (the same set the Save up summary counts), so a big Emergency
 * Fund doesn't pass for spending money. The two parts always add up to the total.
 */
export function savedSplit(cats: BudgetCategory[]) {
  const saved = selectionFigures(cats.filter((c) => c.budgetType === 'savings')).available;
  const total = selectionFigures(cats).available;
  return { spending: total - saved, saved, total };
}
