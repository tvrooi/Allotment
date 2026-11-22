import { transactionPayeeName } from './transferLabel';
import { useAccountName } from '../../hooks/useAccounts';
import { RowMarks } from './TransactionMarks';
import { formatRegisterAmount, RoundUpMark } from './RoundUp';
import { CategoryIcon } from '../ui/CategoryIcon';
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Lock, Pencil } from 'lucide-react';
import { useUpdateTransaction } from '../../hooks/useTransactions';
import { useOfferCategoryFollowup } from '../../hooks/useCategoryFollowup';
import { useTransferToAccount } from '../../hooks/useTransfers';
import { useCanSave } from '../../hooks/useConnection';
import { CategoryPicker } from './CategoryPicker';
import { categoriseEdit } from './categoriseEdit';
import { PayeeIcon } from '../payees/PayeeIcon';
import { formatMoney } from '../../utils/currency';
import { useAccountCurrency } from '../../hooks/useCurrency';
import { ForeignValue } from '../currency/ForeignValue';
import { usePreferencesStore } from '../../store/preferencesStore';
import { AccountIcon } from '../accounts/AccountIcon';
import type { Transaction, CategoryGroup, PayeeWithCount } from '../../types';

/** Present only while the register is selecting; the row is then the checkbox, with no visible box (owner, 22 November 2026, UAT G-03-4). */
export interface RowSelection {
  selected: boolean;
  label: string;
  onToggle: () => void;
}

/** Strongest brand tint keeping every row text colour at 4.5:1 in light and dark, plus a 3 px inset bar at >= 3:1 (WCAG 1.4.11) without taking layout space. */
export const SELECTED_ROW = 'bg-brand-100 shadow-[inset_3px_0_0_var(--color-brand-600)]';

interface Props {
  tx: Transaction;
  categoryEntry: { name: string; icon: string | null } | null;
  categoryMap: Map<string, { name: string; icon: string | null }>;
  groups: CategoryGroup[];
  payees: PayeeWithCount[];
  accountName?: string;
  accountType?: string;
  accountLogo?: string | null;
  showAccountCol?: boolean;
  isSelected?: boolean;
  selection?: RowSelection;
  onOpenDetail: (id: string) => void;
  /** Open accounts, offered as "Transfer: name" in the category picker (except this one's) */
  transferAccounts?: { id: string; name: string }[];
}

