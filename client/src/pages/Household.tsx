import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useTransactions } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';

type Group = { id: string; name: string; currency: string; accountId: string | null };
type Person = { id: string; name: string; isSelf: number };
type Entry = {
  id: string;
  kind: string;
  date: string;
  description: string;
  amount: number;
  payerId: string | null;
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
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const control =
  'border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 w-full';
function cents(value: FormDataEntryValue | null) {
  const text = String(value ?? '');
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error('Enter amounts with at most two decimal places');
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export default function HouseholdPage() {
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
  const { data: bankPayments = [] } = useTransactions({
    from: from || undefined,
    to: to || undefined,
  });
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
      setId(data.group.id);
      await cache.invalidateQueries({ queryKey: ['households'] });
      await cache.invalidateQueries({ queryKey: ['budget'] });
      await cache.invalidateQueries({ queryKey: ['budget-summary'] });
      await cache.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (e: Error) => setError(e.message),
  });
  const money = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: state?.group.currency ?? 'AUD',
    }).format(n / 100);
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
  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Household & shared expenses</h1>
      <p>
        Track agreed shares, advance contributions and repayments privately. Bank payments stay at
        their full amounts. Claims are not spendable cash.
      </p>
      {(error || loadError) && (
        <p role="alert" className="text-red-600">
          {error || loadError?.message}
        </p>
      )}
      {groups.length > 0 && (
        <label>
          Household
          <select className={control} value={selected} onChange={(e) => setId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <details className="border rounded p-4" open={!groups.length}>
        <summary>Create a household</summary>
        <form
          className="grid gap-3 mt-4"
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
          <label>
            Name
            <input className={control} name="name" required maxLength={200} />
          </label>
          <label>
            People, one per line; put yourself first
            <textarea className={control} name="people" required placeholder={'Me\nHousemate'} />
          </label>
          <label>
            Household pool account (AUD)
            <select className={control} name="accountId">
              <option value="">No pool — direct payments only</option>
              {accounts
                .filter((a) => !a.closedAt && (!a.currency || a.currency === 'AUD'))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <p className="text-sm">
            Linking a pool removes its cash and activity from personal budget availability.
            Categorize your confirmed transfers into it as contributions. Existing bank history
            remains intact; review past budget figures after linking.
          </p>
          <button className={control} disabled={mutation.isPending}>
            Create household
          </button>
        </form>
      </details>
      {isLoading && <p>Loading household…</p>}
      {state && (
        <>
          <section className="border rounded p-4 space-y-3">
            <h2 className="text-xl font-semibold">People & balances</h2>
            <p>
              Positive balances are advance credits or amounts owed to someone. Negative balances
              are amounts they owe.
            </p>
            {state.people.map((p) => (
              <div key={p.id} className="flex justify-between">
                <span>
                  {p.name}
                  {p.isSelf ? ' (me)' : ''}
                </span>
                <strong>{money(state.balances[p.id])}</strong>
              </div>
            ))}
            <p>
              Received pool funding remaining: {money(state.pool)} · Bank cash: {money(state.cash)}{' '}
              · Available to reserve: {money(state.unreserved)}
            </p>
          </section>
          <section className="border rounded p-4 space-y-3">
            <h2 className="text-xl font-semibold">Record an event</h2>
            <form
              className="grid gap-3"
              onSubmit={(e) =>
                submit(e, (f) => ({
                  path: `/households/${selected}/events`,
                  body: {
                    kind,
                    date: f.get('date'),
                    description: f.get('description'),
                    amount: kind === 'refund' ? undefined : cents(f.get('amount')),
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
                                    : Number(f.get(p.id)),
                            }))
                        : [],
                  },
                }))
              }
            >
              <label>
                Event
                <select className={control} value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="expense">Shared expense</option>
                  <option value="contribution">Advance into pool</option>
                  <option value="settlement">Repayment between people</option>
                  <option value="refund">Reverse refunded expense</option>
                </select>
              </label>
              <label>
                Description
                <input className={control} name="description" required maxLength={200} />
              </label>
              <label>
                Date
                <input
                  className={control}
                  type="date"
                  name="date"
                  defaultValue={today()}
                  required
                />
              </label>
              {kind !== 'refund' && (
                <label>
                  Amount (AUD)
                  <input className={control} name="amount" inputMode="decimal" required />
                </label>
              )}
              {kind !== 'refund' && (
                <label>
                  Paid by
                  <select className={control} name="payerId">
                    {kind === 'expense' && state.group.accountId && (
                      <option value="">Household pool</option>
                    )}
                    {state.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {kind === 'settlement' && (
                <label>
                  Paid to
                  <select className={control} name="recipientId">
                    {state.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {kind === 'expense' && (
                <>
                  <label>
                    Split method
                    <select
                      className={control}
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option value="equal">Equal (remainder follows participant order)</option>
                      <option value="exact">Exact AUD amounts</option>
                      <option value="percentage">Percentage in basis points (10000 = 100%)</option>
                      <option value="weight">Weights</option>
                    </select>
                  </label>
                  {state.people.map((p) => (
                    <label key={p.id} className="flex gap-3 items-center">
                      <input type="checkbox" name={`include-${p.id}`} defaultChecked />
                      {p.name}
                      {mode !== 'equal' && (
                        <input
                          className={control}
                          name={p.id}
                          aria-label={`${p.name} share`}
                          inputMode="decimal"
                          defaultValue={mode === 'weight' ? '1' : ''}
                        />
                      )}
                    </label>
                  ))}
                  <label>
                    Match shared bill
                    <select name="billId" className={control}>
                      <option value="">No bill</option>
                      {state.bills
                        .filter((b) => b.status !== 'paid')
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.description}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              {kind === 'refund' && (
                <label>
                  Original expense
                  <select className={control} name="reversesId" required>
                    <option value="">Choose expense</option>
                    {state.events
                      .filter((e) => e.kind === 'expense')
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.description} — {money(e.amount)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Existing bank payment (optional)
                <select className={control} name="transactionId">
                  <option value="">No bank link</option>
                  {bankPayments
                    .filter(
                      (t) =>
                        !t.isParent &&
                        !t.parentTransactionId &&
                        !state.events.some(
                          (e) => (e as Entry & { transactionId: string }).transactionId === t.id,
                        ),
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.date} · {t.payeeName || accounts.find((a) => a.id === t.accountId)?.name}{' '}
                        · {money(t.amount)}
                      </option>
                    ))}
                </select>
              </label>
              <button className={control} disabled={mutation.isPending}>
                Save event
              </button>
            </form>
          </section>
          <section className="border rounded p-4 space-y-3">
            <h2 className="text-xl font-semibold">Shared bills</h2>
            <p>
              Reserve received funds for each bill. An account balance alone does not mean a bill is
              funded.
            </p>
            {state.bills.map((b) => (
              <div key={b.id} className="border-b py-3">
                <strong>{b.description}</strong> · {b.dueDate} · {money(b.amount)} · My estimate{' '}
                {money(b.personalShare)} · {b.status}
                <form
                  className="flex gap-2"
                  onSubmit={(e) =>
                    submit(e, (f) => ({
                      path: `/households/${selected}/bills/${b.id}/reservation`,
                      method: 'PUT',
                      body: { reserved: cents(f.get('reserved')) },
                    }))
                  }
                >
                  <label>
                    Reserved
                    <input
                      className={control}
                      name="reserved"
                      defaultValue={(b.reserved / 100).toFixed(2)}
                    />
                  </label>
                  <button disabled={mutation.isPending || b.status === 'paid'}>
                    Update reservation
                  </button>
                </form>
              </div>
            ))}
            <form
              className="grid gap-3"
              onSubmit={(e) =>
                submit(e, (f) => ({
                  path: `/households/${selected}/bills`,
                  body: {
                    description: f.get('description'),
                    dueDate: f.get('dueDate'),
                    amount: cents(f.get('amount')),
                    personalShare: cents(f.get('personalShare')),
                    reserved: cents(f.get('reserved')),
                  },
                }))
              }
            >
              <label>
                Bill name
                <input name="description" className={control} required />
              </label>
              <label>
                Due date
                <input type="date" name="dueDate" className={control} required />
              </label>
              <label>
                Estimated / billed total
                <input name="amount" className={control} required />
              </label>
              <label>
                My estimated share
                <input name="personalShare" className={control} required defaultValue="0" />
              </label>
              <label>
                Reserve now
                <input name="reserved" className={control} defaultValue="0" required />
              </label>
              <button className={control} disabled={mutation.isPending}>
                Add bill
              </button>
            </form>
          </section>
          <section className="border rounded p-4 space-y-3">
            <h2 className="text-xl font-semibold">
              {scope === 'personal' ? 'My expense shares' : 'Household spending'}: {money(total)}
            </h2>
            <label>
              Report scope
              <select
                className={control}
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  localStorage.setItem('household-report-scope', e.target.value);
                }}
              >
                <option value="personal">My share</option>
                <option value="household">Household</option>
              </select>
            </label>
            <div className="flex gap-3">
              <label>
                From
                <input
                  type="date"
                  className={control}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  className={control}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
            <button className={control} onClick={download}>
              Export this statement
            </button>
            {expenses.map((e) => (
              <div key={e.id} className="border-b py-2">
                {e.date} · {e.description} · Gross {money(e.amount)} · My share{' '}
                {money(
                  e.shares.filter((s) => s.personId === self?.id).reduce((n, s) => n + s.amount, 0),
                )}
              </div>
            ))}
          </section>
          <details className="border rounded p-4">
            <summary>All contributions, payments & repayments</summary>
            {state.events.map((e) => (
              <p key={e.id}>
                {e.date} · {e.kind} · {e.description} · {money(e.amount)}{' '}
                <button
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
                </button>
              </p>
            ))}
          </details>
        </>
      )}
    </main>
  );
}
