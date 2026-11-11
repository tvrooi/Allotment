import { useMemo } from 'react';
import { areaY, barX, barY, defineChart, group, lineY } from '@tanstack/charts';
import { decorative } from '@tanstack/charts/mark/decorative';
import { ruleY } from '@tanstack/charts/rule';
import { text } from '@tanstack/charts/text';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import type { ChartPoint } from '@tanstack/charts';
import type { ChartTooltipContent } from '@tanstack/charts/tooltip';
import {
  useNetWorthSeries,
  useIncomeVsExpenses,
  useSpendingByCategory,
  useSpendingTrends,
} from '../../hooks/useReports';
import { useCategories } from '../../hooks/useCategories';
import { usePreferencesStore } from '../../store/preferencesStore';
import { formatCentsAxis, formatCurrency } from '../../utils/currency';
import { niceStep, valueAxis } from '../../utils/valueAxis';
import { dayBounds, monthCount, monthsBetween } from '../../utils/dateRange';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { chartColors, CATEGORY_COLORS } from '../../utils/chartColors';
import { formatDateAxisLabels, formatDateLabel } from '../../utils/chartTicks';
import { ChartSkeleton, EmptyState, EXPENSE_COLORS, monthLabel } from './ChartHelpers';
import { FillChart } from '../charts/FillChart';
import { LegendKey } from '../charts/ChartLegend';
import {
  areaGradient,
  bandScale,
  currencyTooltip,
  pointScale,
  smooth,
  stepAfter,
  valueScale,
} from '../charts/kit';
import type { NetWorthPoint } from '../../types';

// The built-in reports. Each takes a month range (yyyy-MM) and fills its container.

/** Latest net worth and how much it changed since the first month (`percent` is null from $0 or less). */
export function netWorthChange(data: NetWorthPoint[]) {
  if (!data.length) return null;
  const first = data[0].netWorth;
  const latest = data[data.length - 1].netWorth;
  const change = latest - first;
  return { latest, change, percent: first > 0 ? (change / first) * 100 : null };
}

export function formatChange(change: number, percent: number | null): string {
  const sign = change > 0 ? '+' : '';
  const pct =
    percent === null ? '' : ` (${sign}${percent.toFixed(Math.abs(percent) < 10 ? 1 : 0)}%)`;
  return `${sign}${formatCurrency(change)}${pct}`;
}

const INFINITE = Number.POSITIVE_INFINITY;
const labelFor = (labels: Map<string, string>) => (k: string) => labels.get(k) ?? k;

/**
 * Net worth and assets as lines on an axis zoomed to their range, so growth reads at a glance,
 * with liabilities in a strip below on their own $0-based scale (on the zoomed axis they would
 * pull it back down to $0). Hovering either shows all three. `headline` adds the latest value
 * and the period change on top (the full view shows those as stat cards instead).
 */
