import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccounts } from '../../hooks/useAccounts';
import {
  addPoolAccount,
  getRepaymentSuggestions,
  recordRepayment,
  removePoolAccount,
  setDefaultSplit,
  type HouseholdSplit,
  type RepaymentSuggestion,
} from '../../api/households';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';

// Household → Sharing: the accounts the household pays from (each one outside your personal
// budget), the split "Share with household" uses, and money received that looks like someone
// repaying what they owe.

const card = 'bg-surface rounded-lg shadow-card border border-border-light p-4';

interface Props {
  group: {
    id: string;
    currency: string;
    accountId: string | null;
    poolAccountIds: string[];
    defaultSplit: HouseholdSplit | null;
  };
  people: { id: string; name: string; isSelf: number }[];
}

export function HouseholdSharing({ group, people }: Props) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const [error, setError] = useState('');
  const refresh = async () => {
    setError('');
    await qc.invalidateQueries({ queryKey: ['households'] });
    await qc.invalidateQueries({ queryKey: ['accounts'] });
    await qc.invalidateQueries({ queryKey: ['budget'] });
    await qc.invalidateQueries({ queryKey: ['budget-summary'] });
    await qc.invalidateQueries({ queryKey: ['repayments', group.id] });
  };
  const onError = (e: Error) => setError(e.message);
  const pools = useMutation({
    mutationFn: ({ accountId, remove }: { accountId: string; remove?: boolean }) =>
      remove ? removePoolAccount(group.id, accountId) : addPoolAccount(group.id, accountId),
    onSuccess: refresh,
    onError,
  });
  const split = useMutation({
    mutationFn: (s: HouseholdSplit | null) => setDefaultSplit(group.id, s),
    onSuccess: refresh,
    onError,
  });
  const { data: suggestions = [] } = useQuery({
    queryKey: ['repayments', group.id],
    queryFn: () => getRepaymentSuggestions(group.id),
  });
  const self = people.find((p) => p.isSelf);
  const repay = useMutation({
    mutationFn: (s: RepaymentSuggestion) => recordRepayment(group.id, s, self!.id),
    onSuccess: refresh,
    onError,
  });
  const money = (n: number) => formatMoney(n, group.currency);
  const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  const candidates = accounts.filter(
    (a) => !a.closedAt && !a.householdPool && !group.poolAccountIds.includes(a.id),
  );
  const [adding, setAdding] = useState('');

  const current = group.defaultSplit;
  const [mode, setMode] = useState<HouseholdSplit['mode']>(current?.mode ?? 'equal');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      people.map((p) => {
        const v = current?.shares.find((s) => s.personId === p.id)?.value;
        return [p.id, v === undefined ? '' : String(current?.mode === 'percentage' ? v / 100 : v)];
      }),
    ),
  );
  function saveSplit() {
    if (mode === 'equal') return split.mutate(null);
    const shares = people.map((p) => {
      const n = Number(values[p.id] || 0);
      return { personId: p.id, value: mode === 'percentage' ? Math.round(n * 100) : Math.round(n) };
    });
    split.mutate({ mode, shares });
  }
  const describe = (s: HouseholdSplit | null) =>
    !s || s.mode === 'equal'
      ? 'equal between everyone'
      : s.shares
          .map(
            (x) =>
              `${people.find((p) => p.id === x.personId)?.name ?? '?'} ${s.mode === 'percentage' ? `${x.value / 100}%` : `×${x.value}`}`,
          )
          .join(', ');

  return (
    <section className={card} aria-labelledby="household-sharing">
      <h2 id="household-sharing" className="text-sm font-semibold text-text">
        Sharing
      </h2>
      {error && (
        <p role="alert" className="text-xs text-negative mt-1">
          {error}
        </p>
      )}

      <h3 className="text-xs font-semibold text-text-secondary mt-3">Household accounts</h3>
      <p className="text-xs text-text-tertiary">
        Payments from these accounts are the household's, not yours, so they stay out of your
        budget. Your own transfers into them count as your share, in the category you give them. Add
        each account the household pays from (for example an Up 2Up spending account and its
        savers).
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Household accounts">
        {group.poolAccountIds.map((id) => (
          <li
            key={id}
            className="inline-flex items-center gap-1 rounded-md bg-surface-alt px-2 py-0.5 text-xs"
          >
            {name(id)}
            {id !== group.accountId && (
              <button
                type="button"
                className="text-text-tertiary hover:text-negative"
                aria-label={`Remove ${name(id)} from the household`}
                onClick={() => pools.mutate({ accountId: id, remove: true })}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2 items-end">
        <label className="grid gap-1 text-xs text-text-secondary flex-1">
          Add an account
          <Select value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Choose an account</option>
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>
        <Button
          size="sm"
          variant="secondary"
          disabled={!adding || pools.isPending}
          onClick={() => {
            pools.mutate({ accountId: adding });
            setAdding('');
          }}
        >
          Add
        </Button>
      </div>

      <h3 className="text-xs font-semibold text-text-secondary mt-4">Default split</h3>
      <p className="text-xs text-text-tertiary">
        Used by <strong>Share with household</strong> in transactions and by rules. Now{' '}
        {describe(current)}.
      </p>
      <div className="mt-2 grid gap-2">
        <Select
          aria-label="Split"
          value={mode}
          onChange={(e) => setMode(e.target.value as HouseholdSplit['mode'])}
        >
          <option value="equal">Equal</option>
          <option value="percentage">Percentages</option>
          <option value="weight">Weights (for example 2 : 1 : 1)</option>
        </Select>
        {mode !== 'equal' &&
          people.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="w-24 truncate">{p.name}</span>
              <Input
                aria-label={`${p.name}'s ${mode === 'percentage' ? 'percentage' : 'weight'}`}
                inputMode="decimal"
                value={values[p.id] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
              />
              {mode === 'percentage' && '%'}
            </label>
          ))}
        <div>
          <Button size="sm" variant="secondary" onClick={saveSplit} disabled={split.isPending}>
            Save split
          </Button>
        </div>
      </div>

      {suggestions.length > 0 && self && (
        <>
          <h3 className="text-xs font-semibold text-text-secondary mt-4">Looks like repayments</h3>
          <ul className="mt-1 divide-y divide-border-light" aria-label="Possible repayments">
            {suggestions.map((s) => (
              <li key={s.transactionId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="flex-1 min-w-48">
                  {formatDay(s.date)} · {s.payeeName}: {money(s.amount)}
                  <span className="block text-xs text-text-tertiary">
                    {s.personName} owes {money(s.owes)}
                    {s.notes ? ` · “${s.notes}”` : ''}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={repay.isPending}
                  onClick={() => repay.mutate(s)}
                >
                  Record {s.personName}'s repayment
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
