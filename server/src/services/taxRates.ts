// ATO rates by financial year (named by the year it starts: 2025 = 2025–26), in one place
// (docs/TAX-CAR-AND-HOME.md §5.2). Rates are tenths of a cent, so 70c is 700. A year that is not
// here has no rate until the owner types one: a rate is never guessed or carried forward.

/** Working from home, fixed rate method: tenths of a cent per hour */
export const HOME_HOURLY: Record<number, number> = { 2022: 670, 2023: 670, 2024: 700, 2025: 700 };

export const RATES_SOURCE = {
  homeHourly:
    'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/fixed-rate-method',
  /** When the rates above were last checked against the ATO's page */
  checked: '2026-11-08',
} as const;

/** The rate to use: the owner's typed override, else the table's, else none */
export function rateFor(
  table: Record<number, number>,
  fy: number,
  override: number | null,
): number | null {
  return override ?? table[fy] ?? null;
}
