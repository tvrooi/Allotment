import type { BudgetSummary } from '../types';

type Funding = Pick<
  BudgetSummary,
  | 'overspent'
  | 'uncategorized'
  | 'toBeBudgeted'
  | 'paymentShortfall'
  | 'uncoveredCardPayments'
  | 'accountIssues'
  | 'complete'
>;

/**
 * What keeps the budget from being settled, naming only what is actually there: an account
 * that disagrees with its bank, missing exchange rates, overspent envelopes, uncategorised
 * spending, card payments without funding, or more assigned than there is.
 */
export function unresolvedReason(f: Funding): string {
  if (f.accountIssues?.length) return 'Reconcile account balances before assigning money';
  if (f.complete === false) return 'Incomplete: missing exchange rates';
  const causes: string[] = [];
  if (f.overspent > 0) causes.push('overspent envelopes');
  if (f.uncategorized > 0) causes.push('uncategorised spending');
  if ((f.paymentShortfall ?? 0) > 0 || (f.uncoveredCardPayments ?? 0) > 0)
    causes.push('card payments without funding');
  if (f.toBeBudgeted < 0) causes.push('more assigned than you have');
  if (!causes.length) return 'Check the Review page';
  const list =
    causes.length === 1
      ? causes[0]
      : `${causes.slice(0, -1).join(', ')} and ${causes[causes.length - 1]}`;
  return `Resolve ${list}`;
}
