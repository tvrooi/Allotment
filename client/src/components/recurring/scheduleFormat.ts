import { formatCurrency } from '../../utils/currency';
import {
  addMonths,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  parseISO,
  startOfMonth,
} from 'date-fns';
import {
  RECURRENCE_TYPE_LABELS,
  type AmountType,
  type DiscoveredHousehold,
  type ScheduleOccurrence,
  type ScheduleScope,
} from '../../types';
import type { RecurringBadgeStatus } from './StatusBadge';

export const FREQ_LABEL = new Map(RECURRENCE_TYPE_LABELS.map((f) => [f.value, f.label]));

/** Money in that is the owner's: household money in (a housemate's share) is not income */
export const isIncomeAmount = (amount: number, scope?: ScheduleScope) =>
  amount > 0 && scope?.kind !== 'household';

/** Actual-style amount: `~` prefix when not exact, `+` prefix for income. */
export function formatScheduleAmount(
  amount: number,
  amountType: AmountType,
  income = amount > 0,
): string {
  const approx = amountType !== 'exact' ? '~' : '';
  const sign = income ? '+' : '';
  return `${approx}${sign}${formatCurrency(Math.abs(amount))}`;
}

/** What a household item is, in a few words: "Contribution from Juno · 2Up" */
export function householdLabel(scope: ScheduleScope | undefined): string | null {
  if (scope?.kind !== 'household') return null;
  if (scope.role === 'bill') return `Shared bill · ${scope.groupName}`;
  return `${scope.personName ? `Contribution from ${scope.personName}` : 'Contribution'} · ${scope.groupName}`;
}

/** A discovered item in a household's account: "Household contribution · 2Up" */
export const discoveredHouseholdLabel = (h: DiscoveredHousehold) =>
  `${h.role === 'bill' ? 'Household bill' : 'Household contribution'} · ${h.groupName}`;

/**
 * Recurring occurrences by whose money they are, for every view of them (Recurring → Monthly,
 * the dashboard): `income` is the owner's money in, `expenses` the owner's money out plus their
 * share of each household bill (a copy of the occurrence at the share, with `shareOf` the full
 * amount), and `household` the household's own items in full, bills and contributions.
 * Housemates' money is never income, and a shared bill never counts at its full amount.
 */
export function groupOccurrences(occurrences: ScheduleOccurrence[]) {
  const sorted = [...occurrences].sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  const income: ScheduleOccurrence[] = [];
  const expenses: ScheduleOccurrence[] = [];
  const household: ScheduleOccurrence[] = [];
  for (const o of sorted) {
    const scope = o.scope;
    if (scope?.kind !== 'household') {
      (o.expectedAmount > 0 ? income : expenses).push(o);
      continue;
    }
    household.push(o);
    if (scope.role !== 'bill') continue;
    const gross = Math.abs(o.expectedAmount);
    const share = Math.min(gross, scope.myShare ?? gross);
    // A payment that differed from the expected amount: the same part of what was paid
    const paidShare =
      o.matchedAmount === null || !gross
        ? null
        : -Math.round((share * Math.abs(o.matchedAmount)) / gross);
    if (share > 0)
      expenses.push({
        ...o,
        scheduleName: `Your share of ${o.scheduleName} (${scope.groupName})`,
        expectedAmount: -share,
        matchedAmount: paidShare,
        shareOf: gross,
      });
  }
  return { income, expenses, household };
}

// ─── Upcoming length (port of Actual Budget's getUpcomingDays) ───────────────

export const DEFAULT_UPCOMING_LENGTH = '7';

export const UPCOMING_PRESETS: { value: string; label: string }[] = [
  { value: '1', label: '1 day' },
  { value: '7', label: '1 week' },
  { value: '14', label: '2 weeks' },
  { value: 'oneMonth', label: '1 month' },
  { value: 'currentMonth', label: 'End of the current month' },
];

export const isCustomUpcomingLength = (v: string) => !UPCOMING_PRESETS.some((p) => p.value === v);

/** Number of days after today that still count as "upcoming". */
export function getUpcomingDays(
  length: string = DEFAULT_UPCOMING_LENGTH,
  today = new Date(),
): number {
  switch (length) {
    case 'currentMonth':
      return differenceInCalendarDays(endOfMonth(today), today);
    case 'oneMonth':
      return differenceInCalendarDays(addMonths(startOfMonth(today), 1), startOfMonth(today));
    default: {
      if (length.includes('-')) {
        const [num, unit] = length.split('-');
        const value = Math.max(1, parseInt(num, 10) || 1);
        switch (unit) {
          case 'day':
            return value;
          case 'week':
            return value * 7;
          case 'month':
            return differenceInCalendarDays(addMonths(today, value), today);
          case 'year':
            return differenceInCalendarDays(addYears(today, value), today);
        }
      }
      return parseInt(length, 10) || 7;
    }
  }
}

export function describeUpcomingLength(length: string): string {
  const preset = UPCOMING_PRESETS.find((p) => p.value === length);
  if (preset) return preset.label;
  const [num, unit] = length.split('-');
  const n = Math.max(1, parseInt(num, 10) || 1);
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/**
 * Badge status for an occurrence, following Actual's getStatus(): pending dates
 * beyond the upcoming window show as "Scheduled" instead of "Upcoming".
 */
export function occurrenceBadgeStatus(
  occ: ScheduleOccurrence,
  upcomingDays: number,
): RecurringBadgeStatus {
  if (
    occ.displayStatus === 'upcoming' &&
    differenceInCalendarDays(parseISO(occ.expectedDate), new Date()) > upcomingDays
  )
    return 'scheduled';
  return occ.displayStatus;
}
