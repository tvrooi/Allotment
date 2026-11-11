import type { BudgetCategory, BudgetGroup, Goal } from '../types';
import { categoryFigures } from './budgetFigures';

/**
 * Envelopes that hold savings rather than this month's spending money: a category whose type
 * is Savings, and the category a goal (other than a retired one) saves in. Money in them is
 * still yours, and still on the Budget page; it just isn't "left to spend".
 */
export function savingsCategoryIds(goals: Pick<Goal, 'categoryId' | 'status'>[] = []) {
  return new Set(
    goals.filter((g) => g.categoryId && g.status !== 'retired').map((g) => g.categoryId!),
  );
}

const isSavings = (c: BudgetCategory, goalCategories: Set<string>) =>
  c.budgetType === 'savings' || goalCategories.has(c.id);

/**
 * What's left to spend this month: the expense envelopes' Available balances, so money carried
 * over and transfers into an envelope count, as they do on the Budget page, leaving out
 * savings envelopes (`savingsCategoryIds`), whose total is `setAside`. `planned` says whether
 * there's anything in the envelopes at all this month.
 */
export function leftToSpend(groups: BudgetGroup[], goalCategories = new Set<string>()) {
  const envelopes = groups.filter((g) => g.isIncome === 0).flatMap((g) => g.categories);
  let left = 0;
  let setAside = 0;
  for (const c of envelopes) {
    const available = categoryFigures(c, false).remaining;
    if (isSavings(c, goalCategories)) setAside += available;
    else left += available;
  }
  const planned = envelopes.some(
    (c) => c.budgeted !== 0 || c.carryOver !== 0 || (c.transferred ?? 0) !== 0,
  );
  return { left, setAside, planned };
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * How far through `month` (YYYY-MM) `today` (YYYY-MM-DD) is, as a whole percentage of its days
 * with today counted: 0 before the month, 100 once it's over. Throws on a date that isn't real.
 */
export function monthProgress(month: string, today: string): number {
  const m = MONTH.exec(month);
  const t = /^(\d{4}-\d{2})-(\d{2})$/.exec(today);
  const tm = t && MONTH.exec(t[1]);
  if (!m || !t || !tm) throw new Error(`Not a month and day: ${month}, ${today}`);
  const day = Number(t[2]);
  if (day < 1 || day > daysIn(Number(tm[1]), Number(tm[2])))
    throw new Error(`Not a real date: ${today}`);
  if (t[1] < month) return 0;
  if (t[1] > month) return 100;
  return Math.round((day * 100) / daysIn(Number(m[1]), Number(m[2])));
}

/**
 * The dashboard's pace cue: how much of this month's spending money is used, beside how far
 * through the month today is. Spending money is what the spending envelopes (not savings ones,
 * as in `leftToSpend`) were given this month plus what came into them, so it's what's spent
 * there plus what's left. Over 100 when they're overspent. Null when nothing is planned.
 */
export function spendingPace(
  groups: BudgetGroup[],
  goalCategories: Set<string>,
  { month, today }: { month: string; today: string },
) {
  const { left, planned } = leftToSpend(groups, goalCategories);
  if (!planned) return null;
  const activity = groups
    .filter((g) => g.isIncome === 0)
    .flatMap((g) => g.categories)
    .filter((c) => !isSavings(c, goalCategories))
    .reduce((sum, c) => sum + categoryFigures(c, false).actual, 0);
  // Refunds count against spending, but never below nothing spent
  const spent = Math.max(-activity, 0);
  const money = spent + left;
  const usedPercent = money > 0 ? Math.round((spent * 100) / money) : spent > 0 ? 100 : 0;
  return { usedPercent, monthPercent: monthProgress(month, today), overspent: left < 0 };
}
