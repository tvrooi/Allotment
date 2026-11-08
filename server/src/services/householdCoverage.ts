// Whether a household account can pay the bills coming up: the Household page's gauge, like
// the coverage dial in Up's Essentials. A projection only: it reads the ledger and the bills
// and never writes. Integer minor units throughout.

/** How far ahead the gauge looks */
export const COVERAGE_DAYS = 30;

export interface CoverageItem {
  /** The shared recurring item's schedule id, or the one-off household bill's id */
  id: string;
  source: 'recurring' | 'bill';
  name: string;
  /** Expected date (a one-off bill can be overdue, so earlier than `from`) */
  date: string;
  /** Positive minor units still to pay */
  amount: number;
  /** Each person's part of `amount`; they add up to it unless a fixed split doesn't */
  shares: { personId: string; amount: number }[];
}

export interface Coverage {
  from: string;
  to: string;
  /** What the household accounts hold now */
  cash: number;
  /** Bills due by `to`, in date order */
  due: CoverageItem[];
  /** Their total */
  needed: number;
  /** How much of `needed` the cash already covers (never below 0) */
  covered: number;
  /** `needed - covered`: what still has to be paid in before the bills leave */
  shortfall: number;
  /** Per person: their part of the bills due, and what they paid in since the month began */
  people: { personId: string; shareDue: number; paidIn: number }[];
}

/**
 * The gauge: the household accounts' `cash` against the bills `due` by `to`. Contributions count
 * from the first of `from`'s month, so each person's row reads "paid in since 1 Nov".
 */
export function householdCoverage(input: {
  from: string;
  to: string;
  cash: number;
  due: CoverageItem[];
  members: { id: string }[];
  contributions: { payerId: string | null; date: string; amount: number }[];
}): Coverage {
  const { from, to, cash, members } = input;
  const due = input.due
    .filter((d) => d.amount > 0 && d.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const needed = due.reduce((sum, d) => sum + d.amount, 0);
  const covered = Math.max(0, Math.min(cash, needed));
  const monthStart = `${from.slice(0, 7)}-01`;
  return {
    from,
    to,
    cash,
    due,
    needed,
    covered,
    shortfall: needed - covered,
    people: members.map((m) => ({
      personId: m.id,
      shareDue: due.reduce(
        (sum, d) => sum + d.shares.reduce((n, s) => n + (s.personId === m.id ? s.amount : 0), 0),
        0,
      ),
      paidIn: input.contributions
        .filter((c) => c.payerId === m.id && c.date >= monthStart && c.date <= from)
        .reduce((sum, c) => sum + c.amount, 0),
    })),
  };
}
