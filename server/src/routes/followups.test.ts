import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { addDays, format, subMonths } from 'date-fns';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  forecastScenarios,
  payees,
  scheduleOccurrences,
  schedules,
  transactions,
} from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { exportRouter } from './export.js';
import { forecastRouter } from './forecast.js';
import { payeesRouter } from './payees.js';
import { schedulesRouter } from './schedules.js';
import { endSchedule } from '../services/scheduleActivity.js';

// Category follow-ups, recurring near misses and "possibly ended", and saved forecast
// scenarios (docs/research/monarch-flybudget-seamless-ux.md, P2). Mock data only.

const today = new Date();
const iso = (d: Date) => format(d, 'yyyy-MM-dd');
let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  db.insert(accounts)
    .values({ id: 'mock', name: 'Mock account', type: 'checking', createdAt: '2026-01-01' })
    .run();
  db.insert(categoryGroups).values({ id: 'living', name: 'Living' }).run();
  db.insert(categories).values({ id: 'fun', name: 'Fun', groupId: 'living' }).run();
  db.insert(payees)
    .values([
      { id: 'gym', name: 'Mock gym' },
      { id: 'stream', name: 'Mock streaming' },
    ])
    .run();
  // A weekly gym charge whose price keeps changing: regular, but not "the same amount"
  const latest = addDays(today, -2);
  db.insert(transactions)
    .values(
      [-1500, -1500, -2100, -1500].map((amount, i) => ({
        id: `gym${i}`,
        accountId: 'mock',
        date: iso(addDays(latest, -7 * (3 - i))),
        amount,
        payeeId: 'gym',
        payeeName: 'Mock gym',
        categoryId: 'fun',
      })),
    )
    .run();
  const app = express();
  app.use((req, res, next) =>
    req.path === '/api/export/restore' ? next() : express.json()(req, res, next),
  );
  app.use('/api/forecast', forecastRouter);
  app.use('/api/schedules', schedulesRouter);
  app.use('/api/payees', payeesRouter);
  app.use('/api/export', exportRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

const send = async <T = any>(method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
};

describe('recurring', () => {
  it('explains a payee that looks recurring but was not found', async () => {
    const { body } = await send('GET', '/schedules/discover');
    expect(body.found.map((f: any) => f.payeeId)).not.toContain('gym');
    expect(body.nearMisses).toEqual([
      expect.objectContaining({
        payeeId: 'gym',
        reason: 'amounts_vary',
        recurrenceType: 'weekly',
        count: 4,
        amount: -1500,
        minAmount: -2100,
        maxAmount: -1500,
        categoryId: 'fun',
      }),
    ]);
  });

  it('flags an item whose last two payments never came, until it is confirmed', async () => {
    const created = await send('POST', '/schedules', {
      name: 'Mock streaming',
      amount: -1299,
      recurrenceType: 'monthly',
      startDate: iso(subMonths(today, 3)),
      payeeId: 'stream',
      accountId: 'mock',
    });
    expect(created.status).toBe(201);
    const ended = async () =>
      (await send('GET', '/schedules')).body.find((s: any) => s.id === created.body.id)
        .possiblyEnded;
    expect(await ended()).toBe(true);

    // The forecast leaves it out and says so
    const forecast = (await send('POST', '/forecast', { scenarios: [{ name: 'Base' }] })).body;
    expect(forecast.assumptions.join(' ')).toMatch(/Mock streaming/);
    expect(forecast.scenarios[0].events.some((e: any) => e.description === 'Mock streaming')).toBe(
      false,
    );

    await send('PUT', `/schedules/${created.body.id}`, { confirmedActiveAt: iso(today) });
    expect(await ended()).toBe(false);
  });

  it('ends an item: missed payments are skipped, upcoming ones cancelled, and undo is exact', async () => {
    const created = await send('POST', '/schedules', {
      name: 'Mock magazine',
      amount: -999,
      recurrenceType: 'monthly',
      startDate: iso(subMonths(today, 3)),
      accountId: 'mock',
    });
    const id = created.body.id;
    const statuses = async () =>
      (await send('GET', `/schedules/${id}`)).body.occurrences.map((o: any) => o.status).sort();
    const before = await statuses();
    const ended = await send('POST', `/schedules/${id}/end`);
    expect(ended.body.skipped.length).toBeGreaterThanOrEqual(2);
    expect(ended.body.cancelled.length).toBeGreaterThanOrEqual(1);
    expect((await statuses()).every((s: string) => s === 'skipped' || s === 'cancelled')).toBe(
      true,
    );
    expect((await send('GET', `/schedules/${id}`)).body.status).toBe('canceled');

    await send('POST', `/schedules/${id}/reopen`, ended.body);
    expect(await statuses()).toEqual(before);
    expect((await send('GET', `/schedules/${id}`)).body.status).toBe('active');
  });
});

describe('ending a weekend-adjusted item', () => {
  it('sorts occurrences into missed and upcoming by their expected date', () => {
    db.insert(schedules)
      .values({
        id: 'weekend',
        name: 'Weekend-adjusted',
        amount: -500,
        recurrenceType: 'monthly',
        startDate: '2026-08-01',
        weekendAdjust: 'after',
      })
      .run();
    // Scheduled on Saturday 24 Oct, expected Monday 26 Oct: still to come on Sunday 25 Oct
    const occ = (id: string, scheduledDate: string, expectedDate: string) => ({
      id,
      scheduleId: 'weekend',
      scheduledDate,
      expectedDate,
      expectedAmount: -500,
    });
    db.insert(scheduleOccurrences)
      .values([occ('sep', '2026-09-26', '2026-09-28'), occ('oct', '2026-10-24', '2026-10-26')])
      .run();
    expect(endSchedule('weekend', '2026-10-25')).toEqual({ skipped: ['sep'], cancelled: ['oct'] });
  });
});

describe('payees', () => {
  it('remembers not to offer category follow-ups', async () => {
    expect((await send('PUT', '/payees/gym', { skipCategoryFollowup: 1 })).body).toMatchObject({
      skipCategoryFollowup: 1,
    });
    expect((await send('PUT', '/payees/gym', { skipCategoryFollowup: 2 })).status).toBe(400);
  });
});

describe('saved forecast scenarios', () => {
  const tuned = { name: 'Lean', spendingPercent: 80, oneOffs: [] };

  it('saves, refuses a stale version and deletes', async () => {
    const created = await send('POST', '/forecast/scenarios', { scenario: tuned });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      version: 1,
      scenario: { name: 'Lean', spendingPercent: 80, incomePercent: 100 },
    });
    const id = created.body.id;
    expect((await send('POST', '/forecast/scenarios', { scenario: { name: 'lean' } })).status).toBe(
      409,
    );

    // Device A saves on top of version 1; device B, still on version 1, is refused
    const a = await send('PUT', `/forecast/scenarios/${id}`, {
      scenario: { ...tuned, spendingPercent: 75 },
      expectedVersion: 1,
    });
    expect(a.body.version).toBe(2);
    const b = await send('PUT', `/forecast/scenarios/${id}`, {
      scenario: { ...tuned, spendingPercent: 90 },
      expectedVersion: 1,
    });
    expect(b.status).toBe(409);
    expect(b.body.current).toMatchObject({ version: 2, scenario: { spendingPercent: 75 } });
    expect((await send('DELETE', `/forecast/scenarios/${id}?expectedVersion=1`)).status).toBe(409);

    const list = (await send('GET', '/forecast/scenarios')).body;
    expect(list).toHaveLength(1);
    expect((await send('DELETE', `/forecast/scenarios/${id}?expectedVersion=2`)).status).toBe(204);
    expect((await send('GET', '/forecast/scenarios')).body).toEqual([]);
    const gone = await send('PUT', `/forecast/scenarios/${id}`, {
      scenario: tuned,
      expectedVersion: 2,
    });
    expect(gone).toMatchObject({ status: 409, body: { current: null } });
  });

  it('round-trips in backups and restores a format 12 backup without them', async () => {
    await send('POST', '/forecast/scenarios', { scenario: tuned });
    const backup = (await send('GET', '/export/backup')).body;
    expect(backup.version).toBe(20);
    expect(backup.forecastScenarios).toHaveLength(1);
    const restore = (body: unknown) =>
      fetch(`${base}/export/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await restore(backup)).status).toBe(200);
    expect(db.select().from(forecastScenarios).all()).toHaveLength(1);
    expect(db.select().from(payees).where(eq(payees.id, 'gym')).get()!.skipCategoryFollowup).toBe(
      1,
    );

    const old = { ...backup, version: 12 };
    delete old.forecastScenarios;
    old.payees = backup.payees.map(({ skipCategoryFollowup: _s, ...p }: any) => p);
    expect((await restore(old)).status).toBe(200);
    expect(db.select().from(forecastScenarios).all()).toEqual([]);
    expect(db.select().from(payees).where(eq(payees.id, 'gym')).get()!.skipCategoryFollowup).toBe(
      0,
    );

    const bad = {
      ...backup,
      forecastScenarios: [
        { ...backup.forecastScenarios[0], assumptions: '{"spendingPercent":-1}' },
      ],
    };
    expect((await restore(bad)).status).toBe(400);
  });
});
