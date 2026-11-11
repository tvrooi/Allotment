import { Select } from '../ui/Input';
import { DataFeedback, dataUnavailable } from './DataFeedback';
import { useState, useMemo } from 'react';
import { areaY, defineChart, lineY } from '@tanstack/charts';
import type { ChartPoint } from '@tanstack/charts';
import { decorative } from '@tanstack/charts/mark/decorative';
import { tooltip } from '@tanstack/charts/tooltip';
import type { ChartTooltipContent } from '@tanstack/charts/tooltip';
import { useSpendingComparison } from '../../hooks/useReports';
import { formatCurrency } from '../../utils/currency';
import { TrendingDown } from 'lucide-react';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { chartColors } from '../../utils/chartColors';
import { FillChart } from '../charts/FillChart';
import { LegendKey } from '../charts/ChartLegend';
import { areaGradient, pointScale, smooth, valueScale } from '../charts/kit';

type Mode =
  | 'week_vs_last_week'
  | 'month_vs_last_month'
  | 'month_vs_last_year'
  | 'month_vs_average'
  | 'year_vs_last_year';

const MODES: { value: Mode; label: string }[] = [
  { value: 'week_vs_last_week', label: 'This week vs. last week' },
  { value: 'month_vs_last_month', label: 'This month vs. last month' },
  { value: 'month_vs_last_year', label: 'This month vs. last year' },
  { value: 'month_vs_average', label: 'This month vs. average month' },
  { value: 'year_vs_last_year', label: 'This year vs. last year' },
];

export default function SpendingComparison() {
  const [mode, setMode] = useState<Mode>('month_vs_last_month');
  const spendingComparisonQuery = useSpendingComparison(mode);
  const { data } = spendingComparisonQuery;

  const chartData = useMemo(() => {
    if (!data) return [];
    const merged: Record<
      number,
      { day: number; label: string; current?: number; comparison?: number }
    > = {};

    for (let day = 1; day <= data.maxDays; day++) {
      merged[day] = { day, label: `Day ${day}` };
    }

    for (const pt of data.current) {
      if (merged[pt.day]) merged[pt.day].current = pt.cumulative;
    }
    for (const pt of data.comparison) {
      if (merged[pt.day]) merged[pt.day].comparison = pt.cumulative;
    }

    return Object.values(merged).sort((a, b) => a.day - b.day);
  }, [data]);

  const hasData =
    !!data &&
    (data.current.some((p) => p.cumulative !== 0) ||
      data.comparison.some((p) => p.cumulative !== 0));

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          decorative(
            areaY(chartData, {
              x: 'label',
              y: 'current',
              fill: 'url(#gSpendingCur)',
              fillOpacity: 1,
              curve: smooth,
            }),
          ),
          lineY(chartData, {
            x: 'label',
            y: 'comparison',
            z: () => data?.comparisonLabel ?? 'Comparison',
            stroke: chartColors.axis,
            strokeWidth: 2,
            strokeDasharray: '5 4',
            curve: smooth,
          }),
          lineY(chartData, {
            x: 'label',
            y: 'current',
            z: () => data?.currentLabel ?? 'Current',
            stroke: chartColors.brand,
            strokeWidth: 2,
            curve: smooth,
          }),
        ],
        scales: {
          x: pointScale((k) => k.replace('Day ', ''), 14),
          y: valueScale(),
        },
        gradients: [areaGradient('gSpendingCur', chartColors.brand, 0.2)],
        focus: 'group-x',
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip: {
          use: tooltip,
          content: (points: readonly ChartPoint[]): ChartTooltipContent => ({
            title: points[0] ? String(points[0].xValue) : '',
            rows: points.map((p) => ({
              label: p.groupLabel,
              value: formatCurrency(Number(p.yValue)),
              color: p.groupLabel === data?.comparisonLabel ? chartColors.axis : chartColors.brand,
            })),
          }),
        },
      }),
    [chartData, data?.comparisonLabel, data?.currentLabel],
  );

  const sources = [spendingComparisonQuery];
  if (dataUnavailable(sources))
    return <DataFeedback title="Spending comparison" sources={sources} />;

  if (sources.some((q) => q.isLoading) || !data) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="h-5 w-36 bg-surface-alt rounded animate-pulse" />
          <div className="h-8 w-44 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className="h-4 w-28 bg-surface-alt rounded animate-pulse mb-3" />
        <div className="h-48 bg-surface-alt rounded animate-pulse" />
      </Card>
    );
  }

  return (
    <Card>
      <DataFeedback title="Spending comparison" sources={sources} />
      <div className="flex items-start justify-between mb-1 max-md:flex-col max-md:gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text">
            Spending{' '}
            <span className="text-text-secondary font-normal tabular-nums">
              {formatCurrency(data.currentTotal)} {data.periodLabel}
            </span>
          </h2>
        </div>
        <Select
          compact
          aria-label="Compare spending"
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          className="w-auto min-w-0 max-w-[200px] max-md:w-full max-md:max-w-none"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>

      {hasData && chartData.length > 0 ? (
        <div className="mt-2">
          <FillChart definition={definition} height={176} ariaLabel="Spending so far compared" />
          <div
            data-testid="chart-legend"
            className="flex items-center justify-center gap-3 pt-1 text-2xs text-text-secondary"
          >
            <LegendKey color={chartColors.axis} label={data.comparisonLabel} line dashed />
            <LegendKey color={chartColors.brand} label={data.currentLabel} line />
          </div>
        </div>
      ) : (
        <EmptyState
          compact
          icon={<TrendingDown size={20} />}
          title="Nothing to compare yet"
          description="Once you have some spending, this shows how this period compares with the last one."
        />
      )}
    </Card>
  );
}
