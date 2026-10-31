import type { Account, CategoryGroup } from '../../types';
import type { PlanFrequency } from '../../api/paymentPlans';

/** Accounts a plan can be on: open, in the personal budget, a credit account */
export const planAccounts = (accounts: Account[]) =>
  accounts.filter(
    (a) => !a.closedAt && !a.isOffBudget && ['credit', 'line_of_credit'].includes(a.type),
  );

/** Accounts the payments can come from: open, on budget, not a credit account */
export const fundingAccounts = (accounts: Account[]) =>
  accounts.filter(
    (a) => !a.closedAt && !a.isOffBudget && !['credit', 'line_of_credit'].includes(a.type),
  );

/** Spending categories a purchase can have: not income, not a card payment reserve */
export const purchaseGroups = (groups: CategoryGroup[]) =>
  groups.filter((g) => !g.isIncome && g.id !== 'system:card-payments');

export const FREQUENCY_LABELS: Record<PlanFrequency, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
};

/** Same rounding as the server: equal shares, the odd cents on the first */
export function splitTotal(total: number, count: number): number[] {
  if (count < 1 || total <= 0) return [];
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => base + (i === 0 ? total - base * count : 0));
}
