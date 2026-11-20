import { useState, useEffect, useRef, useId } from 'react';
import { useReminderSettings } from '../../hooks/useReminders';
import { useFormReset } from '../../hooks/useFormReset';
import { Modal } from '../ui/Modal';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { Checkbox } from '../ui/Checkbox';
import { Combobox } from '../ui/Combobox';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DatePicker } from '../ui/DatePicker';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { NumberField } from '../ui/NumberField';
import { Select } from '../ui/Select';
import { MerchantSelect } from '../transactions/MerchantSelect';
import { CategorySelectButton } from '../transactions/CategorySelectButton';
import { useAccounts } from '../../hooks/useAccounts';
import { usePayees } from '../../hooks/usePayees';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { format } from 'date-fns';
import type { ScheduleDraft } from '../../utils/nearMiss';
import {
  RECURRENCE_TYPE_LABELS,
  type Schedule,
  type RecurrenceType,
  type AmountType,
  type WeekendAdjust,
} from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  editItem?: Schedule | null;
  /** A new item filled in from elsewhere (Find recurring's "Add anyway") */
  draft?: ScheduleDraft | null;
}

const NONE_ACCOUNT = '__none__';
const NO_REMINDER = '__none__';

/** Advanced stays open while Date flexibility is invalid so its error remains visible (WR-06). */
export const nextAdvancedOpen = (open: boolean, advancedInvalid: boolean) =>
  advancedInvalid ? true : !open;

/** How many days ahead a reminder can be asked for from the form (the server allows up to 30) */
const REMINDER_LEADS = [0, 1, 3, 7];
const leadLabel = (days: number) =>
  days === 0 ? 'On the day' : days === 1 ? '1 day before' : `${days} days before`;

const AMOUNT_TYPE_OPTIONS: { value: AmountType; label: string }[] = [
  { value: 'exact', label: 'Exact' },
  { value: 'approximate', label: 'Approx' },
  { value: 'variable', label: 'Variable' },
];

const WEEKEND_ADJUST_OPTIONS: { value: WeekendAdjust; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'before', label: 'Before weekend' },
  { value: 'after', label: 'After weekend' },
  { value: 'closest', label: 'Closest weekday' },
];

