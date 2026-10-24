import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as api from '../../api/longTerm';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';
import { chartColors } from '../../utils/chartColors';
import { formatCentsAxis, formatCurrency } from '../../utils/currency';
import { CLASS_LABEL, chanceLabel, inDollars, type Dollars } from '../../utils/longTerm';
import { Field, WholeNumberField } from './fields';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';

const PATHS = [500, 1000, 2000];

/**
 * Monte Carlo: the saved plan run many times with random yearly returns. It answers "how often
 * does this plan hold up?" and shows a band of outcomes. Returns are the only thing that varies,
 * and they are seeded, so the same seed always shows the same picture.
 */
export function SimulationPanel({
  saved,
  result,
  mode,
  dirty,
}: {
  saved: api.SavedPlan;
  result: api.PlanResult | undefined;
  mode: Dollars;
  /** The working copy has changes that are not saved, and the simulation does not see them */
  dirty: boolean;
}) {
  const [paths, setPaths] = useState(1000);
  const [seed, setSeed] = useState(1);
  const [run, setRun] = useState<{ paths: number; seed: number } | null>(null);
  const { allValid, report } = useAmountValidity();
  // Today's net worth is in the key: after a sync the starting figures change, and an old run
  // must not be shown against a fresh forecast
  const start = result?.years[0]?.closingNetWorth;
  const sim = useQuery({
    queryKey: ['lt-sim', saved.id, saved.version, run?.paths, run?.seed, start],
    queryFn: () => api.getSimulation(saved.id, run!.paths, run!.seed),
    enabled: run !== null,
  });
  const s = sim.data;

  const rows = useMemo(() => {
    if (!s) return [];
    return s.bands.map((b) => {
      const at = (i: number) => inDollars(b.net[i], b.inflationIndexPpb, mode);
      const det = result?.years[b.index];
      return {
        year: s.startYear + b.index,
        age: s.startAge + b.index,
        wide: [at(0), at(4)],
        middle: [at(1), at(3)],
        median: at(2),
        forecast: det ? inDollars(det.closingNetWorth, det.inflationIndexPpb, mode) : undefined,
      };
    });
  }, [s, mode, result]);

  const successPercent = s ? s.successBps / 100 : 0;
  const otherSwing = s
    ? s.volatilityBps.cash + s.volatilityBps.vehicles + s.volatilityBps.other > 0
    : false;
  return (
    <section aria-label="Simulation" className="space-y-4">
      <p className="text-sm text-text-secondary">
        The forecast above uses one steady return each year. Real returns swing, so this runs your
        saved plan many times with random yearly returns and shows how often it holds up. Only the
        returns vary: income, spending, inflation and events are as in the forecast. It is a
        projection, not a promise.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!allValid) return;
          // The same settings again run again, rather than showing what was fetched before
          if (run?.paths === paths && run.seed === seed) void sim.refetch();
          else setRun({ paths, seed });
        }}
      >
        <AmountFields report={report}>
          <Field label="Simulated paths">
            <Select
              aria-label="Simulated paths"
              value={paths}
              onChange={(e) => setPaths(Number(e.target.value))}
            >
              {PATHS.map((p) => (
                <option key={p} value={p}>
                  {p.toLocaleString()}
                </option>
              ))}
            </Select>
          </Field>
          <WholeNumberField
            label="Random seed"
            value={seed}
            min={0}
            max={2_147_483_647}
            onChange={setSeed}
            hint="The same seed always gives the same result"
          />
        </AmountFields>
        <Button type="submit" disabled={!allValid || sim.isFetching}>
          {s ? 'Run again' : 'Run simulation'}
        </Button>
      </form>
      {dirty && (
        <p role="status" className="text-sm text-caution">
          The simulation runs the saved plan, and you have unsaved changes. Save them first to
          include them.
        </p>
      )}
      {sim.isFetching && (
        <p role="status" className="text-sm text-text-secondary">
          Running {run?.paths.toLocaleString()} paths…
        </p>
      )}
      {sim.error && (
        <p role="alert" className="text-sm text-negative">
          {(sim.error as Error).message}
        </p>
      )}

      {s && !sim.isFetching && (
        <div className="space-y-4">
          <div className="rounded-xl bg-surface border border-border-light shadow-card px-4 py-5 text-center">
            <output
              className={`block text-3xl font-semibold tabular-nums ${successPercent < 50 ? 'text-negative' : successPercent < 80 ? 'text-caution' : 'text-positive'}`}
              aria-label="Chance of success"
            >
              {chanceLabel(s.successBps)}
            </output>
            <p className="text-sm text-text-secondary mt-1">Chance of success</p>
            <p className="text-xs text-text-tertiary mt-1 max-w-xl mx-auto">
              The share of {s.paths.toLocaleString()} simulated paths in which your accounts always
              covered your spending and you ended above zero.{' '}
              {s.unfundedPaths > 0
                ? `${s.unfundedPaths.toLocaleString()} paths ran out of money, typically from ${s.medianFirstUnfundedYear}.`
                : 'No path ran out of money.'}
              {s.overflowPaths > 0 &&
                ` ${s.overflowPaths.toLocaleString()} paths grew too large to count; they count as successes and are left out of the bands.`}
            </p>
          </div>

          <div
            className="h-72 max-md:h-60"
            role="img"
            aria-label={`Range of net worth across ${s.paths} simulated paths`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
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
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as (typeof rows)[number];
                    return (
                      <div className="bg-surface border border-border rounded-md shadow-hover px-3 py-2 text-xs space-y-0.5">
                        <p className="text-text-tertiary">
                          {row.year} · age {row.age}
                        </p>
                        <p>Best 5%: {formatCurrency(row.wide[1])} or more</p>
                        <p>Middle: {formatCurrency(row.median)}</p>
                        <p>Worst 5%: {formatCurrency(row.wide[0])} or less</p>
                        {row.forecast !== undefined && (
                          <p>Steady-return forecast: {formatCurrency(row.forecast)}</p>
                        )}
                      </div>
                    );
                  }}
                />
                <Area
                  dataKey="wide"
                  name="5th to 95th percentile"
                  stroke="none"
                  fill={chartColors.brandSubtle}
                  fillOpacity={0.8}
                  isAnimationActive={false}
                />
                <Area
                  dataKey="middle"
                  name="25th to 75th percentile"
                  stroke="none"
                  fill={chartColors.brandLight}
                  fillOpacity={0.45}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="median"
                  name="Median"
                  stroke={chartColors.brand}
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="forecast"
                  name="Forecast (steady returns)"
                  stroke={chartColors.caution}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-text-tertiary">
            The darker band holds the middle half of outcomes (25th to 75th percentile) and the
            lighter band the middle 90% (5th to 95th). The thick line is the median of each year;
            the thin line is the forecast above. Seed {s.seed}, {s.paths.toLocaleString()} paths, in{' '}
            {mode === 'today' ? "today's dollars" : 'future dollars'}.
          </p>
          <p className="text-xs text-text-tertiary">
            Volatility, the typical yearly swing, is an assumption you can change under Assumptions:{' '}
            {(['investments', 'super', 'property'] as const)
              .map((c) => `${CLASS_LABEL[c]} ${s.volatilityBps[c] / 100}%`)
              .join(', ')}
            .{' '}
            {otherSwing
              ? `Other accounts with a volatility swing too. `
              : 'Cash and other accounts do not swing. '}
            Investments and super move together, as one market.
          </p>
        </div>
      )}
    </section>
  );
}
