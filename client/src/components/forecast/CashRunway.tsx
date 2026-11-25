import { useId, useMemo, useState, type ReactNode } from 'react';
import { UncategorisedNotice } from '../review/UncategorisedBanner';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Copy, Download, Plus, Save, Trash2, X } from 'lucide-react';
import { defineChart, lineY } from '@tanstack/charts';
import type { ChartMark, ChartPoint } from '@tanstack/charts';
import { dot } from '@tanstack/charts/dot';
import { decorative } from '@tanstack/charts/mark/decorative';
import { ruleX, ruleY } from '@tanstack/charts/rule';
import { tooltip } from '@tanstack/charts/tooltip';
import type { ChartTooltipContent } from '@tanstack/charts/tooltip';
import * as api from '../../api/forecast';
import { PrivateSection } from '../ui/Private';
import { EmptyState } from '../ui/EmptyState';
import { Button, ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { Combobox } from '../ui/Combobox';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select, type SelectOption } from '../ui/Select';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { NumberField } from '../ui/NumberField';
import { percentRangeMessage } from '../ui/fieldMessages';
import { StatCardRow } from '../reports/ChartHelpers';
import { FillChart } from '../charts/FillChart';
import { LegendKey } from '../charts/ChartLegend';
import { pointScale, valueScale } from '../charts/kit';
import { useDebounce } from '../../hooks/useDebounce';
import { useGoals } from '../../hooks/useGoals';
import { MAX_SLOTS, useScenarioSlots, type Slot } from '../../hooks/useScenarioSlots';
import { chartColors } from '../../utils/chartColors';
import { formatExampleMoney, formatCurrency } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { downloadCsv } from '../../utils/exportCsv';
import { bpsToInput, inputToBps } from '../../utils/longTerm';
import { onTabListKeyDown } from '../ui/tabList';
import { addDaysIso, todayIso } from '../../utils/calendarDay';

const COLORS = [chartColors.brand, chartColors.caution, chartColors.positive];
// Round-capped near-zero dashes draw a dotted line
const DOTTED = '0.1 5';
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
const addDays = addDaysIso;
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
const HORIZON_OPTIONS: SelectOption[] = [30, 90, 180, 365, 730].map((d) => ({
  value: String(d),
  label: d < 365 ? `${d} days` : `${d / 365} year${d > 365 ? 's' : ''}`,
}));
const LOOKBACK_OPTIONS: SelectOption[] = [28, 90, 180, 365].map((d) => ({
  value: String(d),
  label: `Last ${d} days`,
}));
// The shared Select reads '' as no choice, so Automatic (null in the request) has its own value
const AUTOMATIC = 'auto';
const INCOME_SOURCE_OPTIONS: SelectOption[] = [
  { value: AUTOMATIC, label: 'Automatic' },
  { value: 'payday', label: 'Payday plans' },
  { value: 'schedules', label: 'Scheduled income' },
];
const HOUSEHOLD_OPTIONS: SelectOption[] = [
  { value: AUTOMATIC, label: 'Automatic' },
  { value: 'true', label: 'Include my share' },
  { value: 'false', label: 'Leave out' },
];

