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
  const lastFy = terms.disposedDate
    ? Math.min(throughFy, financialYearOf(terms.disposedDate))
    : throughFy;
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
    if (terms.disposedDate && financialYearOf(terms.disposedDate) === fy) {
      const adjustment = (terms.terminationValue ?? 0) - value;
      row.balancingAdjustment = adjustment;
      row.balancingTaxable = share(adjustment, workUseBps);
      row.closing = 0;
      rows.push(row);
      break;
    }
    rows.push(row);
    if (value <= 0) break;
  }
  return rows;
}

/** A year's row (or nothing, outside the asset's life) */
export const scheduleYear = (terms: AssetTerms, fy: number) =>
  schedule(terms, fy).find((r) => r.financialYear === fy) ?? null;
