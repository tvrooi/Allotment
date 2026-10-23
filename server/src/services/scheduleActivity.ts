/**
 * "Possibly ended": an active recurring item whose last two occurrences went by with no
 * payment. A stopped subscription would otherwise show as Missed every month and keep being
 * forecast. Nothing is changed automatically; the user cancels it (history is kept) or says
 * it's still active.
 */
import { addDays, format, parseISO } from 'date-fns';
import { and, eq, inArray, lt, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { scheduleOccurrences, schedules } from '../db/schema.js';

/** Missed occurrences in a row that make an item look ended */
export const MISSED_IN_A_ROW = 2;

type Occ = { expectedDate: string; status: string; matchedTransactionId: string | null };

/**
 * Whether the latest occurrences past their flexibility window were all missed: pending with
 * no transaction. Skipped ones don't count either way; a paid one means it's alive. Misses on
 * or before `confirmedActiveAt` ("Still active") are ignored.
 */
export function looksEnded(
  occurrences: Occ[],
  today: string,
  flexibility: number,
  confirmedActiveAt: string | null,
): boolean {
  const cutoff = format(addDays(parseISO(today), -flexibility), 'yyyy-MM-dd');
  const latest = occurrences
    .filter(
      (o) =>
        o.expectedDate < cutoff &&
        o.status !== 'skipped' &&
        o.status !== 'cancelled' &&
        (!confirmedActiveAt || o.expectedDate > confirmedActiveAt),
    )
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))
    .slice(-MISSED_IN_A_ROW);
  return (
    latest.length === MISSED_IN_A_ROW &&
    latest.every((o) => o.status === 'pending' && !o.matchedTransactionId)
  );
}

/** Active, repeating items that look ended today */
export function possiblyEndedIds(today = format(new Date(), 'yyyy-MM-dd')): Set<string> {
  const active = db
    .select()
    .from(schedules)
    .where(and(eq(schedules.status, 'active'), ne(schedules.recurrenceType, 'once')))
    .all();
  if (!active.length) return new Set();
  const bySchedule = new Map<string, Occ[]>();
  for (const o of db
    .select({
      scheduleId: scheduleOccurrences.scheduleId,
      expectedDate: scheduleOccurrences.expectedDate,
      status: scheduleOccurrences.status,
      matchedTransactionId: scheduleOccurrences.matchedTransactionId,
    })
    .from(scheduleOccurrences)
    .where(lt(scheduleOccurrences.expectedDate, today))
    .all()) {
    const list = bySchedule.get(o.scheduleId) ?? [];
    list.push(o);
    bySchedule.set(o.scheduleId, list);
  }
  return new Set(
    active
      .filter((s) =>
        looksEnded(bySchedule.get(s.id) ?? [], today, s.dateFlexibility, s.confirmedActiveAt),
      )
      .map((s) => s.id),
  );
}

/** What ending an item changed, so undo can put exactly that back */
export interface EndedChanges {
  skipped: string[];
  cancelled: string[];
}

/**
 * Cancel an item that ended: like Cancel recurring (paid history stays, upcoming occurrences
 * are cancelled), and the payments that never came are skipped rather than left as missed.
 */
export function endSchedule(id: string, today = format(new Date(), 'yyyy-MM-dd')): EndedChanges {
  return db.transaction(() => {
    const pending = db
      .select()
      .from(scheduleOccurrences)
      .where(and(eq(scheduleOccurrences.scheduleId, id), eq(scheduleOccurrences.status, 'pending')))
      .all()
      .filter((o) => !o.matchedTransactionId);
    // Due or missed is decided by the expected date (after weekend adjustment), as everywhere else
    const skipped = pending.filter((o) => o.expectedDate < today).map((o) => o.id);
    const cancelled = pending.filter((o) => o.expectedDate >= today).map((o) => o.id);
    if (skipped.length)
      db.update(scheduleOccurrences)
        .set({ status: 'skipped', skippedAt: today })
        .where(inArray(scheduleOccurrences.id, skipped))
        .run();
    if (cancelled.length)
      db.update(scheduleOccurrences)
        .set({ status: 'cancelled' })
        .where(inArray(scheduleOccurrences.id, cancelled))
        .run();
    db.update(schedules)
      .set({ status: 'canceled', updatedAt: new Date().toISOString() })
      .where(eq(schedules.id, id))
      .run();
    return { skipped, cancelled };
  });
}

/** Undo endSchedule: active again, and only the occurrences it changed back to pending */
export function reopenSchedule(id: string, changes: EndedChanges) {
  db.transaction(() => {
    for (const [status, ids] of [
      ['skipped', changes.skipped],
      ['cancelled', changes.cancelled],
    ] as const)
      if (ids.length)
        db.update(scheduleOccurrences)
          .set({ status: 'pending', skippedAt: null })
          .where(
            and(
              eq(scheduleOccurrences.scheduleId, id),
              eq(scheduleOccurrences.status, status),
              inArray(scheduleOccurrences.id, ids),
            ),
          )
          .run();
    db.update(schedules)
      .set({ status: 'active', updatedAt: new Date().toISOString() })
      .where(eq(schedules.id, id))
      .run();
  });
}
