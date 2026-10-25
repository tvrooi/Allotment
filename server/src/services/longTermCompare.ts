// Comparing two long-term plans (docs/LONG-TERM-FORECAST.md §13). Pure. The difference is
// active − reference in cents (or years). The percentage is the difference divided by the
// REFERENCE plan's value, in basis points, and is null when that value is zero or below: the
// UI says so in words beside every percentage, unlike Monarch's unexplained convention.
import { mulDiv, PPB, SUPER_NEW_ID, type ForecastResult } from './longTermForecast.js';

export interface PlanFacts {
  result: ForecastResult;
  startAge: number;
  endAge: number;
  /** Age the retirement event takes effect, or null without one */
  retirementAge: number | null;
  preservationAge: number;
  /** Accounts in the super class */
  superAccountIds: string[];
}

export interface Figure {
  key:
    | 'endNetWorth'
    | 'lowestNetWorth'
    | 'retirementNetWorth'
    | 'retirementAccessible'
    | 'superAtPreservation'
    | 'firstUnfundedYear';
  label: string;
  unit: 'money' | 'year';
  active: number | null;
  reference: number | null;
  /** active − reference, or null when either side has no value */
  difference: number | null;
  /** (active − reference) ÷ reference in basis points; money figures only, null if reference ≤ 0 */
  percentBps: number | null;
}

export interface SeriesPoint {
  index: number;
  calendarYear: number;
  age: number;
  active: number;
  reference: number;
  difference: number;
}

export interface Comparison {
  figures: Figure[];
  series: SeriesPoint[];
  /** Printed beside every percentage */
  percentDefinition: string;
}

/**
 * A plan's facts with every closing net worth and balance in today's dollars, each year
 * deflated by that year's own inflation index (so two plans with different inflation are each
 * deflated by their own). Comparing the result gives today's-dollar figures, differences and
 * percentages.
 */
export function inTodaysDollars(facts: PlanFacts): PlanFacts {
  const deflate = (cents: number, index: number) => mulDiv(cents, PPB, index);
  return {
    ...facts,
    result: {
      ...facts.result,
      years: facts.result.years.map((y) => ({
        ...y,
        closingNetWorth: deflate(y.closingNetWorth, y.inflationIndexPpb),
        // Deflated part by part, so the parts may differ from the deflated total by a cent each
        wealth: {
          accessible: deflate(y.wealth.accessible, y.inflationIndexPpb),
          preserved: deflate(y.wealth.preserved, y.inflationIndexPpb),
          illiquid: deflate(y.wealth.illiquid, y.inflationIndexPpb),
          debts: deflate(y.wealth.debts, y.inflationIndexPpb),
        },
        balances: Object.fromEntries(
          Object.entries(y.balances).map(([id, v]) => [id, deflate(v, y.inflationIndexPpb)]),
        ),
      })),
    },
  };
}

export const PERCENT_DEFINITION =
  'Percent difference is (active − reference) ÷ reference plan, shown only when the reference value is above zero.';

/** The closing net worth at the end of the plan year in which `age` is reached (0 = today) */
function netWorthAtAge(facts: PlanFacts, age: number): number | null {
  const index = age - facts.startAge;
  const year = facts.result.years[index];
  return index >= 0 && year ? year.closingNetWorth : null;
}

function superAtAge(facts: PlanFacts, age: number): number | null {
  const index = age - facts.startAge;
  const year = facts.result.years[index];
  if (index < 0 || !year) return null;
  const ids = new Set([...facts.superAccountIds, SUPER_NEW_ID]);
  return Object.entries(year.balances).reduce((sum, [id, v]) => sum + (ids.has(id) ? v : 0), 0);
}

const lowest = (facts: PlanFacts) =>
  facts.result.years.reduce((min, y) => Math.min(min, y.closingNetWorth), Infinity);

/** The difference as basis points of the reference; null if it is too large to state */
function percentBps(difference: number, reference: number): number | null {
  try {
    return mulDiv(difference, 10_000, reference);
  } catch {
    return null;
  }
}

function figure(
  key: Figure['key'],
  label: string,
  unit: Figure['unit'],
  active: number | null,
  reference: number | null,
): Figure {
  const difference = active !== null && reference !== null ? active - reference : null;
  return {
    key,
    label,
    unit,
    active,
    reference,
    difference,
    percentBps:
      unit === 'money' && difference !== null && reference !== null && reference > 0
        ? percentBps(difference, reference)
        : null,
  };
}

export function compareResults(active: PlanFacts, reference: PlanFacts): Comparison {
  // Retirement takes effect in the plan year after this closing balance, so a retirement at or
  // past the end age never happens and has no figure
  const retirement = (f: PlanFacts) =>
    f.retirementAge === null || f.retirementAge - f.startAge >= f.result.years.length - 1
      ? null
      : netWorthAtAge(f, f.retirementAge);
  const accessibleAtRetirement = (f: PlanFacts) =>
    retirement(f) === null
      ? null
      : f.result.years[(f.retirementAge as number) - f.startAge].wealth.accessible;
  const unfunded = (f: PlanFacts) => f.result.firstUnfunded?.calendarYear ?? null;
  const points = Math.min(active.result.years.length, reference.result.years.length);
  const series: SeriesPoint[] = [];
  for (let i = 0; i < points; i++) {
    const a = active.result.years[i];
    const r = reference.result.years[i];
    series.push({
      index: i,
      calendarYear: a.calendarYear,
      age: a.age,
      active: a.closingNetWorth,
      reference: r.closingNetWorth,
      difference: a.closingNetWorth - r.closingNetWorth,
    });
  }
  return {
    figures: [
      figure(
        'endNetWorth',
        'Net worth at the end of the plan',
        'money',
        active.result.years.at(-1)!.closingNetWorth,
        reference.result.years.at(-1)!.closingNetWorth,
      ),
      figure('lowestNetWorth', 'Lowest net worth', 'money', lowest(active), lowest(reference)),
      figure(
        'retirementNetWorth',
        'Net worth at retirement',
        'money',
        retirement(active),
        retirement(reference),
      ),
      figure(
        'retirementAccessible',
        'Accessible wealth at retirement (cash, investments and released super)',
        'money',
        accessibleAtRetirement(active),
        accessibleAtRetirement(reference),
      ),
      figure(
        'superAtPreservation',
        'Super at the preservation age',
        'money',
        superAtAge(active, active.preservationAge),
        superAtAge(reference, reference.preservationAge),
      ),
      figure(
        'firstUnfundedYear',
        'First year money runs out',
        'year',
        unfunded(active),
        unfunded(reference),
      ),
    ],
    series,
    percentDefinition: PERCENT_DEFINITION,
  };
}
