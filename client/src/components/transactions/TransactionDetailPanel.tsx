import { ShareWithHousehold } from '../household/ShareWithHousehold';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { X, Lock, Trash2, Repeat, Unlink, Wand2, Split } from 'lucide-react';
import {
  useUpdateTransaction,
  useDeleteTransaction,
  useUnlockTransaction,
} from '../../hooks/useTransactions';
import { useOfferCategoryFollowup } from '../../hooks/useCategoryFollowup';
import { useTransferToAccount, useUnlinkTransfer } from '../../hooks/useTransfers';
import { useCanSave } from '../../hooks/useConnection';
import { useSchedules, useUnmatchByTransaction } from '../../hooks/useSchedules';
import { CategoryPicker } from './CategoryPicker';
import { PayeeCombobox } from './PayeeCombobox';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useModalValue } from '../ui/Modal';
import { RuleEditorFlow } from '../rules/RuleEditorFlow';
import { PayeeIcon } from '../payees/PayeeIcon';
import { useUpdatePayee } from '../../hooks/usePayees';
import { usePreferencesStore } from '../../store/preferencesStore';
import { AccountIcon } from '../accounts/AccountIcon';
import { formatMoney } from '../../utils/currency';
import { useAccountCurrency } from '../../hooks/useCurrency';
import { MainAmountField } from '../currency/MainAmountField';
import { RECURRENCE_TYPE_LABELS } from '../../types';
import { GoalLink } from '../goals/GoalLink';
import { TransactionMarks } from './TransactionMarks';
import { ReceiptsSection } from '../tax/ReceiptsSection';
import { TaxClaimSection } from '../tax/TaxClaimSection';
import { SplitTransactionModal } from './SplitTransactionModal';
import type {
  Transaction,
  CategoryGroup,
  Payee,
  Account,
  RuleCondition,
  RuleInput,
} from '../../types';

interface Props {
  transaction: Transaction;
  categoryMap: Map<string, { name: string; icon: string | null }>;
  groups: CategoryGroup[];
  payees: Payee[];
  accounts: Account[];
  accountName?: string;
  accountType?: string;
  accountLogo?: string | null;
  onClose: () => void;
}

