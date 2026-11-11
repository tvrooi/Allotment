import { useMemo } from 'react';
import { defineChart, lineY } from '@tanstack/charts';
import type { ChartMark, ChartPoint } from '@tanstack/charts';
import { dot } from '@tanstack/charts/dot';
import { decorative } from '@tanstack/charts/mark/decorative';
import { ruleX, ruleY } from '@tanstack/charts/rule';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { text } from '@tanstack/charts/text';
import { tooltip } from '@tanstack/charts/tooltip';
import type { ChartTooltipContent } from '@tanstack/charts/tooltip';
import { FillChart } from '../charts/FillChart';
import { LegendKey } from '../charts/ChartLegend';
import { smooth, valueScale } from '../charts/kit';
import type { Comparison, PlanEvent, YearResult } from '../../api/longTerm';
import { chartColors } from '../../utils/chartColors';
import { formatCurrency } from '../../utils/currency';
import { eventYear, inDollars, kindLabel, type Dollars } from '../../utils/longTerm';

/** Where a plan year's closing balance sits on the x axis: today, then one year further on each */
export const pointYear = (y: YearResult, startYear: number) => startYear + y.index;

interface Row {
  year: number;
  age: number;
  index: number;
  label: string;
  active: number;
  /** Cash, investments and released super, less unfunded spending */
  accessible: number;
  /** Super still locked by preservation */
  preserved: number;
  reference?: number;
}

// Round-capped near-zero dashes draw a dotted line
const DOTTED = '0.1 5';

const GLYPH: Record<PlanEvent['kind'], string> = {
  home: 'H',
  newJob: 'J',
  careerBreak: 'B',
  child: 'C',
  oneOff: '$',
  recurring: 'R',
  retirement: '★',
  payOff: 'L',
};

/**
 * Net worth at the end of each plan year, with a marker on the line for each life event, and
 * (when comparing) the reference plan as a dashed second line. Clicking a point picks that
 * year for the breakdown below; the year selector does the same without a pointer.
 */
