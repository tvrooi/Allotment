import { useQuery } from '@tanstack/react-query';
import { getResume, getReview } from '../api/review';
import { useTransferSuggestions } from './useTransfers';
import { useCanSave } from './useConnection';
import { useAccounts } from './useAccounts';
import { nextSteps, transferSuggestionCount } from '../utils/reviewNext';
import { transactionsLink } from '../utils/transactionFilters';

/**
 * The Review page's "Do this next" list (utils/reviewNext.ts), shared with the count on the
 * sidebar's Review link. Nothing before there are accounts.
 */
export function useNextSteps() {
  const { data: accounts = [] } = useAccounts();
  const enabled = accounts.length > 0;
  const connected = useCanSave();
  const transfers = useTransferSuggestions(undefined, enabled && connected);
  const review = useQuery({
    queryKey: ['review'],
    queryFn: getReview,
    enabled,
    staleTime: 60_000,
  });
  const resume = useQuery({
    queryKey: ['review', 'resume'],
    queryFn: getResume,
    enabled,
    staleTime: 60_000,
  });
  if (!enabled) return [];
  return nextSteps(
    review.data,
    resume.data,
    transactionsLink({ uncategorized: true, datePreset: 'all' }),
    transferSuggestionCount(connected, transfers),
  );
}
