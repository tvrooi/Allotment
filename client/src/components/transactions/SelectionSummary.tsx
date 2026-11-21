import { Download, ListChecks } from 'lucide-react';
import { useTransactionSummary } from '../../hooks/useTransactions';
import { useBudgetCurrency } from '../../hooks/useCurrency';
import { transactionsCsvPath } from '../../api/transactions';
import { API_BASE } from '../../api/base';
import { IS_DEMO, downloadFromApi } from '../../demo/demoApi';
import { decimalSeparator, formatCurrency, useAmountStyle } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import type { TransactionQueryParams } from '../../types';
import { MissingRateNote } from '../currency/MissingRateNote';

interface Props {
  params: TransactionQueryParams;
  /** Rows in the register, shown until the summary arrives */
  loadedCount: number;
  fixedAccount?: boolean;
  /** Starts selecting with nothing ticked; not given while the register is already selecting */
  onSelect?: () => void;
  /** Starts the register's whole-list selection (every listed row) */
  onSelectAll: () => void;
  /** The whole list is selected already, so the button is not offered */
  selectingAll: boolean;
}

/**
 * Count, money in/out and date span of the register's list, with its CSV export, Select and
 * Select all, which starts the register's whole-list selection (the bar and menu act on it; a filter change
 * ends it, TransactionTable, so a whole-list action always follows an explicit Select all).
 * Money in and out describe bank movement (a refund is money in), not income and spending
 * (docs/MONARCH-DEVELOPMENT-PHASE.md). A filtered split counts only its matching parts.
 */
export function SelectionSummary({
  params,
  loadedCount,
  onSelect,
  onSelectAll,
  selectingAll,
}: Props) {
  const { data } = useTransactionSummary(params);
  const budgetCurrency = useBudgetCurrency();
  const decimalComma = decimalSeparator(useAmountStyle().format) === ',';
  const count = data?.count ?? loadedCount;
  const inBudget = budgetCurrency ? `In ${budgetCurrency}, at each day's rate` : undefined;

  function exportCsv() {
    const url = `${API_BASE}${transactionsCsvPath(params, decimalComma)}`;
    if (IS_DEMO) void downloadFromApi(url);
    else window.location.href = url;
  }

  return (
    <div className="w-full flex flex-col gap-3 text-xs text-text-secondary">
      {data && data.leafCount > 0 && (
        <dl
          aria-label="Money movement"
          className="grid grid-cols-3 gap-3 border-b border-border-light pb-3"
          title={inBudget}
        >
          <div>
            <dt className="text-xs text-text-secondary">Money in</dt>
            <dd className="mt-1 text-xl max-md:text-base font-medium tabular-nums text-positive whitespace-nowrap">
              {formatCurrency(data.moneyIn)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Money out</dt>
            <dd className="mt-1 text-xl max-md:text-base font-medium tabular-nums text-text whitespace-nowrap">
              {formatCurrency(data.moneyOut)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Net movement</dt>
            <dd className="mt-1 text-xl max-md:text-base font-medium tabular-nums text-text whitespace-nowrap">
              {formatCurrency(data.net)}
            </dd>
          </div>
        </dl>
      )}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        <span className="font-medium text-text">
          {count.toLocaleString()} transaction{count === 1 ? '' : 's'}
        </span>
        {data?.firstDate && data.lastDate && (
          <span className="max-md:order-last max-md:w-full">
            {data.firstDate === data.lastDate
              ? formatDay(data.firstDate)
              : `${formatDay(data.firstDate)} – ${formatDay(data.lastDate)}`}
          </span>
        )}
        {data && <MissingRateNote count={data.missingRateCount} />}
        {loadedCount > 0 && onSelect && (
          <button
            type="button"
            onClick={onSelect}
            className="inline-flex items-center gap-1 text-text-secondary hover:text-text max-md:min-h-11"
            title="Tick transactions to change them together"
          >
            <ListChecks size={12} /> Select
          </button>
        )}
        {loadedCount > 0 && !selectingAll && (
          <button
            type="button"
            onClick={onSelectAll}
            className="inline-flex items-center gap-1 text-text-secondary hover:text-text max-md:min-h-11"
            title="Choose an action for every transaction in this list"
          >
            <ListChecks size={12} /> Select all {loadedCount.toLocaleString()}
          </button>
        )}
        {count > 0 && (
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1 text-text-secondary hover:text-text max-md:min-h-11"
            title="Download these transactions as a CSV file (a split's matching parts)"
          >
            <Download size={12} /> Export
          </button>
        )}
      </div>
    </div>
  );
}
