import { withinTolerance } from './matchingEngine.js';

// A recurring bill whose real payments have moved away from what it expects, like power expected
// at A$120 and paid A$86.50. The Household page offers "Update to A$86.50" or "Use the average of the
// last 3", or "Keep A$120" when the change was intentional (a price rise not billed yet), and only the
// owner's click changes anything. Payments on or before the day the owner set or kept the amount are
// what they already saw, so they never flag it again. Minor units, positive.

/** How many recent payments the average uses */
export const DRIFT_AVERAGE_OF = 3;

export interface BillDrift {
  lastPaid: number;
  lastDate: string;
  /** Average of the newest DRIFT_AVERAGE_OF payments, rounded to the cent */
  average: number;
  /** How many payments that average used */
  averageOf: number;
}

/**
 * The drift prompt for a bill, or null when its newest payment is within the schedule's
 * tolerance of `expected` (the same rule Recurring matching uses), or there is no payment after
 * `confirmedAt`, the day the owner last set or kept the amount. `payments` are newest first.
 */
export function billDrift(
  expected: number,
  amountType: string,
  payments: readonly { date: string; amount: number }[],
  confirmedAt: string | null = null,
): BillDrift | null {
  const since = confirmedAt ? payments.filter((p) => p.date > confirmedAt) : payments;
  const [last] = since;
  if (!last || withinTolerance(amountType, last.amount, expected)) return null;
  const recent = since.slice(0, DRIFT_AVERAGE_OF);
  const total = recent.reduce((sum, p) => sum + p.amount, 0);
  return {
    lastPaid: last.amount,
    lastDate: last.date,
    average: Math.round(total / recent.length),
    averageOf: recent.length,
  };
}
