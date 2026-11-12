import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/longTerm';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { PrivateSection } from '../ui/Private';
import { EmptyState } from '../ui/EmptyState';
import { usePlanEditor } from '../../hooks/usePlanEditor';
import { Button, ButtonLink } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import RowMenu from '../ui/RowMenu';
import { StatCardRow, type StatCard } from '../reports/ChartHelpers';
import { formatExampleMoney, formatCurrency, formatWholeCurrency } from '../../utils/currency';
import { inDollars, newDraft, PPB, type Dollars } from '../../utils/longTerm';
import { AccountsPanel } from './AccountsPanel';
import { AssumptionsPanel } from './AssumptionsPanel';
import { ComparePanel } from './ComparePanel';
import { EventEditor } from './EventEditor';
import { EventList } from './EventList';
import { Field, WholeNumberField } from './fields';
import { NetWorthChart } from './NetWorthChart';
import { SavingsPanel } from './SavingsPanel';
import { SimulationPanel } from './SimulationPanel';
import { YearBreakdown } from './YearBreakdown';
import { ScrollCue } from '../ui/ScrollCue';
import { Tip } from '../guide/Tip';
import { TIPS } from '../../guides';
import { onTabListKeyDown } from '../ui/tabList';

const remember = (key: string, value?: string): string | null => {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return value ?? null;
  }
};

type Panel = 'events' | 'assumptions' | 'accounts' | 'savings' | 'compare' | 'simulation';
const PANELS: { id: Panel; label: string }[] = [
  { id: 'events', label: 'Life events' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'savings', label: 'Savings' },
  { id: 'compare', label: 'Compare' },
  { id: 'simulation', label: 'Simulation' },
];

/** Name and birth year: everything else starts at its default */
function NewPlanForm({
  first,
  onCreated,
  onCancel,
}: {
  first: boolean;
  onCreated: (id: string) => void;
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(first ? 'My plan' : '');
  const [birthYear, setBirthYear] = useState(new Date().getFullYear() - 40);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSave = useCanSave();
  const { allValid, report } = useAmountValidity();
  async function create() {
    setBusy(true);
    setError(null);
    try {
      const defaults = await api.getDefaults(birthYear);
      const saved = await api.createPlan({
        name: name.trim(),
        settings: { ...defaults.settings, birthYear },
        accounts: [],
        splits: [],
        events: [],
      });
      qc.invalidateQueries({ queryKey: ['lt-plans'] });
      onCreated(saved.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-4 max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && !busy && allValid && canSave) void create();
      }}
    >
      {first && (
        <p className="text-sm text-text-secondary">
          A long-term plan projects your net worth year by year, from today's real balances to an
          age you choose, with life events like buying a home or retiring. It is a projection, not a
          promise, and it never changes your budget.
        </p>
      )}
      <Field label="Plan name">
        <Input
          aria-label="Plan name"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <AmountFields report={report}>
        <WholeNumberField
          label="Birth year"
          value={birthYear}
          min={1900}
          max={2100}
          onChange={setBirthYear}
        />
      </AmountFields>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={!name.trim() || busy || !allValid || !canSave}>
          Create plan
        </Button>
      </div>
      <SavingPausedHint />
    </form>
  );
}

/** When study debt is repaid, with and without the plan's extra payments */
function StudySummary({ study }: { study: NonNullable<api.PlanResult['studyLoans']> }) {
  const state = (m: api.PlanMoment | null) =>
    m === null
      ? 'not repaid within the plan'
      : m.index === 0
        ? 'already repaid'
        : `repaid in ${m.calendarYear}, at ${m.age}`;
  const saved = study.minimumOnly.indexationTotal - study.indexationTotal;
  return (
    <section
      aria-label="Study loans"
      className="rounded-md border border-border-light p-3 mb-6 text-sm space-y-1"
    >
      <p className="font-medium text-text">Study loans are {state(study.repaid)}.</p>
      {study.voluntaryTotal > 0 ? (
        <p className="text-text-secondary">
          With compulsory repayments only they would be {state(study.minimumOnly.repaid)}. Extra
          payments of {formatCurrency(study.voluntaryTotal)} save{' '}
          {formatCurrency(Math.max(0, saved))} of indexation.
        </p>
      ) : (
        <p className="text-text-secondary">
          By compulsory repayments alone, with {formatCurrency(study.indexationTotal)} of indexation
          added along the way. Add an extra yearly payment under Accounts to compare.
        </p>
      )}
      {study.repaid === null && (
        <p className="text-xs text-text-tertiary">
          Repayments depend on income above a threshold that rises each year. If your pay does not
          keep up, or stops, the indexed debt can outlast your working life.
        </p>
      )}
      <p className="text-xs text-text-tertiary">Totals are in future dollars.</p>
    </section>
  );
}

