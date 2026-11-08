// Household lists open on recent entries, newest first, rather than every entry since the
// household began. "Recent" is counted back from the newest entry, not from today, so a quiet
// household still shows its last activity and the result does not depend on the clock.

const monthIndex = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;

/** The first day of the month `back` months before the month of `day` (a real YYYY-MM-DD) */
export function monthStartBefore(day: string, back: number): string {
  const index = monthIndex(day) - back;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
}

export interface RecentEntries<T> {
  /** Newest first */
  shown: T[];
  /** Entries older than the window */
  older: number;
  /** The `months` that Show older moves to: the next hidden entry's month and `step - 1` more */
  more: number;
}

/**
 * Entries newest first, limited to the newest entry's month and the `months - 1` months before
 * it. `months` of Infinity shows everything. Ties keep the input order reversed, so entries the
 * server sorted by date then id come back in exactly the reverse order.
 */
export function recentEntries<T extends { date: string }>(
  entries: readonly T[],
  months: number,
  step = 3,
): RecentEntries<T> {
  const newestFirst = [...entries].reverse().sort((a, b) => b.date.localeCompare(a.date));
  if (!Number.isFinite(months) || newestFirst.length === 0) {
    return { shown: newestFirst, older: 0, more: months };
  }
  const since = monthStartBefore(newestFirst[0].date, Math.max(1, months) - 1);
  const shown = newestFirst.filter((e) => e.date >= since);
  const older = newestFirst.length - shown.length;
  // Never a click that reveals nothing: reach the next hidden entry however far back it is
  const next = newestFirst[shown.length];
  const more = next ? monthIndex(newestFirst[0].date) - monthIndex(next.date) + step : months;
  return { shown, older, more };
}
