import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Comparison, PlanEvent, YearResult } from '../../api/longTerm';
import { chartColors } from '../../utils/chartColors';
import { formatCentsAxis, formatCurrency } from '../../utils/currency';
import { eventYear, inDollars, kindLabel, type Dollars } from '../../utils/longTerm';

/** Where a plan year's closing balance sits on the x axis: today, then one year further on each */
export const pointYear = (y: YearResult, startYear: number) => startYear + y.index;

interface Row {
  year: number;
  age: number;
  index: number;
  label: string;
  active: number;
  reference?: number;
}

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
          // Already in the chosen dollars: the server deflated each plan at its own inflation
          reference: ref?.reference,
        };
      }),
    [years, startYear, mode, comparison],
  );
  const markers = events
    .filter((e) => e.enabled)
    .map((e) => ({ e, year: eventYear(e.start, birthYear) }))
    .map(({ e, year }) => ({ e, row: rows.find((r) => r.year === year) }))
    .filter((m): m is { e: PlanEvent; row: Row } => m.row !== undefined);
  const selectedRow = rows.find((r) => r.index === selected);

  return (
    <div className="h-72 max-md:h-60" role="img" aria-label={`Net worth by year, ${activeName}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={rows}
          margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
          onClick={(state) => {
            const index = (state as { activeTooltipIndex?: number | string }).activeTooltipIndex;
            const row = rows[Number(index)];
            if (row && row.index >= 1) onSelect(row.index);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light, #eee)" />
          <XAxis
            dataKey="year"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 11 }}
            tickCount={8}
          />
          <YAxis tickFormatter={formatCentsAxis} tick={{ fontSize: 11 }} width={64} />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="bg-surface border border-border rounded-md shadow-hover px-3 py-2 text-xs">
                  <p className="text-text-tertiary mb-1">
                    {(payload[0].payload as Row).label} · age {(payload[0].payload as Row).age}
                  </p>
                  {payload.map((p) => (
                    <p key={String(p.name)} className="font-medium" style={{ color: p.color }}>
                      {p.name}: {formatCurrency(Number(p.value))}
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          <ReferenceLine y={0} stroke="var(--color-border, #ccc)" />
          {selectedRow && (
            <ReferenceLine x={selectedRow.year} stroke={chartColors.brand} strokeDasharray="2 2" />
          )}
          <Line
            type="monotone"
            dataKey="active"
            name={activeName}
            stroke={chartColors.brand}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          {comparison && (
            <Line
              type="monotone"
              dataKey="reference"
              name={referenceName ?? 'Reference'}
              stroke={chartColors.caution}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
          {markers.map(({ e, row }) => (
            <ReferenceDot
              key={e.id}
              x={row.year}
              y={row.active}
              r={9}
              fill={chartColors.brand}
              stroke="var(--color-surface, #fff)"
              strokeWidth={2}
              ifOverflow="visible"
              label={{ value: GLYPH[e.kind], fill: '#fff', fontSize: 10, fontWeight: 700 }}
              aria-label={`${kindLabel(e.kind)}: ${e.name}, ${row.year}`}
            />
          ))}
          {comparison && <Legend />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const MARKER_GLYPH = GLYPH;
