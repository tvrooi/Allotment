import { useSearchParams } from 'react-router-dom';
import { GuideLink } from '../components/guide/GuideLink';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useSchedules } from '../hooks/useSchedules';
import { useTransactions } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';
import { ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { TabList, tabIds } from '../components/ui/tabList';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { formatMoney } from '../utils/currency';
import { formatDay } from '../utils/dates';
import { HouseholdSharing } from '../components/household/HouseholdSharing';
import { HouseholdBills } from '../components/household/HouseholdBills';
import { QuickExpense } from '../components/household/QuickExpense';
import { HouseholdIcon } from '../components/household/HouseholdIcon';
import { CombinedHousehold } from '../components/household/CombinedHousehold';
import { RecurringBills } from '../components/household/RecurringBills';
import { SettleUp } from '../components/household/SettleUp';
import { ReconcileBalances } from '../components/household/ReconcileBalances';
import type { SettleUpTransfer } from '../api/households';
import { EditEntry } from '../components/household/EditEntry';
import { HouseholdBreakdown } from '../components/household/HouseholdBreakdown';
import { ActivityLog } from '../components/household/ActivityLog';
import { RepaymentCategoryOffers } from '../components/household/RepaymentCategoryOffers';
import { recentEntries } from '../components/household/recentEntries';
import type { HouseholdCoverage, HouseholdSplit, SharedRecurringBill } from '../api/households';
import { BillsCoverage } from '../components/household/BillsCoverage';
import { BalanceSummary } from '../components/household/BalanceSummary';
import { householdToShow, unsharedPayments } from '../components/household/balanceHeadline';
import { useHousehold } from '../hooks/useHouseholds';

type Group = {
  id: string;
  name: string;
  currency: string;
  accountId: string | null;
  poolAccountIds: string[];
  defaultSplit: HouseholdSplit | null;
  logo?: string | null;
  /** 1 = opens first when no household is named in the address */
  isDefault?: number;
  /** 0 = bills are off for this household: their tab, coverage and prompts are hidden */
  includeBills?: number;
};
type Person = { id: string; name: string; isSelf: number };
type Entry = {
  id: string;
  kind: string;
  date: string;
  description: string;
  amount: number;
  payerId: string | null;
  recipientId: string | null;
  reversesId: string | null;
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
  /** Contributions less shares of what the household account paid: negative = owes it */
  toPool: Record<string, number>;
  /** For things people paid themselves, and repayments: negative = owes the people who paid */
  direct: Record<string, number>;
  /** Who should pay whom to clear `direct`, and what people owe the household account */
  settlements: SettleUpTransfer[];
  poolOwed: { personId: string; amount: number }[];
  pool: number;
  cash: number;
  unreserved: number;
  bills: Bill[];
  recurringBills: SharedRecurringBill[];
  coverage: HouseholdCoverage;
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'bills', label: 'Bills' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
] as const;
type TabId = (typeof TABS)[number]['id'];
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
  pool_adjustment: 'Balances agreed (household account)',
  balance_adjustment: 'Balances agreed (between people)',
};
/** Reconcile's entries: removed to undo, never edited */
const ADJUSTMENT = new Set(['pool_adjustment', 'balance_adjustment']);
/** Household lists open on the newest entry's month and the one before it */
const RECENT_MONTHS = 2;

function ShowOlder({ older, onClick }: { older: number; onClick: () => void }) {
  if (older === 0) return null;
  return (
    <div className="flex justify-center pt-2">
      <Button size="sm" variant="ghost" onClick={onClick}>
        Show older ({older})
      </Button>
    </div>
  );
}
/** Scrolls the page's own scroller to a section, without motion for people who ask for none */
function jumpTo(elementId: string) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document
    .getElementById(elementId)
    ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
