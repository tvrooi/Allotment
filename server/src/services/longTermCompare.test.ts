import { describe, expect, it } from 'vitest';
import {
  compareResults,
  inTodaysDollars,
  PERCENT_DEFINITION,
  type PlanFacts,
} from './longTermCompare.js';
import { forecastLongTerm, type ForecastPlan } from './longTermForecast.js';

// Comparing two plans (docs/LONG-TERM-FORECAST.md §13). Mock numbers only.

const plan = (over: Partial<ForecastPlan> = {}): ForecastPlan => ({
  startYear: 2027,
  startAge: 40,
  endAge: 50,
  inflationBps: 0,
  accounts: [
    { id: 'cash', name: 'Cash', cls: 'cash', balance: 1_000_000, growthBps: 0 },
    { id: 'sup', name: 'Super', cls: 'super', balance: 5_000_000, growthBps: 0 },
  ],
  loans: [],
  salary: { takeHome: 8_000_000, grossForSuper: 0, escalation: { mode: 'none' } },
  spending: { annual: 6_000_000, escalation: { mode: 'none' } },
  super: { guaranteeBps: 1200, contributionsTaxBps: 1500, preservationAge: 45 },
  agePension: { enabled: false, annual: 0, startAge: 67 },
  extraSavingsGrowthBps: 0,
  splits: [],
  withdrawalOrder: [],
  events: [],
  ...over,
});

const facts = (p: ForecastPlan, retirementAge: number | null = null): PlanFacts => ({
  result: forecastLongTerm(p),
  startAge: p.startAge,
  endAge: p.endAge,
  retirementAge,
  preservationAge: p.super.preservationAge,
  superAccountIds: ['sup'],
});

