// Decline in value of a depreciating asset (docs/DEPRECIATING-ASSETS-PLAN.md §2 and §3.2), from
// the ATO's Guide to depreciating assets: prime cost (straight line) and diminishing value (200%
// from 10 May 2006). Pure: no database, so it is tested on its own and shared by the routes, the
// tax year and the MCP read. Integer cents; every figure is rounded once, half away from zero.
// Australian financial years, numbered by the year they start (2026 = 1 July 2026 to 30 June
// 2027), as in taxService.ts; kept here so this file stays free of the database
const financialYearOf = (date: string) => {
  const year = Number(date.slice(0, 4));
  return date.slice(5) >= '07-01' ? year : year - 1;
};
const financialYearRange = (fy: number) => ({ from: `${fy}-07-01`, to: `${fy + 1}-06-30` });

export type DepreciationMethod = 'prime_cost' | 'diminishing_value';

export interface AssetTerms {
  cost: number;
  /** First used or installed ready for use (YYYY-MM-DD) */
  startDate: string;
  method: DepreciationMethod;
  /** Effective life in hundredths of a year (2.5 years = 250) */
  effectiveLifeHundredths: number;
  /** Taxable-use share in basis points (10,000 = all of it) */
  workUseBps: number;
  /** A year's own share, where it differs (financial year → basis points) */
  yearWorkUse?: Record<number, number>;
  /** Brought in already depreciated elsewhere: its adjustable value at the start of this year */
  openingFy?: number | null;
  openingAdjustableValue?: number | null;
  /** A balancing adjustment event (sold, lost, no longer used) and what it brought in */
  disposedDate?: string | null;
  terminationValue?: number | null;
  /** In the low-value pool from this financial year: its own schedule stops before it */
  pooledFy?: number | null;
}

export interface ScheduleRow {
  financialYear: number;
  daysHeld: number;
  opening: number;
  /** Cost (prime cost, and diminishing value's first year), else the opening value */
  baseValue: number;
  /** The full decline: the adjustable value falls by this */
  decline: number;
  workUseBps: number;
  /** The decline × the taxable-use share */
  deduction: number;
  closing: number;
  /** In the year of disposal: termination value less the adjustable value then */
  balancingAdjustment?: number;
  /** Its taxable share: a deduction when negative, assessable income when positive */
  balancingTaxable?: number;
}

/** The earliest start time handled: the 200% diminishing value rate applies from it */
export const EARLIEST_START = '2006-05-10';

/** num ÷ den, rounded half away from zero, exactly */
function divRound(num: bigint, den: bigint): number {
  const negative = num < 0n !== den < 0n;
  const n = num < 0n ? -num : num;
  const d = den < 0n ? -den : den;
  const q = (n * 2n + d) / (d * 2n);
  return Number(negative ? -q : q);
}
const share = (amount: number, bps: number) => divRound(BigInt(amount) * BigInt(bps), 10_000n);

const DAY = 86_400_000;
const dayNumber = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY;
/** Days from `from` to `to`, both counted */
const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from) + 1;

/** Days the asset is held in a financial year (0 outside its life) */
export function daysHeld(terms: AssetTerms, fy: number): number {
  const range = financialYearRange(fy);
  const from = terms.startDate > range.from ? terms.startDate : range.from;
  const end = terms.disposedDate && terms.disposedDate < range.to ? terms.disposedDate : range.to;
  return end < from ? 0 : daysBetween(from, end);
}

/**
 * Year-by-year schedule from the start time (or `openingFy`) through `throughFy`, stopping at
 * disposal or when nothing is left to decline. Prime cost uses the cumulative difference (each
 * year is the total to date less the total before), so it never drifts and ends at exactly zero.
 */
