// P3 investments (docs/INVESTMENTS.md): valuing a manual position. Pure, so the rules are
// tested on their own. Amounts are integer minor units of the security's currency; quantities
// are integer millionths of a unit. Nothing here guesses: a missing price gives no value and a
// missing cost gives no gain, never a zero.

/** Quantities are stored in millionths of a unit */
export const UNIT_SCALE = 1_000_000;

/** A price older than this (in days) before the valuation date is shown as stale */
export const STALE_PRICE_DAYS = 7;

export type BasisStatus =
  /** Every unit is in a lot with a known cost */
  | 'complete'
  /** Lots cover every unit, but some have no known cost */
  | 'partial'
  /** No lot has a known cost (or there are no lots) */
  | 'missing'
  /** The lots add up to a different number of units than the holding */
  | 'mismatch';

export interface LotInput {
  quantity: number;
  costBasis: number | null;
}

export interface PriceInput {
  date: string;
  price: number;
}

export interface Valuation {
  /** The price used: the latest on or before the valuation date */
  price: number | null;
  priceDate: string | null;
  priceStale: boolean;
  /** quantity × price, or null without a price */
  value: number | null;
  lotQuantity: number;
  /** Units in lots with a known cost, and what those units cost */
  knownBasisQuantity: number;
  knownBasis: number;
  basisStatus: BasisStatus;
  /** Only when every unit's cost is known */
  costBasis: number | null;
  /** value − cost basis: unrealized, before tax and fees not in the cost */
  unrealizedGain: number | null;
  /** The gain as a percentage of cost, null when the cost is zero */
  gainPercent: number | null;
}

/** a × b / c, rounded half away from zero, as a safe integer */
function mulDiv(a: number, b: number, c: number): number {
  const n = BigInt(a) * BigInt(b);
  const d = BigInt(c);
  const q = n / d;
  const r = n % d;
  const twice = (r < 0n ? -r : r) * 2n;
  const rounded = twice >= d ? q + (n < 0n ? -1n : 1n) : q;
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new RangeError('Value is out of range');
  return result;
}

/** What `quantity` (millionths) units are worth at `price` (minor units per unit) */
export function positionValue(quantity: number, price: number): number {
  return mulDiv(quantity, price, UNIT_SCALE);
}

const dayNumber = (iso: string) =>
  Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;

/** The latest price on or before `asOf` (prices in any order) */
export function priceOn(prices: PriceInput[], asOf: string): PriceInput | null {
  let best: PriceInput | null = null;
  for (const p of prices) {
    if (p.date <= asOf && (!best || p.date > best.date)) best = p;
  }
  return best;
}

export function valueHolding(
  quantity: number,
  lots: LotInput[],
  prices: PriceInput[],
  asOf: string,
): Valuation {
  const found = priceOn(prices, asOf);
  let value: number | null = null;
  try {
    if (found) value = positionValue(quantity, found.price);
  } catch {
    // Too large to count exactly: shown as unvalued rather than rounded
  }

  let lotQuantity = 0;
  let knownBasisQuantity = 0;
  let knownBasis = 0;
  for (const lot of lots) {
    lotQuantity += lot.quantity;
    if (lot.costBasis !== null) {
      knownBasisQuantity += lot.quantity;
      knownBasis += lot.costBasis;
    }
  }

  let basisStatus: BasisStatus;
  if (lots.length && lotQuantity !== quantity) basisStatus = 'mismatch';
  else if (!lots.length || knownBasisQuantity === 0) basisStatus = 'missing';
  else if (knownBasisQuantity === quantity) basisStatus = 'complete';
  else basisStatus = 'partial';

  const costBasis = basisStatus === 'complete' ? knownBasis : null;
  const unrealizedGain = costBasis !== null && value !== null ? value - costBasis : null;
  const gainPercent =
    unrealizedGain !== null && costBasis
      ? Math.round((unrealizedGain / costBasis) * 10_000) / 100
      : null;

  return {
    price: found?.price ?? null,
    priceDate: found?.date ?? null,
    priceStale: !!found && dayNumber(asOf) - dayNumber(found.date) > STALE_PRICE_DAYS,
    value,
    lotQuantity,
    knownBasisQuantity,
    knownBasis,
    basisStatus,
    costBasis,
    unrealizedGain,
    gainPercent,
  };
}
