import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useSchedules } from '../hooks/useSchedules';
import { useTransactions } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { formatMoney } from '../utils/currency';
import { formatDay } from '../utils/dates';
import { HouseholdSharing } from '../components/household/HouseholdSharing';
import { CombinedHousehold } from '../components/household/CombinedHousehold';
import { RecurringBills } from '../components/household/RecurringBills';
import type { HouseholdSplit, SharedRecurringBill } from '../api/households';

type Group = {
  id: string;
  name: string;
  currency: string;
  accountId: string | null;
  poolAccountIds: string[];
  defaultSplit: HouseholdSplit | null;
};
type Person = { id: string; name: string; isSelf: number };
type Entry = {
  id: string;
  kind: string;
  date: string;
  description: string;
  amount: number;
  payerId: string | null;
  transactionId: string | null;
  billId: string | null;
  reviewReason: string | null;
  shares: { personId: string; amount: number }[];
};
type Bill = {
  id: string;
  description: string;
  dueDate: string;
  amount: number;
  reserved: number;
  personalShare: number;
  status: string;
};
type State = {
  group: Group;
  people: Person[];
  events: Entry[];
  balances: Record<string, number>;
  pool: number;
  cash: number;
  unreserved: number;
  bills: Bill[];
  recurringBills: SharedRecurringBill[];
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const field = 'grid gap-1 text-sm font-medium text-text-secondary';
const textareaClass =
  'block w-full rounded-md border border-border px-3 py-2 text-sm bg-surface text-text focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600';
const card = 'bg-surface rounded-lg shadow-card border border-border-light p-4';
const STATUS_CLASS: Record<string, string> = {
  funded: 'bg-positive/20 text-text',
  paid: 'bg-surface-alt text-text-secondary',
  due: 'bg-caution-subtle text-caution',
  shortfall: 'bg-caution-subtle text-caution',
  'needs review': 'bg-negative/20 text-negative',
};
const KIND_LABEL: Record<string, string> = {
  expense: 'Shared expense',
  refund: 'Refund',
  contribution: 'Advance into pool',
  settlement: 'Repayment',
};
function cents(value: FormDataEntryValue | null) {
  const text = String(value ?? '');
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error('Enter amounts with at most two decimal places');
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export default function HouseholdPage() {
  const [params] = useSearchParams();
  const cache = useQueryClient();
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [kind, setKind] = useState('expense');
  const [mode, setMode] = useState('equal');
  const [scope, setScope] = useState(
    () => localStorage.getItem('household-report-scope') || 'personal',
  );
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data: groups = [] } = useQuery({
    queryKey: ['households'],
    queryFn: () => apiFetch<Group[]>('/households'),
  });
  const selected = id || groups[0]?.id || '';
  const {
    data: state,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['households', selected],
    queryFn: () => apiFetch<State>(`/households/${selected}`),
    enabled: !!selected,
  });
  const { data: accounts = [] } = useAccounts();
  const { data: schedules = [] } = useSchedules();
  const linkId = params.get('transaction');
  const [recording, setRecording] = useState(!!linkId);
  // Only while recording: the latest payments to link, not the whole register
  const { data: bankPayments = [] } = useTransactions({ limit: 500 }, recording);
  const payment = bankPayments.find((t) => t.id === linkId);
  const mutation = useMutation({
    mutationFn: ({
      path,
      body,
      method = 'POST',
    }: {
      path: string;
      body: unknown;
      method?: string;
    }) => apiFetch<State>(path, { method, body: JSON.stringify(body) }),
    onSuccess: async (data) => {
      setError('');
      setCreating(false);
      setId(data.group.id);
      await cache.invalidateQueries({ queryKey: ['households'] });
      // A combined household shows this ledger too
      await cache.invalidateQueries({ queryKey: ['shared-households'] });
      await cache.invalidateQueries({ queryKey: ['budget'] });
      await cache.invalidateQueries({ queryKey: ['budget-summary'] });
      await cache.invalidateQueries({ queryKey: ['review'] });
      await cache.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (e: Error) => setError(e.message),
  });
  const [creating, setCreating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const money = (n: number) => formatMoney(n, state?.group.currency ?? 'AUD');
  const hasPool = (state?.group.poolAccountIds.length ?? 0) > 0;
  function submit(
    e: React.FormEvent<HTMLFormElement>,
    build: (f: FormData) => { path: string; body: unknown; method?: string },
  ) {
    e.preventDefault();
    try {
      mutation.mutate(build(new FormData(e.currentTarget)));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const expenses =
    state?.events.filter(
      (e) =>
        (e.kind === 'expense' || e.kind === 'refund') &&
        (!from || e.date >= from) &&
        (!to || e.date <= to),
    ) ?? [];
  const self = state?.people.find((p) => p.isSelf);
  const total = expenses.reduce(
    (sum, e) =>
      sum +
      (scope === 'household'
        ? e.amount
        : e.shares.filter((s) => s.personId === self?.id).reduce((n, s) => n + s.amount, 0)),
    0,
  );
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            title: scope === 'personal' ? 'My expense shares' : 'Household expenses',
            currency: state?.group.currency,
            from,
            to,
            total,
            people: state?.people,
            events: expenses,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `household-${scope}-statement.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const createForm = (
    <form
      className="grid gap-3"
      onSubmit={(e) =>
        submit(e, (f) => ({
          path: '/households',
          body: {
            name: f.get('name'),
            currency: 'AUD',
            accountId: f.get('accountId') || null,
            people: String(f.get('people'))
              .split('\n')
              .map((n) => n.trim())
              .filter(Boolean),
            selfIndex: 0,
          },
        }))
      }
    >
      <label className={field}>
        Name
        <Input name="name" required maxLength={200} placeholder="e.g. Home" />
      </label>
      <label className={field}>
        People, one per line; put yourself first
        <textarea
          className={textareaClass}
          name="people"
          rows={3}
          required
          placeholder={'Me\nHousemate'}
        />
      </label>
      <label className={field}>
        Household pool account (AUD)
        <Select name="accountId">
          <option value="">No pool — direct payments only</option>
          {accounts
            .filter((a) => !a.closedAt && (!a.currency || a.currency === 'AUD'))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </Select>
      </label>
      <p className="text-xs text-text-tertiary">
        Linking a pool removes its cash and activity from personal budget availability. Categorize
        your confirmed transfers into it as contributions. Existing bank history remains intact;
        review past budget figures after linking.
      </p>
      <div className="flex justify-end gap-2">
        {groups.length > 0 && (
          <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          Create household
        </Button>
      </div>
    </form>
  );
  const myShare = (e: Entry) =>
    e.shares.filter((s) => s.personId === self?.id).reduce((n, s) => n + s.amount, 0);
  const shownEvents = showHistory ? (state?.events ?? []) : [];
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] max-md:text-2xl leading-tight tracking-tight text-text">
            Household
          </h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            Agreed shares, pool advances and repayments, tracked privately. Bank payments keep their
            full amounts; claims are not spendable cash.
          </p>
        </div>
        {groups.length > 0 && (
          <div className="flex items-center gap-2">
            {groups.length > 1 && (
              <div className="w-48">
                <Select
                  aria-label="Household"
                  value={selected}
                  onChange={(e) => setId(e.target.value)}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
              <Plus size={14} /> New household
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-6 space-y-4">
          {(error || loadError) && (
            <p role="alert" className="text-sm text-negative">
              {error || loadError?.message}
            </p>
          )}
          {groups.length === 0 && (
            <section className={`${card} max-w-xl`} aria-labelledby="create-household">
              <h2 id="create-household" className="text-sm font-semibold text-text mb-1">
                Create a household
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                Add the people who share costs with you. They don’t get access to your budget.
              </p>
              {createForm}
            </section>
          )}
          {isLoading && <div className="h-40 bg-surface-alt rounded-lg animate-pulse" />}
          {state && (
            <>
              <section className={card}>
                <h2 className="text-sm font-semibold text-text">People & balances</h2>
                <p className="text-xs text-text-tertiary mt-0.5 mb-3">
                  Across everything shared: who has paid more than their share, and who owes.
                </p>
                <div className="border-t border-border-light divide-y divide-border-light">
                  {state.people.map((p) => {
                    const balance = state.balances[p.id];
                    return (
                      <div key={p.id} className="flex justify-between gap-3 py-2 text-sm">
                        <span className="text-text">
                          {p.name}
                          {p.isSelf ? <span className="text-text-tertiary"> (me)</span> : ''}
                        </span>
                        <span
                          className={`tabular-nums font-medium text-right ${balance < 0 ? 'text-negative' : balance > 0 ? 'text-positive' : 'text-text-tertiary'}`}
                        >
                          {balance < 0
                            ? `owes ${money(-balance)}`
                            : balance > 0
                              ? `is owed ${money(balance)}`
                              : 'settled'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {hasPool && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs text-text-tertiary">
                    <p className="bg-surface-alt rounded-lg p-2.5">
                      Received pool funding remaining:{' '}
                      <span className="block text-sm font-semibold tabular-nums text-text">
                        {money(state.pool)}
                      </span>
                    </p>
                    <p className="bg-surface-alt rounded-lg p-2.5">
                      Bank cash:{' '}
                      <span className="block text-sm font-semibold tabular-nums text-text">
                        {money(state.cash)}
                      </span>
                    </p>
                    <p className="bg-surface-alt rounded-lg p-2.5">
                      Available to reserve:{' '}
                      <span className="block text-sm font-semibold tabular-nums text-text">
                        {money(state.unreserved)}
                      </span>
                    </p>
                  </div>
                )}
              </section>

              <RecurringBills
                key={`recurring-${state.group.id}`}
                groupId={state.group.id}
                currency={state.group.currency}
                people={state.people}
                bills={state.recurringBills}
              />

              <section className={card}>
                <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-text">
                    {scope === 'personal' ? 'My expense shares' : 'Household spending'}:{' '}
                    <span className="tabular-nums">{money(total)}</span>
                  </h2>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className={`${field} w-36`}>
                      <span className="text-xs">Report scope</span>
                      <Select
                        value={scope}
                        onChange={(e) => {
                          setScope(e.target.value);
                          localStorage.setItem('household-report-scope', e.target.value);
                        }}
                      >
                        <option value="personal">My share</option>
                        <option value="household">Household</option>
                      </Select>
                    </label>
                    <label className={`${field} w-40`}>
                      <span className="text-xs">From</span>
                      <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </label>
                    <label className={`${field} w-40`}>
                      <span className="text-xs">To</span>
                      <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </label>
                    <Button variant="secondary" onClick={download}>
                      Export this statement
                    </Button>
                  </div>
                </div>
                {expenses.length === 0 ? (
                  <p className="text-sm text-text-tertiary py-2">
                    No shared expenses in this period.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-text-tertiary">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Date</th>
                          <th className="py-2 pr-3 font-medium">Description</th>
                          <th className="py-2 pr-3 font-medium text-right">Gross</th>
                          <th className="py-2 font-medium text-right">My share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((e) => (
                          <tr key={e.id} className="border-t border-border-light">
                            <td className="py-2 pr-3 whitespace-nowrap text-text-secondary">
                              {formatDay(e.date)}
                            </td>
                            <td className="py-2 pr-3 text-text">
                              {e.description}
                              {e.reviewReason && (
                                <span className="block text-xs text-negative">
                                  Needs review: {e.reviewReason}
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">{money(e.amount)}</td>
                            <td className="py-2 text-right tabular-nums">{money(myShare(e))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <div
                className={`grid gap-4 items-start ${hasPool || state.bills.length > 0 ? 'lg:grid-cols-2' : ''}`}
              >
                <section className={card}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-text">Record something else</h2>
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-expanded={recording}
                      onClick={() => setRecording(!recording)}
                    >
                      {recording ? 'Close' : 'Expense, advance or repayment'}
                    </Button>
                  </div>
                  {!recording && (
                    <p className="text-xs text-text-tertiary mt-0.5">
                      A one-off shared cost, money paid into the household account, or someone
                      paying someone back. To share a payment from your bank, use{' '}
                      <span className="font-medium">Share with household</span> in Transactions.
                    </p>
                  )}
                  {recording && (
                    <form
                      key={`${selected}-${payment?.id ?? 'manual'}`}
                      className="grid gap-3 mt-3"
                      onSubmit={(e) =>
                        submit(e, (f) => ({
                          path: `/households/${selected}/events`,
                          body: {
                            kind,
                            date: f.get('date'),
                            description: f.get('description'),
                            amount:
                              kind === 'refund' && !f.get('amount')
                                ? undefined
                                : cents(f.get('amount')),
                            payerId: f.get('payerId') || null,
                            recipientId: f.get('recipientId') || null,
                            transactionId: f.get('transactionId') || null,
                            billId: f.get('billId') || null,
                            reversesId: f.get('reversesId') || null,
                            mode,
                            shares:
                              kind === 'expense'
                                ? state.people
                                    .filter((p) => f.has(`include-${p.id}`))
                                    .map((p) => ({
                                      personId: p.id,
                                      value:
                                        mode === 'equal'
                                          ? 1
                                          : mode === 'exact'
                                            ? cents(f.get(p.id))
                                            : mode === 'percentage'
                                              ? Math.round(Number(f.get(p.id)) * 100)
                                              : Number(f.get(p.id)),
                                    }))
                                : [],
                          },
                        }))
                      }
                    >
                      <label className={field}>
                        Event
                        <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                          <option value="expense">Shared expense</option>
                          <option value="contribution">Advance into pool</option>
                          <option value="settlement">Repayment between people</option>
                          <option value="refund">Reverse refunded expense</option>
                        </Select>
                      </label>
                      <label className={field}>
                        Description
                        <Input
                          name="description"
                          required
                          maxLength={200}
                          defaultValue={payment?.payeeName ?? ''}
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={field}>
                          Date
                          <Input
                            type="date"
                            name="date"
                            defaultValue={payment?.date ?? today()}
                            required
                          />
                        </label>
                        <label className={field}>
                          {kind === 'refund'
                            ? 'Refund amount (AUD, blank = remaining)'
                            : 'Amount (AUD)'}
                          <Input
                            name="amount"
                            defaultValue={
                              payment ? (Math.abs(payment.amount) / 100).toFixed(2) : ''
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                            required={kind !== 'refund'}
                          />
                        </label>
                      </div>
                      {kind !== 'refund' && (
                        <label className={field}>
                          Paid by
                          <Select
                            name="payerId"
                            defaultValue={
                              payment?.accountId === state.group.accountId ? '' : self?.id
                            }
                          >
                            {kind === 'expense' && state.group.accountId && (
                              <option value="">Household pool</option>
                            )}
                            {state.people.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </Select>
                        </label>
                      )}
                      {kind === 'settlement' && (
                        <label className={field}>
                          Paid to
                          <Select name="recipientId">
                            {state.people.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </Select>
                        </label>
                      )}
                      {kind === 'expense' && (
                        <>
                          <label className={field}>
                            Split method
                            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
                              <option value="equal">
                                Equal (remainder follows participant order)
                              </option>
                              <option value="exact">Exact AUD amounts</option>
                              <option value="percentage">Percentages (total 100)</option>
                              <option value="weight">Weights</option>
                            </Select>
                          </label>
                          <fieldset className="grid gap-2">
                            <legend className="text-sm font-medium text-text-secondary mb-1">
                              Shared with
                            </legend>
                            {state.people.map((p) => (
                              <label
                                key={p.id}
                                className="flex items-center gap-3 text-sm text-text min-h-9"
                              >
                                <input
                                  type="checkbox"
                                  name={`include-${p.id}`}
                                  defaultChecked
                                  className="h-4 w-4 accent-brand-600"
                                />
                                <span className="flex-1">{p.name}</span>
                                {mode !== 'equal' && (
                                  <span className="w-32">
                                    <Input
                                      name={p.id}
                                      aria-label={`${p.name} share`}
                                      inputMode="decimal"
                                      defaultValue={mode === 'weight' ? '1' : ''}
                                    />
                                  </span>
                                )}
                              </label>
                            ))}
                          </fieldset>
                          <label className={field}>
                            Match shared bill
                            <Select name="billId">
                              <option value="">No bill</option>
                              {state.bills
                                .filter((b) => b.status !== 'paid')
                                .map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.description}
                                  </option>
                                ))}
                            </Select>
                          </label>
                        </>
                      )}
                      {kind === 'refund' && (
                        <label className={field}>
                          Original expense
                          <Select name="reversesId" required>
                            <option value="">Choose expense</option>
                            {state.events
                              .filter((e) => e.kind === 'expense')
                              .map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.description} — {money(e.amount)}
                                </option>
                              ))}
                          </Select>
                        </label>
                      )}
                      <label className={field}>
                        Existing bank payment (optional)
                        <Select name="transactionId" defaultValue={payment?.id ?? ''}>
                          <option value="">No bank link</option>
                          {bankPayments
                            .filter(
                              (t) =>
                                !t.isParent &&
                                !t.parentTransactionId &&
                                !state.events.some((e) => e.transactionId === t.id),
                            )
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.date} ·{' '}
                                {t.payeeName || accounts.find((a) => a.id === t.accountId)?.name} ·{' '}
                                {money(t.amount)}
                              </option>
                            ))}
                        </Select>
                      </label>
                      <div className="flex justify-end">
                        <Button type="submit" disabled={mutation.isPending}>
                          Save event
                        </Button>
                      </div>
                    </form>
                  )}
                </section>

                {(hasPool || state.bills.length > 0) && (
                  <section className={card}>
                    <h2 className="text-sm font-semibold text-text">Bills to reserve for</h2>
                    <p className="text-xs text-text-tertiary mt-0.5 mb-3">
                      Set money aside from the household account for a bill before it is due. An
                      account balance alone does not mean a bill is funded.
                    </p>
                    {state.bills.length === 0 && (
                      <p className="text-sm text-text-tertiary py-2">No shared bills yet.</p>
                    )}
                    <div className="divide-y divide-border-light border-t border-border-light">
                      {state.bills.map((b) => (
                        <div key={b.id} className="py-3 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-text">{b.description}</p>
                              <p className="text-xs text-text-tertiary">
                                Due {formatDay(b.dueDate)} · {money(b.amount)} · My estimate{' '}
                                {money(b.personalShare)}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_CLASS[b.status] ?? 'bg-surface-alt text-text-secondary'}`}
                            >
                              {b.status}
                            </span>
                          </div>
                          <form
                            className="flex items-end gap-2"
                            onSubmit={(e) =>
                              submit(e, (f) => ({
                                path: `/households/${selected}/bills/${b.id}/reservation`,
                                method: 'PUT',
                                body: { reserved: cents(f.get('reserved')) },
                              }))
                            }
                          >
                            <label className={`${field} flex-1`}>
                              <span className="text-xs">Reserved</span>
                              <Input
                                name="reserved"
                                inputMode="decimal"
                                defaultValue={(b.reserved / 100).toFixed(2)}
                              />
                            </label>
                            <Button
                              type="submit"
                              size="sm"
                              variant="secondary"
                              disabled={
                                mutation.isPending || state.events.some((e) => e.billId === b.id)
                              }
                            >
                              Update reservation
                            </Button>
                          </form>
                        </div>
                      ))}
                    </div>
                    <form
                      className="grid gap-3 border-t border-border-light pt-4 mt-1"
                      onSubmit={(e) =>
                        submit(e, (f) => ({
                          path: `/households/${selected}/bills`,
                          body: {
                            description: f.get('description'),
                            dueDate: f.get('dueDate'),
                            amount: cents(f.get('amount')),
                            personalShare: cents(f.get('personalShare')),
                            scheduleId: f.get('scheduleId') || null,
                            reserved: cents(f.get('reserved')),
                          },
                        }))
                      }
                    >
                      <h3 className="text-sm font-semibold text-text">Add a bill</h3>
                      <label className={field}>
                        Bill name
                        <Input name="description" required />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={field}>
                          Due date
                          <Input type="date" name="dueDate" required />
                        </label>
                        <label className={field}>
                          Estimated / billed total
                          <Input name="amount" inputMode="decimal" placeholder="0.00" required />
                        </label>
                        <label className={field}>
                          My estimated share
                          <Input
                            name="personalShare"
                            inputMode="decimal"
                            required
                            defaultValue="0"
                          />
                        </label>
                        <label className={field}>
                          Reserve now
                          <Input name="reserved" inputMode="decimal" defaultValue="0" required />
                        </label>
                      </div>
                      <label className={field}>
                        Recurring schedule (optional)
                        <Select name="scheduleId">
                          <option value="">One-off bill</option>
                          {schedules
                            .filter((s) => !s.autoCreate)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </Select>
                      </label>
                      <div className="flex justify-end">
                        <Button type="submit" variant="secondary" disabled={mutation.isPending}>
                          Add bill
                        </Button>
                      </div>
                    </form>
                  </section>
                )}
              </div>

              <section className={card}>
                <button
                  type="button"
                  aria-expanded={showHistory}
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex w-full items-center gap-2 text-sm font-semibold text-text"
                >
                  {showHistory ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  All contributions, payments & repayments ({state.events.length})
                </button>
                {shownEvents.length > 0 && (
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-sm">
                      <tbody>
                        {shownEvents.map((e) => (
                          <tr key={e.id} className="border-t border-border-light">
                            <td className="py-2 pr-3 whitespace-nowrap text-text-secondary">
                              {formatDay(e.date)}
                            </td>
                            <td className="py-2 pr-3 text-text-secondary whitespace-nowrap">
                              {KIND_LABEL[e.kind] ?? e.kind}
                            </td>
                            <td className="py-2 pr-3 text-text">
                              {e.description}
                              {e.reviewReason && (
                                <span className="block text-xs text-negative">
                                  Needs review: {e.reviewReason}
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">{money(e.amount)}</td>
                            <td className="py-2 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={mutation.isPending}
                                onClick={() =>
                                  mutation.mutate({
                                    path: `/households/${selected}/events/${e.id}`,
                                    method: 'DELETE',
                                    body: undefined,
                                  })
                                }
                              >
                                Remove entry
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary pt-2">
                Household settings
              </h2>
              <HouseholdSharing key={state.group.id} group={state.group} people={state.people} />
              <CombinedHousehold
                key={`combine-${state.group.id}`}
                group={state.group}
                people={state.people}
              />
            </>
          )}
        </div>
      </div>
      <Modal isOpen={creating} onClose={() => setCreating(false)} title="New household">
        {createForm}
      </Modal>
    </div>
  );
}
