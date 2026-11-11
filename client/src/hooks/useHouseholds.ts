import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { getHouseholds, type HouseholdBalances } from '../api/households';

/** The budget's households (shared with every ['households'] query) */
export const useHouseholds = () => useQuery({ queryKey: ['households'], queryFn: getHouseholds });

/**
 * One household's state as GET /households/:id gives it: the Household page reads all of it
 * (`T`), the dashboard's status strip only the balances. Nothing without an id.
 */
export const useHousehold = <T extends HouseholdBalances = HouseholdBalances>(id: string) =>
  useQuery({
    queryKey: ['households', id],
    queryFn: () => apiFetch<T>(`/households/${id}`),
    enabled: !!id,
  });
