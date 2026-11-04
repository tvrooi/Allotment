import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/assets';

// Depreciating assets. They never change a transaction or the budget: only tax views refresh.

const ASSETS = ['tax', 'assets'];
const LODGED = ['tax', 'lodged'];

export const useAssets = () => useQuery({ queryKey: ASSETS, queryFn: api.listAssets });
export const useLodgedYears = () => useQuery({ queryKey: LODGED, queryFn: api.lodgedYears });

/** Assets, lodged years, tax years (their totals include assets) and files (asset links) */
function useRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['tax'] }),
      qc.invalidateQueries({ queryKey: ['files'] }),
    ]);
}

export function useAssetMutation<A>(fn: (args: A) => Promise<unknown>) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: fn, onSuccess: () => refresh() });
}