export function NetWorthChart({
  from,
  to,
  headline,
}: {
  from: string;
  to: string;
  headline?: boolean;
}) {
  const { data = [], isLoading } = useNetWorthSeries(from, to);
  const dateLabels = useMemo(() => formatDateAxisLabels(data.map((d) => d.month)), [data]);
  const labels = useMemo(
    () => new Map(data.map((d, i) => [d.month, dateLabels[i]] as [string, string])),
    [data, dateLabels],
  );
  const yAxis = useMemo(() => valueAxis(data.flatMap((d) => [d.assets, d.netWorth])), [data]);
  const debtMax = useMemo(() => Math.max(0, ...data.map((d) => d.liabilities)), [data]);
  const debtTop =
    debtMax > 0 ? Math.ceil(debtMax / niceStep(debtMax, 2)) * niceStep(debtMax, 2) : 0;
  const summary = useMemo(() => netWorthChange(data), [data]);
  const showDebt = debtMax > 0;

  const main = useMemo(
    () =>
      defineChart({
        marks: [
          decorative(
            areaY(data, {
              x: 'month',
              y1: yAxis.domain[0],
              y2: 'netWorth',
              fill: 'url(#gNet)',
              fillOpacity: 1,
              curve: smooth,
            }),
          ),
          lineY(data, {
            x: 'month',
            y: 'assets',
            z: () => 'Assets',
            stroke: chartColors.positiveLight,
            strokeWidth: 2,
            curve: smooth,
          }),
          lineY(data, {
            x: 'month',
            y: 'netWorth',
            z: () => 'Net worth',
            stroke: chartColors.brand,
            strokeWidth: 2.5,
            curve: smooth,
            points: data.length <= 24,
          }),
        ],
        scales: {
          x: showDebt ? { ...pointScale(), axis: false } : pointScale(labelFor(labels)),
          y: {
            ...valueScale(),
            scale: scaleLinear().domain(yAxis.domain),
            nice: false,
            axis: { line: false, ticks: { size: 0, values: yAxis.ticks, format: formatCentsAxis } },
          },
        },
        gradients: [areaGradient('gNet', chartColors.brand)],
        focus: 'group-x',
        maxFocusDistance: INFINITE,
        tooltip: {
          use: tooltip,
          content: (points: readonly ChartPoint[]): ChartTooltipContent => {
            const d = points[0]?.datum as NetWorthPoint | undefined;
            if (!d) return { rows: [] };
            return {
              title: formatDateLabel(d.month),
              rows: [
                { label: 'Net worth', value: formatCurrency(d.netWorth), color: chartColors.brand },
                {
                  label: 'Assets',
                  value: formatCurrency(d.assets),
                  color: chartColors.positiveLight,
                },
                {
                  label: 'Liabilities',
                  value: formatCurrency(d.liabilities),
                  color: chartColors.negativeLight,
                },
              ],
            };
          },
        },
      }),
    [data, yAxis, labels, showDebt],
  );

  const debt = useMemo(
    () =>
      defineChart({
        marks: [
          decorative(
            areaY(data, {
              x: 'month',
              y: 'liabilities',
              fill: chartColors.negativeLight,
              fillOpacity: 0.15,
              curve: smooth,
            }),
          ),
          lineY(data, {
            x: 'month',
            y: 'liabilities',
            z: () => 'Liabilities',
            stroke: chartColors.negativeLight,
            strokeWidth: 2,
            curve: smooth,
          }),
        ],
        scales: {
          x: pointScale(labelFor(labels)),
          y: {
            ...valueScale(),
            scale: scaleLinear().domain([0, debtTop]),
            nice: false,
            axis: {
              line: false,
              ticks: { size: 0, values: [0, debtTop], format: formatCentsAxis },
            },
          },
        },
        focus: 'group-x',
        maxFocusDistance: INFINITE,
        tooltip: {
          use: tooltip,
          content: (points: readonly ChartPoint[]): ChartTooltipContent => {
            const d = points[0]?.datum as NetWorthPoint | undefined;
            return d
              ? {
                  title: formatDateLabel(d.month),
                  rows: [
                    {
                      label: 'Liabilities',
                      value: formatCurrency(d.liabilities),
                      color: chartColors.negativeLight,
                    },
                  ],
                }
              : { rows: [] };
          },
        },
      }),
    [data, labels, debtTop],
  );

  if (isLoading) return <ChartSkeleton />;
  const hasData =
    data.length > 0 && data.some((d) => d.assets !== 0 || d.liabilities !== 0 || d.netWorth !== 0);
  if (!hasData) return <EmptyState />;

  const trend = summary && summary.change < 0 ? chartColors.negative : chartColors.positive;

  return (
    <div className="w-full h-full flex flex-col">
      {headline && summary && (
        <div className="flex items-baseline gap-2 flex-wrap px-1 pb-1">
          <span className="text-xl font-semibold text-text tabular-nums">
            {formatCurrency(summary.latest)}
          </span>
          {data.length > 1 && (
            <span className="text-sm font-medium tabular-nums" style={{ color: trend }}>
              {summary.change >= 0 ? '▲' : '▼'} {formatChange(summary.change, summary.percent)}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap px-1 pb-1 text-2xs text-text-secondary">
        <LegendKey color={chartColors.brand} label="Net worth" line />
        <LegendKey color={chartColors.positiveLight} label="Assets" line />
        {showDebt && <LegendKey color={chartColors.negativeLight} label="Liabilities" />}
      </div>

      <div className="flex-[3] min-h-0">
        <FillChart definition={main} ariaLabel="Net worth and assets over time" />
      </div>

      {showDebt && (
        <div className="flex-1 min-h-[72px] max-h-[140px] mt-1 pt-1 border-t border-border-light">
          <FillChart definition={debt} ariaLabel="Liabilities over time" />
        </div>
      )}
    </div>
  );
}

export function IncomeExpensesChart({ from, to }: { from: string; to: string }) {
  const { data = [], isLoading } = useIncomeVsExpenses(from, to);
  const chartData = useMemo(() => data.map((d) => ({ ...d, month: monthLabel(d.month) })), [data]);

  const rows = useMemo(
    () =>
      chartData.flatMap((d) => [
        { month: d.month, series: 'Income', value: d.income, net: d.net },
        { month: d.month, series: 'Expenses', value: d.expenses, net: d.net },
      ]),
    [chartData],
  );

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          barY(rows, {
            x: 'month',
            y: 'value',
            z: 'series',
            layout: group({ padding: 0.12 }),
            fill: (d) => (d.series === 'Income' ? chartColors.positive : chartColors.negativeLight),
            radius: [4, 4, 0, 0],
            maxThickness: 24,
          }),
        ],
        scales: { x: bandScale(), y: valueScale() },
        focus: 'group-x',
        maxFocusDistance: INFINITE,
        tooltip: currencyTooltip({
          colors: { Income: chartColors.positive, Expenses: chartColors.negativeLight },
          summary: (points) => {
            const row = (points[0] as any)?.datum as { net: number } | undefined;
            return row ? { label: 'Net', value: row.net } : null;
          },
        }),
      }),
    [rows],
  );

  if (isLoading) return <ChartSkeleton />;
  const hasData = chartData.length > 0 && data.some((d) => d.income !== 0 || d.expenses !== 0);
  if (!hasData) return <EmptyState />;

  return <FillChart definition={definition} ariaLabel="Income and expenses by month" />;
}

