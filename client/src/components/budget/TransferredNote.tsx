import { Link2 } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency } from '../../utils/currency';
import type { BudgetCategory } from '../../types';

/**
 * For an envelope linked to an account: what transfers into that account added this month.
 * They fund the envelope like an assignment (docs/ENVELOPE-FUNDING.md).
 */
export function TransferredNote({
  cat,
  className = '',
}: {
  cat: BudgetCategory;
  className?: string;
}) {
  const { data: accounts } = useAccounts();
  if (!cat.linkedAccountId) return null;
  const account = accounts?.find((a) => a.id === cat.linkedAccountId)?.name ?? 'linked account';
  const transferred = cat.transferred ?? 0;
  return (
    <p
      className={`flex items-center gap-1 text-xs text-text-tertiary ${className}`}
      data-testid="transferred-note"
    >
      <Link2 size={12} aria-hidden />
      {transferred
        ? `${transferred > 0 ? '+' : '−'}${formatCurrency(Math.abs(transferred))} moved ${transferred > 0 ? 'to' : 'out of'} ${account}`
        : `Funded by transfers to ${account}`}
    </p>
  );
}
