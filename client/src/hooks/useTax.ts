import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/tax';

// Receipts and tax claims. Neither changes a transaction, so only their own queries refresh.

const RECEIPTS = ['receipts'];
const TAX = ['tax'];

export const useReceipts = (filter: Parameters<typeof api.listReceipts>[0]) =>
  useQuery({
    queryKey: [...RECEIPTS, filter],
    queryFn: () => api.listReceipts(filter),
    // Receipts being read by the local model change when it finishes
    refetchInterval: (q) => (q.state.data?.some((r) => r.readStatus === 'pending') ? 5000 : false),
  });

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
  // Uploaded onto a transaction, it tags and enriches that transaction too
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: async ({ file, transactionId }: { file: File; transactionId?: string }) => {
      const { blob, name } = await api.prepareReceipt(file);
      return api.uploadReceipt(blob, name, transactionId);
    },
    onSuccess: refresh,
  });
}

export function useUpdateReceipt() {
  const refresh = useRefreshAll();
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

export const useReceipt = (id: string | null) =>
  useQuery({
    queryKey: [...RECEIPTS, 'one', id],
    queryFn: () => api.getReceipt(id!),
    enabled: !!id,
    // While the local model reads it, look again every few seconds
    refetchInterval: (q) => (q.state.data?.readStatus === 'pending' ? 3000 : false),
  });

export const useReceiptSearch = (id: string, q: string) =>
  useQuery({
    queryKey: [...RECEIPTS, 'matches', id, q],
    queryFn: () => api.receiptMatches(id, q || undefined),
  });

export const useReceiptSettings = () =>
  useQuery({ queryKey: [...RECEIPTS, 'settings'], queryFn: api.getReceiptSettings });

/** Matching or creating changes transactions (tags, notes, splits): refresh those too */
export function useRefreshAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: RECEIPTS }),
      qc.invalidateQueries({ queryKey: TAX }),
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['tags'] }),
      // A transaction made from a receipt changes its account's balance and the budget
      qc.invalidateQueries({ queryKey: ['accounts'] }),
      qc.invalidateQueries({ queryKey: ['review'] }),
    ]);
}

export function useSetReceiptSettings() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: api.setReceiptSettings, onSuccess: refresh });
}

export function useMatchReceiptsNow() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: api.matchReceiptsNow, onSuccess: refresh });
}

export function useCreateTransactionFromReceipt() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof api.createTransactionFromReceipt>[1];
    }) => api.createTransactionFromReceipt(id, body),
    onSuccess: refresh,
  });
}

export function useSplitByItems() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: api.splitReceiptByItems, onSuccess: refresh });
}

export const useReaderSettings = () =>
  useQuery({ queryKey: [...RECEIPTS, 'reader'], queryFn: api.getReaderSettings });

export function useSetReaderSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.setReaderSettings,
    onSuccess: (data) => qc.setQueryData([...RECEIPTS, 'reader'], data),
  });
}

/** The models on an Ollama server (checks the address too) */
export const useReaderModels = () => useMutation({ mutationFn: api.readerModels });

export function useReadReceipt() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: api.readReceipt, onSuccess: refresh });
}

/** The last try of the model on the sample receipt; looked at every few seconds while it runs */
export const useSampleRead = () =>
  useQuery({
    queryKey: [...RECEIPTS, 'reader', 'sample'],
    queryFn: api.getSampleRead,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 3000 : false),
  });

export function useStartSampleRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.startSampleRead,
    onSuccess: (data) => qc.setQueryData([...RECEIPTS, 'reader', 'sample'], data),
  });
}
