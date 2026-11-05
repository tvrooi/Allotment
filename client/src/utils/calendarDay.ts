// Calendar days (`YYYY-MM-DD`) and nothing else (audit F-22). The twin of the server's
// `utils/date.ts`: a day has no time zone, so adding days works on the UTC day number, where a
// day is always 24 hours. Never cut `toISOString()` down to a date for a calendar day: it is the
// UTC day, which is the previous one for the morning hours east of UTC (the lint config bans it).
const DAY_MS = 86_400_000;

/** Whether `value` is a real calendar date written `YYYY-MM-DD` (2026-02-30 is not) */
export function isIsoDay(value: string | null | undefined): value is string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return (
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3])
  );
}

/** `day` plus `n` calendar days (negative for earlier) */
export function addDaysIso(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d) + Math.trunc(n) * DAY_MS);
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** The day on the wall clock of `date` on this device */
export function localDayIso(date: Date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Today as `YYYY-MM-DD` on this device */
export const todayIso = (): string => localDayIso();
