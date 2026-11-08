// D3b (docs/INVESTMENT-SALES-AND-INCOME.md §3): the franking credit a franked dividend carries,
// as a prefill for the form. The statement states the credit; the owner keeps or corrects this.

/** Company tax rates a credit is worked out at, in basis points: 30%, or 25% for base-rate entities */
export const FRANKING_RATES_BPS = [3_000, 2_500] as const;

/**
 * The company tax already paid on a franked amount (minor units): franked × rate ÷ (1 − rate),
 * rounded half away from zero, exactly. 30%: $70 franked carries a $30 credit.
 */
export function frankingCredit(franked: number, rateBps: number): number {
  const n = BigInt(franked) * BigInt(rateBps);
  const d = BigInt(10_000 - rateBps);
  const q = n / d;
  return Number((n % d) * 2n >= d ? q + 1n : q);
}
