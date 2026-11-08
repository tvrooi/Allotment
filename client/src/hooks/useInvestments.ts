import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/investments';

// P3 investments: positions only. Nothing here changes a balance, so only the investment
// queries are refreshed after a change, and Tax time's, whose capital gains follow sales and
// the lots they drew from.

const KEY = ['investments'];
const TAX = ['tax'];

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
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: KEY }),
        qc.invalidateQueries({ queryKey: TAX }),
      ]),
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

/** A sale's parcels and gain before it's saved (null input: nothing to preview yet) */
export function useSalePreview(
  holdingId: string,
  input: (api.SaleInput & { saleId?: string }) | null,
) {
  return useQuery({
    queryKey: [...KEY, 'sale-preview', holdingId, input],
    queryFn: () => api.previewSale(holdingId, input!),
    enabled: !!input,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export const useRecordSale = () =>
  useInvestmentMutation(({ holdingId, ...data }: { holdingId: string } & api.SaleInput) =>
    api.recordSale(holdingId, data),
  );

export const useUpdateSale = () =>
  useInvestmentMutation(
    ({ holdingId, saleId, ...data }: { holdingId: string; saleId: string } & api.SaleInput) =>
      api.updateSale(holdingId, saleId, data),
  );

export const useDeleteSale = () =>
  useInvestmentMutation(({ holdingId, saleId }: { holdingId: string; saleId: string }) =>
    api.deleteSale(holdingId, saleId),
  );

export const useSetCarriedLosses = () => useInvestmentMutation(api.setCarriedLosses);

export const useRecordIncome = () =>
  useInvestmentMutation(({ holdingId, ...data }: { holdingId: string } & api.IncomeInput) =>
    api.recordIncome(holdingId, data),
  );

export const useUpdateIncome = () =>
  useInvestmentMutation(
    ({ holdingId, incomeId, ...data }: { holdingId: string; incomeId: string } & api.IncomeInput) =>
      api.updateIncome(holdingId, incomeId, data),
  );

export const useDeleteIncome = () =>
  useInvestmentMutation(({ holdingId, incomeId }: { holdingId: string; incomeId: string }) =>
    api.deleteIncome(holdingId, incomeId),
  );

/** Deposits in the register that could be a sale's or payment's cash */
export const useDepositSuggestions = (of: api.DepositOf | null) =>
  useQuery({
    queryKey: [...KEY, 'deposits', of],
    queryFn: () => api.depositSuggestions(of!),
    enabled: !!of,
  });

/** Links (or unlinks, with null) a deposit; the transaction panel's marker follows */
export function useLinkDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ of, transactionId }: { of: api.DepositOf; transactionId: string | null }) =>
      api.linkDeposit(of, transactionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** The sale or payment this register row is the deposit of, for the transaction panel */
export const useInvestmentForTransaction = (transactionId: string) =>
  useQuery({
    queryKey: [...KEY, 'transaction', transactionId],
    queryFn: () => api.investmentForTransaction(transactionId),
  });
