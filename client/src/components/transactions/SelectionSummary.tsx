import type { Ref } from 'react';
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
  /** Ref to the Select button, used as a stable focus fallback when Done closes a row-started selection */
  selectRef?: Ref<HTMLButtonElement>;
  /** Starts selecting with nothing selected yet (covered by the selection bar while selecting) */
  onSelect: (trigger: HTMLButtonElement) => void;
  /** Starts the register's whole-list selection (every listed row) */
  onSelectAll: (trigger: HTMLButtonElement) => void;
}

/** Label shared between the toolbar's Select all button and the selection bar's */
export const selectAllLabel = (count: number) => `Select all ${count.toLocaleString()}`;

/** Tooltip shared between the toolbar's Select all button and the selection bar's */
export const SELECT_ALL_TITLE = 'Choose an action for every transaction in this list';

/** Whether Select all may be offered: only when rows are actually loaded and not already all selected */
export const canSelectAll = (loadedCount: number, wholeList = false) =>
  loadedCount > 0 && !wholeList;

/**
 * Count, money in/out and date span of the register's list, with its CSV export, Select and
 * Select all, which starts the register's whole-list selection (while selecting, the selection bar
 * covers this toolbar in TransactionTable so the list below stays put; a filter change ends a
 * whole-list selection so an action always follows an explicit Select all).
 * Money in and out describe bank movement (a refund is money in), not income and spending
 * (docs/MONARCH-DEVELOPMENT-PHASE.md). A filtered split counts only its matching parts.
 */
export function SelectionSummary({ params, loadedCount, selectRef, onSelect, onSelectAll }: Props) {
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
        {loadedCount > 0 && (
          <button
            ref={selectRef}
            type="button"
            onClick={(e) => onSelect(e.currentTarget)}
            className="inline-flex items-center gap-1 text-text-secondary hover:text-text max-md:min-h-11"
            title="Select transactions to change them together"
          >
            <ListChecks size={12} /> Select
          </button>
        )}
        {canSelectAll(loadedCount) && (
          <button
            type="button"
            onClick={(e) => onSelectAll(e.currentTarget)}
            className="inline-flex items-center gap-1 text-text-secondary hover:text-text max-md:min-h-11"
            title={SELECT_ALL_TITLE}
          >
            <ListChecks size={12} /> {selectAllLabel(loadedCount)}
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
