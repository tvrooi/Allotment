import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as tagsApi from '../api/tags';
import * as txApi from '../api/transactions';
import { useUndoStore } from '../store/undoStore';
import type { TransactionQueryParams } from '../types';

// Phase 9: tags, saved views, review and report visibility

/** Hiding or tagging changes reports and the register, never balances or the budget */
function refreshAfterMark(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['transactions'] });
  qc.invalidateQueries({ queryKey: ['reports'] });
  qc.invalidateQueries({ queryKey: ['dashboards'] });
  qc.invalidateQueries({ queryKey: ['tags'] });
}

export function useTags() {
  return useQuery({ queryKey: ['tags'], queryFn: tagsApi.getTags });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tagsApi.createTag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) =>
      tagsApi.updateTag(id, data),
    onSuccess: () => refreshAfterMark(qc),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tagsApi.deleteTag,
    onSuccess: () => refreshAfterMark(qc),
  });
}

export function useSetTransactionTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tagIds }: { id: string; tagIds: string[] }) =>
      txApi.setTransactionTags(id, tagIds),
    onSuccess: () => refreshAfterMark(qc),
  });
}

export function useSetTransactionFlags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...flags
    }: {
      id: string;
      reviewed?: boolean;
      hiddenFromReports?: boolean;
    }) => txApi.setTransactionFlags(id, flags),
    onSuccess: () => refreshAfterMark(qc),
  });
}

/** Mark the selection reviewed, with an undo that puts each row's previous state back */
export function useReviewSelection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      params,
      reviewed,
      expectedCount,
    }: {
      params: TransactionQueryParams;
      reviewed: boolean;
      expectedCount: number;
    }) => txApi.reviewSelection(params, reviewed, expectedCount),
    onSuccess: (result, { reviewed }) => {
      refreshAfterMark(qc);
      if (!result.changes.length) return;
      useUndoStore.getState().push({
        description: `Mark ${result.changes.length} ${reviewed ? 'reviewed' : 'not reviewed'}`,
        undo: async () => {
          await txApi.restoreReview(result.changes);
          refreshAfterMark(qc);
        },
        redo: async () => {
          await txApi.restoreReview(
            result.changes.map((c) => ({
              id: c.id,
              previous: reviewed ? new Date().toISOString() : null,
            })),
          );
          refreshAfterMark(qc);
        },
      });
    },
  });
}

/** Put rows' previous review states back (the inline Undo after Mark reviewed) */
export function useRestoreReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: txApi.restoreReview,
    onSuccess: () => refreshAfterMark(qc),
  });
}

export function useSavedViews() {
  return useQuery({ queryKey: ['saved-views'], queryFn: tagsApi.getSavedViews });
}

export function useCreateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tagsApi.createSavedView,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views'] }),
  });
}

export function useUpdateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; query?: string }) =>
      tagsApi.updateSavedView(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views'] }),
  });
}

export function useDeleteSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tagsApi.deleteSavedView,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views'] }),
  });
}