export function schedule(terms: AssetTerms, throughFy: number): ScheduleRow[] {
  const life = BigInt(terms.effectiveLifeHundredths);
  const firstFy = terms.openingFy ?? financialYearOf(terms.startDate);
  let lastFy = terms.disposedDate
    ? Math.min(throughFy, financialYearOf(terms.disposedDate))
    : throughFy;
  // Pooled: the pool takes over from that year, disposal included (see poolSchedule)
  if (terms.pooledFy != null) lastFy = Math.min(lastFy, terms.pooledFy - 1);
  const rows: ScheduleRow[] = [];
  let value = terms.openingFy != null ? (terms.openingAdjustableValue ?? terms.cost) : terms.cost;
  let cumulativeDays = 0;
  let cumulativeDecline = 0;
  for (let fy = firstFy; fy <= lastFy; fy++) {
    const days = daysHeld(terms, fy);
    if (days === 0) continue;
    const opening = value;
    const workUseBps = terms.yearWorkUse?.[fy] ?? terms.workUseBps;
    let decline: number;
    let baseValue: number;
    if (terms.method === 'prime_cost') {
      baseValue = terms.cost;
      cumulativeDays += days;
      // cost × days ÷ 365 × 100% ÷ life, as a running total since the schedule began
      const total = divRound(BigInt(terms.cost) * BigInt(cumulativeDays) * 100n, 365n * life);
      decline = Math.min(total - cumulativeDecline, opening);
      cumulativeDecline += decline;
    } else {
      baseValue = rows.length === 0 && terms.openingFy == null ? terms.cost : opening;
      // base value × days ÷ 365 × 200% ÷ life
      decline = Math.min(divRound(BigInt(baseValue) * BigInt(days) * 200n, 365n * life), opening);
    }
    value = opening - decline;
    const row: ScheduleRow = {
      financialYear: fy,
      daysHeld: days,
      opening,
      baseValue,
      decline,
      workUseBps,
      deduction: share(decline, workUseBps),
      closing: value,
    };
    if (
      terms.disposedDate &&
      financialYearOf(terms.disposedDate) === fy &&
      (terms.pooledFy == null || fy < terms.pooledFy)
    ) {
      const adjustment = (terms.terminationValue ?? 0) - value;
      row.balancingAdjustment = adjustment;
      row.balancingTaxable = share(adjustment, workUseBps);
      row.closing = 0;
      rows.push(row);
      break;
    }
    rows.push(row);
    if (value <= 0) {
      // Fully declined, but a later disposal still has a balancing adjustment: the whole
      // termination value, in the disposal year
      const disposalFy = terms.disposedDate ? financialYearOf(terms.disposedDate) : null;
      if (disposalFy !== null && disposalFy > fy && disposalFy <= lastFy) {
        const share_ = terms.yearWorkUse?.[disposalFy] ?? terms.workUseBps;
        const adjustment = terms.terminationValue ?? 0;
        rows.push({
          financialYear: disposalFy,
          daysHeld: daysHeld(terms, disposalFy),
          opening: 0,
          baseValue: terms.method === 'prime_cost' ? terms.cost : 0,
          decline: 0,
          workUseBps: share_,
          deduction: 0,
          closing: 0,
          balancingAdjustment: adjustment,
          balancingTaxable: share(adjustment, share_),
        });
      }
      break;
    }
  }
  return rows;
}

/** A year's row (or nothing, outside the asset's life) */
export const scheduleYear = (terms: AssetTerms, fy: number) =>
  schedule(terms, fy).find((r) => r.financialYear === fy) ?? null;

/** The pool's entry thresholds: under $1,000 */
export const POOL_LIMIT = 100_000;

/** An asset allocated to the low-value pool (DEPRECIATING-ASSETS-PLAN.md §2, phase 3) */
export interface PoolEntry {
  /** low_cost: cost under $1,000, pooled in its first year; low_value: a DV asset whose
   * opening adjustable value is under $1,000 */
  kind: 'low_cost' | 'low_value';
  /** The year it's allocated */
  fy: number;
  /** Its taxable share of the cost (low cost) or of the opening adjustable value (low value),
   * estimated when it's allocated and fixed from then on */
  amount: number;
  /** A balancing adjustment event: the taxable share of its termination value, in that year */
  disposal?: { fy: number; amount: number } | null;
}

export interface PoolRow {
  financialYear: number;
  /** Last year's closing balance */
  opening: number;
  lowCostAdded: number;
  lowValueAdded: number;
  /** 18.75% of low-cost additions + 37.5% of (opening + low-value additions): the D6 deduction */
  decline: number;
  /** Taxable shares of pooled assets' termination values */
  terminations: number;
  closing: number;
  /** Termination values beyond the balance: assessable income */
  income: number;
}

