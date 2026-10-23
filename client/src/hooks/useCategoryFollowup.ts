import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as txApi from '../api/transactions';
import { useFollowupStore } from '../store/followupStore';
import type { CategoryGroup, PayeeWithCount, Transaction } from '../types';

/**
 * After a category change, offer to give the same payee's other transactions that category,
 * make it the payee's default, or create a rule. Nothing is offered for transfers, rows without
 * a payee record, or payees the user asked not to be asked about.
 */
export function useOfferCategoryFollowup() {
  const qc = useQueryClient();
  return useCallback(
    async (tx: Transaction, categoryId: string | null) => {
      if (!categoryId || categoryId.startsWith('transfer:') || !tx.payeeId) return;
      if (tx.transferTransactionId) return;
      const payee = qc.getQueryData<PayeeWithCount[]>(['payees'])?.find((p) => p.id === tx.payeeId);
      if (!payee || payee.skipCategoryFollowup) return;
      const category = qc
        .getQueryData<CategoryGroup[]>(['categories'])
        ?.flatMap((g) => g.categories)
        .find((c) => c.id === categoryId);
      if (!category) return;
      const isDefault = payee.defaultCategoryId === categoryId;
      try {
        const preview = await txApi.previewBulkEdit(
          { params: { payeeIds: [payee.id] } },
          { categoryId },
        );
        if (!preview.changing && isDefault) return;
        useFollowupStore.getState().show({
          payeeId: payee.id,
          payeeName: payee.name,
          categoryId,
          categoryName: category.name,
          others: preview.changing,
          matched: preview.matched,
          isDefault,
        });
      } catch {
        // The offer is a convenience: the change itself is already saved
      }
    },
    [qc],
  );
}
