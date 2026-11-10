import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recordSharedExpense, type HouseholdSplit } from '../../api/households';
import { useCanSave } from '../../hooks/useConnection';
import { todayIso } from '../../utils/calendarDay';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Input, Select } from '../ui/Input';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { splitLabel } from './splitLabel';

// Household → Overview, for a household without a shared account (people pay as they go): add a
// shared expense in one row, like groceries or a night out, split the way the household splits
// by default. Anything else (another date, a repayment, an unequal split) stays in "Record
// something else".

const card = 'bg-surface rounded-lg shadow-card border border-border-light p-4';
const label = 'grid gap-1 text-sm font-medium text-text-secondary';

interface Props {
  groupId: string;
  people: { id: string; name: string; isSelf: number }[];
  defaultSplit: HouseholdSplit | null;
  onChangeSplit: () => void;
}

export function QuickExpense({ groupId, people, defaultSplit, onChangeSplit }: Props) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const self = people.find((p) => p.isSelf) ?? people[0];
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [payerId, setPayerId] = useState(self.id);
  const [error, setError] = useState('');
  const add = useMutation({
    mutationFn: () =>
      recordSharedExpense(groupId, {
        description: description.trim(),
        amount,
        payerId,
        date: todayIso(),
        people,
        split: defaultSplit,
      }),
    onSuccess: async () => {
      setError('');
      setDescription('');
      setAmount(0);
      for (const key of ['households', 'shared-households', 'budget', 'budget-summary', 'review']) {
        await qc.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (e: Error) => setError(e.message),
  });
  const ready = description.trim() !== '' && amount > 0;
  const others = people.filter((p) => p.id !== payerId).map((p) => p.name);

  return (
    <section className={card} aria-labelledby="quick-expense">
      <h2 id="quick-expense" className="text-sm font-semibold text-text">
        Add a shared expense
      </h2>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_11rem_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) add.mutate();
        }}
      >
        <label className={label}>
          What for
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            placeholder="Groceries, dinner, movie"
          />
        </label>
        <div className={label}>
          <label htmlFor="quick-expense-amount">Amount</label>
          <CurrencyInput id="quick-expense-amount" value={amount} onChange={setAmount} />
        </div>
        <label className={label}>
          Paid by
          <Select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.isSelf ? `${p.name} (me)` : p.name}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" disabled={!ready || !canSave || add.isPending}>
          Add expense
        </Button>
      </form>
      <p className="mt-2 text-xs text-text-tertiary">
        Today, split {splitLabel(defaultSplit, people)}
        {others.length > 0 && ` · ${others.join(' and ')} would owe their share back`}.{' '}
        <button
          type="button"
          onClick={onChangeSplit}
          className="font-medium text-text-secondary underline-offset-2 hover:underline max-md:min-h-11"
        >
          Change split
        </button>
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-negative">
          {error}
        </p>
      )}
      <SavingPausedHint className="mt-1" />
    </section>
  );
}
