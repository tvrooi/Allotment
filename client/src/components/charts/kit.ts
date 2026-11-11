import type { ChartPoint, ChartTooltipContentContext } from '@tanstack/charts';
import type { ChartTooltipContent } from '@tanstack/charts/tooltip';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';
import { d3Curve } from '@tanstack/charts/d3/shape';
import { curveMonotoneX, curveStepAfter } from 'd3-shape';
import { formatCentsAxis, formatCurrency } from '../../utils/currency';

/** Class every chart sits in: palette, tooltip chrome and axis text come from index.css. */
export const CHART_CLASS = 'allotment-chart';

/** Soft gradient under an area, from the series colour down to nothing (shadcn area style). */
export function areaGradient(id: string, color: string, top = 0.28) {
  return {
    id,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: [
      { offset: 0, color, opacity: top },
      { offset: 1, color, opacity: 0.02 },
    ],
  };
}

export const smooth = d3Curve(curveMonotoneX);
export const stepAfter = d3Curve(curveStepAfter);

/** Light horizontal gridlines only, no axis line or tick stubs: the shadcn look. */
const quietAxis = { line: false, ticks: { size: 0 } } as const;

export function valueScale(opts: { nice?: boolean | number; format?: (v: number) => string } = {}) {
  const { nice = true, format = formatCentsAxis } = opts;
  return {
    scale: scaleLinear,
    nice,
    grid: true,
    axis: { ...quietAxis, ticks: { size: 0, count: 5, format: (v: number) => format(v) } },
  };
}

/** `minGap`: least pixels between tick labels, for dense axes (days, months of a long range) */
export function pointScale(format?: (v: string) => string, minGap?: number) {
  return {
    scale: () => scalePoint<string>().padding(0.3),
    axis: {
      ...quietAxis,
      ticks: { size: 0, ...(format ? { format } : {}) },
      ...(minGap ? { tickLabels: { thin: { minGap, priority: 'ends' as const } } } : {}),
    },
  };
}

export function bandScale(format?: (v: string) => string, padding = 0.28) {
  return {
    scale: () => scaleBand<string>().padding(padding),
    axis: { ...quietAxis, ticks: { size: 0, ...(format ? { format } : {}) } },
  };
}

/** What the tooltip reads of a hovered point (a full ChartPoint satisfies it) */
export type TooltipPoint = Pick<ChartPoint, 'groupLabel' | 'xValue' | 'yValue'> &
  Partial<Pick<ChartPoint, 'color' | 'datum'>>;

/** Tooltip showing one currency row per series, with an optional bold summary line. */
export function currencyTooltip(opts: {
  title?: (xLabel: string) => string;
  summary?: (points: readonly TooltipPoint[]) => { label: string; value: number } | null;
  hideZero?: boolean;
  format?: (v: number) => string;
  /** Series colours by name, when a series is not drawn in its default palette colour */
  colors?: Record<string, string>;
}) {
  const fmt = opts.format ?? formatCurrency;
  return {
    use: tooltip,
    content: (
      points: readonly TooltipPoint[],
      ctx: Pick<ChartTooltipContentContext, 'formatX'>,
    ) => {
      const first = points[0];
      const rows = points
        .filter((p) => !opts.hideZero || Number(p.yValue) !== 0)
        .map((p) => ({
          label: String(p.groupLabel ?? ''),
          value: fmt(Number(p.yValue)),
          color: opts.colors?.[String(p.groupLabel)] ?? p.color,
        }));
      const extra = opts.summary?.(points);
      if (extra) rows.push({ label: extra.label, value: fmt(extra.value), color: undefined });
      const content: ChartTooltipContent = {
        title: first
          ? opts.title
            ? opts.title(ctx.formatX(first.xValue))
            : ctx.formatX(first.xValue)
          : '',
        rows,
      };
      return content;
    },
  };
}
