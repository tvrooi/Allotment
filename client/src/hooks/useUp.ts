import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUpConnection } from '../api/up';

export function useUpConnection() {
  return useQuery({ queryKey: ['up-connection'], queryFn: getUpConnection });
}
export function useRefreshUp() {
  const qc = useQueryClient();
  // A sync can affect balances, payees, budgets, reports and transfer suggestions.
  return () => qc.invalidateQueries();
}
