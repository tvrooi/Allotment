import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Private } from '../ui/Private';
import { formatCurrency } from '../../utils/currency';
import { transactionsLink } from '../../utils/transactionFilters';
import { useUncategorisedSummary } from '../../hooks/useReports';

/** Above this share of spending, a figure built on categories says what it leaves out */
export const UNCATEGORISED_WARN_SHARE = 0.05;

/**
 * "$X of spending isn't categorised, so this leaves it out", with a way to sort it. Shown on
 * numbers built from categories (forecast, reports) so they are never confident about
 * data that is mostly uncategorised.
 */
export function UncategorisedNotice({
  amount,
  from,
  to,
  className = '',
}: {
  /** Uncategorised spending, minor units */
  amount: number;
  from: string;
  to: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Uncategorised spending"
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-caution/30 bg-caution-subtle px-3 py-2 text-sm text-text ${className}`}
    >
      <AlertTriangle size={15} className="shrink-0 text-caution" aria-hidden />
      <span>
        <Private>{formatCurrency(amount)}</Private> of spending isn&rsquo;t categorised, so this
        leaves it out.
      </span>
      <Link
        to={transactionsLink({ uncategorized: true, datePreset: 'custom', from, to })}
        className="font-medium text-brand-600 hover:underline"
      >
        Sort it
      </Link>
    </div>
  );
}

/** The notice for a window of days (YYYY-MM-DD), once uncategorised spending is more than 5% */
export function UncategorisedBanner({
  from,
  to,
  className,
}: {
  from: string;
  to: string;
  className?: string;
}) {
  const { data } = useUncategorisedSummary(from, to);
  if (!data || data.share <= UNCATEGORISED_WARN_SHARE) return null;
  return (
    <UncategorisedNotice
      amount={data.uncategorisedSpending}
      from={from}
      to={to}
      className={className}
    />
  );
}
