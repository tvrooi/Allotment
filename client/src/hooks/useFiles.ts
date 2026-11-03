import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/files';

// Files never change a transaction's amount or category. A receipt is a file too, and linking
// or unlinking one can match or unmatch it, so receipts and the register's marks refresh with them.

const FILES = ['files'];

export function useFiles(filter: api.FileFilter, enabled = true) {
  return useQuery({
    queryKey: [...FILES, 'list', filter],
    queryFn: () => api.listFiles(filter),
    enabled,
    // Photos being read by the local model change when it finishes
    refetchInterval: (q) =>
      q.state.data?.documents.some((d) => d.textStatus === 'pending') ? 5000 : false,
  });
}

export const useFile = (id: string | null) =>
  useQuery({
    queryKey: [...FILES, 'one', id],
    queryFn: () => api.getFile(id!),
    enabled: !!id,
  });

export const useFileStorage = () =>
  useQuery({ queryKey: [...FILES, 'storage'], queryFn: api.getFileStorage });

/** Which transactions have files, for the register's paperclips */
export const useFileCounts = (kind: api.LinkKind) =>
  useQuery({ queryKey: [...FILES, 'counts', kind], queryFn: () => api.fileCounts(kind) });

function useRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: FILES }),
      qc.invalidateQueries({ queryKey: ['receipts'] }),
      qc.invalidateQueries({ queryKey: ['tax'] }),
    ]);
}

export function useUploadFile() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      file,
      link,
      tagIds,
    }: {
      file: File;
      link?: { kind: api.LinkKind; id: string };
      tagIds?: string[];
    }) => api.uploadFile(file, file.name, { link, tagIds }),
    onSuccess: refresh,
  });
}

export function useUpdateFile() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: api.FileChange }) =>
      api.updateFile(id, change),
    onSuccess: refresh,
  });
}

export function useLinkFile() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, kind, targetId }: { id: string; kind: api.LinkKind; targetId: string }) =>
      api.linkFile(id, kind, targetId),
    onSuccess: refresh,
  });
}

export function useUnlinkFile() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, kind, targetId }: { id: string; kind: api.LinkKind; targetId: string }) =>
      api.unlinkFile(id, kind, targetId),
    onSuccess: refresh,
  });
}

export function useMakeReceipt() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: api.makeReceipt, onSuccess: refresh });
}

export function useFindFileText() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: api.findFileText, onSuccess: refresh });
}

export function useDeleteFile() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: api.deleteFile, onSuccess: refresh });
}

export function useSetFileStorageCap() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: api.setFileStorageCap, onSuccess: refresh });
}
