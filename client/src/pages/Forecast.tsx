import { useMemo, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Copy, Download, Plus, Save, Trash2, X } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as api from '../api/forecast';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { StatCardRow } from '../components/reports/ChartHelpers';
import { useDebounce } from '../hooks/useDebounce';
import { useGoals } from '../hooks/useGoals';
import { MAX_SLOTS, useScenarioSlots, type Slot } from '../hooks/useScenarioSlots';
import { chartColors } from '../utils/chartColors';
import {
  centsToInput,
  formatCentsAxis,
  formatCurrency,
  isUnreadableAmount,
  parseCents,
} from '../utils/currency';
import { formatDay } from '../utils/dates';
import { downloadCsv } from '../utils/exportCsv';

const COLORS = [chartColors.brand, chartColors.caution, chartColors.positive];
const KIND_LABEL: Record<api.ForecastEvent['kind'], string> = {
  income: 'Expected pay',
  bill: 'Bill',
  scheduled: 'Scheduled',
  household: 'Household share',
  register: 'Future-dated',
  'one-off': 'One-off',
  'cost-change': 'Cost change',
};
const DEFAULT_SCENARIOS: api.ForecastScenarioInput[] = [
  { name: 'Base', spendingPercent: 100, incomePercent: 100 },
  { name: 'Conservative', spendingPercent: 120, incomePercent: 95 },
  { name: 'Stretch', spendingPercent: 85, incomePercent: 100 },
].map((s) => ({
  ...s,
  dailySpending: null,
  annualReturnBasisPoints: 0,
  goalContributions: [],
  oneOffs: [],
  incomePauses: [],
  costChanges: [],
}));
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** Life-event templates (phase 7C): they only prefill the scenario; nothing is saved. */
const TEMPLATES: {
  label: string;
  apply: (s: api.ForecastScenarioInput, today: string) => api.ForecastScenarioInput;
}[] = [
  {
    label: 'No income for 3 months',
    apply: (s, today) => ({
      ...s,
      incomePauses: [...s.incomePauses, { from: addDays(today, 1), to: addDays(today, 91) }],
    }),
  },
  {
    label: 'Emergency cost',
    apply: (s, today) => ({
      ...s,
      oneOffs: [
        ...s.oneOffs,
        { date: addDays(today, 1), amount: -200000, description: 'Emergency' },
      ],
    }),
  },
  {
    label: 'Essentials rise',
    apply: (s, today) => ({
      ...s,
      costChanges: [
        ...s.costChanges,
        { from: addDays(today, 1), monthlyAmount: 20000, description: 'Higher essentials' },
      ],
    }),
  },
];
const field = 'flex flex-col gap-1 text-xs text-text-secondary';

function AmountInput({
  value,
  onChange,
  label,
  allowEmpty,
  placeholder = 'History',
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  label: string;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(value === null ? '' : centsToInput(value));
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      value={raw}
      placeholder={allowEmpty ? placeholder : undefined}
      onChange={(e) => {
        setRaw(e.target.value);
        if (allowEmpty && e.target.value.trim() === '') onChange(null);
        else if (!isUnreadableAmount(e.target.value)) onChange(parseCents(e.target.value));
      }}
    />
  );
}

