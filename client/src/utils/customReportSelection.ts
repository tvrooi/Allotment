import type { CustomReportConfig } from '../types';
import { monthsAsDays } from './cashFlowSelection';
import { transactionsLink } from './transactionFilters';

/**
 * A link to the transactions behind one row of a custom report's Name/Amount table (UX audit
 * AU-014), or null where the register can't select exactly those rows, so a link never opens
 * a list that doesn't add up to the total it came from.
 *
 * `/reports/custom` counts reportedActivity: on budget accounts unless the report picks its
 * own (the register's budget_report scope), spending as each negative row (direction debit),
 * income as rows in an income group. Rows are left without a link when the report picks
 * accounts (an off-budget account is outside budget_report), filters more than one category
 * group (the register takes one), is income grouped other than by category or group (the
 * register has no "any income group" filter), or the row is the one that lumps every
 * transaction without a payee together.
 */
export function customReportRowLink(
  config: CustomReportConfig,
  row: { id: string | null },
): string | null {
  const { groupBy, balanceType, filters, dateRange } = config;
  if (filters.accountIds.length || filters.categoryGroupIds.length > 1) return null;
  if (balanceType === 'income' && groupBy !== 'category' && groupBy !== 'categoryGroup') {
    return null;
  }
  if (groupBy === 'payee' && !row.id) return null;

  const months = groupBy === 'month' && row.id ? { from: row.id, to: row.id } : dateRange;
  const days = monthsAsDays(months.from, months.to);
  const categoryIds = groupBy === 'category' ? (row.id ? [row.id] : []) : filters.categoryIds;
  const categoryGroupId =
    groupBy === 'categoryGroup' ? row.id : (filters.categoryGroupIds[0] ?? null);
  return transactionsLink({
    budgetReport: true,
    datePreset: 'custom',
    ...days,
    categoryIds,
    categoryGroupId,
    uncategorized: (groupBy === 'category' || groupBy === 'categoryGroup') && !row.id,
    payeeIds: groupBy === 'payee' && row.id ? [row.id] : [],
    accountIds: groupBy === 'account' && row.id ? [row.id] : [],
    direction: balanceType === 'expense' ? 'debit' : 'all',
  });
}
