import { daysBetweenIso } from '../../utils/calendarDay';
import { formatDay } from '../../utils/dates';

/** Up's "Expecting next payment in 3 days": a shared bill's next date in words */
export function dueLabel(
  nextDate: string | null,
  today: string,
): { text: string; tone: 'soon' | 'later' } | null {
  if (!nextDate) return null;
  const days = daysBetweenIso(today, nextDate);
  if (days < 0) return { text: `Overdue since ${formatDay(nextDate)}`, tone: 'soon' };
  if (days === 0) return { text: 'Due today', tone: 'soon' };
  if (days === 1) return { text: 'Due tomorrow', tone: 'soon' };
  if (days <= 7) return { text: `Due in ${days} days`, tone: 'soon' };
  return { text: `Due ${formatDay(nextDate)}`, tone: 'later' };
}
