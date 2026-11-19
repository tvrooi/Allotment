import {
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
} from 'date-fns';
import type { DatePresetCustom, ReportDateRange } from '../types';

/** Live presets roll forward with today; 'custom' is a frozen range with fixed dates. */
export const DATE_PRESETS: { id: DatePresetCustom; label: string; long: string }[] = [
  { id: '1m', label: '1M', long: 'This month' },
  { id: 'last-month', label: 'Last month', long: 'Last month' },
  { id: '3m', label: '3M', long: 'Last 3 months' },
  { id: '6m', label: '6M', long: 'Last 6 months' },
  { id: '12m', label: '12M', long: 'Last 12 months' },
  { id: 'ytd', label: 'YTD', long: 'Year to date' },
  { id: 'last-year', label: 'Last year', long: 'Last year' },
  { id: 'all', label: 'All', long: 'All time' },
  { id: 'custom', label: 'Custom', long: 'Custom' },
];

export function computeDateRange(
  preset: DatePresetCustom,
  now: Date = new Date(),
): { from: string; to: string } {
  const to = format(now, 'yyyy-MM');
  switch (preset) {
    case '1m':
      return { from: to, to };
    case 'last-month': {
      const last = format(subMonths(now, 1), 'yyyy-MM');
      return { from: last, to: last };
    }
    case '3m':
      return { from: format(subMonths(now, 2), 'yyyy-MM'), to };
    case '12m':
      return { from: format(subMonths(now, 11), 'yyyy-MM'), to };
    case 'ytd':
      return { from: format(startOfYear(now), 'yyyy-MM'), to };
    case 'last-year':
      return {
        from: format(startOfYear(subYears(now, 1)), 'yyyy-MM'),
        to: format(endOfYear(subYears(now, 1)), 'yyyy-MM'),
      };
    case 'all':
      return { from: '2020-01', to };
    default:
      return { from: format(subMonths(now, 5), 'yyyy-MM'), to };
  }
}

export const isFrozen = (range: ReportDateRange) => range.preset === 'custom';

/** A real yyyy-MM month (the server's `isoMonth` rule), not a half-typed one like "2026-1" */
export const isMonth = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/**
 * The months a saved range covers today: live presets are recomputed, frozen ones kept. A
 * frozen range with a broken month shows the last 6 months instead of crashing the report.
 */
export function resolveDateRange(range: ReportDateRange, now: Date = new Date()): ReportDateRange {
  if (isFrozen(range)) {
    if (isMonth(range.from) && isMonth(range.to) && range.from <= range.to) return range;
    return { preset: '6m', ...computeDateRange('6m', now) };
  }
  return { preset: range.preset, ...computeDateRange(range.preset, now) };
}

/** Pins a range to the months it currently covers. */
export const freezeDateRange = (
  range: ReportDateRange,
  now: Date = new Date(),
): ReportDateRange => ({
  ...resolveDateRange(range, now),
  preset: 'custom',
});

/** What a dashboard shows when its range was never changed. */
const DEFAULT_DASHBOARD_RANGE: ReportDateRange = { preset: '6m', ...computeDateRange('6m') };

export const dashboardDateRange = (page: { dateRange: ReportDateRange | null } | undefined) =>
  resolveDateRange(page?.dateRange ?? DEFAULT_DASHBOARD_RANGE);

/**
 * Where a widget's months come from: its dashboard (no range of its own), its own live
 * range, or its own frozen months.
 */
export type RangeSource = 'dashboard' | 'own' | 'frozen';

export function widgetDateRange(
  own: ReportDateRange | undefined,
  dashboard: ReportDateRange,
): { range: ReportDateRange; source: RangeSource } {
  if (!own) return { range: resolveDateRange(dashboard), source: 'dashboard' };
  return { range: resolveDateRange(own), source: isFrozen(own) ? 'frozen' : 'own' };
}

// A range as a URL parameter, e.g. "6m" (live) or "2025-01..2025-12" (frozen), so a
// dashboard can open the report builder showing the same months as its widget.
export function encodeRangeParam(range: ReportDateRange): string {
  return isFrozen(range) ? `${range.from}..${range.to}` : range.preset;
}

export function decodeRangeParam(param: string | null): ReportDateRange | undefined {
  if (!param) return undefined;
  const fixed = /^(\d{4}-(?:0[1-9]|1[0-2]))\.\.(\d{4}-(?:0[1-9]|1[0-2]))$/.exec(param);
  if (fixed) {
    const [, from, to] = fixed;
    return from <= to ? { preset: 'custom', from, to } : undefined;
  }
  const preset = DATE_PRESETS.find((p) => p.id === param && p.id !== 'custom');
  return preset && { preset: preset.id, ...computeDateRange(preset.id) };
}

/** "Oct 2026", or the text as it is if it isn't a month (never throws) */
export const formatMonth = (m: string) =>
  isMonth(m) ? format(parseISO(`${m}-01`), 'MMM yyyy') : m;

/** A month range as one line: "Nov 2026" when it is one month, else "Jan 2025 – Nov 2026" */
export const formatMonthRange = (from: string, to: string) =>
  from === to ? formatMonth(from) : `${formatMonth(from)} – ${formatMonth(to)}`;

export function formatDateRange(range: ReportDateRange): string {
  if (!isFrozen(range)) return DATE_PRESETS.find((p) => p.id === range.preset)?.long ?? '';
  return formatMonthRange(range.from, range.to);
}

/** A month range: two yyyy-MM months, `from` on or before `to` */
export interface MonthRange {
  from: string;
  to: string;
}

/**
 * The one rule a month range picker follows for every pick (MonthRangePicker, desktop and
 * phone): the month lands on its side and drags the other side with it, so a range never ends
 * before it starts. A pick that is not a real month, or is after `max`, changes nothing and
 * returns `range` itself. Months compare as strings only once `isMonth` has accepted them.
 */
export function pickRangeMonth(
  range: MonthRange,
  side: 'from' | 'to',
  month: string,
  max: string,
): MonthRange {
  if (!isMonth(month) || month > max) return range;
  if (side === 'from') return { from: month, to: range.to < month ? month : range.to };
  return { from: range.from > month ? month : range.from, to: month };
}

/** Month ranges up to this long plot a point per day instead of per month. */
export const DAILY_MAX_MONTHS = 3;

/** How many months a yyyy-MM range covers (0 when `to` is before `from`). */
export function monthCount(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return Math.max(0, ty * 12 + tm - (fy * 12 + fm) + 1);
}

/** Every month (yyyy-MM) from `from` to `to`, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const start = parseISO(`${from}-01`);
  return Array.from({ length: monthCount(from, to) }, (_, i) =>
    format(addMonths(start, i), 'yyyy-MM'),
  );
}

/**
 * The days (yyyy-MM-dd) a yyyy-MM range covers so far: its first day to its last, or to today
 * if that's earlier. `to` is before `from` when the range hasn't started yet.
 */
export function dayBounds(
  from: string,
  to: string,
  now: Date = new Date(),
): { from: string; to: string } {
  const last = format(endOfMonth(parseISO(`${to}-01`)), 'yyyy-MM-dd');
  const today = format(now, 'yyyy-MM-dd');
  return { from: `${from}-01`, to: today < last ? today : last };
}
