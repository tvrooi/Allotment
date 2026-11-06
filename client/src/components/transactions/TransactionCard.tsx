import { RowMarks } from './TransactionMarks';
import { CategoryIcon } from '../ui/CategoryIcon';
import { useMemo } from 'react';
import { ArrowLeftRight, ChevronRight, Lock, MoreHorizontal, Split } from 'lucide-react';
import { PayeeIcon } from '../payees/PayeeIcon';
import { formatMoney } from '../../utils/currency';
import { useAccountCurrency } from '../../hooks/useCurrency';
import { ForeignValue } from '../currency/ForeignValue';
import { usePreferencesStore } from '../../store/preferencesStore';
import type { MenuPoint } from '../ui/ContextMenu';
import type { Transaction, PayeeWithCount } from '../../types';

interface Props {
  tx: Transaction;
  categoryEntry: { name: string; icon: string | null } | null;
  payees: PayeeWithCount[];
  /** Shown on the all-transactions page, where rows come from several accounts */
  accountName?: string;
  isSelected: boolean;
  onOpenDetail: (id: string) => void;
  /** Opens its actions menu (a ⋯ button; a long press does the same) */
  onMenu?: (at: MenuPoint) => void;
}

/**
 * A transaction in the register on a phone: one tap target instead of the desktop row's
 * hover controls. Payee and amount on top, category (or split / transfer), account and
 * notes below. Tapping opens the full-screen details, where it's edited.
 */
export function TransactionCard({
  tx,
  categoryEntry,
  payees,
  accountName,
  isSelected,
  onOpenDetail,
  onMenu,
}: Props) {
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const currencyOf = useAccountCurrency();
  const isTransfer = !!tx.transferTransactionId;
  const isSplit = tx.isParent === 1 && !!tx.children?.length;
  const payeeName = tx.payeeName || (isTransfer ? 'Transfer' : '—');
  const payee = useMemo(
    () => (tx.payeeId ? payees.find((p) => p.id === tx.payeeId) : undefined),
    [payees, tx.payeeId],
  );

  const category = isSplit ? (
    <span className="inline-flex items-center gap-1 text-brand-600">
      <Split size={12} aria-hidden /> Split ({tx.children!.length})
    </span>
  ) : isTransfer && !tx.isBudgetBoundary ? (
    <span className="inline-flex items-center gap-1">
      <ArrowLeftRight size={12} aria-hidden /> Transfer
    </span>
  ) : categoryEntry ? (
    <span className="inline-flex items-center gap-1">
      {showCategoryIcons && <CategoryIcon icon={categoryEntry.icon} size={12} />}
      {categoryEntry.name}
    </span>
  ) : (
    <span className="text-caution">Uncategorised</span>
  );

  const card = (
    <button
      type="button"
      onClick={() => onOpenDetail(tx.id)}
      data-testid="transaction-card"
      data-tx-id={tx.id}
      aria-current={isSelected || undefined}
      className={`w-full min-h-14 flex items-center gap-3 px-4 py-2.5 text-left select-none [-webkit-touch-callout:none] border-b border-border-light transition-colors ${
        isSelected ? 'bg-brand-50' : 'bg-surface active:bg-hover'
      }`}
    >
      <PayeeIcon name={payeeName} logo={payee?.logo} transfer={isTransfer} />
      <span className="flex-1 min-w-0 grid gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className="flex-1 min-w-0 truncate text-row font-medium text-text">
            {payeeName}
          </span>
          <span
            className={`shrink-0 text-row font-medium tabular-nums ${tx.amount > 0 ? 'text-positive' : 'text-text'}`}
          >
            {tx.amount > 0 ? '+' : ''}
            {formatMoney(Math.abs(tx.amount), currencyOf(tx.accountId))}
          </span>
        </span>
        <ForeignValue tx={tx} className="justify-self-end" />
        <span className="flex items-center gap-1.5 text-xs text-text-tertiary min-w-0">
          <span className="min-w-0 truncate">{category}</span>
          {/* A long account name gives way first, so the category stays readable */}
          {accountName && <span className="min-w-0 truncate shrink-[4]">· {accountName}</span>}
          {tx.reconciled ? (
            <Lock size={11} className="shrink-0 text-text-disabled" aria-label="Reconciled" />
          ) : null}
          <RowMarks tx={tx} />
        </span>
        {tx.notes && <span className="text-xs text-text-tertiary truncate">{tx.notes}</span>}
      </span>
      {onMenu ? (
        <span className="w-8 shrink-0" aria-hidden />
      ) : (
        <ChevronRight size={16} className="shrink-0 text-text-disabled" aria-hidden />
      )}
    </button>
  );
  if (!onMenu) return card;
  return (
    <div className="relative">
      {card}
      <button
        type="button"
        aria-label={`Actions for ${payeeName}`}
        aria-haspopup="menu"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onMenu({ x: r.right - 240, y: r.bottom });
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full text-text-tertiary active:bg-hover"
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}
