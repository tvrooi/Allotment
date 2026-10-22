import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { endOfMonth, format, parseISO } from 'date-fns';
import { useSpendingByPayee } from '../../hooks/useReports';
import { formatCurrency } from '../../utils/currency';
import { transactionsLink } from '../../utils/transactionFilters';
import { TransactionTable } from '../transactions/TransactionTable';
import type { SpendingByPayee } from '../../api/reports';

interface Props {
  from: string;
  to: string;
}

const keyOf = (r: SpendingByPayee) => r.payeeId ?? `name:${r.payeeName}`;
const nameOf = (r: SpendingByPayee) => r.payeeName || 'No payee';

/**
 * Cash Flow's spending by merchant (payee), with the same spending definition as categories:
 * merchants with net refunds are listed too, so the rows add up to the period's spending.
 */
export function MerchantBreakdown({ from, to }: Props) {
  const { data = [], isLoading } = useSpendingByPayee(from, to);
  const [selected, setSelected] = useState<string | null>(null);
  const spent = useMemo(() => data.filter((r) => r.net < 0), [data]);
  const refunded = useMemo(() => data.filter((r) => r.net > 0), [data]);
  const total = Math.max(0, -data.reduce((s, r) => s + r.net, 0));
  const largest = spent.length ? -spent[0].net : 0;
  const days = {
    from: `${from}-01`,
    to: format(endOfMonth(parseISO(`${to}-01`)), 'yyyy-MM-dd'),
  };
  const chosen = data.find((r) => keyOf(r) === selected);
  const scope = chosen
    ? chosen.payeeId
      ? { payeeIds: [chosen.payeeId] }
      : { payeeName: chosen.payeeName }
    : null;

  if (isLoading) return <div className="h-40 bg-surface-alt rounded-lg animate-pulse" />;
  if (!data.length) {
    return (
      <p className="text-sm text-text-tertiary py-8 text-center">No spending in this period.</p>
    );
  }

  const row = (r: SpendingByPayee) => {
    const amount = Math.abs(r.net);
    const share = r.net < 0 && total > 0 ? (amount / total) * 100 : null;
    return (
      <li key={keyOf(r)}>
        <button
          type="button"
          onClick={() => setSelected(keyOf(r) === selected ? null : keyOf(r))}
          aria-pressed={keyOf(r) === selected}
          className={`w-full text-left px-3 py-2 max-md:min-h-11 rounded-md transition-colors ${
            keyOf(r) === selected ? 'bg-brand-50' : 'hover:bg-surface-alt'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-text truncate">{nameOf(r)}</span>
            <span
              className={`text-sm tabular-nums shrink-0 ${r.net > 0 ? 'text-positive' : 'text-text'}`}
            >
              {r.net > 0 ? `+${formatCurrency(amount)}` : formatCurrency(amount)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {r.net < 0 && (
              <div className="flex-1 h-1.5 bg-surface-alt rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 rounded-full"
                  style={{ width: `${largest ? (amount / largest) * 100 : 0}%` }}
                />
              </div>
            )}
            <span className="text-xs text-text-tertiary tabular-nums shrink-0">
              {r.count} transaction{r.count === 1 ? '' : 's'}
              {share !== null && ` · ${share.toFixed(1)}%`}
              {r.net > 0 && ' · net refund'}
            </span>
          </div>
        </button>
      </li>
    );
  };

  return (
    <div>
      <div className="bg-surface rounded-lg shadow-card border border-border-light p-3">
        <div className="flex items-center justify-between px-3 pb-2">
          <h2 className="text-sm font-semibold text-text">Spending by merchant</h2>
          <span className="text-xs text-text-tertiary tabular-nums">
            {formatCurrency(total)} total
          </span>
        </div>
        <ul aria-label="Merchants">{spent.map(row)}</ul>
        {refunded.length > 0 && (
          <>
            <p className="px-3 pt-3 pb-1 text-xs text-text-tertiary">
              Net refunds, which lower the total
            </p>
            <ul aria-label="Net refunds">{refunded.map(row)}</ul>
          </>
        )}
      </div>

      {chosen && scope && (
        <section className="mt-6" aria-labelledby="merchant-transactions-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="merchant-transactions-heading" className="text-sm font-semibold text-text">
              Transactions: {nameOf(chosen)}
            </h2>
            <div className="flex items-center gap-3">
              <Link
                to={transactionsLink({
                  ...scope,
                  budgetReport: true,
                  datePreset: 'custom',
                  from: days.from,
                  to: days.to,
                })}
                className="text-xs text-brand-600 hover:text-brand-700"
              >
                Open in Transactions
              </Link>
              <button
                onClick={() => setSelected(null)}
                className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary cursor-pointer"
              >
                <X size={14} /> Clear
              </button>
            </div>
          </div>
          <div className="bg-surface rounded-lg shadow-card border border-border-light overflow-hidden">
            <TransactionTable
              key={`${selected}:${from}:${to}`}
              budgetReport
              {...scope}
              from={days.from}
              to={days.to}
              overlayDetail
            />
          </div>
        </section>
      )}
    </div>
  );
}
