import { useEffect, useState } from 'react';
import {
  CheckCheck,
  Download,
  ListChecks,
  MoreHorizontal,
  PencilLine,
  Trash2,
  X,
} from 'lucide-react';
import { useRestoreReview, useReviewSelection } from '../../hooks/useTags';
import type { ReviewChange } from '../../api/transactions';
import { ConfirmModal } from '../ui/ConfirmModal';
import { BulkEditModal } from './BulkEditModal';
import { BulkDeleteModal } from './BulkDeleteModal';
import { ShareWithHousehold } from '../household/ShareWithHousehold';
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
  const review = useReviewSelection();
  const restore = useRestoreReview();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Bulk actions on the whole list wait for an explicit "Select all": a destructive one is
  // never a single click away from just looking at a filtered list
  const [acting, setActing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // The last Mark reviewed here, offered for undo until the selection changes
  const [marked, setMarked] = useState<ReviewChange[] | null>(null);
  const paramsKey = JSON.stringify(params);
  useEffect(() => setMarked(null), [paramsKey]);
  useEffect(() => {
    setActing(false);
    setMoreOpen(false);
  }, [paramsKey]);
  // The register's own rows: what the server's review matches, and what is on screen
  const reviewCount = loadedCount;

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
        {data && data.missingRateCount > 0 && (
          <span className="text-caution" title="Their exchange rate is missing">
            {data.missingRateCount} without a rate left out
          </span>
        )}
        {reviewCount > 0 && !acting && (
          <button
            type="button"
            onClick={() => setActing(true)}
            className="inline-flex items-center gap-1 text-text-secondary hover:text-text max-md:min-h-11"
            title="Choose an action for every transaction in this list"
          >
            <ListChecks size={12} /> Select all {reviewCount.toLocaleString()}
          </button>
        )}
        {reviewCount > 0 && acting && (
          <span
            role="group"
            aria-label={`Actions for ${reviewCount.toLocaleString()} transactions`}
            className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full bg-brand-50 px-3 py-0.5"
          >
            <span className="font-medium text-text">{reviewCount.toLocaleString()} selected</span>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={review.isPending}
              className="inline-flex items-center gap-1 text-text-secondary hover:text-text max-md:min-h-11"
              title="Mark every transaction in this list reviewed (you can undo it)"
            >
              <CheckCheck size={12} /> Mark reviewed
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-text-secondary hover:text-text max-md:min-h-11"
              title="Change category, payee, notes, tags or visibility on every transaction in this list"
            >
              <PencilLine size={12} /> Edit {reviewCount.toLocaleString()}
            </button>
            <ShareWithHousehold params={params} variant="link" />
            <span className="relative">
              <button
                type="button"
                aria-label="More actions"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((o) => !o)}
                className="inline-flex items-center text-text-secondary hover:text-text max-md:min-h-11 max-md:min-w-11 justify-center"
              >
                <MoreHorizontal size={14} />
              </button>
              {moreOpen && (
                <span
                  role="menu"
                  className="absolute left-0 top-full z-20 mt-1 block min-w-[11rem] rounded-md border border-border bg-surface py-1 shadow-hover"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      setDeleting(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-negative hover:bg-hover max-md:min-h-11"
                    title="Delete every transaction in this list (reconciled ones are kept)"
                  >
                    <Trash2 size={12} /> Delete {reviewCount.toLocaleString()}
                  </button>
                </span>
              )}
            </span>
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => {
                setActing(false);
                setMoreOpen(false);
              }}
              className="inline-flex items-center text-text-tertiary hover:text-text max-md:min-h-11 max-md:min-w-11 justify-center"
            >
              <X size={12} />
            </button>
          </span>
        )}
        <BulkEditModal
          params={params}
          count={reviewCount}
          isOpen={editing}
          onClose={() => setEditing(false)}
        />
        <BulkDeleteModal params={params} isOpen={deleting} onClose={() => setDeleting(false)} />
        {marked && (
          <span role="status" className="text-text-secondary">
            Marked {marked.length.toLocaleString()} reviewed.{' '}
            <button
              type="button"
              onClick={() => restore.mutate(marked, { onSuccess: () => setMarked(null) })}
              disabled={restore.isPending}
              className="text-brand-600 hover:text-brand-700 font-medium"
            >
              Undo
            </button>
          </span>
        )}
        {review.error && (
          <span role="alert" className="text-negative">
            {review.error.message}
          </span>
        )}
        <ConfirmModal
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            review.mutate(
              { params, reviewed: true, expectedCount: reviewCount },
              { onSuccess: (result) => setMarked(result.changes) },
            );
          }}
          title="Mark reviewed"
          message={`Mark ${reviewCount.toLocaleString()} transaction${reviewCount === 1 ? '' : 's'} reviewed? This only records that you have looked at them; amounts and reconciliation are unchanged. You can undo it.`}
          confirmLabel={`Mark ${reviewCount.toLocaleString()} reviewed`}
        />
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