export function TransactionRow({
  tx,
  categoryEntry,
  categoryMap,
  groups,
  payees,
  accountName,
  accountType,
  accountLogo,
  showAccountCol,
  isSelected,
  selection,
  onOpenDetail,
  transferAccounts = [],
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const currency = useAccountCurrency()(tx.accountId);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const selecting = Boolean(selection);
  useEffect(() => {
    if (selecting) setShowCategoryPicker(false);
  }, [selecting]);
  const updateTx = useUpdateTransaction();
  const offerFollowup = useOfferCategoryFollowup();
  const transferTo = useTransferToAccount();
  // Making a transfer needs the server: not offered while saving is paused
  const canSave = useCanSave();
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);

  const isTransfer = !!tx.transferTransactionId;
  const isSplitParent = tx.isParent === 1 && tx.children && tx.children.length > 0;
  // A round-up's own row, listed only when round-ups are shown: part of its purchase
  const roundUpOf = tx.roundUpOf ? (tx.roundUpOf.payeeName ?? 'a purchase') : null;

  const accountNameOf = useAccountName();
  const payeeName = transactionPayeeName(tx, accountNameOf);
  const payee = useMemo(
    () => (tx.payeeId ? payees.find((p) => p.id === tx.payeeId) : undefined),
    [payees, tx.payeeId],
  );

  const categoryName = (
    <>
      {showCategoryIcons && categoryEntry?.icon && (
        <CategoryIcon icon={categoryEntry.icon} size={15} />
      )}
      <span
        className={`text-sm truncate ${categoryEntry ? 'text-text-secondary' : 'text-caution'}`}
      >
        {categoryEntry?.name ?? 'Uncategorised'}
      </span>
    </>
  );

  function handleCategoryChange(catId: string | null) {
    if (catId?.startsWith('transfer:')) {
      transferTo.mutate({ id: tx.id, accountId: catId.slice('transfer:'.length) });
    } else {
      updateTx
        .mutateAsync(
          categoriseEdit(tx, payeeName, catId, catId ? categoryMap.get(catId)?.name : undefined),
        )
        .then(() => offerFollowup(tx, catId))
        .catch(() => {});
    }
    setShowCategoryPicker(false);
  }

  const fillClass = selection?.selected
    ? SELECTED_ROW
    : isSelected
      ? 'bg-brand-50'
      : 'bg-surface hover:bg-hover';
  const detailBorderClass = isSelected ? 'border-l-2 border-l-brand-600' : '';
  const splitBoxClass = 'flex items-center gap-1 text-brand-600';
  const categoryBoxClass =
    'inline-flex max-w-full items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-surface transition-colors min-w-0';
  const pencilBoxClass =
    'w-9 h-9 max-md:w-11 max-md:h-11 max-md:-m-1 flex items-center justify-center rounded-full text-text-tertiary transition-colors shrink-0';

  const splitContent = isSplitParent ? (
    <>
      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      <span className="text-sm">Split ({tx.children!.length})</span>
    </>
  ) : null;

  return (
    <div>
      <div
        // Phones: the payee gets its own line, the other columns wrap below it
        className={`flex max-md:flex-wrap items-center px-4 py-2 cursor-pointer border-b border-border-light transition-colors ${fillClass} ${detailBorderClass}`}
        role={selection ? 'checkbox' : undefined}
        aria-checked={selection ? selection.selected : undefined}
        aria-label={selection ? selection.label : undefined}
        onClick={() => (selection ? selection.onToggle() : onOpenDetail(tx.id))}
        // Keyboard users open the details (or toggle selection while selecting) with Enter or Space
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            if (selection) selection.onToggle();
            else onOpenDetail(tx.id);
          }
        }}
        data-testid="transaction-row"
        data-tx-id={tx.id}
      >
        {/* Payee: part of the row, so a click on it opens the details too (#243). The payee
            is changed there, and its logo on the payee's page. */}
        <div className="flex items-center gap-1 flex-[3] max-md:basis-full min-w-0 mr-3">
          <PayeeIcon name={payeeName} logo={payee?.logo} transfer={isTransfer} />
          {roundUpOf ? (
            <span className="px-2.5 text-xs text-text-tertiary truncate">
              ↳ Round-up of {roundUpOf}
            </span>
          ) : (
            <span className="px-2.5 py-1.5 text-sm font-medium text-text truncate">
              {payeeName}
            </span>
          )}
          <RowMarks tx={tx} />
        </div>

        {/* Category */}
        <div className="flex items-center gap-1 flex-[2] min-w-0 relative mr-3">
          {isSplitParent ? (
            selection ? (
              <span className={splitBoxClass}>{splitContent}</span>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className={`${splitBoxClass} hover:text-brand-700`}
              >
                {splitContent}
              </button>
            )
          ) : isTransfer && !tx.isBudgetBoundary ? (
            <span className="text-sm text-brand-600">Transfer</span>
          ) : selection ? (
            <span className={categoryBoxClass}>
              {categoryName}
              <ChevronDown size={12} className="text-text-tertiary shrink-0" aria-hidden />
            </span>
          ) : (
            // The one edit in the row: drawn as a control (its chevron always shown, #243)
            <button
              type="button"
              aria-label={`Category for ${payeeName}: ${categoryEntry?.name ?? 'Uncategorised'}`}
              aria-expanded={showCategoryPicker}
              className={`${categoryBoxClass} hover:bg-hover hover:border-text-tertiary cursor-pointer`}
              onClick={(e) => {
                e.stopPropagation();
                setShowCategoryPicker(!showCategoryPicker);
              }}
            >
              {categoryName}
              <ChevronDown size={12} className="text-text-tertiary shrink-0" aria-hidden />
            </button>
          )}

          {!selection && showCategoryPicker && (
            <CategoryPicker
              value={tx.categoryId}
              onChange={handleCategoryChange}
              groups={groups}
              onClose={() => setShowCategoryPicker(false)}
              transferAccounts={
                // A balance correction can't be a transfer
                canSave && !isTransfer && !tx.isAdjustment
                  ? transferAccounts.filter((a) => a.id !== tx.accountId)
                  : []
              }
            />
          )}
        </div>

        {/* Account (its register is linked from the details) */}
        {showAccountCol && (
          <div className="flex items-center gap-2 flex-[2] px-2.5 min-w-0">
            <AccountIcon name={accountName} type={accountType} logo={accountLogo} size="sm" />
            <span className="text-sm text-text-secondary truncate">{accountName || '—'}</span>
          </div>
        )}

        {/* Reconciled */}
        {tx.reconciled ? (
          <div className="w-8 flex justify-center shrink-0">
            <Lock size={12} className="text-text-disabled" />
          </div>
        ) : (
          <div className="w-8 shrink-0" />
        )}

        {/* Amount, in its account's currency (with the budget's value under it when they differ) */}
        <div className="w-24 text-right shrink-0 mx-2">
          <span
            className={`flex items-center justify-end gap-1 text-sm font-medium tabular-nums ${tx.amount > 0 && !tx.transferPair ? 'text-positive' : 'text-text'}`}
          >
            <RoundUpMark tx={tx} currency={currency} />
            {formatRegisterAmount(tx, currency)}
          </span>
          <ForeignValue tx={tx} className="block" />
        </div>

        {/* Edit: always shown, so the row says it can be changed (#243), and named for screen
            readers and voice control (#242). Out of the tab order, as the row itself opens the
            details from the keyboard. Touch screens get 44px, the negative margin keeping the
            row's layout as it was. */}
        {selection ? (
          <span aria-hidden className={pencilBoxClass}>
            <Pencil size={14} aria-hidden />
          </span>
        ) : (
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Edit details for ${payeeName}`}
            title="Edit details"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(tx.id);
            }}
            className={`${pencilBoxClass} hover:bg-hover hover:text-text-secondary cursor-pointer`}
          >
            <Pencil size={14} aria-hidden />
          </button>
        )}
      </div>

      {/* Split children */}
      {isSplitParent &&
        expanded &&
        tx.children!.map((child) => {
          const childCat = child.categoryId ? categoryMap.get(child.categoryId) : null;
          return (
            <div
              key={child.id}
              className="flex items-center pl-16 pr-4 py-2 bg-surface-alt border-b border-border-light"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {childCat ? (
                  <>
                    {showCategoryIcons && childCat.icon && (
                      <CategoryIcon icon={childCat.icon} size={14} />
                    )}
                    <span className="text-xs text-text-tertiary truncate">{childCat.name}</span>
                  </>
                ) : (
                  <span className="text-xs text-text-tertiary">&mdash;</span>
                )}
                {child.notes && (
                  <span className="text-xs text-text-tertiary truncate ml-2">{child.notes}</span>
                )}
              </div>
              <span
                className={`text-xs tabular-nums shrink-0 ${child.amount > 0 ? 'text-positive' : 'text-text-secondary'}`}
              >
                {formatMoney(child.amount, currency)}
              </span>
            </div>
          );
        })}
    </div>
  );
}
