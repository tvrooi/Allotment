import { Link } from 'react-router-dom';
import { CandlestickChart } from 'lucide-react';
import { INCOME_KIND_LABEL } from '../../api/investments';
import { useInvestmentForTransaction } from '../../hooks/useInvestments';
import { formatDay } from '../../utils/dates';

// D3b (docs/INVESTMENT-SALES-AND-INCOME.md §4): a deposit linked to a sale or a payment is marked
// as investment money. The link changes nothing else: the category and amount stay the register's.

export function InvestmentMoney({ transactionId }: { transactionId: string }) {
  const { data: link } = useInvestmentForTransaction(transactionId);
  if (!link) return null;
  const what =
    link.kind === 'sale'
      ? `${link.symbol} sale of ${formatDay(link.date)}`
      : `${link.symbol} ${INCOME_KIND_LABEL[link.incomeKind ?? 'dividend'].toLowerCase()} of ${formatDay(link.date)}`;
  return (
    <div>
      <p className="text-xs font-medium text-text-secondary mb-1.5">Investment money</p>
      <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-alt rounded-lg border border-border-light text-sm">
        <CandlestickChart size={14} className="text-brand-600 shrink-0" />
        <span className="min-w-0">
          The deposit of the{' '}
          <Link to="/investments" className="text-brand-600 hover:underline">
            {what}
          </Link>
          .
        </span>
      </div>
    </div>
  );
}
