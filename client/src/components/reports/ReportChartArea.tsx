import { useMemo } from 'react';
import { areaY, barY, defineChart, group, lineY } from '@tanstack/charts';
import type { ChartPoint } from '@tanstack/charts';
import { pie, polar, radialArc } from '@tanstack/charts/polar';
import { decorative } from '@tanstack/charts/mark/decorative';
import { tooltip } from '@tanstack/charts/tooltip';
import type { ChartTooltipContent } from '@tanstack/charts/tooltip';
import { formatCurrency } from '../../utils/currency';
import { chartColors } from '../../utils/chartColors';
import { ChartSkeleton, EmptyState, EXPENSE_COLORS, monthLabel } from './ChartHelpers';
import ReportTable, { type FollowLink } from './ReportTable';
import { FillChart } from '../charts/FillChart';
import { LegendKey } from '../charts/ChartLegend';
import {
  areaGradient,
  bandScale,
  currencyTooltip,
  pointScale,
  smooth,
  valueScale,
} from '../charts/kit';
import type { CustomReportConfig, CustomReportData } from '../../types';

const INFINITE = Number.POSITIVE_INFINITY;

interface Props {
  config: CustomReportConfig;
  data: CustomReportData | undefined;
  isLoading: boolean;
  /** The settings `data` came from, for the table's links (default `config`) */
  linkConfig?: CustomReportConfig;
  onFollowLink?: FollowLink;
}

export default function ReportChartArea({
  config,
  data,
  isLoading,
  linkConfig = config,
  onFollowLink,
}: Props) {
  if (isLoading)
    return (
      <div className="h-full">
        <ChartSkeleton />
      </div>
    );
  if (!data)
    return (
      <div className="h-full">
        <EmptyState />
      </div>
    );

  if (config.chartType === 'table')
    return <ReportTable data={data} config={linkConfig} onFollowLink={onFollowLink} />;
  if (config.chartType === 'donut' && data.mode === 'total') return <DonutView data={data} />;
  if (data.mode === 'total') return <TotalChartView config={config} data={data} />;
  return <TimeChartView config={config} data={data} />;
}

/** Totals as positive amounts, each with the color its slice or bar is drawn in. */
function withColors(rows: Extract<CustomReportData, { mode: 'total' }>['data']) {
  return rows.map((d, i) => ({
    ...d,
    value: Math.abs(d.value),
    color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
  }));
}

function DonutView({ data }: { data: Extract<CustomReportData, { mode: 'total' }> }) {
  const chartData = useMemo(() => withColors(data.data), [data]);
  const total = useMemo(() => chartData.reduce((s, d) => s + d.value, 0), [chartData]);

  const definition = useMemo(() => {
    const slices = pie(chartData, { value: 'value' });
    return defineChart({
      marks: [
        polar({
          inset: 8,
          radiusRatio: 0.86,
          marks: [
            radialArc(slices, {
              innerRadius: ({ radius }) => radius * 0.62,
              cornerRadius: 4,
              padAngle: () => 0.02,
              color: 'name',
              key: 'name',
            }),
          ],
          scales: { angle: null, radius: null },
        }),
      ],
      scales: { x: null, y: null },
      color: {
        domain: chartData.map((d) => d.name),
        range: chartData.map((d) => d.color),
      },
      tooltip: {
        use: tooltip,
        content: (points: readonly ChartPoint[]): ChartTooltipContent => {
          const d = points[0]?.datum as { name: string; value: number; color: string } | undefined;
          if (!d) return { rows: [] };
          const share = total > 0 ? ` · ${((d.value / total) * 100).toFixed(1)}%` : '';
          return {
            title: d.name,
            rows: [
              { label: 'Amount', value: `${formatCurrency(d.value)}${share}`, color: d.color },
            ],
          };
        },
      },
    });
  }, [chartData, total]);

  if (!chartData.length) return <EmptyState />;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <FillChart definition={definition} ariaLabel="Share of the total by group" />
      </div>
      <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap pt-2 text-xs text-text-secondary shrink-0">
        {chartData.map((d) => (
          <LegendKey key={d.name} color={d.color} label={d.name} />
        ))}
      </div>
    </div>
  );
}

/** A line or area needs two points; with only one, draw bars so the value is still readable. */
function singlePointType(type: CustomReportConfig['chartType'], points: number) {
  return points === 1 && (type === 'line' || type === 'area') ? 'bar' : type;
}