export function SpendingChart({ from, to }: { from: string; to: string }) {
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const { data = [], isLoading } = useSpendingByCategory(from, to);
  const chartData = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10)
        .map((d, i) => {
          const full = d.categoryName ?? 'Uncategorised';
          return {
            name: full.length > 22 ? full.slice(0, 21) + '…' : full,
            fullName: full,
            value: d.totalSpent,
            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          };
        }),
    [data, showCategoryIcons],
  );
  // Shares are of all spending, not just the ten categories drawn
  const total = useMemo(() => data.reduce((s, d) => s + d.totalSpent, 0), [data]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          barX(chartData, {
            x: 'value',
            y: 'name',
            fill: (d) => d.color,
            radius: [0, 4, 4, 0],
            maxThickness: 18,
            inset: 1,
          }),
        ],
        scales: {
          x: {
            ...valueScale(),
            axis: { line: false, ticks: { size: 0, count: 4, format: formatCentsAxis } },
          },
          y: { ...bandScale(undefined, 0.3), grid: false },
        },
        focus: 'nearest-y',
        maxFocusDistance: INFINITE,
        tooltip: {
          use: tooltip,
          content: (points: readonly ChartPoint[]): ChartTooltipContent => {
            const d = points[0]?.datum as (typeof chartData)[number] | undefined;
            if (!d) return { rows: [] };
            const share = total > 0 ? ` · ${((d.value / total) * 100).toFixed(1)}%` : '';
            return {
              title: d.fullName,
              color: d.color,
              rows: [
                { label: 'Spent', value: `${formatCurrency(d.value)}${share}`, color: d.color },
              ],
            };
          },
        },
      }),
    [chartData, total],
  );

  if (isLoading) return <ChartSkeleton />;
  if (!chartData.length) return <EmptyState />;

  return <FillChart definition={definition} ariaLabel="Spending by category" />;
}

