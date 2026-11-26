import { useId, useState } from 'react';
import { format } from 'date-fns';
import { Check, X, Split, Plus, Trash2 } from 'lucide-react';
import { PayeeCombobox } from './PayeeCombobox';
import { useCanAddTransaction } from '../../hooks/useOffline';
import { CategorySelectButton } from './CategorySelectButton';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import type { Account, CategoryGroup, Payee, Transaction } from '../../types';
import { transferTargets } from '../../utils/addTransaction';
import type { CreateTransactionData, SplitItem } from '../../api/transactions';
import { formatAmount, useAmountStyle } from '../../utils/currency';
import { useAccountCurrency } from '../../hooks/useCurrency';
import { newClientId } from '../../utils/offline';

interface Props {
  initial?: Transaction;
  accountId: string;
  groups: CategoryGroup[];
  payees: Payee[];
  accounts?: Account[];
  onSave: (data: CreateTransactionData) => void;
  onCancel: () => void;
  onDelete?: () => void;
  /** `row`: inline in the register (desktop). `sheet`: one column in a phone sheet. */
  layout?: 'row' | 'sheet';
}

interface SplitRow {
  /** Stays with the row when another is removed, so each row keeps its own amount field */
  key: string;
  categoryId: string | null;
  /** Minor units as typed; a negative one (allowNegative, as the text field read it) is left out */
  amount: number;
  notes: string;
}

const newSplitRow = (): SplitRow => ({
  key: newClientId(),
  categoryId: null,
  amount: 0,
  notes: '',
});

