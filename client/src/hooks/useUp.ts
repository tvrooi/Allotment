import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUpConnection } from '../api/up';
import { useEffect, useRef } from 'react';

export function useUpConnection() {
  return useQuery({
    queryKey: ['up-connection'],
    queryFn: getUpConnection,
    refetchInterval: (q) =>
      q.state.data?.pollIntervalMinutes || q.state.data?.syncStatus === 'syncing' ? 15_000 : false,
  });
}

export function useUpFreshness() {
  const qc = useQueryClient();
  const completed = useRef<string | null | undefined>(undefined);
  const query = useUpConnection();
  const last = query.data?.lastCompletedAt;
  useEffect(() => {
    if (completed.current !== undefined && last && completed.current !== last)
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'up-connection' });
    completed.current = last;
  }, [last, qc]);
  return query;
}
export function useRefreshUp() {
  const qc = useQueryClient();
  // A sync can affect balances, payees, budgets, reports and transfer suggestions.
  return () => qc.invalidateQueries();
}