/** Summary's full view: expenses (net of refunds) per month against the monthly average. */
export function MonthlySpendingChart({ from, to }: { from: string; to: string }) {
  const { data = [], isLoading } = useIncomeVsExpenses(from, to);
  const chartData = useMemo(
    () => data.map((d) => ({ month: monthLabel(d.month), spending: -d.expenseNet })),
    [data],
  );
  const average = chartData.length
    ? chartData.reduce((s, d) => s + d.spending, 0) / chartData.length
    : 0;

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          barY(chartData, {
            x: 'month',
            y: 'spending',
            z: () => 'Expenses',
            fill: chartColors.negativeLight,
            radius: [4, 4, 0, 0],
            maxThickness: 36,
            inset: 1,
          }),
          ...(chartData.length > 1
            ? [
                decorative(
                  ruleY([average], {
                    stroke: chartColors.label,
                    strokeDasharray: '4 4',
                    strokeOpacity: 0.8,
                  }),
                ),
              ]
            : []),
        ],
        scales: { x: bandScale(), y: valueScale() },
        focus: 'nearest-x',
        maxFocusDistance: INFINITE,
        tooltip: currencyTooltip({
          colors: { Expenses: chartColors.negativeLight },
          summary: () => ({ label: 'Monthly average', value: average }),
        }),
      }),
    [chartData, average],
  );

  if (isLoading) return <ChartSkeleton />;
  if (!chartData.some((d) => d.spending !== 0)) return <EmptyState />;

  return (
    <div className="w-full h-full flex flex-col">
      {chartData.length > 1 && (
        <p className="text-2xs text-text-tertiary px-1 pb-1 shrink-0">
          Dashed line: monthly average {formatCurrency(Math.round(average))}
        </p>
      )}
      <div className="flex-1 min-h-0">
        <FillChart definition={definition} ariaLabel="Monthly spending against the average" />
      </div>
    </div>
  );
}

/** How a category is named in charts and tables: its icon (when shown) and name. */
export function categoryLabel(
  c: { name?: string | null; icon?: string | null } | undefined,
  /** Kept for callers: chart labels are text, so they never carry an icon */
  _showIcons: boolean,
  fallback = 'Uncategorised',
) {
  if (!c?.name) return fallback;
  // Chart labels are text: icons (the app's line icons, never emoji) only appear in lists
  return c.name;
}

/**
 * Spending in each of `categoryIds` over the range, one line per category in EXPENSE_COLORS
 * order. A single month shows each category's running total by day; longer ranges, totals by
 * month.
 */