export default function RecurringFormModal({ isOpen, onClose, onSave, editItem, draft }: Props) {
  const fieldId = useId();
  const { data: accounts = [] } = useAccounts();
  const { data: payees = [] } = usePayees();
  const canSave = useCanSave();
  const amounts = useAmountValidity();
  const advancedAmounts = useAmountValidity();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [isExpense, setIsExpense] = useState(true);
  const [amountType, setAmountType] = useState<AmountType>('exact');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('monthly');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [weekendAdjust, setWeekendAdjust] = useState<WeekendAdjust>('none');
  const [dateFlexibility, setDateFlexibility] = useState(3);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [payeeValue, setPayeeValue] = useState<{ id: string | null; name: string }>({
    id: null,
    name: '',
  });
  const [notes, setNotes] = useState('');
  const [autoCreate, setAutoCreate] = useState(false);
  const [reminderDays, setReminderDays] = useState<number | null>(null);
  const reminders = useReminderSettings().data;
  const [showAdvanced, setShowAdvanced] = useState(false);
  // The payee box keeps its own text: a new one for every reset, so nothing carries over
  const [resets, setResets] = useState(0);

  // Set when the form opened before accounts/payees had loaded: filled in once they arrive
  const pendingDefaults = useRef({ account: false, payee: false });

  // Filled once per opening: payees and accounts refetch (e.g. after picking or creating a
  // payee) and must not wipe the form
  useFormReset(isOpen ? (editItem?.id ?? (draft ? `draft:${draft.key}` : 'new')) : null, () => {
    setResets((n) => n + 1);
    if (editItem) {
      setName(editItem.name);
      setAmount(Math.abs(editItem.amount));
      setIsExpense(editItem.amount < 0);
      setAmountType(editItem.amountType);
      setRecurrenceType(editItem.recurrenceType);
      setStartDate(editItem.startDate);
      setEndDate(editItem.endDate || '');
      setWeekendAdjust(editItem.weekendAdjust);
      setDateFlexibility(editItem.dateFlexibility);
      setAccountId(editItem.accountId || '');
      setCategoryId(editItem.categoryId || '');
      const matchedPayee = editItem.payeeId ? payees.find((p) => p.id === editItem.payeeId) : null;
      setPayeeValue({ id: editItem.payeeId, name: matchedPayee?.name ?? '' });
      pendingDefaults.current = {
        account: false,
        payee: Boolean(editItem.payeeId && !matchedPayee),
      };
      setNotes(editItem.notes || '');
      setAutoCreate(Boolean(editItem.autoCreate));
      setReminderDays(editItem.reminderDays ?? null);
      setShowAdvanced(editItem.weekendAdjust !== 'none' || editItem.dateFlexibility !== 3);
    } else if (draft) {
      setName(draft.name);
      setAmount(Math.abs(draft.amount));
      setIsExpense(draft.amount < 0);
      setAmountType(draft.amountType);
      setRecurrenceType(draft.recurrenceType);
      setStartDate(draft.startDate);
      setEndDate('');
      setWeekendAdjust('none');
      setDateFlexibility(draft.dateFlexibility);
      setAccountId(draft.accountId);
      setCategoryId(draft.categoryId ?? '');
      setPayeeValue({ id: draft.payeeId, name: draft.payeeName });
      pendingDefaults.current = { account: false, payee: false };
      setNotes('');
      setAutoCreate(false);
      setReminderDays(null);
      setShowAdvanced(draft.dateFlexibility !== 3);
    } else {
      setName('');
      setAmount(0);
      setIsExpense(true);
      setAmountType('exact');
      setRecurrenceType('monthly');
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEndDate('');
      setWeekendAdjust('none');
      setDateFlexibility(3);
      setAccountId(accounts.length > 0 ? accounts[0].id : '');
      pendingDefaults.current = { account: accounts.length === 0, payee: false };
      setCategoryId('');
      setPayeeValue({ id: null, name: '' });
      setNotes('');
      setAutoCreate(false);
      setReminderDays(null);
      setShowAdvanced(false);
    }
  });

  // Data that loads after the dialog opened fills in what it couldn't, once, and only if
  // the user hasn't changed that field in the meantime
  useEffect(() => {
    if (!isOpen || !pendingDefaults.current.account || accounts.length === 0) return;
    pendingDefaults.current.account = false;
    setAccountId((current) => current || accounts[0].id);
  }, [isOpen, accounts]);
  useEffect(() => {
    const payeeId = editItem?.payeeId;
    if (!isOpen || !pendingDefaults.current.payee || !payeeId) return;
    const payee = payees.find((p) => p.id === payeeId);
    if (!payee) return;
    pendingDefaults.current.payee = false;
    setPayeeValue((current) =>
      current.id === payeeId && !current.name ? { id: payee.id, name: payee.name } : current,
    );
  }, [isOpen, editItem, payees]);

  const advancedInvalid = !advancedAmounts.allValid;
  const advancedOpen = showAdvanced || advancedInvalid;
  const endBeforeStart = Boolean(endDate && startDate && endDate < startDate);
  const canSubmit =
    Boolean(name) &&
    amount !== 0 &&
    Boolean(startDate) &&
    !endBeforeStart &&
    canSave &&
    amounts.allValid &&
    advancedAmounts.allValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const signedAmount = isExpense ? -Math.abs(amount) : Math.abs(amount);
    onSave({
      name,
      amount: signedAmount,
      amountType,
      recurrenceType,
      startDate,
      endDate: endDate || null,
      weekendAdjust,
      dateFlexibility,
      accountId: accountId || null,
      categoryId: categoryId || null,
      payeeId: payeeValue.id || null,
      notes: notes || null,
      autoCreate: autoCreate ? 1 : 0,
      reminderDays,
    });
  }

  const showWeekendAdjust =
    recurrenceType !== 'once' && recurrenceType !== 'weekly' && recurrenceType !== 'biweekly';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editItem ? 'Edit recurring' : 'Add recurring'}
      size="lg"
    >
      <AmountFields report={amounts.report}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Netflix, Rent, Pay…"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={`${fieldId}-amount`}
                className="block text-sm font-medium text-text-secondary mb-1"
              >
                {amountType === 'variable' ? 'Estimated amount' : 'Amount'}
              </label>
              <CurrencyInput
                id={`${fieldId}-amount`}
                value={amount}
                onChange={setAmount}
                aria-label="Amount"
              />
            </div>
            <div>
              <span
                id={`${fieldId}-type`}
                className="block text-sm font-medium text-text-secondary mb-1"
              >
                Type
              </span>
              <div role="group" aria-labelledby={`${fieldId}-type`} className="flex gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => setIsExpense(true)}
                  aria-pressed={isExpense}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                    isExpense
                      ? 'bg-negative-subtle text-negative ring-1 ring-negative/20'
                      : 'text-text-tertiary hover:bg-hover'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpense(false)}
                  aria-pressed={!isExpense}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                    !isExpense
                      ? 'bg-positive-subtle text-positive ring-1 ring-positive/20'
                      : 'text-text-tertiary hover:bg-hover'
                  }`}
                >
                  Income
                </button>
              </div>
            </div>
          </div>

          <div>
            <span
              id={`${fieldId}-precision`}
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Amount precision
            </span>
            <div role="group" aria-labelledby={`${fieldId}-precision`} className="flex gap-1">
              {AMOUNT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAmountType(opt.value)}
                  aria-pressed={amountType === opt.value}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                    amountType === opt.value
                      ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-600/20'
                      : 'text-text-tertiary hover:bg-hover'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {amountType === 'variable' && (
              <p className="text-xs text-text-tertiary mt-1">
                Amount is estimated — used for forecasting and matching, not an exact expectation.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Frequency"
              value={recurrenceType}
              onChange={(v) => setRecurrenceType(v as RecurrenceType)}
              options={RECURRENCE_TYPE_LABELS}
            />
            <Combobox
              label="Account"
              items={[
                { value: NONE_ACCOUNT, label: 'No account' },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
              value={accountId || NONE_ACCOUNT}
              onChange={(v) => {
                if (v) setAccountId(v === NONE_ACCOUNT ? '' : v);
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              label="Start date"
              value={startDate}
              onChange={setStartDate}
              maxValue={endDate || undefined}
              isRequired
              isInvalid={!startDate}
            />
            <DatePicker
              label="End date"
              optional
              optionalHint
              value={endDate}
              onChange={setEndDate}
              minValue={startDate || undefined}
            />
          </div>

          <div>
            <label
              htmlFor={`${fieldId}-payee`}
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Payee <span className="text-text-tertiary font-normal">(optional)</span>
            </label>
            <MerchantSelect
              id={`${fieldId}-payee`}
              key={resets}
              value={payeeValue}
              onChange={setPayeeValue}
              label="Payee"
            />
          </div>

          <div>
            <label
              htmlFor={`${fieldId}-category`}
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Category
            </label>
            <CategorySelectButton
              id={`${fieldId}-category`}
              value={categoryId || null}
              onChange={(id) => setCategoryId(id ?? '')}
              position="above"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={`${fieldId}-notes`}>
              Notes <span className="text-text-tertiary font-normal">(optional)</span>
            </Label>
            <Input
              id={`${fieldId}-notes`}
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
              aria-label="Notes"
            />
          </div>

          <div className="pt-1">
            <Checkbox checked={autoCreate} onCheckedChange={setAutoCreate}>
              Auto-create transactions
            </Checkbox>
          </div>

          <Select
            id="schedule-reminder"
            label="Remind me"
            value={reminderDays === null ? NO_REMINDER : String(reminderDays)}
            onChange={(v) => setReminderDays(v === '' || v === NO_REMINDER ? null : Number(v))}
            options={[
              { value: NO_REMINDER, label: "Don't remind me" },
              ...REMINDER_LEADS.map((d) => ({ value: String(d), label: leadLabel(d) })),
              ...(reminderDays !== null && !REMINDER_LEADS.includes(reminderDays)
                ? [{ value: String(reminderDays), label: leadLabel(reminderDays) }]
                : []),
            ]}
            // Off, or a reminder that could never be sent: the choice is kept but not offered
            isDisabled={!reminders?.available || !reminders.enabled}
            description={
              !reminders?.available || !reminders.enabled
                ? !reminders?.available
                  ? 'Reminders need Allotment to run as a Home Assistant app.'
                  : reminders.viaGateway
                    ? 'Turn reminders on in Settings, Server, Reminders first.'
                    : 'Choose a notify service in Settings, Server, Reminders first.'
                : undefined
            }
          />

          <p className="text-xs text-text-tertiary">
            On bank-connected accounts, income waits for the imported receipt even when auto-create
            is enabled. Closed accounts never auto-create transactions.
          </p>

          {/* Advanced settings — kept mounted and open while Date flexibility is invalid so the
              error stays visible and Save stays disabled (WR-02, WR-06) */}
          <div>
            <button
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => setShowAdvanced((open) => nextAdvancedOpen(open, advancedInvalid))}
              className="text-xs font-medium text-text-tertiary hover:text-text-secondary"
            >
              {advancedOpen ? '▾ Advanced' : '▸ Advanced'}
            </button>
            <div
              hidden={!advancedOpen}
              className="mt-2 space-y-3 pl-2 border-l-2 border-border-light"
            >
              <AmountFields report={advancedAmounts.report}>
                {showWeekendAdjust && (
                  <Select
                    label="Weekend adjustment"
                    value={weekendAdjust}
                    onChange={(v) => setWeekendAdjust(v as WeekendAdjust)}
                    options={WEEKEND_ADJUST_OPTIONS}
                  />
                )}
                <NumberField
                  label="Date flexibility"
                  description="± days for matching"
                  value={dateFlexibility}
                  onChange={(v) => {
                    if (v !== null) setDateFlexibility(v);
                  }}
                  min={0}
                  max={14}
                  resetKey={resets}
                />
              </AmountFields>
            </div>
          </div>

          <SavingPausedHint className="text-right" />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-md hover:bg-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-medium text-brand-contrast bg-brand-600 rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {editItem ? 'Save changes' : 'Add recurring'}
            </button>
          </div>
        </form>
      </AmountFields>
    </Modal>
  );
}