describe('compareResults', () => {
  const reference = facts(plan());
  const active = facts(plan({ spending: { annual: 7_000_000, escalation: { mode: 'none' } } }));

  it('pairs the key figures and gives the difference in money', () => {
    const { figures } = compareResults(active, reference);
    const end = figures.find((f) => f.key === 'endNetWorth')!;
    // 10 years: reference saves 2,000,000 a year, active 1,000,000
    expect(end).toMatchObject({
      active: 6_000_000 + 10_000_000,
      reference: 6_000_000 + 20_000_000,
      difference: -10_000_000,
    });
    expect(figures.find((f) => f.key === 'superAtPreservation')).toMatchObject({
      active: 5_000_000,
      reference: 5_000_000,
      difference: 0,
    });
  });

  it("divides the difference by the REFERENCE plan's value, in basis points", () => {
    const end = compareResults(active, reference).figures.find((f) => f.key === 'endNetWorth')!;
    // −10,000,000 ÷ 26,000,000 = −38.46%
    expect(end.percentBps).toBe(-3846);
    // Swapping the plans swaps the denominator: +10,000,000 ÷ 16,000,000 = +62.5%
    const swapped = compareResults(reference, active).figures.find((f) => f.key === 'endNetWorth')!;
    expect(swapped.percentBps).toBe(6250);
    expect(PERCENT_DEFINITION).toMatch(/÷ reference plan/);
  });

  it('shows no percentage when the reference is zero or below, or for years', () => {
    const broke = facts(
      plan({
        accounts: [],
        salary: { takeHome: 0, grossForSuper: 0, escalation: { mode: 'none' } },
      }),
    );
    const { figures } = compareResults(active, broke);
    const end = figures.find((f) => f.key === 'endNetWorth')!;
    expect(end.reference).toBeLessThan(0);
    expect(end.percentBps).toBeNull();
    const year = figures.find((f) => f.key === 'firstUnfundedYear')!;
    expect(year).toMatchObject({ unit: 'year', reference: 2027, percentBps: null });
    expect(year).toMatchObject({ active: null, difference: null });
  });

  it('leaves a figure empty when a plan has no value for it', () => {
    const { figures } = compareResults(active, reference);
    const unfunded = figures.find((f) => f.key === 'firstUnfundedYear')!;
    expect(unfunded).toMatchObject({ active: null, reference: null, difference: null });
    const retirement = figures.find((f) => f.key === 'retirementNetWorth')!;
    expect(retirement).toMatchObject({ active: null, difference: null, percentBps: null });
    const retired = compareResults(facts(plan(), 45), facts(plan(), 45)).figures.find(
      (f) => f.key === 'retirementNetWorth',
    )!;
    expect(retired).toMatchObject({ active: 6_000_000 + 10_000_000, difference: 0, percentBps: 0 });
  });

  it('counts super as accessible at retirement only once it is released', () => {
    const retiring = plan({
      events: [
        {
          id: 'ret',
          name: 'Retire',
          kind: 'retirement',
          position: 0,
          enabled: true,
          start: { year: 2032 },
          spendingMultiplierBps: 10000,
          reductions: {},
        },
      ],
    });
    const accessible = (f: PlanFacts) =>
      compareResults(f, f).figures.find((x) => x.key === 'retirementAccessible')!.active;
    // Retiring at the preservation age releases the 5,000,000 of super
    expect(accessible(facts(retiring, 45))).toBe(6_000_000 + 10_000_000);
    // The same balances without a retirement event leave super preserved
    expect(accessible(facts(plan(), 45))).toBe(1_000_000 + 10_000_000);
  });

  it('gives a difference line, year by year, that is active minus reference', () => {
    const { series } = compareResults(active, reference);
    expect(series).toHaveLength(11);
    expect(series[0]).toMatchObject({
      index: 0,
      active: 6_000_000,
      reference: 6_000_000,
      difference: 0,
    });
    expect(series[10]).toMatchObject({ difference: -10_000_000, age: 49 });
    for (const p of series) expect(p.difference).toBe(p.active - p.reference);
  });

  it('finds the lowest net worth', () => {
    const lean = facts(
      plan({
        accounts: [],
        salary: { takeHome: 0, grossForSuper: 0, escalation: { mode: 'none' } },
      }),
    );
    expect(
      compareResults(lean, reference).figures.find((f) => f.key === 'lowestNetWorth'),
    ).toMatchObject({
      active: -60_000_000,
      reference: 6_000_000,
    });
  });

  it('gives no retirement figure for a retirement at or past the end age, and no percent that overflows', () => {
    // Ten plan years from age 40: retiring at 49 happens (in the last year), at 50 it never does
    const at = (age: number) =>
      compareResults(facts(plan(), age), facts(plan(), age)).figures.find(
        (f) => f.key === 'retirementNetWorth',
      )!;
    expect(at(49).active).not.toBeNull();
    expect(at(50).active).toBeNull();
    const tiny = facts(
      plan({
        accounts: [{ id: 'cash', name: 'Cash', cls: 'cash', balance: 1, growthBps: 0 }],
        salary: { takeHome: 0, grossForSuper: 0, escalation: { mode: 'none' } },
        spending: { annual: 0, escalation: { mode: 'none' } },
      }),
    );
    const huge = facts(
      plan({
        accounts: [
          {
            id: 'cash',
            name: 'Cash',
            cls: 'cash',
            balance: 9_000_000_000_000_000 / 10,
            growthBps: 0,
          },
        ],
        salary: { takeHome: 0, grossForSuper: 0, escalation: { mode: 'none' } },
        spending: { annual: 0, escalation: { mode: 'none' } },
      }),
    );
    const figure = compareResults(huge, tiny).figures.find((f) => f.key === 'endNetWorth')!;
    expect(figure.difference).toBeGreaterThan(0);
    expect(figure.percentBps).toBeNull();
  });

  it("compares in today's dollars, deflating each plan by its own inflation", () => {
    const withInflation = (bps: number) =>
      facts(plan({ inflationBps: bps, spending: { annual: 0, escalation: { mode: 'none' } } }));
    const low = withInflation(0);
    const high = withInflation(1000);
    const future = compareResults(high, low).figures.find((f) => f.key === 'endNetWorth')!;
    const today = compareResults(inTodaysDollars(high), inTodaysDollars(low)).figures.find(
      (f) => f.key === 'endNetWorth',
    )!;
    // Zero inflation changes nothing; 10% a year for 10 years shrinks the same cents by 2.59×
    expect(inTodaysDollars(low).result.years.at(-1)!.closingNetWorth).toBe(
      low.result.years.at(-1)!.closingNetWorth,
    );
    expect(today.reference).toBe(future.reference);
    expect(today.active).toBe(Math.round(future.active! / 1.1 ** 10));
    expect(today.difference).toBe(today.active! - today.reference!);
  });
});
