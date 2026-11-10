import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { useCanSave } from '../../hooks/useConnection';
import { formatMoney } from '../../utils/currency';
import { todayIso } from '../../utils/calendarDay';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SavingPausedHint } from '../connection/SavingPausedHint';

interface Props {
  groupId: string;
  currency: string;
  people: { id: string; name: string }[];
  balances: Record<string, number>;
  toPool: Record<string, number>;
  direct: Record<string, number>;
}

/**
 * Where each balance comes from (its household-account part and what people owe each other),
 * and Reconcile: agree everyone's balance from a date (0 unless changed) with adjustment
 * entries that keep the history; removing them under All contributions undoes it.
 */
export function ReconcileBalances({ groupId, currency, people, balances, toPool, direct }: Props) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const money = (n: number) => formatMoney(n, currency);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [agreed, setAgreed] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const reconcile = useMutation({
    mutationFn: () =>
      apiFetch(`/households/${groupId}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({
          date,
          agreed: Object.entries(agreed)
            .filter(([, amount]) => amount !== 0)
            .map(([personId, amount]) => ({ personId, amount })),
        }),
      }),
    onSuccess: async () => {
      setOpen(false);
      setAgreed({});
      for (const key of ['households', 'shared-households', 'budget', 'budget-summary', 'review'])
        await qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e: Error) => setError(e.message),
  });
  const part = (n: number) => (n === 0 ? '—' : money(n));

  return (
    <>
      <details className="mt-3 text-xs text-text-secondary">
        <summary className="cursor-pointer text-text-tertiary max-md:py-3.5">
          Where these figures come from
        </summary>
        <p className="mt-2">
          Each balance adds two parts. <strong>Household account</strong>: money put in, less their
          share of what the household account paid. <strong>Between people</strong>: what they paid
          for others, less their share of what others paid for them, after repayments. Every entry
          under All contributions, payments & repayments counts. The amount beside Household in the
          sidebar is the household account’s bank balance, which is a different figure.
        </p>
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr className="text-text-tertiary">
              <th className="text-left font-medium py-1">Person</th>
              <th className="text-right font-medium py-1">Household account</th>
              <th className="text-right font-medium py-1">Between people</th>
              <th className="text-right font-medium py-1">Balance</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t border-border-light">
                <td className="py-1">{p.name}</td>
                <td className="py-1 text-right">{part(toPool[p.id] ?? 0)}</td>
                <td className="py-1 text-right">{part(direct[p.id] ?? 0)}</td>
                <td className="py-1 text-right">{money(balances[p.id] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          onClick={() => {
            setError('');
            setDate(todayIso());
            setOpen(true);
          }}
        >
          Reconcile balances
        </Button>
      </details>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Reconcile balances">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            reconcile.mutate();
          }}
        >
          <p className="text-sm text-text-secondary">
            Agree everyone’s balance from a date. Allotment records adjustment entries so the
            balances match, and keeps every earlier entry. What people owe each other directly is
            cleared, so record a repayment first if it was paid. Removing the adjustment entries
            undoes this.
          </p>
          <label className="grid gap-1 text-sm font-medium text-text-secondary">
            Agreed on
            <Input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <div className="divide-y divide-border-light border-y border-border-light">
            {people.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-text">
                  {p.name}
                  <span className="block text-xs text-text-tertiary">
                    Now {money(balances[p.id] ?? 0)}
                  </span>
                </span>
                <div className="w-36">
                  <CurrencyInput
                    aria-label={`Agreed balance for ${p.name}`}
                    value={agreed[p.id] ?? 0}
                    onChange={(cents) => setAgreed((a) => ({ ...a, [p.id]: cents }))}
                    allowNegative
                    currency={currency}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-tertiary">
            Positive means credit held in the household account; negative means they owe it.
          </p>
          {error && (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}
          <SavingPausedHint />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={reconcile.isPending || !canSave}>
              Agree balances
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
