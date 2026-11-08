// D3c splits and consolidations (docs/INVESTMENT-SALES-AND-INCOME.md §4): how a split changes the
// number of units, as pure functions so each rule is tested on its own. A split is an event with
// a date and a ratio; it never rewrites a lot or a sale parcel. Quantities are millionths of a
// unit (investmentMath.ts). Splitting changes neither cost nor acquired date and is not a CGT event.

/** The largest `toUnits` or `fromUnits` the owner may enter (a 1,000-for-1 split is already extreme) */
export const SPLIT_RATIO_MAX = 100_000;

export interface Split {
  /** The first day on which units are counted after the split */
  effectiveOn: string;
  /** 2 and 1 for a 2-for-1 split; 1 and 3 for a 1-for-3 consolidation */
  toUnits: number;
  fromUnits: number;
}

export function validRatio(toUnits: number, fromUnits: number): boolean {
  const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= SPLIT_RATIO_MAX;
  return ok(toUnits) && ok(fromUnits) && toUnits !== fromUnits;
}

export interface Scaled {
  units: number;
  /** false: a fraction of a millionth of a unit was dropped (or, going back, added) */
  exact: boolean;
}

/** `quantity` × `numerator` ÷ `divisor`, rounded down (or up with `up`), as a safe integer */
function scale(quantity: number, numerator: number, divisor: number, up: boolean): Scaled {
  const n = BigInt(quantity) * BigInt(numerator);
  const d = BigInt(divisor);
  const q = n / d;
  const exact = n % d === 0n;
  const result = Number(up && !exact ? q + 1n : q);
  if (!Number.isSafeInteger(result)) throw new RangeError('Value is out of range');
  return { units: result, exact };
}

/** `quantity` units before a split counted after it (`back`: after counted before it) */
export function scaleUnits(
  quantity: number,
  split: Pick<Split, 'toUnits' | 'fromUnits'>,
  direction: 'forward' | 'back' = 'forward',
): Scaled {
  return direction === 'forward'
    ? scale(quantity, split.toUnits, split.fromUnits, false)
    : scale(quantity, split.fromUnits, split.toUnits, true);
}

/**
 * `quantity` units counted on `from`, counted on `to` instead, through the splits between them
 * (`splits` in the order they happened). Going forward each split multiplies, rounding down:
 * a unit that isn't whole after a consolidation is never rounded up into one. Going back it
 * divides, rounding up, so the units a sale took are never understated. A split counts from its
 * own effective date: units on that date are already the new units.
 */
export function unitsBetween(quantity: number, from: string, to: string, splits: Split[]): Scaled {
  let units = quantity;
  let exact = true;
  if (from < to) {
    for (const s of splits) {
      if (s.effectiveOn <= from || s.effectiveOn > to) continue;
      const r = scale(units, s.toUnits, s.fromUnits, false);
      units = r.units;
      exact &&= r.exact;
    }
  } else if (from > to) {
    for (let i = splits.length - 1; i >= 0; i -= 1) {
      const s = splits[i];
      if (s.effectiveOn <= to || s.effectiveOn > from) continue;
      const r = scale(units, s.fromUnits, s.toUnits, true);
      units = r.units;
      exact &&= r.exact;
    }
  }
  return { units, exact };
}

/** A lot's units on a day: as recorded when bought, scaled by the splits since (none before it) */
export function lotUnitsOn(
  lot: { acquiredOn: string; quantity: number },
  splits: Split[],
  date: string,
): Scaled {
  // Before it was bought a lot has no units to scale
  return unitsBetween(
    lot.quantity,
    lot.acquiredOn,
    date < lot.acquiredOn ? lot.acquiredOn : date,
    splits,
  );
}
