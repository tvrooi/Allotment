import { useId, useState } from 'react';
import type { HouseholdSplit } from '../../api/households';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { SplitEditor } from './SplitEditor';

/** The parts of an entry the dialog needs; the Household page's own entry type fits it */
export interface EditableEntry {
  id: string;
  kind: string;
  date: string;
  description: string;
  amount: number;
  payerId: string | null;
  recipientId?: string | null;
  transactionId: string | null;
  shares: { personId: string; amount: number }[];
}

interface Props {
  entry: EditableEntry;
  people: { id: string; name: string }[];
  currency: string;
  /** The household has a household account, so a shared expense can be paid by it */
  hasPool: boolean;
  /** A refund depends on this expense, so only its description can change (SPL-03) */
  descriptionOnly: boolean;
  saving: boolean;
  error: string;
  onSave: (body: Record<string, unknown>) => void;
  onClose: () => void;
}

const field = 'grid gap-1 text-sm font-medium text-text-secondary';

/**
 * Household → an entry's Edit: changes it where it is, so refunds and its bank link keep
 * pointing at it. An entry linked to a bank payment keeps that payment's date and amount.
 */
export function EditEntry({
  entry,
  people,
  currency,
  hasPool,
  descriptionOnly,
  saving,
  error,
  onSave,
  onClose,
}: Props) {
  const uid = useId();
  const canSave = useCanSave();
  const [description, setDescription] = useState(entry.description);
  const [date, setDate] = useState(entry.date);
  const [amount, setAmount] = useState(Math.abs(entry.amount));
  const [payerId, setPayerId] = useState(entry.payerId ?? '');
  const [recipientId, setRecipientId] = useState(entry.recipientId ?? '');
  const locked = descriptionOnly || entry.kind === 'refund';
  const linked = !!entry.transactionId;
  const settled = entry.kind === 'settlement';
  const isExpense = entry.kind === 'expense';

  const submit = (split?: HouseholdSplit | null) => {
    if (locked) return onSave({ description });
    const base = {
      kind: entry.kind,
      date,
      description,
      amount,
      payerId: payerId || null,
      recipientId: settled ? recipientId || null : null,
      transactionId: entry.transactionId,
    };
    if (!isExpense) return onSave(base);
    const chosen = split ?? {
      mode: 'equal' as const,
      shares: people.map((p) => ({ personId: p.id, value: 1 })),
    };
    onSave({ ...base, mode: chosen.mode, shares: chosen.shares });
  };

  return (
    <Modal isOpen onClose={onClose} title="Edit entry" size="lg">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isExpense || locked) submit();
        }}
      >
        <div className={field}>
          <label htmlFor={`${uid}-description`}>Description</label>
          <Input
            id={`${uid}-description`}
            value={description}
            required
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {locked ? (
          <p className="text-xs text-text-tertiary">
            {entry.kind === 'refund'
              ? 'Only the description of a refund can change.'
              : 'A refund depends on this entry, so only its description can change. Remove the refund first to change anything else.'}
          </p>
        ) : (
          <>
            {linked ? (
              <p className="text-xs text-text-tertiary">
                Linked to a bank payment of {formatMoney(Math.abs(entry.amount), currency)} on{' '}
                {formatDay(entry.date)}: its date and amount stay as the payment has them.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={field}>
                  <label htmlFor={`${uid}-date`}>Date</label>
                  <Input
                    id={`${uid}-date`}
                    type="date"
                    value={date}
                    required
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className={field}>
                  <span>Amount ({currency})</span>
                  <CurrencyInput aria-label="Amount" value={amount} onChange={setAmount} />
                </div>
              </div>
            )}
            <label className={field}>
              Paid by
              <Select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
                {isExpense && hasPool && <option value="">Household pool</option>}
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
            {settled && (
              <label className={field}>
                Paid to
                <Select value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
                  {people
                    .filter((p) => p.id !== payerId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </Select>
              </label>
            )}
            {isExpense && (
              <div className="grid gap-1">
                <span className="text-sm font-medium text-text-secondary">Split</span>
                <SplitEditor
                  people={people}
                  current={{
                    mode: 'exact',
                    shares: people.map((p) => ({
                      personId: p.id,
                      value: entry.shares.find((s) => s.personId === p.id)?.amount ?? 0,
                    })),
                  }}
                  allowFixed
                  expected={amount}
                  currency={currency}
                  saving={saving || !canSave}
                  saveLabel="Save changes"
                  onSave={submit}
                />
              </div>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <SavingPausedHint />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {(!isExpense || locked) && (
            <Button type="submit" disabled={saving || !canSave || !description.trim()}>
              Save changes
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