export function SpendingTrendsChart({
  from,
  to,
  categoryIds,
  caption,
}: {
  from: string;
  to: string;
  categoryIds: string[];
  /** A short note above the chart (e.g. which categories these are) */
  caption?: string;
}) {
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const { data: groups = [] } = useCategories();
  const daily = monthCount(from, to) === 1;
  const { data: trendData = [], isLoading } = useSpendingTrends(
    categoryIds,
    from,
    to,
    daily ? 'daily' : undefined,
  );

  // Series are keyed by id, so two categories with the same name stay apart
  const names = useMemo(() => {
    const byId = new Map(groups.flatMap((g) => g.categories).map((c) => [c.id, c]));
    return categoryIds.map((id) =>
      categoryLabel(byId.get(id), showCategoryIcons, 'Deleted category'),
    );
  }, [groups, categoryIds, showCategoryIcons]);

  const chartData = useMemo(() => {
    if (!trendData.length) return [];
    const byPeriod = new Map<string, Record<string, number>>();
    for (const p of trendData) {
      const row = byPeriod.get(p.month) ?? {};
      row[p.categoryId] = (row[p.categoryId] ?? 0) + p.total;
      byPeriod.set(p.month, row);
    }
    const zero = () => Object.fromEntries(categoryIds.map((id) => [id, 0]));

    if (daily) {
      const { from: first, to: last } = dayBounds(from, to);
      if (last < first) return [];
      const running: Record<string, number> = zero();
      return eachDayOfInterval({ start: parseISO(first), end: parseISO(last) }).map((d) => {
        const day = format(d, 'yyyy-MM-dd');
        for (const [k, v] of Object.entries(byPeriod.get(day) ?? {})) running[k] += v;
        return { month: day, ...running };
      });
    }
    // Every month from the first with spending, so a month with none shows as $0, not a gap
    const firstMonth = [...byPeriod.keys()].sort()[0];
    return monthsBetween(firstMonth > from ? firstMonth : from, to).map((month) => ({
      month: monthLabel(month),
      ...zero(),
      ...byPeriod.get(month),
    }));
  }, [trendData, categoryIds, daily, from, to]);

  const single = chartData.length === 1;
  const axisLabels = useMemo(() => {
    const keys = chartData.map((d) => String(d.month));
    const out = daily ? formatDateAxisLabels(keys) : keys;
    return new Map(keys.map((k, i) => [k, out[i]] as [string, string]));
  }, [chartData, daily]);

  const definition = useMemo(() => {
    const colors: Record<string, string> = {};
    categoryIds.forEach((_, i) => (colors[names[i]] = EXPENSE_COLORS[i % EXPENSE_COLORS.length]));
    const marks = single
      ? [
          barY(
            categoryIds.map((id, i) => ({
              month: String(chartData[0].month),
              series: names[i],
              value: Number((chartData[0] as Record<string, unknown>)[id] ?? 0),
            })),
            {
              x: 'month',
              y: 'value',
              z: 'series',
              layout: group({ padding: 0.12 }),
              fill: (d) => colors[d.series],
              radius: [4, 4, 0, 0],
              maxThickness: 32,
            },
          ),
        ]
      : categoryIds.map((id, i) => {
          const color = EXPENSE_COLORS[i % EXPENSE_COLORS.length];
          return lineY(chartData, {
            x: 'month',
            y: (d) => Number((d as Record<string, unknown>)[id] ?? 0),
            z: () => names[i],
            stroke: color,
            strokeWidth: 2,
            curve: daily ? stepAfter : smooth,
          });
        });
    return defineChart({
      marks,
      scales: {
        x: single ? bandScale(labelFor(axisLabels)) : pointScale(labelFor(axisLabels)),
        y: valueScale(),
      },
      focus: 'group-x',
      maxFocusDistance: INFINITE,
      tooltip: currencyTooltip({
        colors,
        title: (x) => (daily ? formatDateLabel(x) : x),
        summary: (points) => {
          if (points.length < 2) return null;
          return {
            label: 'Total',
            value: points.reduce((s, p) => s + (Number(p.yValue) || 0), 0),
          };
        },
      }),
    });
  }, [chartData, categoryIds, names, single, daily, axisLabels]);

  if (isLoading) return <ChartSkeleton />;
  if (!categoryIds.length || !chartData.length) return <EmptyState />;

  return (
    <div className="h-full flex flex-col">
      {(caption || daily) && (
        <p className="text-2xs text-text-tertiary px-1 pb-1 shrink-0">
          {caption ? `${caption}${daily ? ' · running total' : ''}` : 'Running total this month'}
        </p>
      )}
      <div className="flex items-center gap-3 flex-wrap px-1 pb-1 text-2xs text-text-secondary shrink-0">
        {categoryIds.map((id, i) => (
          <LegendKey
            key={id}
            color={EXPENSE_COLORS[i % EXPENSE_COLORS.length]}
            label={names[i]}
            line={!single}
          />
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <FillChart definition={definition} ariaLabel="Spending trends by category" />
      </div>
    </div>
  );
}
