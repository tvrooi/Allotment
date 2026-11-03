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
