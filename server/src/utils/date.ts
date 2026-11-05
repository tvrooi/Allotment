// Calendar days (`YYYY-MM-DD`) and nothing else (audit F-22).
//
// A calendar day has no time zone, so arithmetic on one must not depend on the server's zone.
// Every helper that adds, subtracts or walks days works in UTC on the day number, where a day is
// always exactly 86,400,000 ms. Building a local-midnight `Date` and then reading it back through
// `toISOString()` is the pattern this module exists to replace: east of UTC it lands on the
// previous day (`2026-11-03` plus 14 gave `2026-11-16` in Sydney), and across a daylight-saving
// change at midnight a local-time walk can skip or repeat a day. The lint config bans
// `toISOString()` cut down to a date for that reason.
//
// Only `todayIso` and `localDayIso` read the machine's zone, on purpose: "today" is the day on
// the wall clock where the budget lives.

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` read as a UTC day number, or NaN when it is not a real calendar date */
function dayNumber(day: string): number {
  const m = ISO_DAY.exec(day);
  if (!m) return NaN;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(ms);
  // Date.UTC rolls 2026-02-30 over to 1 March; a real date reads back the same
  return d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3])
    ? Math.round(ms / DAY_MS)
    : NaN;
}

const fromDayNumber = (n: number): string => {
  const d = new Date(n * DAY_MS);
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/** Whether `value` is a real calendar date written `YYYY-MM-DD` (2026-02-30 is not) */
export const isIsoDay = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(dayNumber(value));

/** `day` plus `n` calendar days (negative for earlier). Throws on a day that does not exist. */
export function addDaysIso(day: string, n: number): string {
  const base = dayNumber(day);
  if (Number.isNaN(base)) throw new RangeError(`Not a calendar day: ${day}`);
  return fromDayNumber(base + Math.trunc(n));
}

/** `day` plus `n` calendar months, the day of the month kept or cut to the month's last day */
export function addMonthsIso(day: string, n: number): string {
  const base = dayNumber(day);
  if (Number.isNaN(base)) throw new RangeError(`Not a calendar day: ${day}`);
  const [y, m, d] = day.split('-').map(Number);
  const index = y * 12 + (m - 1) + Math.trunc(n);
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Whole days from `from` to `to` (negative when `to` is earlier) */
export function daysBetweenIso(from: string, to: string): number {
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (Number.isNaN(a) || Number.isNaN(b))
    throw new RangeError(`Not a calendar day: ${from} / ${to}`);
  return b - a;
}

/** Every day from `from` to `to` inclusive; empty when `to` is before `from` */
export function eachDayIso(from: string, to: string): string[] {
  const start = dayNumber(from);
  const end = dayNumber(to);
  if (Number.isNaN(start) || Number.isNaN(end))
    throw new RangeError(`Not a calendar day: ${from} / ${to}`);
  const days: string[] = [];
  for (let n = start; n <= end; n++) days.push(fromDayNumber(n));
  return days;
}

/** The day on the wall clock of `date` in this machine's zone */
export function localDayIso(date: Date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Today as `YYYY-MM-DD` on this machine */
export const todayIso = (): string => localDayIso();

/**
 * The UTC day of an instant. For a moment that is a date by itself in UTC (a provider's
 * midnight-UTC timestamp, the clock of a rate feed). Not for "today": that is `todayIso`.
 */
export function utcDayIso(instant: Date | number): string {
  const ms = typeof instant === 'number' ? instant : instant.getTime();
  return fromDayNumber(Math.floor(ms / DAY_MS));
}

export function monthBounds(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${month}-31` };
}
