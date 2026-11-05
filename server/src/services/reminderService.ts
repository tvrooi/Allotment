// Bill and payday reminders (FINX-02).
//
// A schedule can say "remind me N days ahead" (`reminder_days`; null = never). The hourly schedule
// timer (scheduleTimer.ts) then sends one Home Assistant notification for the occurrences that
// have come within their lead, and marks each one (`reminded_at`) so it is never sent twice, even
// after a restart or an edit that remakes the occurrences (regenerateFutureOccurrences keeps it).
//
// Rules that matter on a phone's lock screen:
//   - off until the owner picks a notify service (Settings → Server → Reminders);
//   - the text is generic ("2 scheduled items are due soon") unless the owner opts in to names
//     and amounts, because a lock screen shows the message to whoever is holding the phone;
//   - one message per tick however many items are due, and none overnight;
//   - a failed send marks nothing, so the next hour tries again, and is logged by the timer.
import { and, asc, eq, gte, isNotNull, isNull, like, lte, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, scheduleOccurrences, schedules, transactions } from '../db/schema.js';
import { minorUnits } from '../utils/currencies.js';
import { addDaysIso, daysBetweenIso, localDayIso } from '../utils/date.js';
import type { Notify } from '../gateway/notify.js';
import { getBudgetSettings } from './mainAmountService.js';

/** The longest lead a schedule can ask for */
export const MAX_REMINDER_DAYS = 30;
/** Reminders go out from 8 am to 8:59 pm on the wall clock, never overnight */
export const FIRST_REMINDER_HOUR = 8;
export const LAST_REMINDER_HOUR = 20;

export interface DueReminder {
  occurrenceId: string;
  name: string;
  amount: number;
  currency: string | null;
  expectedDate: string;
  daysAway: number;
}

/** Occurrences that have come within their schedule's lead, unpaid or just auto-posted, not yet reminded */
export function dueReminders(today: string): DueReminder[] {
  const rows = db
    .select({
      occurrenceId: scheduleOccurrences.id,
      name: schedules.name,
      amount: scheduleOccurrences.expectedAmount,
      currency: accounts.currency,
      expectedDate: scheduleOccurrences.expectedDate,
      reminderDays: schedules.reminderDays,
    })
    .from(scheduleOccurrences)
    .innerJoin(schedules, eq(schedules.id, scheduleOccurrences.scheduleId))
    .leftJoin(accounts, eq(accounts.id, schedules.accountId))
    .leftJoin(transactions, eq(transactions.id, scheduleOccurrences.matchedTransactionId))
    .where(
      and(
        eq(schedules.status, 'active'),
        isNotNull(schedules.reminderDays),
        // Pending, or posted by the schedule itself (an auto-create bill is "paid" the moment the
        // timer creates it, which is before the morning's reminder). A payment from the bank or by
        // hand is a real payment: nothing left to remind about.
        or(
          eq(scheduleOccurrences.status, 'pending'),
          and(eq(scheduleOccurrences.status, 'paid'), like(transactions.importedId, 'schedule:%')),
        ),
        isNull(scheduleOccurrences.remindedAt),
        gte(scheduleOccurrences.expectedDate, today),
        lte(scheduleOccurrences.expectedDate, addDaysIso(today, MAX_REMINDER_DAYS)),
      ),
    )
    .orderBy(asc(scheduleOccurrences.expectedDate), asc(schedules.name))
    .all();
  return rows
    .map((r) => ({
      occurrenceId: r.occurrenceId,
      name: r.name,
      amount: r.amount,
      currency: r.currency,
      expectedDate: r.expectedDate,
      daysAway: daysBetweenIso(today, r.expectedDate),
    }))
    .filter((r, i) => r.daysAway <= (rows[i].reminderDays ?? -1));
}

const when = (daysAway: number) =>
  daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`;

function money(amount: number, currency: string | null): string {
  const digits = minorUnits(currency);
  const value = Math.abs(amount) / 10 ** digits;
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currencyDisplay: 'narrowSymbol',
      currency: currency ?? 'USD',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return value.toFixed(digits);
  }
}

/** The notification's title and text for what is due (items are in date order) */
export function reminderMessage(items: DueReminder[], showDetails: boolean) {
  const title = 'Allotment: coming up';
  if (showDetails)
    return {
      title,
      message: items
        .map(
          (i) =>
            `${i.name}: ${i.amount < 0 ? '-' : ''}${money(i.amount, i.currency)} ${when(i.daysAway)}`,
        )
        .join('\n'),
    };
  const first = when(items[0].daysAway);
  return {
    title,
    message:
      items.length === 1
        ? `A scheduled item is due ${first}. Open Allotment to see it.`
        : `${items.length} scheduled items are due soon, the first ${first}. Open Allotment to see them.`,
  };
}

/**
 * Sends one notification for everything that is due, then marks those occurrences. Returns how
 * many occurrences it reminded about (0 when off, outside the daytime window, or nothing is due).
 */
export async function sendDueReminders(notify: Notify, now: Date = new Date()): Promise<number> {
  const settings = getBudgetSettings();
  const service = settings.reminderNotifyService;
  if (!service) return 0;
  const hour = now.getHours();
  if (hour < FIRST_REMINDER_HOUR || hour > LAST_REMINDER_HOUR) return 0;

  const items = dueReminders(localDayIso(now));
  if (!items.length) return 0;
  const { title, message } = reminderMessage(items, settings.reminderShowDetails === 1);
  await notify(service, title, message);

  const stamp = now.toISOString();
  db.transaction((tx) => {
    for (const i of items)
      tx.update(scheduleOccurrences)
        .set({ remindedAt: stamp })
        .where(eq(scheduleOccurrences.id, i.occurrenceId))
        .run();
  });
  return items.length;
}
