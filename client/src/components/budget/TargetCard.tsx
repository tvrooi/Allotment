import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deleteTarget, saveTarget, type TargetInput } from '../../api/budget';
import { useCanSave } from '../../hooks/useConnection';
import type { TargetStatus } from '../../types';
import { centsToInput, formatCurrency, isUnreadableAmount, parseCents } from '../../utils/currency';
import { targetLabel } from '../../utils/targets';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';

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
const field = 'flex flex-col gap-1 text-xs text-text-secondary';

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
  const [amount, setAmount] = useState(target ? centsToInput(target.amount) : '');
  const [dueDate, setDueDate] = useState(target?.dueDate ?? '');
  const [cycle, setCycle] = useState(target?.cycleMonths ?? 12);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!target) return;
    setType(target.type);
    setAmount(centsToInput(target.amount));
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
    if (isUnreadableAmount(amount) || parseCents(amount) <= 0)
      return setError('Enter a target amount above zero.');
    const cents = Math.abs(parseCents(amount));
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
      <h2 className="text-sm font-semibold text-text">Target</h2>
      {target && (
        <p className={`text-sm ${target.underfunded ? 'text-caution' : 'text-text-secondary'}`}>
          {targetLabel(target)}. This month needs {formatCurrency(target.required)}
          {target.periodsLeft ? ` over ${target.periodsLeft} month(s) left` : ''}.
        </p>
      )}
      <label className={field}>
        Target type
        <Select value={type} onChange={(e) => setType(e.target.value as TargetInput['type'])}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <span>{TYPES.find((t) => t.value === type)!.help}</span>
      </label>
      <label className={field}>
        Target amount
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      {needsDate && (
        <label className={field}>
          {type === 'recurring' ? 'Next due date' : 'Due date'}
          <Input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
      )}
      {type === 'recurring' && (
        <label className={field}>
          Repeats every (months)
          <Input
            type="number"
            min={1}
            max={60}
            value={cycle}
            onChange={(e) => setCycle(Math.min(60, Math.max(1, Math.round(+e.target.value))))}
          />
        </label>
      )}
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
        <Button type="submit" size="sm" disabled={!canSave}>
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
