import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/investments';

// P3 investments: positions only. Nothing here changes a balance, so only the investment
// queries are refreshed after a change.

const KEY = ['investments'];

export function useInvestments() {
  // Recorded balances change with any transaction: always refetched when the page opens
  return useQuery({ queryKey: KEY, queryFn: api.getInvestments, staleTime: 0 });
}

/** After a transaction changed an account's recorded balance */
export function useRefreshInvestments() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function usePrices(securityId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'prices', securityId],
    queryFn: () => api.getPrices(securityId!),
    enabled: !!securityId,
  });
}

/**
 * A mutation that refreshes the overview (and price lists) when it's done. It resolves once
 * they're refetched, so a dialog opened next sees what was just saved.
 */
function useInvestmentMutation<A, R>(fn: (args: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export const useCreateSecurity = () => useInvestmentMutation(api.createSecurity);

export const useUpdateSecurity = () =>
  useInvestmentMutation(({ id, ...data }: { id: string } & Partial<api.SecurityInput>) =>
    api.updateSecurity(id, data),
  );

export const useDeleteSecurity = () => useInvestmentMutation(api.deleteSecurity);

export const useSetPrice = () =>
  useInvestmentMutation(
    ({ securityId, ...data }: { securityId: string; date: string; price: number }) =>
      api.setPrice(securityId, data),
  );

export const useDeletePrice = () =>
  useInvestmentMutation(({ securityId, date }: { securityId: string; date: string }) =>
    api.deletePrice(securityId, date),
  );

export const useCreateHolding = () => useInvestmentMutation(api.createHolding);

export const useUpdateHolding = () =>
  useInvestmentMutation(
    ({ id, ...data }: { id: string; quantity?: number; notes?: string | null }) =>
      api.updateHolding(id, data),
  );

export const useDeleteHolding = () => useInvestmentMutation(api.deleteHolding);

export const useAddLot = () =>
  useInvestmentMutation(({ holdingId, ...data }: { holdingId: string } & api.LotInput) =>
    api.addLot(holdingId, data),
  );

export const useUpdateLot = () =>
  useInvestmentMutation(({ id, ...data }: { id: string } & Partial<api.LotInput>) =>
    api.updateLot(id, data),
  );

export const useDeleteLot = () => useInvestmentMutation(api.deleteLot);