/** The scenario's name: kept when left empty or the same as another scenario's */
function NameInput({
  name,
  otherNames,
  onChange,
}: {
  name: string;
  otherNames: string[];
  onChange: (name: string) => void;
}) {
  const [raw, setRaw] = useState(name);
  const [prev, setPrev] = useState(name);
  if (prev !== name) {
    setPrev(name);
    setRaw(name);
  }
  const commit = () => {
    const next = raw.trim().slice(0, 40);
    if (next && !otherNames.some((n) => n.toLowerCase() === next.toLowerCase())) onChange(next);
    else setRaw(name);
  };
  return (
    <Input
      aria-label="Scenario name"
      value={raw}
      maxLength={40}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

function ScenarioEditor({
  scenario,
  color,
  today,
  goals,
  otherNames,
  footer,
  onChange,
}: {
  scenario: api.ForecastScenarioInput;
  color: string;
  today: string;
  goals: { id: string; name: string }[];
  otherNames: string[];
  footer?: ReactNode;
  onChange: (s: api.ForecastScenarioInput) => void;
}) {
  const percent = (key: 'spendingPercent' | 'incomePercent', label: string, max: number) => (
    <label className={field}>
      {label}
      <Input
        type="number"
        min={0}
        max={max}
        value={scenario[key]}
        onChange={(e) =>
          onChange({ ...scenario, [key]: Math.min(max, Math.max(0, Math.round(+e.target.value))) })
        }
      />
    </label>
  );
  return (
    <Card padding="sm">
      <div className="text-sm text-text mb-2 flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <NameInput
          name={scenario.name}
          otherNames={otherNames}
          onChange={(name) => onChange({ ...scenario, name })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {percent('spendingPercent', 'Variable spending %', 500)}
        {percent('incomePercent', 'Income %', 200)}
        <label className={field}>
          Spending per day
          <AmountInput
            label={`${scenario.name} spending per day`}
            allowEmpty
            value={scenario.dailySpending}
            onChange={(n) => onChange({ ...scenario, dailySpending: n })}
          />
        </label>
        <label className={field}>
          Goal growth % a year
          <Input
            type="number"
            step="0.1"
            min={-100}
            max={50}
            value={scenario.annualReturnBasisPoints / 100}
            onChange={(e) =>
              onChange({
                ...scenario,
                annualReturnBasisPoints: Math.min(
                  5000,
                  Math.max(-10000, Math.round(+e.target.value * 100)),
                ),
              })
            }
          />
        </label>
      </div>
      {goals.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-text-secondary cursor-pointer">
            Goal contributions per pay
          </summary>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {goals.map((g) => (
              <label key={g.id} className={field}>
                {g.name}
                <AmountInput
                  label={`${scenario.name} contribution to ${g.name}`}
                  allowEmpty
                  placeholder="Plan"
                  value={
                    scenario.goalContributions.find((c) => c.goalId === g.id)?.amountPerPay ?? null
                  }
                  onChange={(n) =>
                    onChange({
                      ...scenario,
                      goalContributions: [
                        ...scenario.goalContributions.filter((c) => c.goalId !== g.id),
                        ...(n === null ? [] : [{ goalId: g.id, amountPerPay: Math.max(0, n) }]),
                      ],
                    })
                  }
                />
              </label>
            ))}
          </div>
        </details>
      )}
      <div className="mt-3 space-y-2">
        {scenario.oneOffs.map((o, i) => {
          const set = (patch: Partial<typeof o>) =>
            onChange({
              ...scenario,
              oneOffs: scenario.oneOffs.map((x, j) => (j === i ? { ...x, ...patch } : x)),
            });
          return (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 items-center">
              <Input
                aria-label="One-off description"
                value={o.description}
                onChange={(e) => set({ description: e.target.value })}
              />
              <Input
                aria-label="One-off date"
                type="date"
                min={today}
                value={o.date}
                onChange={(e) => set({ date: e.target.value })}
              />
              <AmountInput
                label="One-off amount (negative for spending)"
                value={o.amount}
                onChange={(n) => set({ amount: n ?? 0 })}
              />
              <button
                type="button"
                aria-label="Remove one-off"
                className="p-1 text-text-tertiary hover:text-negative"
                onClick={() =>
                  onChange({ ...scenario, oneOffs: scenario.oneOffs.filter((_, j) => j !== i) })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange({
              ...scenario,
              oneOffs: [
                ...scenario.oneOffs,
                { date: today, amount: -10000, description: 'One-off' },
              ],
            })
          }
        >
          <Plus size={14} /> One-off amount
        </Button>
      </div>
      <details
        className="mt-3"
        open={scenario.incomePauses.length + scenario.costChanges.length > 0}
      >
        <summary className="text-xs text-text-secondary cursor-pointer">Life events</summary>
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {TEMPLATES.map((t) => (
              <Button
                key={t.label}
                size="sm"
                variant="secondary"
                onClick={() => onChange(t.apply(scenario, today))}
              >
                {t.label}
              </Button>
            ))}
          </div>
          {scenario.incomePauses.map((p, i) => {
            const set = (patch: Partial<typeof p>) =>
              onChange({
                ...scenario,
                incomePauses: scenario.incomePauses.map((x, j) =>
                  j === i ? { ...x, ...patch } : x,
                ),
              });
            return (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_1fr_auto] gap-1 items-center text-xs"
              >
                <span className="text-text-secondary">No income</span>
                <Input
                  aria-label="No income from"
                  type="date"
                  value={p.from}
                  onChange={(e) => set({ from: e.target.value })}
                />
                <Input
                  aria-label="No income until"
                  type="date"
                  value={p.to}
                  onChange={(e) => set({ to: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="Remove income pause"
                  className="p-1 text-text-tertiary hover:text-negative"
                  onClick={() =>
                    onChange({
                      ...scenario,
                      incomePauses: scenario.incomePauses.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          {scenario.costChanges.map((c, i) => {
            const set = (patch: Partial<typeof c>) =>
              onChange({
                ...scenario,
                costChanges: scenario.costChanges.map((x, j) => (j === i ? { ...x, ...patch } : x)),
              });
            return (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 items-center">
                <Input
                  aria-label="Cost change description"
                  value={c.description}
                  onChange={(e) => set({ description: e.target.value })}
                />
                <Input
                  aria-label="Cost change from"
                  type="date"
                  min={today}
                  value={c.from}
                  onChange={(e) => set({ from: e.target.value })}
                />
                <AmountInput
                  label="Extra cost per month"
                  value={c.monthlyAmount}
                  onChange={(n) => set({ monthlyAmount: n ?? 0 })}
                />
                <button
                  type="button"
                  aria-label="Remove cost change"
                  className="p-1 text-text-tertiary hover:text-negative"
                  onClick={() =>
                    onChange({
                      ...scenario,
                      costChanges: scenario.costChanges.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </details>
      {footer}
    </Card>
  );
}

/** Saved or not, Save, and what to do when another device changed the saved copy */
function SaveBar({
  slot,
  dirty,
  canDuplicate,
  canRemove,
  slots,
}: {
  slot: Slot;
  dirty: boolean;
  canDuplicate: boolean;
  canRemove: boolean;
  slots: ReturnType<typeof useScenarioSlots>;
}) {
  const name = slot.scenario.name;
  return (
    <div className="mt-3 pt-3 border-t border-border-light space-y-2">
      {slot.theirs !== undefined && (
        <div role="alert" className="text-xs text-caution space-y-1.5">
          <p>
            {slot.theirs
              ? `"${slot.theirs.scenario.name}" was changed on another device since you opened it.`
              : 'This scenario was deleted on another device.'}
          </p>
          <div className="flex flex-wrap gap-1">
            {slot.theirs && (
              <Button size="sm" variant="secondary" onClick={() => slots.loadTheirs(slot)}>
                Use theirs
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => slots.keepMine(slot)}>
              {slot.theirs ? 'Keep mine' : 'Save as new'}
            </Button>
          </div>
        </div>
      )}
      {slot.error && (
        <p role="alert" className="text-xs text-negative">
          {slot.error}
        </p>
      )}
      <p className="text-xs text-text-tertiary" aria-live="polite">
        {!slot.saved ? 'Not saved' : dirty ? 'Unsaved changes' : 'Saved'}
      </p>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={slot.saved && dirty ? 'primary' : 'secondary'}
          disabled={!dirty || slot.theirs !== undefined}
          aria-label={`Save ${name}`}
          onClick={() => slots.save(slot)}
        >
          <Save size={13} /> Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canDuplicate}
          aria-label={`Duplicate ${name}`}
          title={canDuplicate ? undefined : `Compare up to ${MAX_SLOTS} scenarios`}
          onClick={() => slots.duplicate(slot)}
        >
          <Copy size={13} />
        </Button>
        {slot.saved && (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete saved ${name}`}
            title="Delete the saved copy"
            onClick={() => slots.deleteSaved(slot)}
          >
            <Trash2 size={13} />
          </Button>
        )}
        {canRemove && (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Remove ${name} from the comparison`}
            title="Remove from the comparison (a saved copy stays saved)"
            onClick={() => slots.remove(slot)}
          >
            <X size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}

/** "+$120 vs Base": the difference from the first scenario, in money rather than a percentage */
function versus(value: number, baseline: number, baselineName: string) {
  const diff = value - baseline;
  if (diff === 0) return `Same as ${baselineName}`;
  return `${diff > 0 ? '+' : '−'}${formatCurrency(Math.abs(diff))} vs ${baselineName}`;
}

export default function ForecastPage() {
  const [horizonDays, setHorizon] = useState(90);
  const [lookbackDays, setLookback] = useState(90);
  const [incomeSource, setIncomeSource] = useState<api.ForecastRequest['incomeSource']>(null);
  const [includeHousehold, setHousehold] = useState<boolean | null>(null);
  const slots = useScenarioSlots(DEFAULT_SCENARIOS);
  const { scenarios } = slots;
  const [selected, setSelected] = useState(0);
  const request = useDebounce<api.ForecastRequest>(
    { horizonDays, lookbackDays, incomeSource, includeHousehold, scenarios },
    300,
  );
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ['forecast', request],
    queryFn: () => api.getForecast(request),
    placeholderData: keepPreviousData,
    enabled: slots.ready,
  });
  const { data: goalRows = [] } = useGoals();
  const goalOptions = goalRows.map((g) => ({ id: g.id, name: g.name }));
  const today = data?.today ?? new Date().toISOString().slice(0, 10);
  const scenario = data?.scenarios[Math.min(selected, (data?.scenarios.length ?? 1) - 1)];
  const baseline = data?.scenarios[0];
  const compared = !!scenario && !!baseline && scenario !== baseline;

  // Actual history is solid; each scenario is a dashed projection from today.
  const chart = useMemo(() => {
    if (!data) return [];
    const rows = new Map<string, Record<string, number | string>>();
    for (const h of data.history) rows.set(h.date, { date: h.date, Actual: h.balance });
    for (const s of data.scenarios)
      for (const d of s.days)
        rows.set(d.date, { ...rows.get(d.date), date: d.date, [s.name]: d.balance });
    return [...rows.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [data]);

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `forecast-${data.today}.csv`,
      data.scenarios[0].days.map((d, k) => ({
        date: d.date,
        ...Object.fromEntries(
          data.scenarios.flatMap((s) => [
            [`${s.name} balance`, s.days[k].balance / 100],
            [`${s.name} income`, s.days[k].income / 100],
            [`${s.name} scheduled`, s.days[k].scheduled / 100],
            [`${s.name} variable spending`, -s.days[k].variable / 100],
          ]),
        ),
      })),
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] max-md:text-2xl leading-tight tracking-tight text-text">
          Forecast
        </h1>
        <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!data}>
          <Download size={14} /> CSV
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-6 space-y-5">
          <p className="text-sm text-text-secondary">
            Read-only scenarios built from your payday plans, recurring bills, household shares and
            goals. A forecast never creates transactions or assigns money. Scenarios are labelled
            assumptions, not predictions or confidence intervals.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className={field}>
              Horizon
              <Select value={horizonDays} onChange={(e) => setHorizon(+e.target.value)}>
                {[30, 90, 180, 365, 730].map((d) => (
                  <option key={d} value={d}>
                    {d < 365 ? `${d} days` : `${d / 365} year${d > 365 ? 's' : ''}`}
                  </option>
                ))}
              </Select>
            </label>
            <label className={field}>
              Spending history
              <Select value={lookbackDays} onChange={(e) => setLookback(+e.target.value)}>
                {[28, 90, 180, 365].map((d) => (
                  <option key={d} value={d}>
                    Last {d} days
                  </option>
                ))}
              </Select>
            </label>
            <label className={field}>
              Income from
              <Select
                value={incomeSource ?? ''}
                onChange={(e) =>
                  setIncomeSource((e.target.value || null) as api.ForecastRequest['incomeSource'])
                }
              >
                <option value="">Automatic</option>
                <option value="payday">Payday plans</option>
                <option value="schedules">Scheduled income</option>
              </Select>
            </label>
            <label className={field}>
              Household bill shares
              <Select
                value={includeHousehold === null ? '' : String(includeHousehold)}
                onChange={(e) =>
                  setHousehold(e.target.value === '' ? null : e.target.value === 'true')
                }
              >
                <option value="">Automatic</option>
                <option value="true">Include my share</option>
                <option value="false">Leave out</option>
              </Select>
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-negative">
              {(error as Error).message}
            </p>
          )}
          {isLoading && <div className="h-64 bg-surface-alt rounded animate-pulse" />}
          {data && scenario && (
            <div className={`space-y-5 ${isFetching ? 'opacity-70' : ''}`}>
              {data.warnings.length > 0 && (
                <ul className="text-sm text-caution list-disc pl-5" aria-label="Forecast warnings">
                  {data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Scenario">
                {data.scenarios.map((s, i) => (
                  <Button
                    key={s.name}
                    size="sm"
                    role="tab"
                    aria-selected={i === selected}
                    variant={i === selected ? 'primary' : 'secondary'}
                    onClick={() => setSelected(i)}
                  >
                    {s.name}
                  </Button>
                ))}
              </div>
              <StatCardRow
                variant="hero"
                cards={[
                  { label: 'Cash today', value: formatCurrency(data.startBalance) },
                  {
                    label: 'Lowest before payday',
                    value: scenario.lowestBeforeNextPayday
                      ? formatCurrency(scenario.lowestBeforeNextPayday.balance)
                      : '—',
                    sub: scenario.lowestBeforeNextPayday
                      ? `${formatDay(scenario.lowestBeforeNextPayday.date)} · pay ${formatDay(scenario.nextPayday!)}`
                      : 'No payday in range',
                    tone:
                      scenario.lowestBeforeNextPayday && scenario.lowestBeforeNextPayday.balance < 0
                        ? 'negative'
                        : undefined,
                  },
                  {
                    label: 'Lowest balance',
                    value: formatCurrency(scenario.lowest.balance),
                    sub: compared
                      ? `${formatDay(scenario.lowest.date)} · ${versus(scenario.lowest.balance, baseline.lowest.balance, baseline.name)}`
                      : formatDay(scenario.lowest.date),
                    tone: scenario.lowest.balance < 0 ? 'negative' : undefined,
                  },
                  {
                    label: `Balance on ${formatDay(data.end)}`,
                    value: formatCurrency(scenario.endBalance),
                    sub: compared
                      ? versus(scenario.endBalance, baseline.endBalance, baseline.name)
                      : undefined,
                    tone: scenario.endBalance < 0 ? 'negative' : undefined,
                  },
                ]}
              />
              <p role="status" aria-label="Shortfall" className="text-sm text-text-secondary">
                {scenario.firstShortfall ? (
                  <span className="text-negative">
                    First shortfall {formatDay(scenario.firstShortfall.date)}:{' '}
                    {formatCurrency(scenario.firstShortfall.balance)}.
                  </span>
                ) : (
                  'No shortfall within this horizon.'
                )}
                {scenario.pausedIncome > 0 &&
                  ` ${formatCurrency(scenario.pausedIncome)} of expected income does not arrive.`}
                {scenario.reserveUse !== null &&
                  (scenario.reserveUse > 0
                    ? ` The lowest balance falls ${formatCurrency(scenario.reserveUse)} into your flexibility reserve.`
                    : ' The lowest balance stays above your flexibility reserve.')}
              </p>
              <Card padding="sm">
                <p className="text-sm font-semibold text-text mb-2">Cash runway</p>
                <div className="h-72" aria-label="Cash runway chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chart} margin={{ left: 8, right: 16, top: 8 }}>
                      <CartesianGrid stroke={chartColors.grid} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => formatDay(d)}
                        minTickGap={40}
                        tick={{ fontSize: 11, fill: chartColors.axis }}
                      />
                      <YAxis
                        tickFormatter={formatCentsAxis}
                        width={70}
                        tick={{ fontSize: 11, fill: chartColors.axis }}
                      />
                      <Tooltip
                        formatter={(v) => formatCurrency(Number(v))}
                        labelFormatter={(d) => formatDay(String(d))}
                      />
                      <Legend />
                      <ReferenceLine y={0} stroke={chartColors.negative} strokeOpacity={0.4} />
                      <ReferenceLine
                        x={data.today}
                        stroke={chartColors.axis}
                        strokeDasharray="2 2"
                      />
                      <Line
                        dataKey="Actual"
                        stroke={chartColors.axis}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      {data.scenarios.map((s, i) => (
                        <Line
                          key={s.name}
                          dataKey={s.name}
                          stroke={COLORS[i]}
                          strokeDasharray="6 3"
                          strokeWidth={i === selected ? 2.5 : 1.5}
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {scenario.goals.length > 0 && (
                <Card padding="none">
                  <p className="text-sm font-semibold text-text px-4 pt-3">Goal trajectory</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-text-tertiary">
                        <tr>
                          <th className="px-4 py-2 font-medium">Goal</th>
                          <th className="px-4 py-2 font-medium text-right">Now</th>
                          <th className="px-4 py-2 font-medium text-right">Target</th>
                          <th className="px-4 py-2 font-medium text-right">
                            On {formatDay(data.end)}
                          </th>
                          {data.scenarios.map((s) => (
                            <th key={s.name} className="px-4 py-2 font-medium">
                              {s.name} reaches target
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scenario.goals.map((g) => (
                          <tr key={g.id} className="border-t border-border-light">
                            <td className="px-4 py-2">
                              <span className="text-text">{g.name}</span>
                              <span className="block text-xs text-text-tertiary">
                                {g.source === 'category' ? 'Category funded' : 'Manually tracked'}
                                {g.targetDate ? ` · due ${formatDay(g.targetDate)}` : ''}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {g.start === null ? 'Unknown' : formatCurrency(g.start)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {formatCurrency(g.target)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {g.end === null ? '—' : formatCurrency(g.end)}
                            </td>
                            {data.scenarios.map((s) => {
                              const p = s.goals.find((x) => x.id === g.id)!;
                              return (
                                <td
                                  key={s.name}
                                  className={`px-4 py-2 ${p.onTrack === false ? 'text-negative' : ''}`}
                                >
                                  {p.attainmentDate
                                    ? formatDay(p.attainmentDate)
                                    : 'Not within horizon'}
                                  {p.onTrack === false && ' (late)'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="px-4 py-2 text-xs text-text-tertiary">
                    Contributions follow payday plan rules for each goal's category unless a
                    scenario sets its own amount per pay. Scheduled bills in a goal's category are
                    withdrawals. Manual values may overlap other goals or accounts.
                  </p>
                </Card>
              )}

              <Card padding="none">
                <p className="text-sm font-semibold text-text px-4 pt-3">
                  {scenario.name}: expected movements
                </p>
                {scenario.events.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-text-tertiary">
                    No paydays, bills or scheduled movements in this horizon.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-text-tertiary sticky top-0 bg-surface">
                        <tr>
                          <th className="px-4 py-2 font-medium">Date</th>
                          <th className="px-4 py-2 font-medium">Description</th>
                          <th className="px-4 py-2 font-medium">Type</th>
                          <th className="px-4 py-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scenario.events.map((e) => (
                          <tr key={e.id} className="border-t border-border-light">
                            <td className="px-4 py-2 whitespace-nowrap">{formatDay(e.date)}</td>
                            <td className="px-4 py-2">{e.description}</td>
                            <td className="px-4 py-2 text-text-secondary">
                              {KIND_LABEL[e.kind]}
                              {e.estimated ? ' (estimate)' : ''}
                            </td>
                            <td
                              className={`px-4 py-2 text-right tabular-nums ${e.amount < 0 ? 'text-negative' : 'text-positive'}`}
                            >
                              {formatCurrency(e.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="px-4 py-2 text-xs text-text-tertiary">
                  Plus variable spending of {formatCurrency(scenario.variableTotal)} over the
                  horizon, from {formatCurrency(data.spending.total)} spent across{' '}
                  {data.spending.days} days since {formatDay(data.spending.from)}.
                </p>
              </Card>

              <Card padding="sm">
                <p className="text-sm font-semibold text-text mb-1">Assumptions</p>
                <ul className="text-sm text-text-secondary list-disc pl-5 space-y-1">
                  {data.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <p className="text-xs text-text-tertiary mt-2">
                  From {formatDay(data.today)} to {formatDay(data.end)} ·{' '}
                  {data.accounts.map((a) => a.name).join(', ') || 'No cash accounts'} · latest
                  transaction{' '}
                  {data.freshness.latestTransaction
                    ? formatDay(data.freshness.latestTransaction)
                    : 'none'}
                  {data.freshness.upLastSyncedAt &&
                    ` · Up synced ${formatDay(data.freshness.upLastSyncedAt.slice(0, 10))}`}
                </p>
              </Card>
            </div>
          )}
          <section aria-labelledby="scenario-assumptions" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="scenario-assumptions" className="text-sm font-semibold text-text">
                Scenario assumptions
              </h2>
              {slots.available.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  {slots.slots.length < MAX_SLOTS
                    ? 'Open saved'
                    : `Replace ${slots.slots[Math.min(selected, slots.slots.length - 1)].scenario.name} with`}
                  <Select
                    aria-label="Open a saved scenario"
                    value=""
                    onChange={(e) => {
                      const saved = slots.available.find((s) => s.id === e.target.value);
                      if (!saved) return;
                      slots.open(
                        saved,
                        slots.slots.length < MAX_SLOTS
                          ? undefined
                          : slots.slots[Math.min(selected, slots.slots.length - 1)],
                      );
                    }}
                  >
                    <option value="">Choose…</option>
                    {slots.available.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.scenario.name}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
            </div>
            <p className="text-xs text-text-tertiary">
              Save a scenario to keep it after a refresh and on your other devices. The comparison
              shows each scenario against the first one.
            </p>
            <div className="grid gap-3 lg:grid-cols-3">
              {slots.slots.map((slot, i) => (
                <ScenarioEditor
                  key={slot.uid}
                  scenario={slot.scenario}
                  color={COLORS[i]}
                  today={today}
                  goals={goalOptions}
                  otherNames={scenarios.filter((_, j) => j !== i).map((x) => x.name)}
                  onChange={(next) => slots.change(slot.uid, next)}
                  footer={
                    <SaveBar
                      slot={slot}
                      dirty={slots.isDirty(slot)}
                      canDuplicate={slots.slots.length < MAX_SLOTS}
                      canRemove={slots.slots.length > 1}
                      slots={slots}
                    />
                  }
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