export function NetWorthChart({
  years,
  startYear,
  mode,
  events,
  birthYear,
  comparison,
  referenceName,
  activeName,
  selected,
  onSelect,
}: {
  years: YearResult[];
  startYear: number;
  mode: Dollars;
  events: PlanEvent[];
  birthYear: number;
  comparison?: Comparison;
  activeName: string;
  referenceName?: string;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const rows = useMemo<Row[]>(
    () =>
      years.map((y, i) => {
        const ref = comparison?.series[i];
        return {
          year: pointYear(y, startYear),
          age: y.age + (y.index === 0 ? 0 : 1),
          index: y.index,
          label:
            y.index === 0
              ? 'Today'
              : `In ${y.index} year${y.index === 1 ? '' : 's'} (${startYear + y.index})`,
          active: inDollars(y.closingNetWorth, y.inflationIndexPpb, mode),
          accessible: inDollars(y.wealth.accessible, y.inflationIndexPpb, mode),
          preserved: inDollars(y.wealth.preserved, y.inflationIndexPpb, mode),
          // Already in the chosen dollars: the server deflated each plan at its own inflation
          reference: ref?.reference,
        };
      }),
    [years, startYear, mode, comparison],
  );
  const markers = useMemo(
    () =>
      events
        .filter((e) => e.enabled)
        .map((e) => ({ e, year: eventYear(e.start, birthYear) }))
        .map(({ e, year }) => ({ e, row: rows.find((r) => r.year === year) }))
        .filter((m): m is { e: PlanEvent; row: Row } => m.row !== undefined),
    [events, rows, birthYear],
  );
  const selectedRow = useMemo(() => rows.find((r) => r.index === selected), [rows, selected]);
  // Without a comparison, show when the money can be spent: accessible now beside preserved super
  const split = !comparison && rows.some((r) => r.preserved !== 0);

  const ACCESSIBLE = 'Accessible (cash, investments, released super)';
  const definition = useMemo(() => {
    const colors: Record<string, string> = {
      [activeName]: chartColors.brand,
      [ACCESSIBLE]: chartColors.positive,
      'Preserved super': chartColors.caution,
      [referenceName ?? 'Reference']: chartColors.caution,
    };
    // Data lines lead, so the year axis takes its range from them rather than a lone rule
    const marks: ChartMark[] = [
      lineY(rows, {
        x: 'year',
        y: 'active',
        z: () => activeName,
        stroke: chartColors.brand,
        strokeWidth: 2.5,
        curve: smooth,
      }),
      ...(split
        ? [
            lineY(rows, {
              x: 'year',
              y: 'accessible',
              z: () => ACCESSIBLE,
              stroke: chartColors.positive,
              strokeWidth: 3,
              strokeDasharray: DOTTED,
              curve: smooth,
            }),
            lineY(rows, {
              x: 'year',
              y: 'preserved',
              z: () => 'Preserved super',
              stroke: chartColors.caution,
              strokeWidth: 3,
              strokeDasharray: DOTTED,
              curve: smooth,
            }),
          ]
        : []),
      ...(comparison
        ? [
            lineY(rows, {
              x: 'year',
              y: 'reference',
              z: () => referenceName ?? 'Reference',
              stroke: chartColors.caution,
              strokeWidth: 2,
              strokeDasharray: '6 4',
              curve: smooth,
            }),
          ]
        : []),
      decorative(ruleY([0], { stroke: chartColors.axis, strokeOpacity: 0.4 })),
      ...(selectedRow
        ? [
            decorative(
              ruleX([selectedRow.year], {
                stroke: chartColors.brand,
                strokeDasharray: '2 2',
              }),
            ),
          ]
        : []),
      // The ring where the forecasts leave from: today's net worth
      decorative(
        dot([rows[0]], {
          x: 'year',
          y: 'active',
          r: 5,
          fill: 'var(--color-surface, #fff)',
          stroke: chartColors.brand,
          strokeWidth: 2.5,
        }),
      ),
      ...(markers.length
        ? [
            decorative(
              dot(
                markers.map(({ e, row }) => ({
                  glyph: GLYPH[e.kind],
                  year: row.year,
                  y: row.active,
                })),
                {
                  x: 'year',
                  y: 'y',
                  r: 9,
                  fill: chartColors.brand,
                  stroke: 'var(--color-surface, #fff)',
                  strokeWidth: 2,
                },
              ),
            ),
            decorative(
              text(
                markers.map(({ e, row }) => ({
                  glyph: GLYPH[e.kind],
                  year: row.year,
                  y: row.active,
                })),
                { x: 'year', y: 'y', text: 'glyph', fill: '#fff', fontSize: 10, fontWeight: 700 },
              ),
            ),
          ]
        : []),
    ];
    return defineChart({
      marks,
      scales: {
        x: {
          scale: scaleLinear,
          axis: {
            line: false,
            ticks: { size: 0, count: 8, format: (v: number) => String(Math.round(v)) },
          },
        },
        y: valueScale(),
      },
      focus: 'nearest-x',
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: {
        use: tooltip,
        content: (points: readonly ChartPoint[]): ChartTooltipContent => {
          const row = points[0]?.datum as Row | undefined;
          if (!row) return { rows: [] };
          return {
            title: `${row.label} · age ${row.age}`,
            rows: points.map((p) => ({
              label: p.groupLabel,
              value: formatCurrency(Number(p.yValue)),
              color: colors[p.groupLabel],
            })),
          };
        },
      },
    });
  }, [rows, markers, selectedRow, split, comparison, activeName, referenceName]);

  return (
    <div>
      {(comparison || split) && (
        <div className="flex items-center gap-3 flex-wrap pb-2 text-xs text-text-secondary">
          <LegendKey color={chartColors.brand} label={activeName} line />
          {split && (
            <>
              <LegendKey color={chartColors.positive} label={ACCESSIBLE} line dashed />
              <LegendKey color={chartColors.caution} label="Preserved super" line dashed />
            </>
          )}
          {comparison && (
            <LegendKey
              color={chartColors.caution}
              label={referenceName ?? 'Reference'}
              line
              dashed
            />
          )}
        </div>
      )}
      <div className="h-72 max-md:h-60">
        <FillChart
          definition={definition}
          ariaLabel={`Net worth by year, ${activeName}`}
          onSelect={(point) => {
            const row = point?.datum as Row | undefined;
            if (row && row.index >= 1) onSelect(row.index);
          }}
        />
      </div>
    </div>
  );
}

export const MARKER_GLYPH = GLYPH;
