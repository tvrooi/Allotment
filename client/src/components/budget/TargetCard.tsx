import { useEffect, useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deleteTarget, saveTarget, type TargetInput } from '../../api/budget';
import { useCanSave } from '../../hooks/useConnection';
import type { TargetStatus } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { targetLabel } from '../../utils/targets';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DatePicker } from '../ui/DatePicker';
import { Label } from '../ui/Label';
import { NumberField } from '../ui/NumberField';
import { Select } from '../ui/Select';

const TYPES: { value: TargetInput['type']; label: string; help: string }[] = [
  { value: 'monthly', label: 'Monthly amount', help: 'Assign the same amount every month.' },
  { value: 'by-date', label: 'Balance by date', help: 'Have this balance by a date.' },
  {
    value: 'recurring',
    label: 'Recurring bill',
    help: 'A bill every few months; the next due date advances after each cycle.',
  },
  {
    value: 'refill',
    label: 'Refill to balance',
    help: 'Top the balance up to this amount each month.',
  },
];
/** The server's bounds on a recurring target's cycle (`cycleMonths` in server/src/services/targetConfig.ts) */
const CYCLE_MIN = 1;
const CYCLE_MAX = 60;

/** Edit a category's target. Saving a target never assigns money. */
export function TargetCard({
  categoryId,
  target,
}: {
  categoryId: string;
  target: TargetStatus | null | undefined;
}) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const [type, setType] = useState<TargetInput['type']>(target?.type ?? 'monthly');
  /** Minor units; 0 until an amount is typed */
  const [amount, setAmount] = useState(target?.amount ?? 0);
  const [dueDate, setDueDate] = useState(target?.dueDate ?? '');
  const [cycle, setCycle] = useState(target?.cycleMonths ?? 12);
  const [error, setError] = useState<string | null>(null);
  const { allValid, report } = useAmountValidity();
  const amountId = useId();
  useEffect(() => {
    if (!target) return;
    setType(target.type);
    setAmount(target.amount);
    setCycle(target.cycleMonths ?? 12);
  }, [target?.type, target?.amount, target?.cycleMonths]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await qc.invalidateQueries({ queryKey: ['budget'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the target.');
    }
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) return setError('Enter a target amount above zero.');
    const cents = Math.abs(amount);
    const input: TargetInput =
      type === 'by-date'
        ? { type, amount: cents, dueDate }
        : type === 'recurring'
          ? { type, amount: cents, dueDate, cycleMonths: cycle }
          : { type, amount: cents };
    void run(() => saveTarget(categoryId, input));
  }
  const needsDate = type === 'by-date' || type === 'recurring';
  return (
    <form
      onSubmit={save}
      aria-label="Category target"
      className="bg-surface rounded-lg shadow-card border border-border-light p-4 space-y-3"
    >
      <h2 className="text-base font-semibold text-text">Target</h2>
      {target && (
        <p className={`text-sm ${target.underfunded ? 'text-caution' : 'text-text-secondary'}`}>
          {targetLabel(target)}. This month needs {formatCurrency(target.required)}
          {target.periodsLeft ? ` over ${target.periodsLeft} month(s) left` : ''}.
        </p>
      )}
      <AmountFields report={report}>
        <Select
          label="Target type"
          value={type}
          onChange={(v) => setType(v as TargetInput['type'])}
          options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
          description={TYPES.find((t) => t.value === type)!.help}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={amountId}>Target amount</Label>
          <CurrencyInput
            id={amountId}
            value={amount}
            // Signed, so a typed negative meets the positive-amount check instead of becoming positive
            allowNegative
            onChange={setAmount}
            // Enter submits without leaving the field, so what is typed counts at once
            onTextChange={(cents) => {
              if (cents !== null) setAmount(cents);
            }}
          />
        </div>
        {needsDate && (
          <DatePicker
            label={type === 'recurring' ? 'Next due date' : 'Due date'}
            isRequired
            value={dueDate}
            onChange={setDueDate}
          />
        )}
        {type === 'recurring' && (
          <NumberField
            label="Repeats every (months)"
            min={CYCLE_MIN}
            max={CYCLE_MAX}
            value={cycle}
            onChange={(months) => {
              if (months !== null) setCycle(months);
            }}
          />
        )}
      </AmountFields>
      <p className="text-xs text-text-tertiary">
        Targets suggest funding from money you already have. Use Fund targets on the budget to
        review and assign it.
      </p>
      {error && (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!canSave || !allValid || (needsDate && !dueDate)}>
          Save target
        </Button>
        {target && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canSave}
            onClick={() => run(() => deleteTarget(categoryId))}
          >
            Remove target
          </Button>
        )}
      </div>
    </form>
  );
}
