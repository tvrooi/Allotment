// D3a capital gains (docs/INVESTMENT-SALES-AND-INCOME.md §3 and §5.2): the ATO's rules for a sale
// of shares, units or coins, as pure functions so each rule is tested on its own. Amounts are
// integer minor units; quantities are millionths of a unit (investmentMath.ts). Nothing here
// guesses: a parcel without a known cost or exchange rate has an unknown gain, never zero.
import { mulDiv } from './investmentMath.js';

/** The 50% CGT discount for an individual, as a fraction of a discountable gain */
const DISCOUNT_DIVISOR = 2;

/**
 * The day a year after `date` (YYYY-MM-DD); 29 February is followed by 28 February, the last day
 * of the twelfth month after it
 */
function anniversary(date: string): string {
  const monthDay = date.slice(5) === '02-29' ? '02-28' : date.slice(5);
  return `${String(Number(date.slice(0, 4)) + 1).padStart(4, '0')}-${monthDay}`;
}

/**
 * Whether a gain gets the 50% discount: the asset was held for at least 12 months, not counting
 * the day it was bought or the day it was sold. Bought 1 January 2025: sold 1 January 2026 is
 * not eligible, sold 2 January 2026 is.
 */
export function discountEligible(acquiredOn: string, soldOn: string): boolean {
  return soldOn > anniversary(acquiredOn);
}

export interface AvailableLot {
  id: string;
  acquiredOn: string;
  createdAt: string;
  /** Units not yet taken by another sale */
  remaining: number;
}

export interface ParcelChoice {
  lotId: string;
  quantity: number;
}

/**
 * First in, first out: the oldest lots bought on or before the sale (ties by when they were
 * entered) give their remaining units until the sale is covered. `uncovered` is what no lot
 * could give.
 */
export function fifoParcels(
  lots: AvailableLot[],
  quantity: number,
  soldOn: string,
): { parcels: ParcelChoice[]; uncovered: number } {
  const ordered = lots
    .filter((l) => l.remaining > 0 && l.acquiredOn <= soldOn)
    .sort((a, b) =>
      a.acquiredOn === b.acquiredOn
        ? a.createdAt.localeCompare(b.createdAt)
        : a.acquiredOn.localeCompare(b.acquiredOn),
    );
  const parcels: ParcelChoice[] = [];
  let left = quantity;
  for (const lot of ordered) {
    if (left === 0) break;
    const take = Math.min(left, lot.remaining);
    parcels.push({ lotId: lot.id, quantity: take });
    left -= take;
  }
  return { parcels, uncovered: left };
}

/**
 * `total` split in proportion to `weights` (all > 0), in whole minor units that add up to it
 * exactly: each part rounded toward zero, the remainder on the largest weight (the first of equal
 * ones)
 */
export function apportion(total: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const sum = weights.reduce((s, w) => s + w, 0);
  const sign = total < 0 ? -1 : 1;
  // `|| 0`: no negative zero for an empty part of a loss
  const parts = weights.map((w) => sign * mulDiv(Math.abs(total), w, sum, 'down') || 0);
  let largest = 0;
  weights.forEach((w, i) => {
    if (w > weights[largest]) largest = i;
  });
  parts[largest] += total - parts.reduce((s, p) => s + p, 0);
  return parts;
}

export type UnknownReason =
  /** Units sold that no lot covers */
  | 'no_lot'
  /** The lot's cost isn't known */
  | 'no_cost'
  /** No exchange rate to the budget's currency on the purchase or sale date */
  | 'no_rate';

export interface SaleInput {
  soldOn: string;
  quantity: number;
  /** Gross proceeds and sale brokerage, in the security's currency */
  proceeds: number;
  fees: number;
}

export interface ParcelLot {
  id: string;
  acquiredOn: string;
  /** The lot's units and total cost when bought (null: not known) */
  quantity: number;
  costBasis: number | null;
}

export interface ParcelFigures {
  /** null: units no lot covers */
  lotId: string | null;
  acquiredOn: string | null;
  quantity: number;
  /** The parcel's share of the proceeds after sale brokerage, in the budget's currency */
  proceeds: number | null;
  /** Its share of the lot's cost, in the budget's currency at the purchase date */
  cost: number | null;
  gain: number | null;
  discountable: boolean;
  unknown: UnknownReason | null;
}

export interface SaleFigures {
  parcels: ParcelFigures[];
  /** Proceeds less sale brokerage, in the budget's currency (null without a rate) */
  proceeds: number | null;
  /** null when any parcel's is unknown */
  cost: number | null;
  gain: number | null;
  /** The gain of the parcels held long enough for the discount (before netting) */
  discountableGain: number;
}

/** Converts an amount in the security's currency to the budget's on a day; null: no rate */
export type ToBudget = (amount: number, date: string) => number | null;