export function TransactionDetailPanel({
  transaction: tx,
  categoryMap,
  groups,
  payees,
  accounts,
  accountName,
  accountType,
  accountLogo,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const updateTx = useUpdateTransaction();
  const offerFollowup = useOfferCategoryFollowup();
  const currency = useAccountCurrency()(tx.accountId);
  const updatePayee = useUpdatePayee();
  const deleteTx = useDeleteTransaction();
  const transferTo = useTransferToAccount();
  const unlinkTransfer = useUnlinkTransfer();
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const { data: schedules = [] } = useSchedules();
  const unmatchByTx = useUnmatchByTransaction();
  const linkedSchedule = tx.scheduleId ? schedules.find((s) => s.id === tx.scheduleId) : null;
  const freqMap = new Map(RECURRENCE_TYPE_LABELS.map((f) => [f.value, f.label]));

  const [localDate, setLocalDate] = useState(tx.date);
  const [localNotes, setLocalNotes] = useState(tx.notes ?? '');
  const [localPayee, setLocalPayee] = useState({ id: tx.payeeId, name: tx.payeeName ?? '' });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const unlock = useUnlockTransaction();
  const [ruleDraft, setRuleDraft] = useState<RuleInput | null>(null);
  const [splitting, setSplitting] = useState(false);
  const ruleModal = useModalValue(ruleDraft);

  // Each field follows only its own saved value: a refetch after one edit must not wipe
  // another field that's being typed but not saved yet
  useEffect(() => setLocalDate(tx.date), [tx.id, tx.date]);
  useEffect(() => setLocalNotes(tx.notes ?? ''), [tx.id, tx.notes]);
  useEffect(
    () => setLocalPayee({ id: tx.payeeId, name: tx.payeeName ?? '' }),
    [tx.id, tx.payeeId, tx.payeeName],
  );
  useEffect(() => setShowCategoryPicker(false), [tx.id]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.key === 'Escape' &&
        !showCategoryPicker &&
        !showDeleteConfirm &&
        !showUnlockConfirm &&
        !ruleDraft &&
        !splitting
      )
        onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, showCategoryPicker, showDeleteConfirm, showUnlockConfirm, ruleDraft, splitting]);

  const isReconciled = tx.reconciled === 1;
  const isTransfer = !!tx.transferTransactionId;
  const isSplitParent = tx.isParent === 1 && tx.children && tx.children.length > 0;
  // A reconciled row keeps its amount, date and account; category, payee and notes change no balance
  const canEditCategory = (!isTransfer || !!tx.isBudgetBoundary) && !isSplitParent;
  // Synced and earlier transactions can be split into categories here, or have their parts changed
  const canSplit = !isReconciled && !isTransfer && !tx.isAdjustment && !tx.parentTransactionId;

  const payeeName = tx.payeeName || (isTransfer ? 'Transfer' : '—');
  const payee = tx.payeeId ? payees.find((p) => p.id === tx.payeeId) : undefined;
  const categoryEntry = tx.categoryId ? (categoryMap.get(tx.categoryId) ?? null) : null;
  // Making or undoing a transfer needs the server: not offered while saving is paused, and a
  // balance correction can't be a transfer
  const canSave = useCanSave();
  const transferAccounts =
    canSave && !isTransfer && !tx.isAdjustment
      ? accounts.filter((a) => a.id !== tx.accountId && !a.closedAt)
      : [];

  function saveDate() {
    if (localDate !== tx.date) {
      updateTx.mutate({ id: tx.id, data: { date: localDate } });
    }
  }

  function saveNotes() {
    const val = localNotes || null;
    if (val !== tx.notes) {
      updateTx.mutate({ id: tx.id, data: { notes: val } });
    }
  }

  function handlePayeeChange(v: { id: string | null; name: string }) {
    setLocalPayee(v);
    if (v.id !== null) {
      updateTx.mutate({ id: tx.id, data: { payeeId: v.id, payeeName: v.name || null } });
    }
  }

  function savePayeeOnBlur() {
    if (localPayee.id !== tx.payeeId || localPayee.name !== (tx.payeeName ?? '')) {
      updateTx.mutate({
        id: tx.id,
        data: { payeeId: localPayee.id, payeeName: localPayee.name || null },
      });
    }
  }

  function handleCategoryChange(catId: string | null) {
    if (catId?.startsWith('transfer:')) {
      // Links the matching transaction in that account, or creates it
      transferTo.mutate({ id: tx.id, accountId: catId.slice('transfer:'.length) });
    } else {
      updateTx
        .mutateAsync({ id: tx.id, data: { categoryId: catId } })
        .then(() => offerFollowup(tx, catId))
        .catch(() => {});
    }
    setShowCategoryPicker(false);
  }

  /** A rule matching this transaction's payee that sets its current category */
  function startRule() {
    const condition: RuleCondition = tx.payeeId
      ? { field: 'payee', op: 'is', value: tx.payeeId }
      : { field: 'payee_name', op: 'is', value: tx.payeeName ?? '' };
    setRuleDraft({
      conditionsOp: 'and',
      conditions: [condition],
      actions: [{ type: 'set_category', value: tx.categoryId ?? '' }],
      enabled: true,
    });
  }

  function handleDelete() {
    deleteTx.mutate(tx.id, { onSuccess: onClose });
  }

  const inputCls =
    'w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface text-text focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-60 disabled:cursor-not-allowed';

  return (
    <aside
      aria-label="Transaction details"
      // Phones: a full-screen sheet over the register (see TransactionTable)
      className="w-96 max-md:w-screen max-md:max-w-full max-md:border-l-0 shrink-0 border-l border-border bg-surface flex flex-col h-full max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]"
    >
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">Transaction Details</span>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="p-1 max-md:min-w-11 max-md:min-h-11 max-md:-mr-2 flex items-center justify-center rounded hover:bg-hover text-text-tertiary hover:text-text-secondary"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <PayeeIcon
              name={payeeName}
              logo={payee?.logo}
              transfer={isTransfer}
              size="lg"
              onLogoChange={
                payee ? (logo) => updatePayee.mutate({ id: payee.id, logo }) : undefined
              }
            />
            <div>
              <div className="text-base font-semibold text-text">{payeeName}</div>
              {accountName && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <AccountIcon name={accountName} type={accountType} logo={accountLogo} size="xs" />
                  <span className="text-xs text-text-tertiary">{accountName}</span>
                </div>
              )}
            </div>
          </div>
          <span
            className={`text-lg font-semibold tabular-nums ${tx.amount > 0 ? 'text-positive' : 'text-text'}`}
          >
            {formatMoney(Math.abs(tx.amount), currency)}
          </span>
        </div>

        {isReconciled && (
          <>
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-alt rounded-lg text-text-tertiary text-xs">
              <Lock size={12} className="shrink-0" />
              <span className="flex-1">
                Reconciled: the amount, date and account are locked. Category, payee and notes can
                still change.
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!canSave || unlock.isPending}
                onClick={() => setShowUnlockConfirm(true)}
              >
                Unlock
              </Button>
            </div>
            {unlock.error && (
              <p role="alert" className="text-xs text-negative">
                {unlock.error.message}
              </p>
            )}
          </>
        )}

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Date</label>
          <input
            type="date"
            aria-label="Date"
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
            onBlur={saveDate}
            disabled={isReconciled}
            className={inputCls}
          />
        </div>

        <MainAmountField tx={tx} disabled={isReconciled} />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text-secondary block">Category</label>
            {canSplit && (
              <button
                type="button"
                onClick={() => setSplitting(true)}
                disabled={!canSave}
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50 max-md:min-h-11"
                title={
                  isSplitParent ? 'Change the parts or unsplit' : 'Split into several categories'
                }
              >
                <Split size={12} />
                {isSplitParent ? 'Edit split' : 'Split'}
              </button>
            )}
          </div>
          {isSplitParent ? (
            <div className="space-y-2">
              <div className="text-sm text-brand-600 font-medium">
                Split ({tx.children!.length})
              </div>
              {tx.children!.map((child) => {
                const childCat = child.categoryId ? categoryMap.get(child.categoryId) : null;
                return (
                  <div key={child.id} className="flex items-center justify-between text-sm pl-2">
                    <div className="flex items-center gap-1.5">
                      {showCategoryIcons && childCat?.icon && (
                        <span className="text-sm">{childCat.icon}</span>
                      )}
                      <span className="text-text-secondary">
                        {childCat?.name ?? 'Uncategorized'}
                      </span>
                    </div>
                    <span className="tabular-nums text-text-tertiary">
                      {formatMoney(Math.abs(child.amount), currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : isTransfer && !tx.isBudgetBoundary ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 truncate text-sm text-brand-600 px-3 py-2 border border-border rounded-lg bg-surface-alt">
                {tx.payeeName || 'Transfer'}
              </div>
              {!isReconciled && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => unlinkTransfer.mutate(tx)}
                  disabled={!canSave || unlinkTransfer.isPending}
                  title="Make both sides ordinary transactions again"
                >
                  <Unlink size={13} />
                  Not a transfer
                </Button>
              )}
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => canEditCategory && setShowCategoryPicker(!showCategoryPicker)}
                className={`${inputCls} text-left flex items-center gap-2 ${canEditCategory ? 'cursor-pointer' : ''}`}
              >
                {showCategoryIcons && categoryEntry?.icon && (
                  <span className="text-base">{categoryEntry.icon}</span>
                )}
                <span className={categoryEntry ? '' : 'text-text-tertiary'}>
                  {categoryEntry?.name ?? 'Uncategorized'}
                </span>
              </button>
              {showCategoryPicker && (
                <CategoryPicker
                  value={tx.categoryId}
                  onChange={handleCategoryChange}
                  groups={groups}
                  onClose={() => setShowCategoryPicker(false)}
                  transferAccounts={transferAccounts}
                />
              )}
            </div>
          )}
        </div>

        <GoalLink categoryIds={[tx.categoryId, ...(tx.children ?? []).map((c) => c.categoryId)]} />

        {!tx.parentTransactionId && <TransactionMarks tx={tx} />}

        {tx.isBudgetBoundary && (
          <div className="text-xs text-text-secondary">
            <p>
              Transfer across the budget boundary. Choose an expense category for money leaving, or
              an income/refund category for money returning.
            </p>
            {!isReconciled && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => unlinkTransfer.mutate(tx)}
                disabled={!canSave || unlinkTransfer.isPending}
              >
                Not a transfer
              </Button>
            )}
          </div>
        )}

        {!isTransfer && (
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Payee</label>
            <div onBlur={savePayeeOnBlur}>
              <PayeeCombobox
                value={localPayee}
                onChange={handlePayeeChange}
                payees={payees}
                className={`border border-border rounded-lg px-3 py-2 focus:border-brand-600 focus:ring-1 focus:ring-brand-600`}
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Notes</label>
          <textarea
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add notes to this transaction..."
            aria-label="Notes"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>

        {!tx.parentTransactionId && <ReceiptsSection transactionId={tx.id} />}
        {!tx.isAdjustment && <TaxClaimSection tx={tx} currency={currency} />}

        {linkedSchedule && (
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              Recurring
            </label>
            <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-alt rounded-lg border border-border-light">
              <Repeat size={14} className="text-brand-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{linkedSchedule.name}</p>
                <p className="text-xs text-text-tertiary">
                  {freqMap.get(linkedSchedule.recurrenceType) || linkedSchedule.recurrenceType}
                </p>
              </div>
              {!isReconciled && (
                <button
                  onClick={() => unmatchByTx.mutate(tx.id)}
                  className="p-1 rounded text-text-tertiary hover:text-caution hover:bg-caution-subtle transition-colors"
                  title="Unlink from recurring"
                >
                  <Unlink size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-border space-y-2">
        {!tx.isParent && !tx.parentTransactionId && !tx.isAdjustment && tx.amount < 0 && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              onClose();
              navigate(`/household?transaction=${encodeURIComponent(tx.id)}`);
            }}
          >
            Split with people
          </Button>
        )}
        {!tx.isParent && !tx.parentTransactionId && !tx.isAdjustment && tx.amount < 0 && (
          <ShareWithHousehold transactionId={tx.id} />
        )}
        {!isTransfer && (
          <Button variant="secondary" onClick={startRule} className="w-full">
            <Wand2 size={14} />
            Create rule
          </Button>
        )}
        {!isReconciled && (
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} className="w-full">
            <Trash2 size={14} />
            Delete Transaction
          </Button>
        )}
      </div>

      <SplitTransactionModal
        transaction={tx}
        currency={currency}
        groups={groups}
        isOpen={splitting}
        onClose={() => setSplitting(false)}
      />

      {ruleModal.value && (
        <RuleEditorFlow
          isOpen={ruleModal.isOpen}
          onClose={() => setRuleDraft(null)}
          initial={ruleModal.value}
          title="New rule from transaction"
        />
      )}

      <ConfirmModal
        isOpen={showUnlockConfirm}
        title="Unlock reconciled transaction"
        message="Unlocking lets you change this transaction's amount, date or account, or delete it. The account's reconciled balance will no longer match your statement until you reconcile again."
        confirmLabel="Unlock"
        onConfirm={() => {
          setShowUnlockConfirm(false);
          unlock.mutate(tx.id);
        }}
        onClose={() => setShowUnlockConfirm(false)}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </aside>
  );
}
