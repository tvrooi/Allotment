import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import fc from 'fast-check';
import { db } from '../db/index.js';
import { accounts, budgetSettings, scheduleOccurrences, schedules } from '../db/schema.js';
import { buildRecurrenceRule } from '../utils/recurrence.js';
import { ensureOccurrences, regenerateFutureOccurrences } from './scheduleService.js';
import { updateBudgetSettings } from './mainAmountService.js';
import {
  FIRST_REMINDER_HOUR,
  LAST_REMINDER_HOUR,
  dueReminders,
  reminderMessage,
  sendDueReminders,
} from './reminderService.js';

// FINX-02: bill and payday reminders. A stub stands in for Home Assistant's notify service.

beforeAll(() => migrate(db, { migrationsFolder: 'src/db/migrations' }));

beforeEach(() => {
  for (const table of [scheduleOccurrences, schedules, accounts, budgetSettings])
    db.delete(table).run();
  db.insert(accounts)
    .values({
      id: 'everyday',
      name: 'Everyday',
      type: 'checking',
      currency: 'AUD',
      createdAt: '2026-01-01',
    })
    .run();
});
afterEach(() => vi.useRealTimers());

// Local time, so the tests read the same in any zone the runner uses
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0, 0);

function bill(values: Partial<typeof schedules.$inferInsert> = {}) {
  const id = values.id ?? 'rent';
  db.insert(schedules)
    .values({
      id,
      name: 'Rent',
      amount: -150_000,
      recurrenceType: 'monthly',
      recurrenceRule: JSON.stringify(buildRecurrenceRule('monthly', '2026-10-15')),
      startDate: '2026-10-15',
      accountId: 'everyday',
      reminderDays: 3,
      ...values,
    })
    .run();
  ensureOccurrences(id, '2026-12-31');
  return id;
}

function setup(over: Partial<{ service: string | null; details: boolean }> = {}) {
  updateBudgetSettings({
    reminderNotifyService: over.service === undefined ? 'mobile_app_phone' : over.service,
    reminderShowDetails: over.details ? 1 : 0,
  });
  const sent: { service: string; title: string; message: string }[] = [];
  const notify = async (service: string, title: string, message: string) => {
    sent.push({ service, title, message });
  };
  return { sent, notify };
}