/**
 * A sale's gain or loss, parcel by parcel. Cost and proceeds are each converted on their own
 * event's date (the purchase's and the sale's), never the gain. The proceeds after brokerage are
 * apportioned to parcels by units, so the parts add up to the sale.
 */
export function saleFigures(
  sale: SaleInput,
  parcels: { lot: ParcelLot; quantity: number }[],
  toBudget: ToBudget,
): SaleFigures {
  const covered = parcels.reduce((s, p) => s + p.quantity, 0);
  const uncovered = sale.quantity - covered;
  const proceeds = toBudget(sale.proceeds - sale.fees, sale.soldOn);
  const weights = [...parcels.map((p) => p.quantity), ...(uncovered > 0 ? [uncovered] : [])];
  const shares = proceeds === null ? null : apportion(proceeds, weights);

  const out: ParcelFigures[] = parcels.map((p, i) => {
    const share = shares?.[i] ?? null;
    // A lot of no units (consolidated away before this sale) has no cost to share out
    const ownCost =
      p.lot.costBasis === null || p.lot.quantity === 0
        ? null
        : mulDiv(p.lot.costBasis, p.quantity, p.lot.quantity);
    const cost = ownCost === null ? null : toBudget(ownCost, p.lot.acquiredOn);
    const unknown: UnknownReason | null =
      ownCost === null ? 'no_cost' : cost === null || share === null ? 'no_rate' : null;
    return {
      lotId: p.lot.id,
      acquiredOn: p.lot.acquiredOn,
      quantity: p.quantity,
      proceeds: share,
      cost,
      gain: unknown ? null : share! - cost!,
      discountable: discountEligible(p.lot.acquiredOn, sale.soldOn),
      unknown,
    };
  });
  if (uncovered > 0)
    out.push({
      lotId: null,
      acquiredOn: null,
      quantity: uncovered,
      proceeds: shares?.[shares.length - 1] ?? null,
      cost: null,
      gain: null,
      discountable: false,
      unknown: 'no_lot',
    });

  const known = out.every((p) => p.gain !== null);
  return {
    parcels: out,
    proceeds,
    cost: known ? out.reduce((s, p) => s + p.cost!, 0) : null,
    gain: known ? out.reduce((s, p) => s + p.gain!, 0) : null,
    discountableGain: out.reduce(
      (s, p) => s + (p.discountable && p.gain !== null && p.gain > 0 ? p.gain : 0),
      0,
    ),
  };
}

export interface NetCapitalGain {
  /** Item 18H: total current year capital gains, before losses and the discount */
  totalGains: number;
  /** Capital losses made this year */
  currentLosses: number;
  /** Net capital losses carried in from earlier years */
  lossesCarriedIn: number;
  /** Losses (this year's, then earlier years') used against this year's gains */
  lossesApplied: number;
  /** The 50% discount taken off what was left of the discountable gains */
  discount: number;
  /** Item 18A: net capital gain */
  netGain: number;
  /** Item 18V: net capital losses carried forward to later years */
  lossesCarriedForward: number;
  /** Parcels left out because their gain isn't known */
  unknownParcels: number;
}

/**
 * A year's net capital gain from its parcels' gains. This year's losses, then losses carried in,
 * reduce gains that get no discount first, then discountable ones, and the discount applies to
 * what is left (the order the ATO's own calculator uses: it gives the lowest net gain). A net
 * loss is carried forward; it never reduces other income.
 */
export function netCapitalGain(
  parcels: { gain: number | null; discountable: boolean }[],
  lossesCarriedIn: number,
): NetCapitalGain {
  let other = 0;
  let discountable = 0;
  let currentLosses = 0;
  let unknownParcels = 0;
  for (const p of parcels) {
    if (p.gain === null) unknownParcels += 1;
    else if (p.gain > 0) {
      if (p.discountable) discountable += p.gain;
      else other += p.gain;
    } else currentLosses -= p.gain;
  }
  const totalGains = other + discountable;
  let current = currentLosses;
  let carried = lossesCarriedIn;
  const use = (gain: number, losses: number) => {
    const used = Math.min(gain, losses);
    return [gain - used, losses - used] as const;
  };
  [other, current] = use(other, current);
  [discountable, current] = use(discountable, current);
  [other, carried] = use(other, carried);
  [discountable, carried] = use(discountable, carried);
  const discount = Math.floor(discountable / DISCOUNT_DIVISOR);
  return {
    totalGains,
    currentLosses,
    lossesCarriedIn,
    lossesApplied: currentLosses - current + (lossesCarriedIn - carried),
    discount,
    netGain: other + discountable - discount,
    lossesCarriedForward: current + carried,
    unknownParcels,
  };
}
