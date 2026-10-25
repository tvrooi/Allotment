import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/tax';

// Receipts and tax claims. Neither changes a transaction, so only their own queries refresh.

const RECEIPTS = ['receipts'];
const TAX = ['tax'];

export const useReceipts = (filter: { transactionId?: string; inbox?: boolean }) =>
  useQuery({ queryKey: [...RECEIPTS, filter], queryFn: () => api.listReceipts(filter) });

/** Which transactions have receipts and claims, for the register's markers */
export function useReceiptMarks() {
  const counts = useQuery({ queryKey: [...RECEIPTS, 'counts'], queryFn: api.receiptCounts });
  const claims = useQuery({ queryKey: [...TAX, 'claimed'], queryFn: api.claimedIds });
  return {
    receipts: new Set((counts.data ?? []).map((c) => c.transactionId)),
    claims: new Set(claims.data ?? []),
  };
}

function useRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: RECEIPTS }),
      qc.invalidateQueries({ queryKey: TAX }),
    ]);
}

export function useUploadReceipt() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ file, transactionId }: { file: File; transactionId?: string }) => {
      const { blob, name } = await api.prepareReceipt(file);
      return api.uploadReceipt(blob, name, transactionId);
    },
    onSuccess: refresh,
  });
}

export function useUpdateReceipt() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: Parameters<typeof api.updateReceipt>[1] }) =>
      api.updateReceipt(id, change),
    onSuccess: refresh,
  });
}

export function useDeleteReceipt() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: api.deleteReceipt, onSuccess: refresh });
}

export const useReceiptMatches = (id: string, enabled = true) =>
  useQuery({
    queryKey: [...RECEIPTS, 'matches', id],
    queryFn: () => api.receiptMatches(id),
    enabled,
  });

export const useClaim = (transactionId: string) =>
  useQuery({
    queryKey: [...TAX, 'claim', transactionId],
    queryFn: () => api.getClaim(transactionId),
  });

export function useSetClaim() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      transactionId,
      claim,
    }: {
      transactionId: string;
      claim: Parameters<typeof api.setClaim>[1];
    }) => api.setClaim(transactionId, claim),
    onSuccess: refresh,
  });
}

export function useRemoveClaim() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: api.removeClaim, onSuccess: refresh });
}

export const useTaxYears = () => useQuery({ queryKey: [...TAX, 'years'], queryFn: api.taxYears });
export const useTaxYear = (fy: number | null) =>
  useQuery({
    queryKey: [...TAX, 'year', fy],
    queryFn: () => api.taxYear(fy!),
    enabled: fy !== null,
  });
