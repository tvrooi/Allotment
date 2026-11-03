import type { BudgetGroup } from '../types';
import { categoryFigures } from './budgetFigures';

/**
 * What's left to spend this month: the expense envelopes' Available balances, so money carried
 * over and transfers into an envelope count, as they do on the Budget page. `planned` says
 * whether there's anything in the envelopes at all this month.
 */
export function leftToSpend(groups: BudgetGroup[]) {
  const envelopes = groups.filter((g) => g.isIncome === 0).flatMap((g) => g.categories);
  const left = envelopes.reduce((s, c) => s + categoryFigures(c, false).remaining, 0);
  const planned = envelopes.some(
    (c) => c.budgeted !== 0 || c.carryOver !== 0 || (c.transferred ?? 0) !== 0,
  );
  return { left, planned };
}