describe('sendDueReminders', () => {
  it('sends nothing until a notify service is chosen', async () => {
    bill();
    const { sent, notify } = setup({ service: null });
    expect(await sendDueReminders(notify, at(2026, 10, 13))).toBe(0);
    expect(sent).toEqual([]);
  });

  it('sends one generic message when a bill comes within its lead, and never again', async () => {
    bill();
    const { sent, notify } = setup();
    // The 15th is 4 days away on the 11th: outside a 3-day lead
    expect(await sendDueReminders(notify, at(2026, 10, 11))).toBe(0);
    expect(await sendDueReminders(notify, at(2026, 10, 12))).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].service).toBe('mobile_app_phone');
    expect(sent[0].message).toContain('in 3 days');
    // Generic: nothing a lock screen should show
    expect(sent[0].title + sent[0].message).not.toMatch(/rent|1,?500|150000/i);
    // Later ticks, the next day, the day itself: still just the one
    expect(await sendDueReminders(notify, at(2026, 10, 12, 15))).toBe(0);
    expect(await sendDueReminders(notify, at(2026, 10, 13))).toBe(0);
    expect(await sendDueReminders(notify, at(2026, 10, 15))).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('names the bill and amount only when the owner opted in', async () => {
    bill();
    const { sent, notify } = setup({ details: true });
    await sendDueReminders(notify, at(2026, 10, 14));
    expect(sent[0].message).toBe('Rent: -$1,500.00 tomorrow');
  });

  it('reminds about a payday as well, in one message with the bills', async () => {
    bill();
    bill({ id: 'pay', name: 'Pay', amount: 300_000, reminderDays: 1 });
    const { sent, notify } = setup({ details: true });
    expect(await sendDueReminders(notify, at(2026, 10, 14))).toBe(2);
    expect(sent).toHaveLength(1);
    expect(sent[0].message.split('\n').sort()).toEqual([
      'Pay: $3,000.00 tomorrow',
      'Rent: -$1,500.00 tomorrow',
    ]);
  });

  it('is off for a schedule with no lead, a paused one, and an occurrence already paid or skipped', async () => {
    bill({ id: 'none', name: 'None', reminderDays: null });
    bill({ id: 'paused', name: 'Paused', status: 'paused' });
    bill({ id: 'paid', name: 'Paid' });
    bill({ id: 'skipped', name: 'Skipped' });
    for (const [id, status] of [
      ['paid', 'paid'],
      ['skipped', 'skipped'],
    ] as const)
      db.update(scheduleOccurrences)
        .set({ status })
        .where(eq(scheduleOccurrences.scheduleId, id))
        .run();
    const { sent, notify } = setup();
    expect(await sendDueReminders(notify, at(2026, 10, 14))).toBe(0);
    expect(sent).toEqual([]);
  });

  it('keeps quiet overnight and sends when the morning comes', async () => {
    bill();
    const { sent, notify } = setup();
    expect(await sendDueReminders(notify, at(2026, 10, 14, FIRST_REMINDER_HOUR - 1))).toBe(0);
    expect(await sendDueReminders(notify, at(2026, 10, 14, LAST_REMINDER_HOUR + 1))).toBe(0);
    expect(sent).toEqual([]);
    expect(await sendDueReminders(notify, at(2026, 10, 14, FIRST_REMINDER_HOUR))).toBe(1);
  });

  it('marks nothing when the send fails, so the next hour tries again', async () => {
    bill();
    setup();
    const failing = async () => {
      throw new Error('Home Assistant has no notify.mobile_app_phone service');
    };
    await expect(sendDueReminders(failing, at(2026, 10, 14))).rejects.toThrow(/no notify/);
    expect(dueReminders('2026-10-14')).toHaveLength(1);
    const { sent, notify } = setup();
    expect(await sendDueReminders(notify, at(2026, 10, 14, 10))).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('does not remind again after an edit remakes the occurrences', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(2026, 10, 12));
    const id = bill();
    const { sent, notify } = setup();
    expect(await sendDueReminders(notify)).toBe(1);
    // The pattern changed (a weekend rule, say): future occurrences are made again
    db.update(schedules).set({ weekendAdjust: 'none' }).where(eq(schedules.id, id)).run();
    regenerateFutureOccurrences(id);
    expect(
      db
        .select()
        .from(scheduleOccurrences)
        .where(eq(scheduleOccurrences.scheduledDate, '2026-10-15'))
        .get()?.remindedAt,
    ).toBeTruthy();
    expect(await sendDueReminders(notify)).toBe(0);
    expect(sent).toHaveLength(1);
  });
});

describe('reminderMessage', () => {
  const item = (daysAway: number, name = 'Secret bill') => ({
    occurrenceId: 'o',
    name,
    amount: -12_345,
    currency: 'AUD',
    expectedDate: '2026-10-15',
    daysAway,
  });

  it('says nothing about what or how much unless asked (property-based)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 30 }), { minLength: 1, maxLength: 6 }),
        (days) => {
          const { title, message } = reminderMessage(
            days.map((d) => item(d)),
            false,
          );
          expect(title + message).not.toMatch(/secret|123/i);
        },
      ),
    );
  });

  it('counts the items and names the first day', () => {
    expect(reminderMessage([item(0)], false).message).toContain('due today');
    expect(reminderMessage([item(1)], false).message).toContain('due tomorrow');
    expect(reminderMessage([item(2), item(5)], false).message).toContain('2 scheduled items');
  });
});
