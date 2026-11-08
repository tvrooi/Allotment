// D3b dividends and franking (docs/INVESTMENT-SALES-AND-INCOME.md §3 and §5.2): the ATO's rules
// for income from shares and funds, as pure functions. Amounts are integer minor units. Like the
// rest of Tax time this adds up what the statements say. The franking credit prefill is the
// form's (client/src/utils/franking.ts): the server keeps what the owner enters.

export const INCOME_KINDS = ['dividend', 'distribution', 'interest'] as const;
export type IncomeKind = (typeof INCOME_KINDS)[number];

/** Under this much in franking credits a year, the 45-day rule doesn't apply (the small shareholder exemption) */
export const SMALL_SHAREHOLDER_LIMIT = 500_000;

/** Days a share must be held at risk for its dividend's franking credit (90 for preference shares) */
export const HOLDING_PERIOD_DAYS = 45;

export interface IncomeFigures {
  kind: IncomeKind;
  /** In the budget's currency; null without an exchange rate */
  amount: number | null;
  unfranked: number | null;
  franked: number | null;
  frankingCredit: number | null;
  withheld: number | null;
}

export interface IncomeYearTotals {
  /** Item 11: dividends */
  dividends: {
    /** S: unfranked amount */
    unfranked: number;
    /** T: franked amount */
    franked: number;
    /** U: franking credit */
    frankingCredit: number;
    /** V: TFN amounts withheld */
    withheld: number;
    count: number;
  };
  /** Trust distributions: cash and franking only, the rest comes from the fund's tax statement */
  distributions: { amount: number; franked: number; frankingCredit: number; count: number };
  /** Item 10: gross interest (paid plus withheld) and TFN amounts withheld */
  interest: { gross: number; withheld: number; count: number };
  /** Rows left out because an amount couldn't be converted */
  unconverted: number;
}

/** A year's income added up by return item */
export function incomeYearTotals(rows: IncomeFigures[]): IncomeYearTotals {
  const out: IncomeYearTotals = {
    dividends: { unfranked: 0, franked: 0, frankingCredit: 0, withheld: 0, count: 0 },
    distributions: { amount: 0, franked: 0, frankingCredit: 0, count: 0 },
    interest: { gross: 0, withheld: 0, count: 0 },
    unconverted: 0,
  };
  for (const r of rows) {
    if (
      r.amount === null ||
      r.unfranked === null ||
      r.franked === null ||
      r.frankingCredit === null ||
      r.withheld === null
    ) {
      out.unconverted += 1;
      continue;
    }
    if (r.kind === 'dividend') {
      out.dividends.unfranked += r.unfranked;
      out.dividends.franked += r.franked;
      out.dividends.frankingCredit += r.frankingCredit;
      out.dividends.withheld += r.withheld;
      out.dividends.count += 1;
    } else if (r.kind === 'distribution') {
      out.distributions.amount += r.amount;
      out.distributions.franked += r.franked;
      out.distributions.frankingCredit += r.frankingCredit;
      out.distributions.count += 1;
    } else {
      out.interest.gross += r.amount + r.withheld;
      out.interest.withheld += r.withheld;
      out.interest.count += 1;
    }
  }
  return out;
}

/**
 * Whether a dividend's parts disagree with what was paid: unfranked + franked should be the
 * payment plus tax withheld. A prompt, not a refusal: statements can differ by rounding.
 */
export const partsDisagree = (r: {
  kind: IncomeKind;
  amount: number;
  unfranked: number;
  franked: number;
  withheld: number;
}) => r.kind === 'dividend' && r.unfranked + r.franked !== r.amount + r.withheld;

/** Days held at risk: not counting the day bought or the day sold */
function daysHeld(acquiredOn: string, soldOn: string): number {
  const day = (iso: string) =>
    Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;
  return day(soldOn) - day(acquiredOn) - 1;
}

/**
 * Franked payments that may fail the 45-day rule: units of the same holding bought on or before
 * the payment were sold after it having been held fewer than 45 days. A prompt for the owner to
 * check, shown only when the year's credits are over the small shareholder exemption.
 */
export function holdingPeriodConcerns(
  payments: { id: string; holdingId: string; paidOn: string; frankingCredit: number }[],
  parcels: { holdingId: string; acquiredOn: string; soldOn: string }[],
): string[] {
  return payments
    .filter(
      (p) =>
        p.frankingCredit > 0 &&
        parcels.some(
          (s) =>
            s.holdingId === p.holdingId &&
            s.acquiredOn <= p.paidOn &&
            s.soldOn >= p.paidOn &&
            daysHeld(s.acquiredOn, s.soldOn) < HOLDING_PERIOD_DAYS,
        ),
    )
    .map((p) => p.id);
}