/**
 * The low-value pool year by year, from the first allocation through `throughFy`. The amounts
 * going in are already taxable shares, so the decline is the deduction. Ends when the balance
 * reaches zero and nothing more is allocated.
 */
export function poolSchedule(entries: PoolEntry[], throughFy: number): PoolRow[] {
  if (!entries.length) return [];
  const first = Math.min(...entries.map((e) => e.fy));
  const lastEntry = Math.max(
    ...entries.flatMap((e) => (e.disposal ? [e.fy, e.disposal.fy] : [e.fy])),
  );
  const rows: PoolRow[] = [];
  let balance = 0;
  for (let fy = first; fy <= throughFy; fy++) {
    const sum = (kind: PoolEntry['kind']) =>
      entries.filter((e) => e.kind === kind && e.fy === fy).reduce((s, e) => s + e.amount, 0);
    const lowCostAdded = sum('low_cost');
    const lowValueAdded = sum('low_value');
    const terminations = entries
      .filter((e) => e.disposal?.fy === fy)
      .reduce((s, e) => s + (e.disposal?.amount ?? 0), 0);
    if (balance === 0 && !lowCostAdded && !lowValueAdded && !terminations) {
      if (fy > lastEntry) break;
      continue;
    }
    const opening = balance;
    const decline =
      divRound(BigInt(lowCostAdded) * 1_875n, 10_000n) +
      divRound(BigInt(opening + lowValueAdded) * 375n, 1_000n);
    let closing = opening + lowCostAdded + lowValueAdded - decline - terminations;
    let income = 0;
    if (closing < 0) {
      income = -closing;
      closing = 0;
    }
    rows.push({
      financialYear: fy,
      opening,
      lowCostAdded,
      lowValueAdded,
      decline,
      terminations,
      closing,
      income,
    });
    balance = closing;
  }
  return rows;
}

/** What an asset adds to the pool if allocated in `fy`, or why it can't be */
export function poolEntryFor(
  terms: AssetTerms,
  fy: number,
): { kind: PoolEntry['kind']; amount: number } | { refused: string } {
  const firstFy = terms.openingFy ?? financialYearOf(terms.startDate);
  const shareOf = (amount: number) => share(amount, terms.yearWorkUse?.[fy] ?? terms.workUseBps);
  if (terms.disposedDate && financialYearOf(terms.disposedDate) < fy)
    return { refused: 'It was disposed of before that year' };
  if (fy < firstFy) return { refused: 'That is before its first year' };
  if (terms.cost < POOL_LIMIT && terms.openingFy == null) {
    if (fy !== firstFy) return { refused: 'A low-cost asset goes into the pool in its first year' };
    return { kind: 'low_cost', amount: shareOf(terms.cost) };
  }
  if (terms.method !== 'diminishing_value')
    return { refused: 'Only a diminishing value asset can join the pool later' };
  const before = schedule({ ...terms, pooledFy: null, disposedDate: null }, fy - 1).find(
    (r) => r.financialYear === fy - 1,
  );
  const value =
    fy === firstFy && terms.openingFy != null
      ? (terms.openingAdjustableValue ?? terms.cost)
      : before?.closing;
  if (value === undefined)
    return { refused: 'It has no adjustable value at the start of that year' };
  if (value >= POOL_LIMIT)
    return { refused: 'Its adjustable value at the start of that year is $1,000 or more' };
  if (value <= 0) return { refused: 'It has nothing left to decline' };
  return { kind: 'low_value', amount: shareOf(value) };
}

/** A pooled asset's entry in the pool, from its terms (null when not pooled, or not allowed) */
export function poolEntryOf(terms: AssetTerms): PoolEntry | null {
  if (terms.pooledFy == null) return null;
  const fy = terms.pooledFy;
  const entry = poolEntryFor({ ...terms, disposedDate: null }, fy);
  if ('refused' in entry) return null;
  const bps = terms.yearWorkUse?.[fy] ?? terms.workUseBps;
  const disposalFy = terms.disposedDate ? financialYearOf(terms.disposedDate) : null;
  return {
    ...entry,
    fy,
    disposal:
      disposalFy !== null && disposalFy >= fy
        ? { fy: disposalFy, amount: share(terms.terminationValue ?? 0, bps) }
        : null,
  };
}
