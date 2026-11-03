import type { QueryClient } from '@tanstack/react-query';

/**
 * Every query whose figures come from the ledger (transactions, assignments, accounts,
 * categories, transfers, household tables): the Budget page, its summary, Review, account
 * balances, reports and dashboard widgets, forecasts, payday plans, card funding and goals.
 *
 * Any change that succeeds refreshes them, so no page keeps showing what a register edit,
 * assignment or import changed (the server's own figures move with `fundingRevision()`).
 * Only active queries refetch; the rest are marked stale and refetch when next shown.
 */
export const LEDGER_VIEW_KEYS = [
  'budget',
  'budget-summary',
  'category-history',
  'review',
  'accounts',
  'reports',
  'forecast',
  'payday',
  'card-funding',
  'goals',
] as const;

export function invalidateLedgerViews(qc: QueryClient) {
  return Promise.all(LEDGER_VIEW_KEYS.map((key) => qc.invalidateQueries({ queryKey: [key] }))).then(
    () => undefined,
  );
}