/** A scenario's date row field: a half-typed or cleared date keeps the last whole one */
function ScenarioDate({
  label,
  value,
  minValue,
  onChange,
}: {
  label: string;
  value: string;
  minValue?: string;
  onChange: (iso: string) => void;
}) {
  return (
    <DatePicker
      label={label}
      hideLabel
      value={value}
      minValue={minValue}
      onChange={(iso) => {
        if (iso) onChange(iso);
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
  /**
   * The slot bar, told whether every field in this editor holds a value it can save, and whether
   * an amount is being typed
   */
  footer?: (allValid: boolean, drafting: boolean) => ReactNode;
  onChange: (s: api.ForecastScenarioInput) => void;
}) {
  // Scenario edits apply live, so a field only passes on values inside the server's caps
  // (scenarioSchema, forecastConfig.ts); while one holds text it can't use, Save waits for it
  const { allValid, report } = useAmountValidity();
  // An amount applies when its field is left, so until then the scenario doesn't hold it. Save
  // counts the text being typed as a change: the click that leaves the field (applying the
  // amount) is then the click that saves, instead of only enabling Save for a second one.
  const [drafting, setDrafting] = useState(false);
  const amountDraft = {
    onTextChange: () => setDrafting(true),
    onBlur: () => setDrafting(false),
  };
  const ids = useId();
  const percent = (key: 'spendingPercent' | 'incomePercent', label: string, max: number) => (
    <NumberField
      label={label}
      value={scenario[key]}
      min={0}
      max={max}
      onChange={(n) => {
        if (n !== null) onChange({ ...scenario, [key]: n });
      }}
    />
  );
  return (
    <Card padding="sm">
      <AmountFields report={report}>
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
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${ids}-daily`}>Spending per day</Label>
            <CurrencyInput
              id={`${ids}-daily`}
              aria-label={`${scenario.name} spending per day`}
              {...amountDraft}
              nullable
              placeholder="History"
              value={scenario.dailySpending}
              onChange={(n) => onChange({ ...scenario, dailySpending: n })}
            />
          </div>
          <NumberField
            label="Goal growth % a year"
            value={Number(bpsToInput(scenario.annualReturnBasisPoints))}
            min={-100}
            max={50}
            allowDecimal
            // Basis points are hundredths of a percent, so 5.555 is acknowledged as 5.56
            precision={2}
            errorMessage={percentRangeMessage(-100, 50)}
            onChange={(n) => {
              // toFixed, not String: String(0.0000001) is "1e-7", which inputToBps refuses
              const bps = n === null ? null : inputToBps(n.toFixed(2));
              if (bps !== null) onChange({ ...scenario, annualReturnBasisPoints: bps });
            }}
          />
        </div>
        {goals.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-text-secondary cursor-pointer">
              Goal contributions per pay
            </summary>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {goals.map((g) => (
                <div key={g.id} className="flex flex-col gap-1">
                  <Label htmlFor={`${ids}-goal-${g.id}`}>{g.name}</Label>
                  <CurrencyInput
                    id={`${ids}-goal-${g.id}`}
                    aria-label={`${scenario.name} contribution to ${g.name}`}
                    {...amountDraft}
                    nullable
                    placeholder="Plan"
                    value={
                      scenario.goalContributions.find((c) => c.goalId === g.id)?.amountPerPay ??
                      null
                    }
                    onChange={(n) =>
                      onChange({
                        ...scenario,
                        goalContributions: [
                          ...scenario.goalContributions.filter((c) => c.goalId !== g.id),
                          ...(n === null ? [] : [{ goalId: g.id, amountPerPay: n }]),
                        ],
                      })
                    }
                  />
                </div>
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
              <div key={i} className="grid grid-cols-2 gap-1 items-start">
                <div className="col-span-2 flex items-center gap-1">
                  <Input
                    aria-label="One-off description"
                    className="w-full min-w-0"
                    value={o.description}
                    onChange={(e) => set({ description: e.target.value })}
                  />
                  <button
                    type="button"
                    aria-label="Remove one-off"
                    className="p-1 text-text-tertiary hover:text-negative"
                    onClick={() =>
                      onChange({
                        ...scenario,
                        oneOffs: scenario.oneOffs.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <ScenarioDate
                  label="One-off date"
                  minValue={today}
                  value={o.date}
                  onChange={(date) => set({ date })}
                />
                <CurrencyInput
                  aria-label="One-off amount (negative for spending)"
                  {...amountDraft}
                  allowNegative
                  value={o.amount}
                  onChange={(amount) => set({ amount })}
                />
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
                <div key={i} className="grid grid-cols-2 gap-1 items-start">
                  <div className="col-span-2 flex items-center justify-between gap-1">
                    <span className="text-xs text-text-secondary">No income</span>
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
                  <ScenarioDate
                    label="No income from"
                    value={p.from}
                    onChange={(from) => set({ from })}
                  />
                  <ScenarioDate
                    label="No income until"
                    value={p.to}
                    onChange={(to) => set({ to })}
                  />
                </div>
              );
            })}
            {scenario.costChanges.map((c, i) => {
              const set = (patch: Partial<typeof c>) =>
                onChange({
                  ...scenario,
                  costChanges: scenario.costChanges.map((x, j) =>
                    j === i ? { ...x, ...patch } : x,
                  ),
                });
              return (
                <div key={i} className="grid grid-cols-2 gap-1 items-start">
                  <div className="col-span-2 flex items-center gap-1">
                    <Input
                      aria-label="Cost change description"
                      className="w-full min-w-0"
                      value={c.description}
                      onChange={(e) => set({ description: e.target.value })}
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
                  <ScenarioDate
                    label="Cost change from"
                    minValue={today}
                    value={c.from}
                    onChange={(from) => set({ from })}
                  />
                  <CurrencyInput
                    aria-label="Extra cost per month"
                    {...amountDraft}
                    allowNegative
                    value={c.monthlyAmount}
                    onChange={(monthlyAmount) => set({ monthlyAmount })}
                  />
                </div>
              );
            })}
          </div>
        </details>
      </AmountFields>
      {footer?.(allValid, drafting)}
    </Card>
  );
}

/** Saved or not, Save, and what to do when another device changed the saved copy */
function SaveBar({
  slot,
  dirty,
  allValid,
  canDuplicate,
  canRemove,
  slots,
}: {
  slot: Slot;
  /** The scenario differs from its saved copy, or an amount is being typed into it */
  dirty: boolean;
  /** False while a field in the scenario holds text it can't use (out of range, not a number) */
  allValid: boolean;
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
            <Button
              size="sm"
              variant="secondary"
              disabled={!allValid}
              onClick={() => slots.keepMine(slot)}
            >
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
          disabled={!dirty || !allValid || slot.theirs !== undefined}
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

export function CashRunway() {
  const [horizonDays, setHorizon] = useState(90);
  const [lookbackDays, setLookback] = useState(90);
  const [incomeSource, setIncomeSource] = useState<api.ForecastRequest['incomeSource']>(null);
  const [includeHousehold, setHousehold] = useState<boolean | null>(null);
  const slots = useScenarioSlots(DEFAULT_SCENARIOS);
  const { scenarios } = slots;
  const [selected, setSelected] = useState(0);
  const [savedQuery, setSavedQuery] = useState('');
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
  const today = data?.today ?? todayIso();
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

  // The ring where the forecasts leave the history: the balance today
  const todayBalance = data
    ? ([chart.find((r) => r.date === data.today)]
        .flatMap((r) => (r ? [r.Actual, ...data.scenarios.map((sc) => r[sc.name])] : []))
        .find((v) => typeof v === 'number') as number | undefined)
    : undefined;

  const runway = useMemo(() => {
    if (!data) return null;
    const today = data.today;
    const names = ['Actual', ...data.scenarios.map((s) => s.name)];
    const colors: Record<string, string> = { Actual: chartColors.axis };
    data.scenarios.forEach((s, i) => (colors[s.name] = COLORS[i]));
    const value = (name: string) => (r: Record<string, number | string>) =>
      typeof r[name] === 'number' ? (r[name] as number) : null;
    // Data lines lead: the date axis takes its order from the first mark, so a lone 'today' rule must not
    const marks: ChartMark[] = [
      lineY(chart, {
        x: 'date',
        y: value('Actual'),
        z: () => 'Actual',
        stroke: chartColors.axis,
        strokeWidth: 2,
      }),
      ...data.scenarios.map((s, i) =>
        lineY(chart, {
          x: 'date',
          y: value(s.name),
          z: () => s.name,
          stroke: COLORS[i],
          strokeDasharray: DOTTED,
          strokeWidth: i === selected ? 3 : 2,
        }),
      ),
      decorative(ruleY([0], { stroke: chartColors.negative, strokeOpacity: 0.4 })),
      decorative(
        ruleX([today], {
          stroke: chartColors.axis,
          strokeDasharray: '2 2',
          strokeOpacity: 0.7,
        }),
      ),
      ...(todayBalance !== undefined
        ? [
            decorative(
              dot([{ date: today, balance: todayBalance }], {
                x: 'date',
                y: 'balance',
                r: 5,
                fill: 'var(--color-surface, #fff)',
                stroke: chartColors.axis,
                strokeWidth: 2.5,
              }),
            ),
          ]
        : []),
    ];
    return defineChart({
      marks,
      scales: {
        x: pointScale((d) => formatDay(d), 40),
        y: valueScale(),
      },
      focus: 'group-x',
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: {
        use: tooltip,
        content: (points: readonly ChartPoint[]): ChartTooltipContent => ({
          title: points[0] ? formatDay(String(points[0].xValue)) : '',
          rows: points
            .filter((p) => names.includes(p.groupLabel))
            .map((p) => ({
              label: p.groupLabel,
              value: formatCurrency(Number(p.yValue)),
              color: colors[p.groupLabel],
            })),
        }),
      },
    });
  }, [data, chart, selected, todayBalance]);

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

  if (data && !error && data.accounts.length === 0 && data.warnings.length === 0)
    return (
      <EmptyState
        title="See how long your cash could last"
        description="Project your cash balance around upcoming pay and bills."
        example={{
          content: (
            <>
              <p>Cash on {formatDay('2027-01-01')}</p>
              <p className="mt-1 font-medium text-text">
                {formatExampleMoney(250_000)} after planned bills
              </p>
            </>
          ),
          description:
            'An illustrative cash forecast leaves ' +
            formatExampleMoney(250_000) +
            ' after planned bills on ' +
            formatDay('2027-01-01') +
            '.',
        }}
        keepActions
        actions={<ButtonLink to="/accounts">Add an account</ButtonLink>}
      />
    );
  const content = (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-6 pt-4 max-md:px-4 shrink-0 flex justify-end">
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
            <Select
              label="Horizon"
              options={HORIZON_OPTIONS}
              value={String(horizonDays)}
              onChange={(v) => setHorizon(Number(v))}
            />
            <Select
              label="Spending history"
              options={LOOKBACK_OPTIONS}
              value={String(lookbackDays)}
              onChange={(v) => setLookback(Number(v))}
            />
            <Select
              label="Income from"
              options={INCOME_SOURCE_OPTIONS}
              value={incomeSource ?? AUTOMATIC}
              onChange={(v) =>
                setIncomeSource(
                  v === AUTOMATIC ? null : (v as NonNullable<api.ForecastRequest['incomeSource']>),
                )
              }
            />
            <Select
              label="Household bill shares"
              options={HOUSEHOLD_OPTIONS}
              value={includeHousehold === null ? AUTOMATIC : String(includeHousehold)}
              onChange={(v) => setHousehold(v === AUTOMATIC ? null : v === 'true')}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-negative">
              {(error as Error).message}
            </p>
          )}
          {isLoading && <div className="h-64 bg-surface-alt rounded animate-pulse" />}
          {data && scenario && (
            <div className={`space-y-5 ${isFetching ? 'opacity-70' : ''}`}>
              {data.spending.uncategorised.significant && (
                <UncategorisedNotice
                  amount={data.spending.uncategorised.total}
                  from={data.spending.from}
                  to={data.spending.to}
                />
              )}
              {data.warnings.length > 0 && (
                <ul className="text-sm text-caution list-disc pl-5" aria-label="Forecast warnings">
                  {data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              <div
                className="flex gap-2 flex-wrap"
                role="tablist"
                aria-label="Scenario"
                onKeyDown={onTabListKeyDown}
              >
                {data.scenarios.map((s, i) => (
                  <Button
                    key={s.name}
                    size="sm"
                    role="tab"
                    aria-selected={i === selected}
                    tabIndex={i === selected ? 0 : -1}
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
                <div className="flex items-center gap-3 flex-wrap pb-2 text-xs text-text-secondary">
                  <LegendKey color={chartColors.axis} label="Actual" line />
                  {data.scenarios.map((s, i) => (
                    <LegendKey key={s.name} color={COLORS[i]} label={s.name} line dashed />
                  ))}
                </div>
                <div className="h-72" aria-label="Cash runway chart">
                  {runway && <FillChart definition={runway} ariaLabel="Cash runway by scenario" />}
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
                <Combobox
                  label={
                    slots.slots.length < MAX_SLOTS
                      ? 'Open saved'
                      : `Replace ${slots.slots[Math.min(selected, slots.slots.length - 1)].scenario.name} with`
                  }
                  aria-label="Open a saved scenario"
                  placeholder="Choose…"
                  className="w-56 max-w-full"
                  items={slots.available.map((s) => ({ value: s.id, label: s.scenario.name }))}
                  // A click shows the list, as the select it replaces did
                  menuTrigger="focus"
                  // Choosing opens the scenario, so the field itself never holds one
                  value=""
                  inputValue={savedQuery}
                  onInputChange={setSavedQuery}
                  onChange={(id) => {
                    const saved = slots.available.find((s) => s.id === id);
                    setSavedQuery('');
                    if (!saved) return;
                    slots.open(
                      saved,
                      slots.slots.length < MAX_SLOTS
                        ? undefined
                        : slots.slots[Math.min(selected, slots.slots.length - 1)],
                    );
                  }}
                />
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
                  footer={(allValid, drafting) => (
                    <SaveBar
                      slot={slot}
                      dirty={drafting || slots.isDirty(slot)}
                      allValid={allValid}
                      canDuplicate={slots.slots.length < MAX_SLOTS}
                      canRemove={slots.slots.length > 1}
                      slots={slots}
                    />
                  )}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
  return <PrivateSection title="Forecasts are hidden in Safe mode">{content}</PrivateSection>;
}
