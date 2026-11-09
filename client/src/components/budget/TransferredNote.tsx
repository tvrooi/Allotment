import { Link2 } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency } from '../../utils/currency';
import type { BudgetCategory } from '../../types';

/** The account an envelope mirrors, or null for an ordinary envelope */
export function useLinkedAccount(cat: Pick<BudgetCategory, 'linkedAccountId'>) {
  const { data: accounts } = useAccounts();
  if (!cat.linkedAccountId) return null;
  const account = accounts?.find((a) => a.id === cat.linkedAccountId);
  return { name: account?.name ?? 'linked account', balance: account?.balance ?? null };
}

/**
 * For an envelope linked to an account: it holds what that account holds
 * (docs/ENVELOPE-FUNDING.md), so the row names the account, its balance and this month's
 * movement in and out. Money reaches it by a transfer, never an assignment.
 */
export function TransferredNote({
  cat,
  className = '',
}: {
  cat: BudgetCategory;
  className?: string;
}) {
  const account = useLinkedAccount(cat);
  if (!account) return null;
  const moved = (cat.transferred ?? 0) + cat.budgeted;
  return (
    <p
      className={`flex items-center gap-1 text-xs text-text-tertiary ${className}`}
      data-testid="transferred-note"
    >
      <Link2 size={12} aria-hidden />
      <span>
        Follows {account.name}
        {account.balance !== null && ` · holds ${formatCurrency(account.balance)}`}
        {moved !== 0 && ` · ${moved > 0 ? '+' : '−'}${formatCurrency(Math.abs(moved))} this month`}
      </span>
    </p>
  );
}
