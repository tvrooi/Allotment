import { endOfMonth, format, parseISO } from 'date-fns';
import { transactionsLink } from './transactionFilters';

export function cashFlowSelection(
  node: {
    nodeType: 'income' | 'hub' | 'expense-group' | 'subcategory' | 'savings';
    categoryId?: string | null;
    groupId?: string | null;
  },
  from: string,
  to: string,
) {
  return {
    budgetReport: true,
    categoryId: node.nodeType === 'subcategory' ? (node.categoryId ?? undefined) : undefined,
    categoryGroupId: node.nodeType === 'expense-group' ? (node.groupId ?? undefined) : undefined,
    uncategorized:
      (node.nodeType === 'subcategory' && !node.categoryId) ||
      (node.nodeType === 'expense-group' && !node.groupId),
    ...monthsAsDays(from, to),
  };
}

/** Report months (YYYY-MM) as the register's day range: the first of one to the last of the other */
export function monthsAsDays(from: string, to: string) {
  return { from: `${from}-01`, to: format(endOfMonth(parseISO(`${to}-01`)), 'yyyy-MM-dd') };
}

/** The same selection on All Transactions, where it can be filtered further and exported */
export function cashFlowTransactionsLink(
  node: Parameters<typeof cashFlowSelection>[0],
  from: string,
  to: string,
): string {
  const s = cashFlowSelection(node, from, to);
  return transactionsLink({
    budgetReport: true,
    datePreset: 'custom',
    from: s.from,
    to: s.to,
    categoryIds: s.categoryId ? [s.categoryId] : [],
    categoryGroupId: s.categoryGroupId ?? null,
    uncategorized: s.uncategorized,
  });
}
