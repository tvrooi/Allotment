import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as guidesApi from '../api/guides';
import type { GuideProgress, GuideUpdate } from '../api/guides';
import { applyGuideUpdate } from '../utils/guides';

const QK = ['guides'];

/**
 * The signed-in person's guide progress. Until it loads (or when the server is older and has
 * none, or can't be reached) nothing is offered and no tips show.
 */
export function useGuideProgress() {
  return useQuery({
    queryKey: QK,
    queryFn: guidesApi.getGuideProgress,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** Records progress, showing it straight away; a failed save is put back quietly */
export function useUpdateGuides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: GuideUpdate) => guidesApi.updateGuideProgress(update),
    onMutate: async (update) => {
      await qc.cancelQueries({ queryKey: QK });
      const before = qc.getQueryData<GuideProgress>(QK);
      if (before) qc.setQueryData(QK, applyGuideUpdate(before, update));
      return { before };
    },
    onError: (_error, _update, context) => {
      if (context?.before) qc.setQueryData(QK, context.before);
    },
    onSuccess: (saved) => qc.setQueryData(QK, saved),
  });
}

export function useResetGuides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: guidesApi.resetGuideProgress,
    onSuccess: (saved) => qc.setQueryData(QK, saved),
  });
}
