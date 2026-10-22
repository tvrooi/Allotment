import { Download } from 'lucide-react';
import { useTransactionSummary } from '../../hooks/useTransactions';
import { useBudgetCurrency } from '../../hooks/useCurrency';
import { transactionsCsvPath } from '../../api/transactions';
import { API_BASE } from '../../api/base';
import { IS_DEMO, downloadFromApi } from '../../demo/demoApi';
import { decimalSeparator, formatCurrency, useAmountStyle } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import type { TransactionQueryParams } from '../../types';

interface Props {
  params: TransactionQueryParams;
  /** Rows in the register, shown until the summary arrives */
  loadedCount: number;
  fixedAccount?: boolean;
}

/**
 * Count, money in/out and date span of the register's selection, with its CSV export.
 * Money in and out describe bank movement (a refund is money in), not income and spending
 * (docs/MONARCH-DEVELOPMENT-PHASE.md). A filtered split counts only its matching parts.
 */
export function SelectionSummary({ params, loadedCount }: Props) {
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
    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-text-tertiary">
      <span>
        {count.toLocaleString()} transaction{count === 1 ? '' : 's'}
      </span>
      {data && data.leafCount > 0 && (
        <>
          <span className="tabular-nums" title={inBudget}>
            In <span className="text-positive font-medium">{formatCurrency(data.moneyIn)}</span>
          </span>
          <span className="tabular-nums" title={inBudget}>
            Out <span className="text-negative font-medium">{formatCurrency(data.moneyOut)}</span>
          </span>
          <span className="tabular-nums" title={inBudget}>
            Net{' '}
            <span
              className={`font-medium ${data.net < 0 ? 'text-negative' : 'text-text-secondary'}`}
            >
              {formatCurrency(data.net)}
            </span>
          </span>
          {data.firstDate && data.lastDate && (
            <span>
              {data.firstDate === data.lastDate
                ? formatDay(data.firstDate)
                : `${formatDay(data.firstDate)} – ${formatDay(data.lastDate)}`}
            </span>
          )}
          {data.missingRateCount > 0 && (
            <span className="text-caution" title="Their exchange rate is missing">
              {data.missingRateCount} without a rate left out
            </span>
          )}
        </>
      )}
      {count > 0 && (
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1 text-text-secondary hover:text-text max-md:min-h-8"
          title="Download these transactions as a CSV file (a split's matching parts)"
        >
          <Download size={12} /> Export
        </button>
      )}
    </div>
  );
}
