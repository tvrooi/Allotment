import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as txApi from '../api/transactions';
import { useUndoStore } from '../store/undoStore';
import type { Transaction, TransactionQueryParams } from '../types';

// Splitting a transaction after it arrives, and editing many at once

/** Categories, payees and visibility feed the budget, reports and the register */
function refreshAfterEdit(qc: QueryClient) {
  for (const key of [
    'transactions',
    'review',
    'accounts',
    'budget',
    'reports',
    'dashboards',
    'tags',
  ])
    qc.invalidateQueries({ queryKey: [key] });
}

/** The parts a transaction has now, as the split route takes them */
const currentParts = (tx: Transaction): txApi.SplitPartInput[] =>
  tx.isParent === 1 && tx.children?.length
    ? tx.children.map((c) => ({ categoryId: c.categoryId, amount: c.amount, notes: c.notes }))
    : [];

/** Split, re-split or unsplit, with an undo that puts the previous parts back */
export function useSplitTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tx, splits }: { tx: Transaction; splits: txApi.SplitPartInput[] }) =>
      txApi.splitTransaction(tx.id, splits),
    onSuccess: (_, { tx, splits }) => {
      refreshAfterEdit(qc);
      const before = currentParts(tx);
      // Unsplitting restores the parts' category; putting a whole one back needs its category
      const restore = async () => {
        await txApi.splitTransaction(tx.id, before);
        if (!before.length)
          await txApi.updateTransaction(tx.id, { categoryId: tx.categoryId ?? null });
        refreshAfterEdit(qc);
      };
      useUndoStore.getState().push({
        description: splits.length ? 'Split transaction' : 'Unsplit transaction',
        undo: restore,
        redo: async () => {
          await txApi.splitTransaction(tx.id, splits);
          refreshAfterEdit(qc);
        },
      });
    },
  });
}

export function usePreviewBulkEdit() {
  return useMutation({
    mutationFn: ({
      params,
      changes,
    }: {
      params: TransactionQueryParams;
      changes: txApi.BulkChanges;
    }) => txApi.previewBulkEdit({ params }, changes),
  });
}

/** Edit the selection, with an undo that puts every changed row back exactly */
export function useBulkEdit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      params,
      changes,
      expectedCount,
    }: {
      params: TransactionQueryParams;
      changes: txApi.BulkChanges;
      expectedCount: number;
    }) => txApi.bulkEditTransactions({ params }, changes, expectedCount),
    onSuccess: (result, { changes }) => {
      refreshAfterEdit(qc);
      if (!result.restore.length) return;
      const ids = result.restore.map((r) => r.id);
      useUndoStore.getState().push({
        description: `Edit ${ids.length} transaction${ids.length === 1 ? '' : 's'}`,
        undo: async () => {
          await txApi.restoreBulkEdit(result.restore);
          refreshAfterEdit(qc);
        },
        redo: async () => {
          await txApi.bulkEditTransactions({ params: {}, ids }, changes, ids.length);
          refreshAfterEdit(qc);
        },
      });
    },
  });
}
