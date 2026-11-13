import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FILTER_KEYS,
  filtersFromSearch,
  filtersToSearch,
  withoutScope,
  type FilterState,
  type ScopeDimension,
} from '../utils/transactionFilters';

/**
 * A register's filters kept in the URL, so reload, Back and drill-down links keep them (#245).
 * Changes replace the history entry. Other parameters (like ?add=1) belong to the page and are
 * kept. A URL the register didn't write itself (a link followed while already here) starts it
 * afresh: pass `generation` as the TransactionTable's key. A new `restartKey` restarts it too.
 * With no filters in the URL, the register picks its own defaults. A scoped page (an account,
 * a category, a payee) passes its dimension, which the URL can't set.
 */
export function useFilterSearch({
  restartKey = null,
  scope = null,
}: { restartKey?: string | null; scope?: ScopeDimension | null } = {}) {
  const [params, setParams] = useSearchParams();
  const search = new URLSearchParams(
    [...params].filter(([key]) => FILTER_KEYS.has(key)),
  ).toString();
  const own = useRef({ search, restartKey, generation: 0 });
  if (search !== own.current.search || (restartKey && restartKey !== own.current.restartKey)) {
    own.current = { search, restartKey, generation: own.current.generation + 1 };
  }
  const onFiltersChange = useCallback(
    (filters: FilterState) => {
      setParams(
        (prev) => {
          const next = filtersToSearch(filters);
          own.current = { ...own.current, search: next.toString() };
          for (const [key, value] of prev) if (!FILTER_KEYS.has(key)) next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return {
    initialFilters: search ? withoutScope(filtersFromSearch(params), scope) : undefined,
    onFiltersChange,
    generation: own.current.generation,
  };
}
