import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CLASS_VOLATILITY_BPS } from './longTermConfig.js';
import {
  forecastLongTerm,
  mulDiv,
  type ForecastPlan,
  type PlanAccount,
} from './longTermForecast.js';
import {
  pathGenerator,
  percentile,
  PERCENTILES,
  simulate,
  SplitMix64,
  yearReturnBps,
} from './longTermSimulation.js';

// Monte Carlo (docs/LONG-TERM-FORECAST.md §15). Mock numbers only.

const acct = (
  id: string,
  cls: PlanAccount['cls'],
  balance: number,
  growthBps = 0,
): PlanAccount => ({
  id,
  name: id,
  cls,
  balance,
  growthBps,
});

const plan = (over: Partial<ForecastPlan> = {}): ForecastPlan => ({
  startYear: 2027,
  startAge: 40,
  endAge: 80,
  inflationBps: 250,
  accounts: [
    acct('cash', 'cash', 2_000_000, 200),
    acct('inv', 'investments', 30_000_000, 700),
    acct('sup', 'super', 50_000_000, 650),
    acct('house', 'property', 60_000_000, 300),
  ],
  loans: [],
  salary: { takeHome: 9_000_000, grossForSuper: 11_000_000, escalation: { mode: 'inflation' } },
  spending: { annual: 7_000_000, escalation: { mode: 'inflation' } },
  super: { guaranteeBps: 1200, contributionsTaxBps: 1500, preservationAge: 60 },
  agePension: { enabled: false, annual: 0, startAge: 67 },
  extraSavingsGrowthBps: 200,
  splits: [],
  withdrawalOrder: [],
  events: [
    {
      id: 'ret',
      name: 'Retire',
      kind: 'retirement',
      position: 0,
      enabled: true,
      start: { age: 62 },
      spendingMultiplierBps: 8000,
      reductions: { salary: 10000 },
    },
  ],
  ...over,
});
const vol = DEFAULT_CLASS_VOLATILITY_BPS;
const noVol = { cash: 0, investments: 0, super: 0, property: 0, vehicles: 0, other: 0 };

describe('SplitMix64', () => {
  it("matches the generator's published output", () => {
    const g = new SplitMix64(0n);
    expect([g.nextBits(), g.nextBits(), g.nextBits()]).toEqual([
      0xe220a8397b1dcdafn,
      0x6e789e6aa1b965f4n,
      0x06c45d188009454fn,
    ]);
    const h = new SplitMix64(1234567n);
    expect([h.nextBits(), h.nextBits()]).toEqual([0x599ed017fb08fc85n, 0x2c73f08458540fa5n]);
  });

  it('gives the same stream for the same seed and path, and different ones otherwise', () => {
    const draw = (seed: number, path: number) => {
      const g = pathGenerator(seed, path);
      return [g.normal(), g.normal(), g.normal()];
    };
    expect(draw(7, 3)).toEqual(draw(7, 3));
    expect(draw(7, 3)).not.toEqual(draw(7, 4));
    expect(draw(7, 3)).not.toEqual(draw(8, 3));
  });

  it('draws uniforms strictly inside (0, 1) and normals with mean 0 and sd 1', () => {
    const g = new SplitMix64(99n);
    const n = 40_000;
    let sum = 0;
    let sumSquares = 0;
    for (let i = 0; i < n; i++) {
      const u = g.next();
      expect(u).toBeGreaterThan(0);
      expect(u).toBeLessThan(1);
      const z = g.normal();
      sum += z;
      sumSquares += z * z;
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.02);
    expect(Math.abs(sumSquares / n - 1)).toBeLessThan(0.03);
  });
});

describe('yearReturnBps', () => {
  it('is the mean with no volatility', () => {
    expect(yearReturnBps(700, 0, 3)).toBe(700);
    expect(yearReturnBps(-1500, 0, -3)).toBe(-1500);
  });

  it('has the stated mean and standard deviation, and can never lose everything', () => {
    const g = new SplitMix64(5n);
    const n = 60_000;
    let sum = 0;
    let sumSquares = 0;
    for (let i = 0; i < n; i++) {
      const r = yearReturnBps(700, 1600, g.normal()) / 10_000;
      expect(r).toBeGreaterThan(-1);
      sum += r;
      sumSquares += r * r;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSquares / n - mean * mean);
    expect(Math.abs(mean - 0.07)).toBeLessThan(0.005);
    expect(Math.abs(sd - 0.16)).toBeLessThan(0.01);
    expect(yearReturnBps(700, 1600, -40)).toBeGreaterThan(-10_000);
  });
});

describe('percentile', () => {
  it('interpolates between neighbours', () => {
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
    expect(percentile([10, 20, 30, 40, 50], 25)).toBe(20);
    expect(percentile([0, 100], 10)).toBe(10);
    expect(percentile([5], 95)).toBe(5);
    expect(percentile([], 50)).toBe(0);
  });
});

