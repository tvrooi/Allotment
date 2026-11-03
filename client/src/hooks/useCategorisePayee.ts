import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as payeesApi from '../api/payees';
import * as txApi from '../api/transactions';
import { useUndoStore } from '../store/undoStore';
import type { PayeeWithCount, TransactionQueryParams } from '../types';

export interface PayeeTarget {
  payeeId: string | null;
  payeeName: string;
}

/** Categories feed the budget, reports, forecasts and the register */
function refresh(qc: QueryClient) {
  for (const key of [
    'transactions',
    'review',
    'accounts',
    'budget',
    'reports',
    'dashboards',
    'payees',
    'payday',
    'tags',
  ])
    void qc.invalidateQueries({ queryKey: [key] });
}

const paramsFor = (p: PayeeTarget): TransactionQueryParams => ({
  uncategorized: true,
  ...(p.payeeId ? { payeeIds: [p.payeeId] } : { payeeName: p.payeeName }),
});

/**
 * Put a payee's uncategorised transactions in one category and, if asked, make it the payee's
 * default so later ones follow. It is one step on the undo stack (Ctrl+Z, or the Undo the
 * caller shows): the rows go back exactly as they were and the old default comes back.
 * Reconciled, split and transfer rows are left alone by the bulk edit itself.
 */
export function useCategorisePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      payee,
      categoryId,
      future,
    }: {
      payee: PayeeTarget;
      categoryId: string;
      categoryName: string;
      /** Also make this the payee's default category */
      future: boolean;
    }) => {
      const params = paramsFor(payee);
      let previousDefault: string | null = null;
      const setDefault = future && !!payee.payeeId;
      if (setDefault) {
        const all = await qc.fetchQuery({
          queryKey: ['payees'],
          queryFn: payeesApi.getPayees,
          staleTime: 0,
        });
        previousDefault =
          all.find((p: PayeeWithCount) => p.id === payee.payeeId)?.defaultCategoryId ?? null;
        await payeesApi.updatePayee(payee.payeeId!, { defaultCategoryId: categoryId });
      }
      try {
        const preview = await txApi.previewBulkEdit({ params }, { categoryId });
        const result = preview.changing
          ? await txApi.bulkEditTransactions({ params }, { categoryId }, preview.matched)
          : { changed: 0, restore: [] as txApi.BulkRestore[] };
        return { result, previousDefault, setDefault };
      } catch (error) {
        // Don't leave a default behind for a sort that did not happen
        if (setDefault)
          await payeesApi.updatePayee(payee.payeeId!, { defaultCategoryId: previousDefault });
        throw error;
      }
    },
    onSuccess: ({ result, previousDefault, setDefault }, { payee, categoryId, categoryName }) => {
      refresh(qc);
      if (!result.restore.length && !setDefault) return;
      const ids = result.restore.map((r) => r.id);
      useUndoStore.getState().push({
        description: `Sort ${payee.payeeName} as ${categoryName}`,
        undo: async () => {
          if (result.restore.length) await txApi.restoreBulkEdit(result.restore);
          if (setDefault)
            await payeesApi.updatePayee(payee.payeeId!, { defaultCategoryId: previousDefault });
          refresh(qc);
        },
        redo: async () => {
          if (setDefault)
            await payeesApi.updatePayee(payee.payeeId!, { defaultCategoryId: categoryId });
          if (ids.length)
            await txApi.bulkEditTransactions({ params: {}, ids }, { categoryId }, ids.length);
          refresh(qc);
        },
      });
    },
  });
}
