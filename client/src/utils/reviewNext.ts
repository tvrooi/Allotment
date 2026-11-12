import type { BudgetReview, ResumeState } from '../api/review';

export interface NextStep {
  id:
    | 'overspent'
    | 'over-assigned'
    | 'transfers'
    | 'uncategorised'
    | 'cards'
    | 'targets'
    | 'assign'
    | 'reconcile';
  title: string;
  /** Where doing it happens */
  to: string;
  /** Cents involved, when there are some (shown, and hidden in Safe mode) */
  amount?: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * What the Review page asks for first, most urgent first: money problems (overspent, more
 * assigned than held), then sorting, then planning, then housekeeping. Empty when the budget
 * is in order. Its length is the count on the Review link in the sidebar.
 */
export function nextSteps(
  review: BudgetReview | undefined,
  resume: ResumeState | undefined,
  uncategorisedLink: string,
  transferCount = 0,
): NextStep[] {
  const steps: NextStep[] = [];
  if (review) {
    const overspent = review.totals.deficits;
    if (overspent > 0)
      steps.push({
        id: 'overspent',
        title: 'Cover overspent envelopes',
        to: '/budget',
        amount: overspent,
      });
    if (review.complete && review.unassigned < 0)
      steps.push({
        id: 'over-assigned',
        title: 'Take back money you’ve assigned but don’t have',
        to: '/budget',
        amount: -review.unassigned,
      });
  }
  if (transferCount > 0)
    steps.push({
      id: 'transfers',
      title: `Check ${plural(transferCount, 'possible transfer')}`,
      to: '/transactions?possible-transfers=1',
    });
  const uncategorised = review?.uncategorisedCount ?? resume?.uncategorisedCount ?? 0;
  if (uncategorised > 0)
    steps.push({
      id: 'uncategorised',
      title: `Give ${plural(uncategorised, 'transaction')} a category`,
      to: uncategorisedLink,
    });
  if (review) {
    const cards = review.totals.cardShortfall + review.totals.uncoveredCardPayments;
    if (cards > 0)
      steps.push({
        id: 'cards',
        title: 'Set money aside for card payments',
        to: '/budget',
        amount: cards,
      });
    if (review.totals.targetShortfalls > 0)
      steps.push({
        id: 'targets',
        title: `Fund ${plural(review.targetShortfalls.length, 'target')}`,
        to: '/budget',
        amount: review.totals.targetShortfalls,
      });
    if (review.complete && review.unassigned > 0)
      steps.push({
        id: 'assign',
        title: 'Assign your Ready to assign money',
        to: '/budget',
        amount: review.unassigned,
      });
  }
  const reconcile = resume?.unreconciledAccounts ?? 0;
  if (reconcile > 0)
    steps.push({
      id: 'reconcile',
      title: `Reconcile ${plural(reconcile, 'account')} with your bank`,
      to: '/accounts',
    });
  return steps;
}

/** Keep the last successful suggestions during a refetch, but never show stale failed/offline data. */
export function transferSuggestionCount(
  connected: boolean,
  query: { data?: readonly unknown[]; isSuccess: boolean; isFetching: boolean },
): number {
  return connected && query.isSuccess ? (query.data?.length ?? 0) : 0;
}