describe('simulate', () => {
  it('gives the same answer for the same seed, and a different one for another', () => {
    const a = simulate(plan(), { seed: 1, paths: 200, volatilityBps: vol });
    expect(JSON.stringify(simulate(plan(), { seed: 1, paths: 200, volatilityBps: vol }))).toBe(
      JSON.stringify(a),
    );
    const b = simulate(plan(), { seed: 2, paths: 200, volatilityBps: vol });
    expect(b.bands.at(-1)!.net).not.toEqual(a.bands.at(-1)!.net);
  });

  it('never mutates the plan', () => {
    const p = plan();
    const before = JSON.stringify(p);
    simulate(p, { seed: 1, paths: 100, volatilityBps: vol });
    expect(JSON.stringify(p)).toBe(before);
  });

  it('with no volatility every path is the deterministic forecast', () => {
    const p = plan();
    const sim = simulate(p, { seed: 3, paths: 100, volatilityBps: noVol });
    const run = forecastLongTerm(p);
    sim.bands.forEach((band, i) => {
      for (const v of band.net) expect(v).toBe(run.years[i].closingNetWorth);
    });
    expect(sim.successBps).toBe(10_000);
    expect(sim.unfundedPaths).toBe(0);
  });

  it('has bands in order, widening with time, with today exact', () => {
    const sim = simulate(plan(), { seed: 4, paths: 400, volatilityBps: vol });
    expect(sim.percentiles).toEqual(PERCENTILES);
    for (const band of sim.bands) {
      expect([...band.net].sort((x, y) => x - y)).toEqual(band.net);
    }
    expect(new Set(sim.bands[0].net).size).toBe(1);
    const spread = (i: number) => sim.bands[i].net[4] - sim.bands[i].net[0];
    expect(spread(30)).toBeGreaterThan(spread(5));
  });

  it('reports the chance of success as the share of paths that never run out and end above zero', () => {
    // A plan that cannot fail: more income than spending and no retirement
    const safe = simulate(
      plan({ events: [], spending: { annual: 1_000_000, escalation: { mode: 'inflation' } } }),
      { seed: 1, paths: 200, volatilityBps: vol },
    );
    expect(safe.successBps).toBe(10_000);
    // A plan that always fails: spending with nothing to pay it
    const broke = simulate(
      plan({
        accounts: [],
        events: [],
        salary: { takeHome: 0, grossForSuper: 0, escalation: { mode: 'none' } },
      }),
      { seed: 1, paths: 200, volatilityBps: vol },
    );
    expect(broke.successBps).toBe(0);
    expect(broke.unfundedPaths).toBe(200);
    expect(broke.medianFirstUnfundedYear).toBe(2027);
    // In between: risk makes some paths fail and others not
    const tight = simulate(
      plan({ spending: { annual: 9_800_000, escalation: { mode: 'inflation' } } }),
      { seed: 1, paths: 400, volatilityBps: vol },
    );
    expect(tight.successBps).toBeGreaterThan(0);
    expect(tight.successBps).toBeLessThan(10_000);
    expect(tight.unfundedPaths).toBeGreaterThan(0);
  });

  it('more volatility cannot raise the median above the no-volatility forecast by much, and widens the band', () => {
    const calm = simulate(plan(), { seed: 1, paths: 300, volatilityBps: noVol });
    const wild = simulate(plan(), {
      seed: 1,
      paths: 300,
      volatilityBps: { ...vol, investments: 3000, super: 3000 },
    });
    const last = (s: typeof calm) => s.bands.at(-1)!.net;
    expect(last(wild)[4] - last(wild)[0]).toBeGreaterThan(last(calm)[4] - last(calm)[0]);
  });

  it('refuses bad input', () => {
    expect(() => simulate(plan(), { seed: -1, paths: 100, volatilityBps: vol })).toThrow(
      RangeError,
    );
    expect(() => simulate(plan(), { seed: 1, paths: 0, volatilityBps: vol })).toThrow(RangeError);
    expect(() => simulate(plan(), { seed: 1, paths: 5000, volatilityBps: vol })).toThrow(
      RangeError,
    );
  });

  it('runs 1000 paths of a long plan in a few seconds', () => {
    const started = performance.now();
    simulate(plan({ endAge: 100 }), { seed: 1, paths: 1000, volatilityBps: vol });
    expect(performance.now() - started).toBeLessThan(15_000);
  });

  it('is a pure module: no database, clock or Math.random', () => {
    const source = readFileSync(new URL('./longTermSimulation.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*(db|drizzle|express)[^'"]*['"]/);
    expect(source).not.toMatch(/Date\.now|new Date|Math\.random|performance\.now/);
  });
});

describe('mulDiv fast path', () => {
  it('agrees with exact BigInt arithmetic, including signs, halves and large products', () => {
    let state = 12345;
    const next = (n: number) => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state % n;
    };
    const reference = (a: number, b: number, c: number) => {
      const n = BigInt(a) * BigInt(b);
      const d = BigInt(c);
      const neg = n < 0n !== d < 0n;
      const an = n < 0n ? -n : n;
      const ad = d < 0n ? -d : d;
      let q = an / ad;
      if ((an % ad) * 2n >= ad) q += 1n;
      return Number(neg ? -q : q);
    };
    for (let i = 0; i < 20_000; i++) {
      const a = (next(2) ? 1 : -1) * next(10 ** (1 + next(13)));
      const b = (next(2) ? 1 : -1) * next(10 ** (1 + next(6)));
      const c = (next(2) ? 1 : -1) * (1 + next(10 ** (1 + next(7))));
      expect(mulDiv(a, b, c), `${a} × ${b} ÷ ${c}`).toBe(reference(a, b, c));
    }
    expect(Object.is(mulDiv(0, 5, -3), 0)).toBe(true);
    expect(mulDiv(5, 1, 2)).toBe(3);
    expect(mulDiv(-5, 1, 2)).toBe(-3);
    expect(mulDiv(9_000_000_000_000, 1_000_000_007, 1_000_000_000)).toBe(9_000_000_063_000);
  });
});