function TotalChartView({
  config,
  data,
}: {
  config: CustomReportConfig;
  data: Extract<CustomReportData, { mode: 'total' }>;
}) {
  const chartData = useMemo(() => withColors(data.data), [data]);
  const total = useMemo(() => chartData.reduce((s, d) => s + d.value, 0), [chartData]);
  const chartType = singlePointType(config.chartType, chartData.length);
  // Month groups arrive as "2025-06"; show them like the other charts ("Jun 25"). Checking the
  // format, not just groupBy, because data from the previous grouping can still be showing
  const byMonth = chartData.length > 0 && chartData.every((d) => /^\d{4}-\d{2}$/.test(d.name));
  const label = (name: string) => (byMonth ? monthLabel(name) : name);

  const definition = useMemo(() => {
    const line = chartType === 'line' || chartType === 'area';
    const marks = [
      ...(chartType === 'area'
        ? [
            decorative(
              areaY(chartData, {
                x: 'name',
                y: 'value',
                fill: 'url(#gTotal)',
                fillOpacity: 1,
                curve: smooth,
              }),
            ),
          ]
        : []),
      ...(line
        ? [
            lineY(chartData, {
              x: 'name',
              y: 'value',
              z: () => 'Amount',
              stroke: chartColors.brand,
              strokeWidth: 2,
              curve: smooth,
              points: true,
            }),
          ]
        : [
            barY(chartData, {
              x: 'name',
              y: 'value',
              fill: (d) => d.color,
              radius: [4, 4, 0, 0],
              maxThickness: 44,
              inset: 1,
            }),
          ]),
    ];
    return defineChart({
      marks,
      scales: {
        x: line ? pointScale(label) : bandScale(label),
        y: valueScale(),
      },
      gradients: [areaGradient('gTotal', chartColors.brand)],
      focus: 'nearest-x',
      maxFocusDistance: INFINITE,
      tooltip: {
        use: tooltip,
        content: (points: readonly ChartPoint[]): ChartTooltipContent => {
          const d = points[0]?.datum as (typeof chartData)[number] | undefined;
          if (!d) return { rows: [] };
          const share = total > 0 ? ` · ${((d.value / total) * 100).toFixed(1)}%` : '';
          return {
            title: label(d.name),
            rows: [
              {
                label: 'Amount',
                value: `${formatCurrency(d.value)}${share}`,
                color: chartType === 'bar' ? d.color : chartColors.brand,
              },
            ],
          };
        },
      },
    });
    // `label` only reads byMonth
  }, [chartData, chartType, total, byMonth]);

  if (!chartData.length) return <EmptyState />;

  return <FillChart definition={definition} ariaLabel="Report totals" />;
}

function TimeChartView({
  config,
  data,
}: {
  config: CustomReportConfig;
  data: Extract<CustomReportData, { mode: 'time' }>;
}) {
  const chartData = useMemo(
    () => data.data.map((d) => ({ ...d, month: monthLabel(d.month as string) })),
    [data],
  );
  const chartType = singlePointType(config.chartType, chartData.length);
  const groups = data.groups;

  const definition = useMemo(() => {
    const colors: Record<string, string> = {};
    groups.forEach((g, i) => (colors[g] = EXPENSE_COLORS[i % EXPENSE_COLORS.length]));
    const value = (g: string) => (d: Record<string, unknown>) => Number(d[g] ?? 0);

    // Wide rows (one column per group) become one row per group and month for stacked and grouped bars
    const long = chartData.flatMap((d) =>
      groups.map((g) => ({
        month: String(d.month),
        group: g,
        value: Number((d as Record<string, unknown>)[g] ?? 0),
      })),
    );

    const marks =
      chartType === 'stacked-bar'
        ? [
            barY(long, {
              x: 'month',
              y: 'value',
              z: 'group',
              fill: (d) => colors[d.group],
              maxThickness: 44,
              inset: 1,
            }),
          ]
        : chartType === 'bar'
          ? [
              barY(long, {
                x: 'month',
                y: 'value',
                z: 'group',
                layout: group({ padding: 0.1 }),
                fill: (d) => colors[d.group],
                radius: [3, 3, 0, 0],
                maxThickness: 28,
              }),
            ]
          : groups.flatMap((g) => [
              ...(chartType === 'area'
                ? [
                    decorative(
                      areaY(chartData, {
                        x: 'month',
                        y: value(g),
                        fill: colors[g],
                        fillOpacity: 0.1,
                        curve: smooth,
                      }),
                    ),
                  ]
                : []),
              lineY(chartData, {
                x: 'month',
                y: value(g),
                z: () => g,
                stroke: colors[g],
                strokeWidth: 2,
                curve: smooth,
                points: true,
              }),
            ]);

    const line = chartType === 'line' || chartType === 'area';
    return defineChart({
      marks,
      scales: { x: line ? pointScale() : bandScale(), y: valueScale() },
      focus: 'group-x',
      maxFocusDistance: INFINITE,
      tooltip: currencyTooltip({
        colors,
        hideZero: chartType === 'stacked-bar',
        summary: (points) =>
          points.length > 1
            ? { label: 'Total', value: points.reduce((s, p) => s + (Number(p.yValue) || 0), 0) }
            : null,
      }),
    });
  }, [chartData, chartType, groups]);

  if (!chartData.length) return <EmptyState />;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 flex-wrap px-1 pb-1 text-2xs text-text-secondary shrink-0">
        {groups.map((g, i) => (
          <LegendKey
            key={g}
            color={EXPENSE_COLORS[i % EXPENSE_COLORS.length]}
            label={g}
            line={chartType === 'line' || chartType === 'area'}
          />
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <FillChart definition={definition} ariaLabel="Report over time" />
      </div>
    </div>
  );
}