export function LongTermForecast() {
  const plans = useQuery({ queryKey: ['lt-plans'], queryFn: api.listPlans });
  const [chosen, setChosen] = useState<string | null>(() => remember('lt-plan'));
  const list = plans.data;
  const [creating, setCreating] = useState(false);
  const selected = list?.find((p) => p.id === chosen)?.id ?? list?.[0]?.id ?? null;
  useEffect(() => {
    if (selected) remember('lt-plan', selected);
  }, [selected]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-6 pt-5 pb-8 max-md:px-4 space-y-5">
        {plans.isLoading && <div className="h-64 bg-surface-alt rounded animate-pulse" />}
        {plans.error && (
          <p role="alert" className="text-sm text-negative">
            {(plans.error as Error).message}
          </p>
        )}
        {list &&
          list.length === 0 &&
          (creating ? (
            <PrivateSection title="Forecasts are hidden in Safe mode">
              <NewPlanForm first onCreated={setChosen} />
            </PrivateSection>
          ) : (
            <EmptyState
              title="See where your plans could take you"
              description="Explore how saving and life changes could shape your future balance."
              example={{
                content: (
                  <>
                    <p>At age 65</p>
                    <p className="mt-1 font-medium text-text">
                      {formatExampleMoney(85_000_000)} projected balance
                    </p>
                  </>
                ),
                description:
                  'An illustrative plan projects a balance of ' +
                  formatExampleMoney(85_000_000) +
                  ' at age 65.',
              }}
              keepActions
              actions={<Button onClick={() => setCreating(true)}>Create a plan</Button>}
            />
          ))}

        {list && selected && (
          <PrivateSection title="Forecasts are hidden in Safe mode">
            <Workspace key={selected} id={selected} plans={list} onSelect={setChosen} />
          </PrivateSection>
        )}
      </div>
    </div>
  );
}

function Workspace({
  id,
  plans,
  onSelect,
}: {
  id: string;
  plans: api.PlanSummary[];
  onSelect: (id: string) => void;
}) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['lt-plan', id],
    queryFn: () => api.getPlan(id),
    staleTime: Infinity,
  });
  if (error)
    return (
      <p role="alert" className="text-sm text-negative">
        {(error as Error).message}
      </p>
    );
  if (isLoading || !data) return <div className="h-64 bg-surface-alt rounded animate-pulse" />;
  return <Editor initial={data} plans={plans} onSelect={onSelect} />;
}

