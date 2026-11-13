/** What Ready to assign last showed: the month, and whether it was fully budgeted ($0) */
export interface ReadySeen {
  month: string;
  full: boolean;
}

/**
 * The sprout tick grows in only when you bring this month to $0 while looking at it (#241):
 * opening a month that is already fully budgeted, or switching to one, shows it still.
 */
export function reachedZeroNow(prev: ReadySeen | null, month: string, full: boolean): boolean {
  return full && prev !== null && prev.month === month && !prev.full;
}
