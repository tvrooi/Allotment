import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRepaymentSuggestions,
  recordRepayment,
  recordSettleUp,
  type RepaymentSuggestion,
  type SettleUpTransfer,
} from '../../api/households';
import { useCanSave } from '../../hooks/useConnection';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { todayIso } from '../../utils/calendarDay';
import { Button } from '../ui/Button';
import { SavingPausedHint } from '../connection/SavingPausedHint';

interface Props {
  groupId: string;
  currency: string;
  people: { id: string; name: string; isSelf: number }[];
  /** Who should pay whom to clear what people owe each other for things they paid themselves */
  settlements: SettleUpTransfer[];
  /** What each person owes the household account: put into the account, not paid to a person */
  poolOwed: { personId: string; amount: number }[];
}

/**
 * Household → Settle up (SPL-01, SPL-02): the transfers that would clear what people owe each
 * other, each recorded with one click. If a bank payment of yours already looks like one, the
 * button links that payment instead, so it is not recorded twice.
 */
export function SettleUp({ groupId, currency, people, settlements, poolOwed }: Props) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const [error, setError] = useState('');
  const money = (n: number) => formatMoney(n, currency);
  const self = people.find((p) => p.isSelf);
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? 'Someone';
  const { data: suggestions = [] } = useQuery({
    queryKey: ['repayments', groupId],
    queryFn: () => getRepaymentSuggestions(groupId),
  });
  const refresh = async () => {
    setError('');
    for (const key of ['households', 'shared-households', 'budget', 'budget-summary', 'review']) {
      await qc.invalidateQueries({ queryKey: [key] });
    }
    await qc.invalidateQueries({ queryKey: ['repayments', groupId] });
  };
  const onError = (e: Error) => setError(e.message);
  const record = useMutation({
    mutationFn: (t: SettleUpTransfer) =>
      recordSettleUp(groupId, t, { from: name(t.fromId), to: name(t.toId) }, todayIso()),
    onSuccess: refresh,
    onError,
  });
  const link = useMutation({
    mutationFn: (s: RepaymentSuggestion) => recordRepayment(groupId, s, self!.id),
    onSuccess: refresh,
    onError,
  });
  if (!settlements.length && !poolOwed.length) return null;

  const sentence = (t: SettleUpTransfer) =>
    t.fromId === self?.id
      ? `You pay ${name(t.toId)} ${money(t.amount)}`
      : t.toId === self?.id
        ? `${name(t.fromId)} pays you ${money(t.amount)}`
        : `${name(t.fromId)} pays ${name(t.toId)} ${money(t.amount)}`;
  // Your own bank payment (or the money you received) that already looks like this transfer
  const bankMatch = (t: SettleUpTransfer) =>
    suggestions.find(
      (s) =>
        (s.kind === 'payment' && t.fromId === self?.id && s.personId === t.toId) ||
        (s.kind === 'settlement' && t.toId === self?.id && s.personId === t.fromId),
    );

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-text-secondary">Settle up</h3>
      <p className="text-xs text-text-tertiary">
        The fewest repayments that clear what people owe each other for things they paid themselves.
        Nothing is recorded until you click.
      </p>
      {error && (
        <p role="alert" className="text-xs text-negative mt-1">
          {error}
        </p>
      )}
      <ul className="mt-1 divide-y divide-border-light" aria-label="Suggested repayments">
        {settlements.map((t) => {
          const match = bankMatch(t);
          return (
            <li
              key={`${t.fromId}-${t.toId}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <span className="min-w-48 flex-1">
                {sentence(t)}
                {match && (
                  <span className="block text-xs text-text-tertiary">
                    {formatDay(match.date)} · {match.payeeName}: {money(match.amount)}
                  </span>
                )}
              </span>
              {match ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canSave || link.isPending}
                  aria-label={`Link the payment of ${money(match.amount)} on ${formatDay(match.date)}: ${sentence(t)}`}
                  onClick={() => link.mutate(match)}
                >
                  Link payment of {money(match.amount)}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canSave || record.isPending}
                  aria-label={`Record: ${sentence(t)}`}
                  onClick={() => record.mutate(t)}
                >
                  Record
                </Button>
              )}
            </li>
          );
        })}
        {poolOwed.map((o) => (
          <li key={o.personId} className="py-2 text-sm text-text-secondary">
            {o.personId === self?.id ? 'You put' : `${name(o.personId)} puts`} {money(o.amount)}{' '}
            into the household account
          </li>
        ))}
      </ul>
      <SavingPausedHint className="mt-1" />
    </div>
  );
}
