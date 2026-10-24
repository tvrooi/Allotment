// Monte Carlo for the long-term forecast (docs/LONG-TERM-FORECAST.md §15). Pure and seeded:
// the same plan, seed and path count always give the same answer, with no clock and no
// ambient randomness. Each path is the same deterministic engine run with a different return for
// each year, so a simulation can only disagree with the forecast about the returns.
import {
  forecastLongTerm,
  LongTermForecastError,
  validatePlan,
  type AccountClass,
  type ForecastPlan,
} from './longTermForecast.js';

export const MAX_PATHS = 2000;
export const DEFAULT_PATHS = 1000;

/** Percentiles of the band, in the order they are returned */
export const PERCENTILES = [5, 25, 50, 75, 95] as const;

export type Volatility = Record<AccountClass, number>;

// ─── Random numbers ──────────────────────────────────────────────────────────

const MASK = (1n << 64n) - 1n;

/** SplitMix64: a small, well-known generator with a 64-bit state */
export class SplitMix64 {
  private state: bigint;
  constructor(seed: bigint) {
    this.state = seed & MASK;
  }
  nextBits(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & MASK;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return (z ^ (z >> 31n)) & MASK;
  }
  /** Uniform in (0, 1): never exactly 0 or 1, so a logarithm of it is always finite */
  next(): number {
    return (Number(this.nextBits() >> 11n) + 0.5) / 9007199254740992;
  }
  /** A standard normal draw (Box-Muller; the second value of each pair is not kept) */
  normal(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

/** The generator for one path: a function of the run's seed and the path's index only */
export function pathGenerator(seed: number, pathIndex: number): SplitMix64 {
  const mixed = new SplitMix64(BigInt(seed) * 0x2545f4914f6cdd1dn + BigInt(pathIndex));
  // Spread nearby seeds and indexes apart before the path starts
  return new SplitMix64(mixed.nextBits());
}

/**
 * One year's return, in whole basis points, for an account growing at `meanBps` on average with
 * a standard deviation of `volBps`, given a standard normal draw. Lognormal, so a balance can
 * never fall below zero, with E[1 + r] = 1 + mean and SD[r] = vol exactly (σ² = ln(1 + (vol ÷ (1 +
 * mean))²), and the log has mean ln(1 + mean) − σ²/2).
 */
export function yearReturnBps(meanBps: number, volBps: number, z: number): number {
  if (volBps <= 0) return meanBps;
  const growth = 1 + meanBps / 10_000;
  if (growth <= 0) return meanBps;
  const ratio = volBps / 10_000 / growth;
  const sigma2 = Math.log(1 + ratio * ratio);
  const rate = Math.exp(Math.log(growth) - sigma2 / 2 + Math.sqrt(sigma2) * z) - 1;
  return Math.max(-9_999, Math.round(rate * 10_000));
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export interface Band {
  index: number;
  calendarYear: number;
  age: number;
  inflationIndexPpb: number;
  /** Closing net worth at each of PERCENTILES, in cents (future dollars) */
  net: number[];
}

export interface SimulationResult {
  seed: number;
  paths: number;
  volatilityBps: Volatility;
  percentiles: readonly number[];
  /** Share of paths that never ran out of money and ended above zero, in basis points */
  successBps: number;
  /** Paths that had unfunded spending at some point, and the year it first happened (median) */
  unfundedPaths: number;
  /**
   * Paths whose balances grew past what can be counted exactly. They are successes, but left out of
   * the bands, which then describe the remaining paths.
   */
  overflowPaths: number;
  medianFirstUnfundedYear: number | null;
  bands: Band[];
}

/** The value at a percentile of an ascending list, linearly interpolated between neighbours */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const position = ((sorted.length - 1) * p) / 100;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return Math.round(sorted[low] + (sorted[high] - sorted[low]) * (position - low));
}

export function simulate(
  plan: ForecastPlan,
  options: { seed: number; paths: number; volatilityBps: Volatility },
): SimulationResult {
  const { seed, paths, volatilityBps } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed >= 2 ** 31) throw new RangeError('Bad seed');
  if (!Number.isInteger(paths) || paths < 1 || paths > MAX_PATHS)
    throw new RangeError('Bad path count');
  validatePlan(plan);
  const years = plan.endAge - plan.startAge;
  const finals: number[][] = Array.from({ length: years + 1 }, () => []);
  let successes = 0;
  let overflowPaths = 0;
  const firstYears: number[] = [];
  let template: ReturnType<typeof forecastLongTerm> | null = null;

  for (let path = 0; path < paths; path++) {
    const random = pathGenerator(seed, path);
    // One shared draw per year for everything that moves with the share market (investments
    // and super), and one for property: they rise and fall together, as markets do
    const market: number[] = [];
    const property: number[] = [];
    for (let k = 0; k <= years; k++) {
      market.push(random.normal());
      property.push(random.normal());
    }
    let result: ReturnType<typeof forecastLongTerm>;
    try {
      result = forecastLongTerm(plan, {
        validated: true,
        growthBps: (k, a) => {
          const vol = volatilityBps[a.cls];
          if (vol <= 0) return a.growthBps;
          const z = a.cls === 'property' ? property[k] : market[k];
          return yearReturnBps(a.growthBps, vol, z);
        },
      });
    } catch (error) {
      // One lucky path whose balances outgrow exact arithmetic must not sink the whole run
      if (!(error instanceof LongTermForecastError)) throw error;
      overflowPaths++;
      successes++;
      continue;
    }
    template ??= result;
    result.years.forEach((y, i) => finals[i].push(y.closingNetWorth));
    const last = result.years[result.years.length - 1];
    if (!result.firstUnfunded && last.closingNetWorth > 0) successes++;
    if (result.firstUnfunded) firstYears.push(result.firstUnfunded.calendarYear);
  }

  if (!template) throw new LongTermForecastError('Amounts are too large to simulate');
  const shape = template.years;
  const bands: Band[] = shape.map((y, i) => {
    const sorted = finals[i].sort((a, b) => a - b);
    return {
      index: y.index,
      calendarYear: y.calendarYear,
      age: y.age,
      inflationIndexPpb: y.inflationIndexPpb,
      net: PERCENTILES.map((p) => percentile(sorted, p)),
    };
  });
  firstYears.sort((a, b) => a - b);
  return {
    seed,
    paths,
    volatilityBps,
    percentiles: PERCENTILES,
    successBps: Math.round((successes * 10_000) / paths),
    unfundedPaths: firstYears.length,
    overflowPaths,
    medianFirstUnfundedYear: firstYears.length
      ? firstYears[Math.floor((firstYears.length - 1) / 2)]
      : null,
    bands,
  };
}
