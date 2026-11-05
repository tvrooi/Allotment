import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  budgetSettings,
  scheduleOccurrences,
  schedules,
  transactions,
} from '../db/schema.js';
import { buildRecurrenceRule } from '../utils/recurrence.js';
import { ensureOccurrencesForAll } from './scheduleService.js';
import { runScheduleTick, startScheduleTimer, SCHEDULE_TICK_MS } from './scheduleTimer.js';

// FINX-01: schedules keep up with the calendar while the server stays up

beforeAll(() => migrate(db, { migrationsFolder: 'src/db/migrations' }));

beforeEach(() => {
  for (const table of [scheduleOccurrences, schedules, transactions, accounts, budgetSettings])
    db.delete(table).run();
  db.insert(accounts)
    .values({ id: 'everyday', name: 'Everyday', type: 'checking', createdAt: '2026-01-01' })
    .run();
});

afterEach(() => vi.useRealTimers());

function monthlyBill(values: Partial<typeof schedules.$inferInsert> = {}) {
  db.insert(schedules)
    .values({
      id: 'rent',
      name: 'Rent',
      amount: -50_000,
      recurrenceType: 'monthly',
      recurrenceRule: JSON.stringify(buildRecurrenceRule('monthly', '2026-10-15')),
      startDate: '2026-10-15',
      accountId: 'everyday',
      autoCreate: 1,
      ...values,
    })
    .run();
}

const created = () =>
  db.select().from(transactions).where(eq(transactions.scheduleId, 'rent')).all();

// Local noon, so the test reads the same in any time zone the runner uses
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);

describe('runScheduleTick', () => {
  it('creates what is due, once, and nothing the second time', () => {
    monthlyBill();
    ensureOccurrencesForAll('2026-12-31');

    expect(runScheduleTick('2026-10-14').created).toBe(0);
    expect(created()).toHaveLength(0);

    expect(runScheduleTick('2026-10-15').created).toBe(1);
    expect(created()).toMatchObject([{ date: '2026-10-15', amount: -50_000 }]);

    expect(runScheduleTick('2026-10-15').created).toBe(0);
    expect(created()).toHaveLength(1);
  });

  it('never creates before the automatic-from date', () => {
    monthlyBill({ autoCreateFrom: '2026-11-15' });
    expect(runScheduleTick('2026-10-20').created).toBe(0);
    expect(runScheduleTick('2026-11-15').created).toBe(1);
    expect(created().map((t) => t.date)).toEqual(['2026-11-15']);
  });

  it('keeps occurrences 90 days ahead of the day it runs', () => {
    monthlyBill();
    runScheduleTick('2026-10-01');
    const last = (): string =>
      db
        .select()
        .from(scheduleOccurrences)
        .all()
        .map((o) => o.expectedDate)
        .sort()
        .at(-1)!;
    // 2026-10-01 + 90 days = 2026-12-30: the December bill is stored, January's is not
    expect(last()).toBe('2026-12-15');
    // The server stays up and the calendar moves on: the horizon moves with it
    runScheduleTick('2026-12-01');
    expect(last()).toBe('2027-02-15');
    runScheduleTick('2026-12-01');
    expect(db.select().from(scheduleOccurrences).all()).toHaveLength(5);
  });
});

describe('startScheduleTimer', () => {
  it('posts a bill due tomorrow once the clock crosses midnight, with no restart', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(at(2026, 10, 14, 9));
    monthlyBill();
    ensureOccurrencesForAll('2026-12-31');
    const stop = startScheduleTimer();
    try {
      vi.advanceTimersByTime(SCHEDULE_TICK_MS * 12); // 9pm: still the 14th
      expect(created()).toHaveLength(0);
      vi.advanceTimersByTime(SCHEDULE_TICK_MS * 4); // 1am on the 15th
      expect(created()).toHaveLength(1);
      vi.advanceTimersByTime(SCHEDULE_TICK_MS * 24); // a day of ticks later: nothing new
      expect(created()).toHaveLength(1);
    } finally {
      stop();
    }
  });

  it('makes an occurrence past the old 90-day horizon without a restart', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(at(2026, 10, 1));
    monthlyBill();
    runScheduleTick();
    const count = () => db.select().from(scheduleOccurrences).all().length;
    const before = count();
    const stop = startScheduleTimer();
    try {
      vi.setSystemTime(at(2027, 1, 20));
      vi.advanceTimersByTime(SCHEDULE_TICK_MS);
      expect(count()).toBeGreaterThan(before);
    } finally {
      stop();
    }
  });

  it('waits for the startup bank sync and for a sync in progress', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(at(2026, 10, 15, 8));
    monthlyBill();
    ensureOccurrencesForAll('2026-12-31');
    let release!: () => void;
    const ready = new Promise<void>((resolve) => (release = resolve));
    let syncing = false;
    const stop = startScheduleTimer({ ready, busy: () => syncing });
    try {
      vi.advanceTimersByTime(SCHEDULE_TICK_MS);
      expect(created()).toHaveLength(0); // startup sync not finished
      release();
      await ready;
      syncing = true;
      vi.advanceTimersByTime(SCHEDULE_TICK_MS);
      expect(created()).toHaveLength(0); // a sync is running: real bank rows match first
      syncing = false;
      vi.advanceTimersByTime(SCHEDULE_TICK_MS);
      expect(created()).toHaveLength(1);
    } finally {
      stop();
    }
  });

  it('logs a failing tick and keeps ticking, and stops when asked', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(at(2026, 10, 15, 8));
    const errors: unknown[] = [];
    let ticks = 0;
    const stop = startScheduleTimer({
      onResult: () => {
        if (++ticks === 1) throw new Error('database is locked');
      },
      onError: (e) => errors.push(e),
    });
    vi.advanceTimersByTime(SCHEDULE_TICK_MS * 3);
    expect(ticks).toBe(3);
    expect(errors).toHaveLength(1);
    stop();
    vi.advanceTimersByTime(SCHEDULE_TICK_MS * 3);
    expect(ticks).toBe(3);
  });

  it('runs follow-up work after every tick, reports its failure, and never overlaps itself', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(at(2026, 10, 15, 8));
    const errors: unknown[] = [];
    let calls = 0;
    let release!: () => void;
    const stop = startScheduleTimer({
      afterTick: () => {
        calls++;
        if (calls === 1) return new Promise<void>((resolve) => (release = resolve));
        return Promise.reject(new Error('no notify service'));
      },
      onError: (e) => errors.push(e),
    });
    try {
      vi.advanceTimersByTime(SCHEDULE_TICK_MS * 3); // the first call is still in flight
      expect(calls).toBe(1);
      release();
      await vi.advanceTimersByTimeAsync(SCHEDULE_TICK_MS);
      expect(calls).toBe(2);
      expect(errors).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(SCHEDULE_TICK_MS); // a failure does not stop it
      expect(calls).toBe(3);
    } finally {
      stop();
    }
  });
});