function cents(value: FormDataEntryValue | null) {
  const text = String(value ?? '');
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error('Enter amounts with at most two decimal places');
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export default function HouseholdPage() {
  const [params, setParams] = useSearchParams();
  const cache = useQueryClient();
  // ?household= opens that household (e.g. "View in household" on a shared payment)
  const [id, setId] = useState(() => params.get('household') ?? '');
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
  const selected = (groups.some((g) => g.id === id) ? id : householdToShow(groups, true)?.id) ?? '';
  const current = groups.find((g) => g.id === selected);
  const { data: state, isLoading, error: loadError } = useHousehold<State>(selected);
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
      setNewPool('');
      setNewBills(null);
      setEditingGroup(false);
      setEditingPerson('');
      setAddingPerson(false);
      setEditingBill('');
      setDeletingBill('');
      setEditingEntry(null);
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
  const withBills = state?.group.includeBills !== 0;
  const tabs = TABS.filter((t) => t.id !== 'bills' || withBills);
  const tab: TabId = tabs.find((t) => t.id === params.get('tab'))?.id ?? 'overview';
  // A jump from the balance band can land on another tab: scroll once that tab is showing
  const pendingJump = useRef('');
  useEffect(() => {
    if (pendingJump.current) jumpTo(pendingJump.current);
    pendingJump.current = '';
  }, [tab]);
  function showTab(next: TabId, jumpToId = '') {
    if (next === tab) {
      if (jumpToId) jumpTo(jumpToId);
      return;
    }
    pendingJump.current = jumpToId;
    const nextParams = new URLSearchParams(params);
    if (next === 'overview') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  }
  const [creating, setCreating] = useState(false);
  // A new household includes bills when it has a shared account, until the person says otherwise
  const [newPool, setNewPool] = useState('');
  const [newBills, setNewBills] = useState<boolean | null>(null);
  const [editingGroup, setEditingGroup] = useState(false);
  const [editingPerson, setEditingPerson] = useState('');
  const [addingPerson, setAddingPerson] = useState(false);
  const [editingBill, setEditingBill] = useState('');
  const [deletingBill, setDeletingBill] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [expenseMonths, setExpenseMonths] = useState(RECENT_MONTHS);
  const [historyMonths, setHistoryMonths] = useState(RECENT_MONTHS);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const money = (n: number) => formatMoney(n, state?.group.currency ?? 'AUD');
  const unshared = unsharedPayments(state?.recurringBills ?? [], withBills);
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
            includeBills: newBills ?? newPool !== '',
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
        <Select name="accountId" value={newPool} onChange={(e) => setNewPool(e.target.value)}>
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
        A shared account (like 2Up) that you all pay into. Optional.
      </p>
      <label className="flex items-start gap-3 text-sm text-text min-h-9 max-md:min-h-11">
        <input
          type="checkbox"
          checked={newBills ?? newPool !== ''}
          onChange={(e) => setNewBills(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-600"
        />
        <span>
          Include bills
          <span className="block text-xs text-text-tertiary">
            On with a shared account, off without one. Change it if you like.
          </span>
        </span>
      </label>
      <details className="text-xs text-text-tertiary">
        <summary className="cursor-pointer w-fit font-medium text-text-secondary">
          How this works
        </summary>
        <p className="mt-1">
          Money in the pool is shared, so it stops counting as yours to budget. Categorise your
          transfers into it as contributions. Your bank history stays as it is; check past budget
          figures after linking.
        </p>
      </details>
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
  // Newest first, recent months only until Show older; a chosen From date shows its whole range
  const recentExpenses = recentEntries(expenses, from ? Infinity : expenseMonths);
  const history = recentEntries(showHistory ? (state?.events ?? []) : [], historyMonths);
  const shownEvents = history.shown;
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div data-guide="household.header" className="min-w-0">
          <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
            Household
          </h1>
          <div className="text-sm text-text-tertiary mt-0.5">
            <span className="max-md:hidden">
              Split bills with the people you live with and see who owes whom.
            </span>
            <span className="md:hidden">Split bills and see who owes whom.</span>{' '}
            <details className="inline">
              <summary className="inline cursor-pointer font-medium text-text-secondary">
                How this works
              </summary>{' '}
              Shares and repayments are tracked privately, only in your budget. Bank payments keep
              their full amounts; what others owe you isn’t money you can spend yet.{' '}
              <GuideLink
                page="households"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Read the guide
              </GuideLink>
            </details>
          </div>
        </div>
        {groups.length > 0 && (
          <div className="flex items-center gap-2 max-md:w-full">
            {current && <HouseholdIcon name={current.name} logo={current.logo} size="sm" />}
            {groups.length === 1 && current && (
              <span className="text-sm font-medium text-text">{current.name}</span>
            )}
            {groups.length > 1 && (
              <div className="w-48 max-md:w-auto max-md:flex-1 max-md:min-w-0">
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
            {current && (
              <Button
                size="sm"
                variant="ghost"
                aria-label="Edit household"
                className="max-md:min-w-11"
                onClick={() => setEditingGroup(true)}
              >
                <Pencil size={14} /> <span className="max-md:hidden">Edit</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              aria-label="New household"
              className="max-md:min-w-11"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} /> <span className="max-md:hidden">New household</span>
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
            <section
              data-guide="household.create"
              className={`${card} max-w-xl`}
              aria-labelledby="create-household"
            >
              <h2 id="create-household" className="text-sm font-semibold text-text mb-1">
                Create a household
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                Who do you share costs with? They don’t get access to your budget.
              </p>
              {createForm}
            </section>
          )}
          {isLoading && <div className="h-40 bg-surface-alt rounded-lg animate-pulse" />}
          {state && (
            <>
              <BalanceSummary
                currency={state.group.currency}
                people={state.people}
                balances={state.balances}
                canSettle={(state.settlements?.length ?? 0) + (state.poolOwed?.length ?? 0) > 0}
                unshared={unshared}
                sharedAccount={hasPool}
                withBills={withBills}
                settle={
                  <SettleUp
                    key={`settle-${state.group.id}`}
                    groupId={state.group.id}
                    currency={state.group.currency}
                    people={state.people}
                    settlements={state.settlements ?? []}
                    poolOwed={state.poolOwed ?? []}
                  />
                }
                onReview={() => showTab('bills', 'household-bills')}
                onRecord={() => {
                  if (hasPool) setRecording(true);
                  showTab('overview', hasPool ? 'household-record' : 'quick-expense');
                }}
              />

              <TabList label="Household view" className="scroll-row flex gap-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={tabIds('household', t.id).tab}
                    aria-controls={tabIds('household', t.id).panel}
                    aria-selected={tab === t.id}
                    tabIndex={tab === t.id ? 0 : -1}
                    onClick={() => showTab(t.id)}
                    className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 max-md:min-h-11 ${
                      tab === t.id
                        ? 'border-brand-600 text-text'
                        : 'border-transparent text-text-secondary hover:text-text'
                    }`}
                  >
                    {t.label}
                    {t.id === 'bills' && unshared.count > 0 && (
                      <span className="ml-2 rounded-full bg-caution-subtle px-2 py-0.5 text-xs font-medium tabular-nums text-caution">
                        {unshared.count}
                        <span className="sr-only"> payments not shared yet</span>
                      </span>
                    )}
                  </button>
                ))}
              </TabList>

              <div
                role="tabpanel"
                id={tabIds('household', 'overview').panel}
                aria-labelledby={tabIds('household', 'overview').tab}
                hidden={tab !== 'overview'}
                className="space-y-4"
              >
                {!hasPool && (
                  <QuickExpense
                    key={`quick-${state.group.id}`}
                    groupId={state.group.id}
                    currency={state.group.currency}
                    events={state.events}
                    people={state.people}
                    defaultSplit={state.group.defaultSplit}
                    onChangeSplit={() => showTab('settings')}
                    onSeeAll={() => showTab('activity')}
                  />
                )}

                {withBills && hasPool && state.coverage && (
                  <BillsCoverage
                    coverage={state.coverage}
                    currency={state.group.currency}
                    people={state.people}
                  />
                )}

                <section id="household-people" data-guide="household.people" className={card}>
                  <h2 className="text-base font-semibold text-text">People & balances</h2>
                  <p className="text-xs text-text-tertiary mt-1 mb-4">
                    Across everything shared: who has paid more than their share, and who owes.
                  </p>
                  <div className="border-t border-border-light divide-y divide-border-light">
                    {state.people.map((p) => {
                      const balance = state.balances[p.id];
                      return (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm"
                        >
                          {editingPerson === p.id ? (
                            <form
                              className="flex flex-1 items-center gap-2 min-w-56"
                              onSubmit={(e) =>
                                submit(e, (f) => ({
                                  path: `/households/${selected}/people/${p.id}`,
                                  method: 'PUT',
                                  body: { name: f.get('name') },
                                }))
                              }
                            >
                              <Input
                                name="name"
                                aria-label={`New name for ${p.name}`}
                                defaultValue={p.name}
                                required
                                maxLength={200}
                                autoFocus
                              />
                              <Button type="submit" size="sm" disabled={mutation.isPending}>
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingPerson('')}
                              >
                                Cancel
                              </Button>
                            </form>
                          ) : (
                            <span className="text-text">
                              {p.name}
                              {p.isSelf ? <span className="text-text-tertiary"> (me)</span> : ''}
                              <button
                                type="button"
                                className="ml-2 text-xs text-text-tertiary underline-offset-2 hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center max-md:px-2"
                                aria-label={`Rename ${p.name}`}
                                onClick={() => setEditingPerson(p.id)}
                              >
                                Rename
                              </button>
                            </span>
                          )}
                          <span
                            className={`tabular-nums font-medium text-right ${balance < 0 ? 'text-negative' : balance > 0 ? 'text-positive' : 'text-text-tertiary'}`}
                          >
                            {balance < 0
                              ? `owes ${money(-balance)}`
                              : balance > 0
                                ? `is owed ${money(balance)}`
                                : 'settled'}
                          </span>
                          {state.group.poolAccountIds.length > 0 && (
                            <BalanceParts
                              toPool={state.toPool?.[p.id] ?? 0}
                              direct={state.direct?.[p.id] ?? 0}
                              money={money}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {addingPerson ? (
                    <form
                      className="mt-2 flex items-center gap-2"
                      onSubmit={(e) =>
                        submit(e, (f) => ({
                          path: `/households/${selected}/people`,
                          body: { name: f.get('name') },
                        }))
                      }
                    >
                      <Input
                        name="name"
                        aria-label="New person's name"
                        placeholder="Name"
                        required
                        maxLength={200}
                        autoFocus
                      />
                      <Button type="submit" size="sm" disabled={mutation.isPending}>
                        Add to household
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setAddingPerson(false)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1"
                      onClick={() => setAddingPerson(true)}
                    >
                      <Plus size={14} /> Add person
                    </Button>
                  )}
                  {addingPerson &&
                    state.group.defaultSplit &&
                    state.group.defaultSplit.mode !== 'equal' && (
                      <p className="mt-1 text-xs text-text-tertiary">
                        Your default split gives each person a set share, so it leaves someone new
                        out until you change it in Household settings.
                      </p>
                    )}
                  <ReconcileBalances
                    key={`reconcile-${state.group.id}`}
                    groupId={state.group.id}
                    currency={state.group.currency}
                    people={state.people}
                    balances={state.balances}
                    toPool={state.toPool ?? {}}
                    direct={state.direct ?? {}}
                  />
                  {hasPool && (
                    <details className="mt-3 text-xs text-text-tertiary">
                      <summary className="cursor-pointer w-fit text-sm font-medium text-text-secondary max-md:py-3.5">
                        Household account figures
                      </summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <p className="bg-surface-alt rounded-lg p-2.5">
                          In the account now:{' '}
                          <span className="block text-sm font-semibold tabular-nums text-text">
                            {money(state.cash)}
                          </span>
                        </p>
                        <p className="bg-surface-alt rounded-lg p-2.5">
                          Paid in, less what the account paid:{' '}
                          <span className="block text-sm font-semibold tabular-nums text-text">
                            {money(state.pool)}
                          </span>
                          Below zero means people owe the account this much.
                        </p>
                        <p className="bg-surface-alt rounded-lg p-2.5">
                          Not set aside for a bill:{' '}
                          <span className="block text-sm font-semibold tabular-nums text-text">
                            {money(state.unreserved)}
                          </span>
                        </p>
                      </div>
                    </details>
                  )}
                </section>

                <RepaymentCategoryOffers
                  key={`offers-${state.group.id}`}
                  groupId={state.group.id}
                  currency={state.group.currency}
                />

                <div className="grid gap-4 items-start">
                  <section id="household-record" data-guide="household.record" className={card}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-base font-semibold text-text">Record something else</h2>
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-expanded={recording}
                        onClick={() => setRecording(!recording)}
                      >
                        {recording
                          ? 'Close'
                          : hasPool
                            ? 'Expense, advance or repayment'
                            : 'Expense or repayment'}
                      </Button>
                    </div>
                    {!recording && (
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {hasPool
                          ? 'A one-off shared cost, money paid into the household account, or someone paying someone back.'
                          : 'A one-off shared cost, like groceries or a night out, or someone paying someone back.'}{' '}
                        To share a payment from your bank, use{' '}
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
                              advance: kind === 'settlement' && f.has('advance'),
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
                            {hasPool && <option value="contribution">Advance into pool</option>}
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
                          <>
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
                            <label className="flex items-start gap-2 text-sm">
                              <input type="checkbox" name="advance" className="mt-1" />
                              <span>
                                Paid ahead: allow more than is owed now. The extra becomes owed back
                                the other way.
                              </span>
                            </label>
                          </>
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
                                  {formatDay(t.date)} ·{' '}
                                  {t.payeeName || accounts.find((a) => a.id === t.accountId)?.name}{' '}
                                  · {money(t.amount)}
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
                </div>
              </div>

              {withBills && (
                <div
                  role="tabpanel"
                  id={tabIds('household', 'bills').panel}
                  aria-labelledby={tabIds('household', 'bills').tab}
                  hidden={tab !== 'bills'}
                  className="space-y-4"
                >
                  <div id="household-bills">
                    <RecurringBills
                      key={`recurring-${state.group.id}`}
                      groupId={state.group.id}
                      currency={state.group.currency}
                      people={state.people}
                      bills={state.recurringBills}
                      hasPool={hasPool}
                    />
                  </div>

                  {(hasPool || state.bills.length > 0) && (
                    <section className={card}>
                      <h2 className="text-base font-semibold text-text">One-off bills</h2>
                      <p className="text-xs text-text-tertiary mt-1 mb-4">
                        A bill that doesn't repeat, like a plumber or a bond top-up. Set money aside
                        from the household account for it before it is due: an account balance alone
                        does not mean a bill is funded.
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
                            <div className="flex flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Edit ${b.description}`}
                                onClick={() => setEditingBill(editingBill === b.id ? '' : b.id)}
                              >
                                Edit
                              </Button>
                              {deletingBill === b.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={mutation.isPending}
                                    onClick={() =>
                                      mutation.mutate({
                                        path: `/households/${selected}/bills/${b.id}`,
                                        method: 'DELETE',
                                        body: undefined,
                                      })
                                    }
                                  >
                                    Delete {b.description}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setDeletingBill('')}
                                  >
                                    Keep it
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  aria-label={`Delete ${b.description}…`}
                                  disabled={state.events.some((e) => e.billId === b.id)}
                                  title={
                                    state.events.some((e) => e.billId === b.id)
                                      ? 'A payment is matched to this bill: remove that entry first'
                                      : undefined
                                  }
                                  onClick={() => setDeletingBill(b.id)}
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                            {editingBill === b.id && (
                              <form
                                className="grid gap-2 rounded-md bg-surface-alt p-2.5"
                                onSubmit={(e) =>
                                  submit(e, (f) => {
                                    const paid = state.events.some((x) => x.billId === b.id);
                                    return {
                                      path: `/households/${selected}/bills/${b.id}`,
                                      method: 'PUT',
                                      body: {
                                        description: f.get('description'),
                                        dueDate: f.get('dueDate'),
                                        ...(paid
                                          ? {}
                                          : {
                                              amount: cents(f.get('amount')),
                                              personalShare: cents(f.get('personalShare')),
                                            }),
                                      },
                                    };
                                  })
                                }
                              >
                                <label className={field}>
                                  <span className="text-xs">Bill name</span>
                                  <Input
                                    name="description"
                                    defaultValue={b.description}
                                    required
                                    maxLength={200}
                                  />
                                </label>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <label className={field}>
                                    <span className="text-xs">Due date</span>
                                    <Input
                                      type="date"
                                      name="dueDate"
                                      defaultValue={b.dueDate}
                                      required
                                    />
                                  </label>
                                  <label className={field}>
                                    <span className="text-xs">Total</span>
                                    <Input
                                      name="amount"
                                      inputMode="decimal"
                                      defaultValue={(b.amount / 100).toFixed(2)}
                                      disabled={state.events.some((x) => x.billId === b.id)}
                                    />
                                  </label>
                                  <label className={field}>
                                    <span className="text-xs">My estimated share</span>
                                    <Input
                                      name="personalShare"
                                      inputMode="decimal"
                                      defaultValue={(b.personalShare / 100).toFixed(2)}
                                      disabled={state.events.some((x) => x.billId === b.id)}
                                    />
                                  </label>
                                </div>
                                {state.events.some((x) => x.billId === b.id) && (
                                  <p className="text-xs text-text-tertiary">
                                    A payment is matched to this bill, so its amounts stay as they
                                    are.
                                  </p>
                                )}
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingBill('')}
                                  >
                                    Cancel
                                  </Button>
                                  <Button type="submit" size="sm" disabled={mutation.isPending}>
                                    Save bill
                                  </Button>
                                </div>
                              </form>
                            )}
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
              )}

              <div
                role="tabpanel"
                id={tabIds('household', 'activity').panel}
                aria-labelledby={tabIds('household', 'activity').tab}
                hidden={tab !== 'activity'}
                className="space-y-4"
              >
                <section className={card}>
                  <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                    <h2 className="text-base font-semibold text-text">
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
                          {recentExpenses.shown.map((e) => (
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
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {money(e.amount)}
                              </td>
                              <td className="py-2 text-right tabular-nums">{money(myShare(e))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <ShowOlder
                        older={recentExpenses.older}
                        onClick={() => setExpenseMonths(recentExpenses.more)}
                      />
                    </div>
                  )}
                </section>

                <HouseholdBreakdown
                  key={`breakdown-${state.group.id}`}
                  groupId={state.group.id}
                  currency={state.group.currency}
                  from={from}
                  to={to}
                  scope={scope}
                />

                <section className={card}>
                  <button
                    type="button"
                    aria-expanded={showHistory}
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex w-full items-center gap-2 text-sm font-semibold text-text max-md:min-h-11"
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
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {money(e.amount)}
                              </td>
                              <td className="py-2 text-right whitespace-nowrap">
                                {!ADJUSTMENT.has(e.kind) && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={mutation.isPending}
                                    aria-label={`Edit ${e.description}`}
                                    onClick={() => {
                                      setError('');
                                      setEditingEntry(e);
                                    }}
                                  >
                                    Edit
                                  </Button>
                                )}
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
                      <ShowOlder
                        older={history.older}
                        onClick={() => setHistoryMonths(history.more)}
                      />
                    </div>
                  )}
                </section>
                <ActivityLog key={`activity-${state.group.id}`} groupId={state.group.id} />
              </div>

              <div
                role="tabpanel"
                id={tabIds('household', 'settings').panel}
                aria-labelledby={tabIds('household', 'settings').tab}
                hidden={tab !== 'settings'}
                className="space-y-4"
              >
                <HouseholdBills
                  key={`bills-${state.group.id}`}
                  groupId={state.group.id}
                  includeBills={withBills}
                />
                <HouseholdSharing key={state.group.id} group={state.group} people={state.people} />
                <CombinedHousehold
                  key={`combine-${state.group.id}`}
                  group={state.group}
                  people={state.people}
                />
              </div>
            </>
          )}
        </div>
      </div>
      {editingEntry && state && (
        <EditEntry
          key={editingEntry.id}
          entry={editingEntry}
          people={state.people}
          currency={state.group.currency}
          hasPool={!!state.group.accountId}
          descriptionOnly={state.events.some((x) => x.reversesId === editingEntry.id)}
          saving={mutation.isPending}
          error={error}
          onClose={() => setEditingEntry(null)}
          onSave={(body) =>
            mutation.mutate({
              path: `/households/${selected}/events/${editingEntry.id}`,
              method: 'PUT',
              body,
            })
          }
        />
      )}
      <Modal isOpen={creating} onClose={() => setCreating(false)} title="New household">
        {createForm}
      </Modal>
      {current && (
        <Modal isOpen={editingGroup} onClose={() => setEditingGroup(false)} title="Edit household">
          <form
            className="space-y-4"
            onSubmit={(e) =>
              submit(e, (f) => ({
                path: `/households/${current.id}`,
                method: 'PUT',
                body: {
                  name: f.get('name'),
                  ...(f.get('isDefault') && !current.isDefault ? { isDefault: true } : {}),
                },
              }))
            }
          >
            <label className="block text-sm">
              <span className="text-text-secondary">Name</span>
              <Input name="name" defaultValue={current.name} required maxLength={200} />
            </label>
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                name="isDefault"
                defaultChecked={!!current.isDefault || groups.length === 1}
                disabled={!!current.isDefault}
              />
              Open this household first
            </label>
            <p className="text-xs text-text-tertiary">
              Its people, entries and balances stay as they are. Change its picture and default
              split under Sharing.
            </p>
            {error && (
              <p role="alert" className="text-sm text-negative">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditingGroup(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/**
 * One person's balance in two parts: what they owe the household account (their shares of what
 * it paid, less what they put in) and what they owe, or are owed, for things people paid
 * themselves. Only the second is owed to a person.
 */
function BalanceParts({
  toPool,
  direct,
  money,
}: {
  toPool: number;
  direct: number;
  money: (n: number) => string;
}) {
  if (!toPool && !direct) return null;
  const parts = [
    toPool < 0
      ? `owes the household account ${money(-toPool)}`
      : toPool > 0
        ? `${money(toPool)} ahead in the household account`
        : '',
    direct < 0
      ? `owes ${money(-direct)} for things others paid`
      : direct > 0
        ? `is owed ${money(direct)} for things they paid`
        : '',
  ].filter(Boolean);
  return <p className="basis-full text-xs text-text-tertiary">{parts.join(' · ')}</p>;
}
