import { withinTolerance } from './matchingEngine.js';

// A recurring bill whose real payments have moved away from what it expects, like OVO expected at
// A$150 and paid A$107. The Household page offers "Update to A$107" or "Use the average of the
// last 3", and only the owner's click changes the amount. Minor units, positive.

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
 * tolerance of `expected` (the same rule Recurring matching uses), or there is no payment.
 * `payments` are newest first.
 */
export function billDrift(
  expected: number,
  amountType: string,
  payments: readonly { date: string; amount: number }[],
): BillDrift | null {
  const [last] = payments;
  if (!last || withinTolerance(amountType, last.amount, expected)) return null;
  const recent = payments.slice(0, DRIFT_AVERAGE_OF);
  const total = recent.reduce((sum, p) => sum + p.amount, 0);
  return {
    lastPaid: last.amount,
    lastDate: last.date,
    average: Math.round(total / recent.length),
    averageOf: recent.length,
  };
}