function Editor({
  initial,
  plans,
  onSelect,
}: {
  initial: api.SavedPlan;
  plans: api.PlanSummary[];
  onSelect: (id: string) => void;
}) {
  const qc = useQueryClient();
  const ed = usePlanEditor(initial);
  const { saved, working } = ed;
  const [mode, setMode] = useState<Dollars>(() =>
    remember('lt-dollars') === 'future' ? 'future' : 'today',
  );
  const [panel, setPanel] = useState<Panel>('events');
  const [year, setYear] = useState<number | null>(null);
  const [reference, setReference] = useState('');
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; event: api.PlanEvent } | null>(
    null,
  );
  const [modal, setModal] = useState<'new' | 'rename' | 'duplicate' | 'delete' | null>(null);
  const [text, setText] = useState('');
  const [planError, setPlanError] = useState<string | null>(null);
  const { allValid, report } = useAmountValidity();
  /** Something to do once the owner agrees to leave unsaved changes behind */
  const [pending, setPending] = useState<(() => void) | null>(null);
  const edRef = useRef(ed);
  edRef.current = ed;
  const guard = (go: () => void) => (ed.dirty ? setPending(() => go) : go());
  // Closing the tab or reloading with edits waiting
  useEffect(() => {
    if (!ed.dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [ed.dirty]);

  const point = useQuery({ queryKey: ['lt-start'], queryFn: api.getStartingPoint });
  const defaults = useQuery({
    queryKey: ['lt-defaults'],
    queryFn: () => api.getDefaults(),
    staleTime: Infinity,
  });
  const result = useQuery({
    queryKey: ['lt-result', saved.id, saved.version],
    queryFn: () => api.getResult(saved.id),
  });
  const others = plans.filter((p) => p.id !== saved.id);
  const refSummary = others.find((p) => p.id === reference);
  // A reference that has since been deleted is no reference
  const comparison = useQuery({
    queryKey: ['lt-compare', saved.id, saved.version, reference, refSummary?.version, mode],
    queryFn: () => api.getComparison(saved.id, refSummary!.id, mode),
    enabled: !!refSummary,
  });
  const r = result.data;
  const years = r?.years ?? [];
  // A year chosen before the plan got shorter no longer exists
  const yearIndex = year !== null && year >= 1 && year < years.length ? year : null;
  const selectedYear = yearIndex !== null ? years[yearIndex] : undefined;

  function chooseMode(m: Dollars) {
    setMode(m);
    remember('lt-dollars', m);
  }

  const summary = useMemo(() => {
    if (!r) return null;
    const show = (cents: number, index: number) =>
      formatWholeCurrency(inDollars(cents, years[index].inflationIndexPpb, mode));
    const last = years.length - 1;
    const lowest = years.reduce(
      (m, y) => (y.closingNetWorth < m.closingNetWorth ? y : m),
      years[0],
    );
    const atPreservation = years[r.preservationAge - r.startAge];
    const superNow = atPreservation
      ? Object.entries(atPreservation.balances)
          .filter(([id]) => r.superAccountIds.includes(id) || id === 'super-new-contributions')
          .reduce((s, [, v]) => s + v, 0)
      : null;
    // Retirement takes effect after this closing balance, so its split shows super as released
    const retiredIndex = r.retirementAge === null ? -1 : r.retirementAge - r.startAge;
    const opens = years.slice(1).find((y) => y.superPhase !== 'preserved');
    const atRetirement =
      retiredIndex >= 0 && retiredIndex < years.length - 1 ? years[retiredIndex] : undefined;
    const endNegative = years[last].closingNetWorth < 0;
    const headline = r.firstUnfunded
      ? `Your accounts run short from ${r.firstUnfunded.calendarYear}, at age ${r.firstUnfunded.age}.`
      : lowest.closingNetWorth < 0
        ? `Your net worth dips below zero, lowest in ${years[0].calendarYear + lowest.index}.`
        : `Your net worth stays positive to age ${r.endAge}.`;
    const lead = {
      headline,
      label: `Net worth at ${r.endAge}`,
      value: show(years[last].closingNetWorth, last),
      negative: endNegative,
    };
    // The lowest point only earns a card when it is not simply the last year again
    const cards: StatCard[] = [
      {
        label: 'Net worth today',
        value: show(years[0].closingNetWorth, 0),
        sub: `${show(years[0].wealth.accessible, 0)} accessible · ${show(years[0].wealth.preserved, 0)} preserved super`,
      },
      ...(lowest.index !== last
        ? [
            {
              label: 'Lowest net worth',
              value: show(lowest.closingNetWorth, lowest.index),
              sub:
                lowest.index === 0
                  ? 'Today'
                  : `In ${lowest.index} year${lowest.index === 1 ? '' : 's'}`,
              tone: lowest.closingNetWorth < 0 ? ('negative' as const) : undefined,
            },
          ]
        : []),
      ...(atRetirement
        ? [
            {
              label: 'Accessible at retirement',
              value: show(atRetirement.wealth.accessible, atRetirement.index),
              sub: `Cash, investments and released super at ${r.retirementAge}`,
              tone: atRetirement.wealth.accessible < 0 ? ('negative' as const) : undefined,
            },
          ]
        : []),
      {
        label: `Super at ${r.preservationAge}`,
        value:
          superNow === null || !atPreservation
            ? '—'
            : formatWholeCurrency(inDollars(superNow, atPreservation.inflationIndexPpb, mode)),
        sub: r.retirementAge === null ? undefined : `Retiring at ${r.retirementAge}`,
      },
      {
        label: 'Super opens',
        value: opens ? (opens.index === 1 ? 'Now' : `At ${opens.age}`) : 'Not in this plan',
        sub: !opens
          ? `Preserved until 65, or retiring from ${r.preservationAge}`
          : opens.superPhase === 'pension'
            ? 'Retired, so it pays a pension'
            : 'Reached 65, while still working',
      },
    ];
    return { lead, cards, noRetirement: r.retirementAge === null };
  }, [r, years, mode]);

  async function removePlan() {
    setPlanError(null);
    try {
      await api.deletePlan(saved.id, saved.version);
      await qc.invalidateQueries({ queryKey: ['lt-plans'] });
      const next = plans.find((p) => p.id !== saved.id);
      if (next) onSelect(next.id);
      qc.removeQueries({ queryKey: ['lt-plan', saved.id] });
    } catch (e) {
      setPlanError((e as Error).message);
    }
  }
  async function submitName() {
    setPlanError(null);
    const name = text.trim();
    if (!name) return;
    if (modal === 'rename') {
      const ok = await ed.commit((p) => ({ ...p, name }));
      if (ok) setModal(null);
      else setPlanError(ed.lastError());
    } else if (modal === 'duplicate') {
      try {
        const copy = await api.duplicatePlan(saved.id, name);
        await qc.invalidateQueries({ queryKey: ['lt-plans'] });
        setModal(null);
        onSelect(copy.id);
      } catch (e) {
        setPlanError((e as Error).message);
      }
    }
  }

  const conflictBox = ed.theirs !== undefined && (
    <div
      role="alert"
      className="rounded-md border border-caution p-3 text-sm text-caution space-y-2"
    >
      <p>
        {ed.theirs
          ? `"${ed.theirs.plan.name}" was changed on another device since you opened it.`
          : 'This plan was deleted on another device.'}
      </p>
      <div className="flex gap-2">
        {ed.theirs && (
          <Button size="sm" variant="secondary" onClick={ed.useTheirs}>
            Use theirs
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            const copy = await ed.keepMine();
            if (copy && copy.id !== saved.id) onSelect(copy.id);
          }}
        >
          {ed.theirs ? 'Keep mine' : 'Save as new'}
        </Button>
      </div>
    </div>
  );

  const startYear = r?.startYear ?? new Date().getFullYear();
  const prevIndex = selectedYear ? (years[selectedYear.index - 1]?.inflationIndexPpb ?? PPB) : PPB;
  const dirtyNote = ed.dirty && (
    <p className="text-sm text-caution" role="status">
      You have unsaved changes. The forecast below shows the saved plan; save to update it.
    </p>
  );

  // With no income at all, the cause leads and its own warning line would only repeat it
  const noIncome =
    point.data?.income.source === 'none' && working.settings.income.takeHome === null;
  const warnings = (r?.warnings ?? []).filter(
    (w) => !(noIncome && w.startsWith('There is no payday plan')),
  );
  function enterIncome() {
    setPanel('assumptions');
    setTimeout(
      () => document.getElementById('lt-plan-sections')?.scrollIntoView({ block: 'start' }),
      0,
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Plan" className="min-w-48 max-md:flex-1">
          <Select
            aria-label="Plan"
            value={saved.id}
            onChange={(e) => {
              const id = e.target.value;
              guard(() => onSelect(id));
            }}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === saved.id ? working.name : p.name}
              </option>
            ))}
          </Select>
        </Field>
        <RowMenu
          label="Plan actions"
          items={[
            {
              label: 'New plan',
              onClick: () =>
                guard(() => {
                  setText('');
                  setPlanError(null);
                  setModal('new');
                }),
            },
            {
              label: 'Duplicate',
              onClick: () =>
                guard(() => {
                  setText(`${saved.plan.name} copy`);
                  setPlanError(null);
                  setModal('duplicate');
                }),
            },
            {
              label: 'Rename',
              onClick: () => {
                setText(saved.plan.name);
                setPlanError(null);
                setModal('rename');
              },
            },
            { label: 'Delete', danger: true, onClick: () => guard(() => setModal('delete')) },
          ]}
        />
        <div
          className="flex gap-1 ml-auto max-md:ml-0 max-md:w-full max-md:[&>button]:flex-1 max-md:[&>button]:min-h-11"
          role="group"
          aria-label="Dollars"
        >
          {(['today', 'future'] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? 'primary' : 'secondary'}
              aria-pressed={mode === m}
              onClick={() => chooseMode(m)}
            >
              {m === 'today' ? "Today's dollars" : 'Future dollars'}
            </Button>
          ))}
        </div>
      </div>
      {!editing && modal === null && conflictBox}
      {noIncome && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-caution/30 bg-caution-subtle px-4 py-3"
        >
          <p className="flex-1 min-w-64 text-sm text-text">
            <span className="font-medium">This forecast assumes you earn nothing.</span> You have no
            payday plan and no take-home income entered
            {r?.firstUnfunded
              ? `, so your accounts run short from ${r.firstUnfunded.calendarYear}`
              : ''}
            . Add your take-home pay to see a realistic picture.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={enterIncome}>
              Enter take-home pay
            </Button>
            <ButtonLink size="sm" variant="secondary" to="/budget">
              Set up a payday plan
            </ButtonLink>
          </div>
        </div>
      )}
      {warnings.length ? (
        <ul className="text-sm text-caution list-disc pl-5" aria-label="Forecast warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {r?.firstUnfunded && !noIncome && (
        <p role="alert" className="rounded-md border border-negative p-3 text-sm text-negative">
          Unfunded spending: from {r.firstUnfunded.calendarYear} (age {r.firstUnfunded.age}) your
          accounts cannot pay for all of your spending. The shortfall is counted against your net
          worth.
        </p>
      )}
      {result.error && (
        <p role="alert" className="text-sm text-negative">
          {(result.error as Error).message}
        </p>
      )}

      {r && (
        <>
          {summary && (
            <div className="space-y-3">
              <div>
                <p className="text-base text-text-secondary">{summary.lead.headline}</p>
                <p
                  className={`font-display text-4xl max-md:text-3xl tracking-tight tabular-nums mt-1 ${summary.lead.negative ? 'text-negative' : 'text-text'}`}
                >
                  {summary.lead.value}
                </p>
                <p className="text-sm text-text-secondary">{summary.lead.label}</p>
              </div>
              <StatCardRow cards={summary.cards} />
              {summary.noRetirement && (
                <p className="text-sm text-text-tertiary">
                  Add a retirement event in Life events to see what you will have to live on.
                </p>
              )}
            </div>
          )}
          {r.studyLoans && <StudySummary study={r.studyLoans} />}
          <NetWorthChart
            years={years}
            startYear={startYear}
            mode={mode}
            events={saved.plan.events}
            birthYear={saved.plan.settings.birthYear}
            comparison={comparison.data}
            activeName={saved.plan.name}
            referenceName={comparison.data?.reference.name}
            selected={yearIndex}
            onSelect={setYear}
          />
          <div className="flex flex-wrap items-end gap-3">
            <Field label="See what made up a year">
              <Select
                aria-label="Year"
                value={yearIndex ?? ''}
                onChange={(e) => setYear(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">Choose a year</option>
                {years.slice(1).map((y) => (
                  <option key={y.index} value={y.index}>
                    {y.calendarYear} (age {y.age} to {y.age + 1})
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-text-tertiary pb-3 max-w-prose">
              A projection, not a promise.{' '}
              {mode === 'today'
                ? `Amounts are in today's dollars, with inflation at ${working.settings.inflationBps / 100}% a year taken out.`
                : `Amounts are in the dollars of each year, with inflation at ${working.settings.inflationBps / 100}% a year.`}{' '}
              Each point is your net worth that many years from today. Nothing here changes your
              budget.
            </p>
          </div>
          <Tip tip={TIPS.todaysDollars} className="rounded-lg border border-border-light p-4" />
          {selectedYear && (
            <YearBreakdown year={selectedYear} previousIndexPpb={prevIndex} mode={mode} />
          )}
        </>
      )}

      <section id="lt-plan-sections" className="space-y-4 scroll-mt-4">
        <ScrollCue
          className="border-b border-border-light"
          scrollerClassName="flex gap-1 -mb-px"
          activeKey={panel}
          scrollerProps={{
            role: 'tablist',
            'aria-label': 'Plan sections',
            onKeyDown: onTabListKeyDown,
          }}
        >
          {PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={panel === p.id}
              tabIndex={panel === p.id ? 0 : -1}
              data-scroll-active={panel === p.id}
              onClick={() => setPanel(p.id)}
              className={`px-3 py-2 text-sm whitespace-nowrap shrink-0 border-b-2 max-md:min-h-11 transition-colors ${panel === p.id ? 'border-brand-600 font-medium text-text' : 'border-transparent text-text-secondary hover:text-text'}`}
            >
              {p.label}
            </button>
          ))}
        </ScrollCue>

        {panel !== 'events' && panel !== 'compare' && panel !== 'simulation' && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              disabled={ed.busy || !allValid}
              onClick={() => {
                // An amount being typed is handed over when its field is left
                (document.activeElement as HTMLElement | null)?.blur();
                setTimeout(() => {
                  if (edRef.current.dirty) void edRef.current.save();
                }, 0);
              }}
            >
              Save changes
            </Button>
            <Button size="sm" variant="secondary" onClick={ed.revert} disabled={!ed.dirty}>
              Discard changes
            </Button>
            {dirtyNote}
          </div>
        )}
        {ed.error && editing === null && (
          <p role="alert" className="text-sm text-negative">
            {ed.error}
          </p>
        )}

        {panel === 'events' && (
          <EventList
            plan={saved.plan}
            busy={ed.busy}
            onAdd={(kind) => {
              ed.setError(null);
              setEditing({ mode: 'create', event: newDraft(kind, { startYear }) });
            }}
            onEdit={(event) => {
              ed.setError(null);
              setEditing({ mode: 'edit', event });
            }}
            onToggle={(event) =>
              void ed.commit((p) => ({
                ...p,
                events: p.events.map((x) =>
                  x.id === event.id ? { ...x, enabled: !x.enabled } : x,
                ),
              }))
            }
            onDelete={(event) =>
              void ed.commit((p) => ({ ...p, events: p.events.filter((x) => x.id !== event.id) }))
            }
          />
        )}
        <AmountFields report={report}>
          {panel === 'assumptions' && (
            <AssumptionsPanel
              plan={working}
              setPlan={ed.setWorking}
              point={point.data}
              defaults={defaults.data}
            />
          )}
          {panel === 'accounts' && (
            <AccountsPanel plan={working} setPlan={ed.setWorking} point={point.data} />
          )}
          {panel === 'savings' && (
            <SavingsPanel plan={working} setPlan={ed.setWorking} point={point.data} result={r} />
          )}
        </AmountFields>
        {panel === 'simulation' && (
          <SimulationPanel saved={saved} result={r} mode={mode} dirty={ed.dirty} />
        )}
        {panel === 'compare' && (
          <div className="space-y-4">
            {others.length === 0 ? (
              <p className="text-sm text-text-tertiary">
                Make a second plan (Duplicate is the quickest way) to compare it with this one.
              </p>
            ) : (
              <>
                <Field label="Compare with" className="max-w-xs">
                  <Select
                    aria-label="Compare with"
                    value={refSummary ? reference : ''}
                    onChange={(e) => setReference(e.target.value)}
                  >
                    <option value="">No comparison</option>
                    {others.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {comparison.error && (
                  <p role="alert" className="text-sm text-negative">
                    {(comparison.error as Error).message}
                  </p>
                )}
                {comparison.data && <ComparePanel comparison={comparison.data} />}
              </>
            )}
          </div>
        )}
      </section>

      {editing && (
        <EventEditor
          key={editing.event.id}
          initial={editing.event}
          mode={editing.mode}
          plan={saved.plan}
          point={point.data}
          busy={ed.busy}
          error={ed.error}
          banner={conflictBox}
          onClose={() => setEditing(null)}
          onSave={async (event) => {
            const done = await ed.commit((p) => ({
              ...p,
              events: p.events.some((x) => x.id === event.id)
                ? p.events.map((x) => (x.id === event.id ? event : x))
                : [...p.events, event],
            }));
            if (done) setEditing(null);
          }}
        />
      )}

      <Modal
        isOpen={modal === 'rename' || modal === 'duplicate'}
        onClose={() => setModal(null)}
        title={modal === 'rename' ? 'Rename plan' : 'Duplicate plan'}
        size="sm"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitName();
          }}
        >
          <Field label="Plan name">
            <Input
              aria-label="Plan name"
              value={text}
              maxLength={100}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          {modal === 'rename' && conflictBox}
          {planError && (
            <p role="alert" className="text-sm text-negative">
              {planError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!text.trim() || ed.busy}>
              {modal === 'rename' ? 'Rename' : 'Duplicate'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={modal === 'new'} onClose={() => setModal(null)} title="New plan" size="sm">
        <NewPlanForm
          first={false}
          onCancel={() => setModal(null)}
          onCreated={(newId) => {
            setModal(null);
            onSelect(newId);
          }}
        />
      </Modal>
      <ConfirmModal
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => pending?.()}
        title="Leave without saving?"
        message="You have unsaved changes to this plan. They are lost if you go on."
        confirmLabel="Discard changes"
        danger
      />
      <ConfirmModal
        isOpen={modal === 'delete'}
        onClose={() => setModal(null)}
        onConfirm={() => void removePlan()}
        title="Delete this plan?"
        message={
          plans.length > 1
            ? `"${saved.plan.name}" is deleted. Only the plan goes: your budget is not touched.`
            : `"${saved.plan.name}" is deleted, and you will be asked to set up a new plan. Your budget is not touched.`
        }
        confirmLabel="Delete plan"
        danger
      />
      {planError && modal === null && (
        <p role="alert" className="text-sm text-negative">
          {planError}
        </p>
      )}
    </div>
  );
}