export function TransactionFormRow({
  initial,
  accountId,
  groups,
  payees,
  accounts,
  onSave,
  onCancel,
  onDelete,
  layout = 'row',
}: Props) {
  const sheet = layout === 'sheet';
  // Amounts are typed and shown in the account's currency (no decimals for yen)
  const currency = useAccountCurrency()(initial?.accountId ?? accountId);
  const style = useAmountStyle(currency);
  const formatCurrency = (cents: number) => formatAmount(cents, style);
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(initial?.date ?? today);
  const [payee, setPayee] = useState({
    id: initial?.payeeId ?? null,
    name: initial?.payeeName ?? '',
  });
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  // Minor units. Both take a minus sign as they always have: a negative outflow is money in
  const [outflow, setOutflow] = useState(
    initial?.amount !== undefined && initial.amount < 0 ? -initial.amount : 0,
  );
  const [inflow, setInflow] = useState(
    initial?.amount !== undefined && initial.amount > 0 ? initial.amount : 0,
  );
  const [splitMode, setSplitMode] = useState(false);
  // New transactions can be saved offline: they wait on this device until it reconnects
  const { allowed: canAdd, onDevice } = useCanAddTransaction();
  const [splits, setSplits] = useState<SplitRow[]>(() => [newSplitRow(), newSplitRow()]);
  // Amount text that isn't an amount: the field keeps it, marked, and the row isn't saved
  const { allValid: amountsReadable, report } = useAmountValidity();

  const isTransfer = categoryId?.startsWith('transfer:');
  // Offered as "Transfer: name": every other open account
  const transferAccounts = transferTargets(accounts, accountId);
  const isEditingParent = initial?.isParent === 1;

  function getTotalCents() {
    return inflow > 0 ? inflow : -outflow;
  }

  const fieldId = useId();

  function handleSave() {
    // Never save text that isn't an amount as 0: each field shows its own line
    if (!amountsReadable) return;
    const amount = getTotalCents();

    if (splitMode) {
      const splitItems: SplitItem[] = splits
        .filter((s) => s.amount > 0)
        .map((s) => ({
          categoryId: s.categoryId,
          amount: amount < 0 ? -s.amount : s.amount,
          notes: s.notes || null,
        }));

      if (splitItems.length < 2) return;

      onSave({
        accountId,
        date,
        payeeId: payee.id,
        payeeName: payee.name || null,
        categoryId: null,
        notes: notes || null,
        amount,
        splits: splitItems,
      });
      return;
    }

    onSave({
      accountId,
      date,
      payeeId: payee.id,
      payeeName: payee.name || null,
      categoryId,
      notes: notes || null,
      amount,
    });
  }

  function updateSplit(key: string, change: Partial<Omit<SplitRow, 'key'>>) {
    setSplits((prev) => prev.map((s) => (s.key === key ? { ...s, ...change } : s)));
  }

  function addSplitRow() {
    setSplits((prev) => [...prev, newSplitRow()]);
  }

  function removeSplitRow(key: string) {
    setSplits((prev) => prev.filter((s) => s.key !== key));
  }

  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const totalCents = Math.abs(getTotalCents());
  const splitRemaining = totalCents - splitTotal;

  // The shared fields are 44 px with 16px text on phones (no zoom into the field) either way;
  // on desktop the row's are the compact size (03-UI-SPEC §4 item 1), the sheet's the default
  const fieldSize = sheet ? 'md' : 'sm';
  // The payee keeps its own look: bare in the row, a full field in the sheet
  const payeeField = sheet
    ? 'w-full bg-surface text-base text-text placeholder:text-text-tertiary border border-border rounded-md px-3 py-2.5 focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600'
    : undefined;
  const amountCls = `text-right tabular-nums${sheet ? ' max-md:text-base' : ''}`;
  const labelCls = sheet
    ? 'text-sm font-medium text-text-secondary mb-1 block'
    : 'text-xs text-text-tertiary mb-1 block';
  const amountProps = {
    currency,
    fieldSize,
    // A minus sign reads as it always has: a negative outflow is money in, a negative inflow
    // or split part is left out
    allowNegative: true,
    className: amountCls,
  } as const;
  const sheetBtn =
    'min-h-11 px-4 rounded-md text-sm font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none';

  const saveButton = (
    <button
      onClick={handleSave}
      disabled={!canAdd}
      className={
        sheet
          ? `${sheetBtn} flex-1 bg-brand-600 text-brand-contrast`
          : 'p-1.5 rounded text-brand-600 hover:text-brand-700 hover:bg-brand-100 disabled:opacity-40 disabled:pointer-events-none'
      }
      title={
        !canAdd
          ? 'Save (paused until Allotment reconnects)'
          : onDevice
            ? 'Save on this device (sent when Allotment reconnects)'
            : 'Save'
      }
      aria-label="Save"
    >
      <Check size={16} />
      {sheet && (onDevice && canAdd ? 'Save on device' : 'Save')}
    </button>
  );
  const splitButton = !isEditingParent && !isTransfer && (
    <button
      onClick={() => setSplitMode(!splitMode)}
      aria-pressed={splitMode}
      className={
        sheet
          ? `${sheetBtn} border ${splitMode ? 'border-brand-600 text-brand-600 bg-brand-50' : 'border-border text-text-secondary'}`
          : `p-1.5 rounded ${splitMode ? 'text-brand-600 bg-brand-100' : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-alt'}`
      }
      title="Split transaction"
      aria-label="Split transaction"
    >
      <Split size={16} />
      {sheet && 'Split'}
    </button>
  );
  const cancelButton = (
    <button
      onClick={onCancel}
      className={
        sheet
          ? `${sheetBtn} border border-border text-text-secondary`
          : 'p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-alt'
      }
      title="Cancel"
      aria-label="Cancel"
    >
      {sheet ? 'Cancel' : <X size={16} />}
    </button>
  );

  return (
    <AmountFields report={report}>
      <div
        role="form"
        aria-label={initial ? 'Edit transaction' : 'New transaction'}
        className={sheet ? 'grid gap-4' : 'bg-brand-50 border-b border-brand-100 px-4 py-3'}
      >
        <div className={sheet ? 'grid gap-3' : 'grid grid-cols-4 gap-3 mb-3'}>
          <div>
            {/* The row's own label look; the picker names itself with its hidden label, and a
              <label> would point at its group, which is no field */}
            <span aria-hidden="true" className={labelCls}>
              Date
            </span>
            <DatePicker
              id={`${fieldId}-date`}
              label="Date"
              hideLabel
              value={date}
              onChange={setDate}
              fieldSize={fieldSize}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor={`${fieldId}-payee`}>
              Payee
            </label>
            <PayeeCombobox
              id={`${fieldId}-payee`}
              value={payee}
              onChange={setPayee}
              payees={payees}
              fieldClassName={payeeField}
            />
          </div>
          <div>
            {splitMode ? (
              <>
                {/* No category field in split mode, so a <label> would point at nothing */}
                <span className={labelCls}>Category</span>
                <span className="text-sm text-brand-600 font-medium leading-8">Split</span>
              </>
            ) : (
              <>
                <label className={labelCls} htmlFor={`${fieldId}-category`}>
                  Category
                </label>
                {/* As the list it replaces: every category, hidden ones too, Uncategorised, the
                  other open accounts as transfers, and no new categories here */}
                <CategorySelectButton
                  id={`${fieldId}-category`}
                  value={categoryId}
                  onChange={setCategoryId}
                  groups={groups}
                  transferAccounts={transferAccounts}
                  allowNone
                  allowCreate={false}
                  includeHidden
                />
              </>
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor={`${fieldId}-notes`}>
              Notes
            </label>
            <Input
              id={`${fieldId}-notes`}
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              aria-label="Notes"
              fieldSize={fieldSize}
            />
          </div>
        </div>

        <div className={sheet ? 'grid grid-cols-2 gap-3' : 'flex items-end gap-3'}>
          <div className={sheet ? '' : 'w-28'}>
            <label className={labelCls} htmlFor={`${fieldId}-outflow`}>
              Outflow
            </label>
            <CurrencyInput
              id={`${fieldId}-outflow`}
              value={outflow}
              onChange={setOutflow}
              // Live, so typing one side empties the other at once (and the split total follows)
              onTextChange={(cents) => {
                setOutflow(cents ?? 0);
                if (cents !== 0) setInflow(0);
              }}
              aria-label="Outflow"
              {...amountProps}
            />
          </div>
          <div className={sheet ? '' : 'w-28'}>
            <label className={labelCls} htmlFor={`${fieldId}-inflow`}>
              Inflow
            </label>
            <CurrencyInput
              id={`${fieldId}-inflow`}
              value={inflow}
              onChange={setInflow}
              onTextChange={(cents) => {
                setInflow(cents ?? 0);
                if (cents !== 0) setOutflow(0);
              }}
              aria-label="Inflow"
              {...amountProps}
            />
          </div>
          {!sheet && (
            <>
              <div className="flex-1" />
              <div className="flex items-center gap-1 pb-0.5">
                {saveButton}
                {splitButton}
                {cancelButton}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="p-1.5 rounded text-text-tertiary hover:text-negative hover:bg-negative-subtle ml-1"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {splitMode && (
          <div
            className={
              sheet
                ? 'grid gap-3 pt-3 border-t border-border-light'
                : 'mt-3 pt-3 border-t border-brand-100'
            }
          >
            {splits.map((s, i) => (
              <div
                key={s.key}
                className={
                  sheet
                    ? 'grid grid-cols-[1fr_1fr_auto] gap-2 items-center'
                    : 'grid grid-cols-[1fr_1fr_120px_auto] gap-2 mb-2 items-center'
                }
              >
                <div className={sheet ? 'col-span-3' : ''}>
                  {/* As the list it replaces: no transfers in a part */}
                  <CategorySelectButton
                    value={s.categoryId}
                    onChange={(categoryId) => updateSplit(s.key, { categoryId })}
                    groups={groups}
                    label={`Split ${i + 1} category`}
                    allowNone
                    allowCreate={false}
                    includeHidden
                  />
                </div>
                <Input
                  type="text"
                  value={s.notes}
                  onChange={(e) => updateSplit(s.key, { notes: e.target.value })}
                  placeholder="Notes"
                  aria-label={`Split ${i + 1} notes`}
                  fieldSize={fieldSize}
                />
                <div>
                  <CurrencyInput
                    value={s.amount}
                    onChange={(amount) => updateSplit(s.key, { amount })}
                    // Remaining follows the typing; unreadable text counts as no amount
                    onTextChange={(cents) => updateSplit(s.key, { amount: cents ?? 0 })}
                    aria-label={`Split ${i + 1} amount`}
                    {...amountProps}
                  />
                </div>
                <div className={sheet ? 'w-11' : 'w-6'}>
                  {splits.length > 2 && (
                    <button
                      onClick={() => removeSplitRow(s.key)}
                      aria-label={`Remove split ${i + 1}`}
                      className={`rounded text-text-tertiary hover:text-negative ${sheet ? 'w-11 h-11 flex items-center justify-center' : 'p-0.5'}`}
                    >
                      <Trash2 size={sheet ? 16 : 14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={addSplitRow}
                className={`flex items-center gap-1 text-brand-600 hover:text-brand-700 ${sheet ? 'text-sm min-h-11' : 'text-xs'}`}
              >
                <Plus size={12} /> Add split
              </button>
              <span
                className={`text-xs tabular-nums ${splitRemaining === 0 ? 'text-positive' : 'text-negative'}`}
              >
                {splitRemaining === 0 ? 'Balanced' : `${formatCurrency(splitRemaining)} remaining`}
              </span>
            </div>
          </div>
        )}

        {sheet && (
          <div className="flex gap-2">
            {cancelButton}
            {splitButton}
            {saveButton}
          </div>
        )}
      </div>
    </AmountFields>
  );
}
