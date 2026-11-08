import { useState } from 'react';
import { useUpdateSchedule } from '../../hooks/useSchedules';
import { useCanSave } from '../../hooks/useConnection';
import type { SharedRecurringBill } from '../../api/households';
import type { AmountType } from '../../types';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Select } from '../ui/Input';

// A shared bill's amount, the Up "Edit Regular" way: its payments newest first with their total,
// a prompt when real payments have moved away from what it expects (server billDrift; the
// owner's click is the only thing that changes it), and an in-place edit of the expected amount.
// Every change goes through the schedule (PUT /api/schedules/:id), with Undo, so Recurring,
// the forecast and the household's bills all follow.

const AMOUNT_TYPES = [
  { value: 'exact', label: 'Exact: the same every time' },
  { value: 'approximate', label: 'About the same (within 10%)' },
  { value: 'variable', label: 'Changes (within 25%)' },
] as const;

interface Props {
  bill: SharedRecurringBill;
  currency: string;
}

export function BillAmount({ bill, currency }: Props) {
  const canSave = useCanSave();
  const money = (n: number) => formatMoney(n, currency);
  const save = useUpdateSchedule();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(bill.amount);
  const [amountType, setAmountType] = useState<AmountType>(bill.amountType);
  const [error, setError] = useState('');
  // Keep the schedule's sign: a bill is money out, so its schedule amount is negative
  const signed = (positive: number) => (bill.scheduleAmount < 0 ? -positive : positive);
  const apply = (changes: { amount?: number; amountType?: AmountType }) =>
    save.mutate(
      {
        id: bill.scheduleId,
        ...(changes.amount !== undefined ? { amount: signed(changes.amount) } : {}),
        ...(changes.amountType ? { amountType: changes.amountType } : {}),
      },
      {
        onSuccess: () => {
          setEditing(false);
          setError('');
        },
        onError: (e) => setError(e.message),
      },
    );
  const total = bill.payments.reduce((sum, p) => sum + p.amount, 0);
  const { drift } = bill;
  const busy = !canSave || save.isPending;

  return (
    <div className="space-y-1.5">
      {drift && !editing && (
        <div className="rounded-md bg-caution-subtle p-2 text-xs text-text space-y-1.5">
          <p>
            Last paid <span className="font-semibold tabular-nums">{money(drift.lastPaid)}</span> on{' '}
            {formatDay(drift.lastDate)}, but {money(bill.amount)} is expected.
          </p>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" disabled={busy} onClick={() => apply({ amount: drift.lastPaid })}>
              Update to {money(drift.lastPaid)}
            </Button>
            {drift.averageOf > 1 && drift.average !== drift.lastPaid && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => apply({ amount: drift.average })}
              >
                Use the average of the last {drift.averageOf} ({money(drift.average)})
              </Button>
            )}
          </div>
        </div>
      )}
      {bill.payments.length > 0 && (
        <details className="text-xs text-text-tertiary">
          <summary className="cursor-pointer w-fit">
            {bill.payments.length === 1 ? 'Last payment' : `Last ${bill.payments.length} payments`}:{' '}
            <span className="tabular-nums">{money(total)}</span>
          </summary>
          <ul className="mt-1 grid gap-0.5">
            {bill.payments.map((p) => (
              <li key={p.transactionId} className="flex justify-between gap-3 tabular-nums">
                <span>{formatDay(p.date)}</span>
                <span className="text-text-secondary">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {editing ? (
        <form
          className="grid gap-2 rounded-md bg-surface-alt p-2.5"
          aria-label={`Edit ${bill.name}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (amount <= 0) return setError('Enter the amount you expect to pay');
            apply({ amount, amountType });
          }}
        >
          <label className="grid gap-1 text-xs font-medium text-text-secondary">
            Expected amount
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              currency={currency}
              aria-label="Expected amount"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-text-secondary">
            How it varies
            <Select
              value={amountType}
              onChange={(e) => setAmountType(e.target.value as AmountType)}
            >
              {AMOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </label>
          <p className="text-xs text-text-tertiary">
            Changes the bill in Recurring too. Its household bills that aren&rsquo;t paid yet
            follow.
          </p>
          {error && (
            <p role="alert" className="text-xs text-negative">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setAmount(bill.amount);
                setAmountType(bill.amountType);
                setError('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        error && (
          <p role="alert" className="text-xs text-negative">
            {error}
          </p>
        )
      )}
      {!editing && (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Edit amount of ${bill.name}`}
          disabled={busy}
          onClick={() => {
            setAmount(bill.amount);
            setAmountType(bill.amountType);
            setEditing(true);
          }}
        >
          Edit amount
        </Button>
      )}
    </div>
  );
}
