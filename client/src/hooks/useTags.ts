import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as tagsApi from '../api/tags';
import * as txApi from '../api/transactions';

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
