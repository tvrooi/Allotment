import type { CategoryGroup } from '../types';

/** The income category pay belongs in (Pay, Paychecks, Salary…), else the first income category */
export function findPayCategory(groups: CategoryGroup[]) {
  const income = groups
    .filter((g) => g.isIncome === 1)
    .flatMap((g) => g.categories)
    .filter((c) => !c.hidden);
  return income.find((c) => /^(pay|paychecks?|salary|wages?)$/i.test(c.name.trim())) ?? income[0];
}
