import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as txApi from '../api/transactions';
import { useUndoStore } from '../store/undoStore';
import type { Transaction } from '../types';

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

/** What an edit can change (the server's own field list), what it did and why it skipped rows */
export type { BulkChanges, BulkResult, BulkSkipReason } from '../api/transactions';

/** The rows an edit or delete reaches: the register's list, or hand-picked rows within it */
export type EditTarget = txApi.BulkTarget;

export function usePreviewBulkEdit() {
  return useMutation({
    mutationFn: ({ changes, ...target }: EditTarget & { changes: txApi.BulkChanges }) =>
      txApi.previewBulkEdit(target, changes),
  });
}

/** Edit the selection, with an undo that puts every changed row back exactly */
export function useBulkEdit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      changes,
      expectedCount,
      ...target
    }: EditTarget & {
      changes: txApi.BulkChanges;
      expectedCount: number;
      /** What the toast says, from how many changed (it offers Undo only when one was recorded) */
      message?: (changed: number, result: txApi.BulkResult) => string;
    }) => txApi.bulkEditTransactions(target, changes, expectedCount),
    onSuccess: (result, { changes, message }) => {
      refreshAfterEdit(qc);
      // Nothing restorable means nothing was recorded to undo
      if (!result.restore.length) {
        if (message) useUndoStore.getState().announce(message(result.changed, result), false);
        return;
      }
      const ids = result.restore.map((r) => r.id);
      useUndoStore.getState().push(
        {
          description: `Edit ${ids.length} transaction${ids.length === 1 ? '' : 's'}`,
          undo: async () => {
            await txApi.restoreBulkEdit(result.restore);
            refreshAfterEdit(qc);
          },
          redo: async () => {
            await txApi.bulkEditTransactions({ params: {}, ids }, changes, ids.length);
            refreshAfterEdit(qc);
          },
        },
        { message: message?.(result.changed, result) },
      );
    },
  });
}

export function usePreviewBulkDelete() {
  return useMutation({
    mutationFn: (target: EditTarget) => txApi.previewBulkDelete(target),
  });
}

/** Delete the selection. There is no undo: a restored row would lose its links, parts and tags. */
export function useBulkDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expectedCount, ...target }: EditTarget & { expectedCount: number }) =>
      txApi.bulkDeleteTransactions(target, expectedCount),
    onSuccess: () => refreshAfterEdit(qc),
  });
}
