import type { Transaction } from '../../types';

/**
 * The update for changing one transaction's category from the register or its details: Undo
 * puts back exactly the category (nothing else on the row), and the undo toast says what
 * changed (#245).
 */
export function categoriseEdit(
  tx: Pick<Transaction, 'id' | 'categoryId'>,
  payeeName: string,
  categoryId: string | null,
  categoryName: string | undefined,
) {
  return {
    id: tx.id,
    data: { categoryId },
    undo: { description: `Categorise ${payeeName}`, data: { categoryId: tx.categoryId } },
    message: categoryId
      ? `${payeeName} categorised as ${categoryName ?? 'a category'}.`
      : `${payeeName} uncategorised.`,
  };
}
