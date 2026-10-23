import { allocate } from './money';

// The split editor's arithmetic (components/transactions/SplitTransactionModal.tsx). Pure, so
// the property tests can check that parts always add up to the transaction exactly.

/** Hundredths of a percent: 33.33% is 3333, the whole is 10000 */
export const WHOLE = 10_000;

/** A typed percentage as hundredths ("33.33" → 3333, "12,5" → 1250), or null */
export function readPercent(s: string): number | null {
  const t = s.trim().replace(',', '.').replace(/%$/, '').trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  const value = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return value > 0 && value <= WHOLE ? value : null;
}

/** A percentage in hundredths, for an input field ("33.33", "50") */
export const percentToInput = (hundredths: number) =>
  hundredths % 100 === 0
    ? String(hundredths / 100)
    : (hundredths / 100).toFixed(2).replace(/0$/, '');

/**
 * Signed amounts for parts given in hundredths of a percent adding up to 100%: each rounded
 * down, the leftover cents to the largest remainders, so they add up to `total` exactly.
 * Null unless the percentages add up to 100.
 */
export function percentsToAmounts(total: number, percents: number[]): number[] | null {
  if (percents.reduce((a, b) => a + b, 0) !== WHOLE) return null;
  return allocate(total, percents);
}

/** Each part's share of `total`, in hundredths, adding up to 100% (for switching modes) */
export function amountsToPercents(total: number, amounts: number[]): number[] {
  if (total === 0) return amounts.map(() => 0);
  return allocate(
    WHOLE,
    amounts.map((a) => Math.round((a / total) * WHOLE * 100)),
  );
}

/** What's left to give a part: the total minus the parts so far (same sign as the total) */
export const leftToSplit = (total: number, amounts: number[]) =>
  total - amounts.reduce((a, b) => a + b, 0);
