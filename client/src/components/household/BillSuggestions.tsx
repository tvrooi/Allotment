import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addSuggestedBill,
  dismissSuggestedBill,
  getBillSuggestions,
  type BillSuggestion,
} from '../../api/households';
import { useCanSave } from '../../hooks/useConnection';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { Button } from '../ui/Button';

// "Looks like a bill": payments the household account makes again and again that aren't in
// Recurring yet, like power every two months or quarterly water (server
// householdBillSuggestions.ts). Nothing is added by itself: Add makes it a variable recurring
// item shared with the household; Not a bill stops suggesting that payee here.

interface Props {
  groupId: string;
  currency: string;
}

export function BillSuggestions({ groupId, currency }: Props) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const [error, setError] = useState('');
  const { data: suggestions = [] } = useQuery({
    queryKey: ['households', groupId, 'bill-suggestions'],
    queryFn: () => getBillSuggestions(groupId),
  });
  const refresh = async () => {
    setError('');
    await qc.invalidateQueries({ queryKey: ['households'] });
    await qc.invalidateQueries({ queryKey: ['schedules'] });
  };
  const add = useMutation({
    mutationFn: (s: BillSuggestion) => addSuggestedBill(groupId, s.id),
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  });
  const dismiss = useMutation({
    mutationFn: (s: BillSuggestion) => dismissSuggestedBill(groupId, s.payeeKey),
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  });
  if (!suggestions.length && !error) return null;
  const money = (n: number) => formatMoney(n, currency);
  const busy = !canSave || add.isPending || dismiss.isPending;

  return (
    <div className="mt-3 rounded-lg border border-dashed border-border p-3">
      <h3 id={`bill-suggestions-${groupId}`} className="text-xs font-semibold text-text-secondary">
        Looks like a bill
      </h3>
      <p className="text-xs text-text-tertiary mt-0.5">
        The household account pays these again and again, but they aren&rsquo;t recurring bills yet.
      </p>
      {error && (
        <p role="alert" className="text-xs text-negative mt-1">
          {error}
        </p>
      )}
      <ul className="mt-2 grid gap-2" aria-labelledby={`bill-suggestions-${groupId}`}>
        {suggestions.map((s) => (
          <li
            key={s.id}
            aria-label={s.payeeName}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-text">{s.payeeName}</p>
              <p className="text-xs text-text-tertiary">
                {s.frequency} · {s.count} payments,{' '}
                <span className="tabular-nums">
                  {s.minAmount === s.maxAmount
                    ? money(s.amount)
                    : `${money(s.minAmount)}–${money(s.maxAmount)}`}
                </span>{' '}
                · last {formatDay(s.lastDate)} · next about {formatDay(s.nextDate)}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" disabled={busy} onClick={() => add.mutate(s)}>
                Add as household bill
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => dismiss.mutate(s)}>
                Not a bill
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
