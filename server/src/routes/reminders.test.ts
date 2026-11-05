import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { budgetSettings } from '../db/schema.js';
import { createRemindersRouter } from './reminders.js';
import { schedulesRouter } from './schedules.js';
import { accountsRouter } from './accounts.js';

// FINX-02: choosing where reminders go, and giving a schedule its lead

let server: Server;
let base: string;
let available = true;
const sent: [string, string, string][] = [];
let failWith: Error | null = null;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use(
    '/api/reminders',
    createRemindersRouter(
      async (service, title, message) => {
        if (failWith) throw failWith;
        sent.push([service, title, message]);
      },
      () => available,
    ),
  );
  app.use('/api/accounts', accountsRouter);
  app.use('/api/schedules', schedulesRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());
beforeEach(() => {
  db.delete(budgetSettings).run();
  available = true;
  failWith = null;
  sent.length = 0;
});

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

describe('reminder settings', () => {
  it('start off, and say whether this install can send them', async () => {
    expect((await call('GET', '/reminders')).body).toEqual({
      available: true,
      service: null,
      showDetails: false,
    });
    available = false;
    expect((await call('GET', '/reminders')).body.available).toBe(false);
  });

  it('save a service and the detail choice', async () => {
    const saved = await call('PUT', '/reminders', {
      service: 'mobile_app_phone',
      showDetails: true,
    });
    expect(saved.body).toEqual({ available: true, service: 'mobile_app_phone', showDetails: true });
    expect((await call('GET', '/reminders')).body.service).toBe('mobile_app_phone');
    expect(
      (await call('PUT', '/reminders', { service: null, showDetails: false })).body.service,
    ).toBeNull();
  });

  it.each([
    ['a service with a dot', { service: 'notify.phone', showDetails: false }],
    ['a service with a slash', { service: 'a/../b', showDetails: false }],
    ['an upper-case service', { service: 'Phone', showDetails: false }],
    ['an empty service', { service: '', showDetails: false }],
    ['a missing choice', { service: 'phone' }],
    ['an extra field', { service: 'phone', showDetails: false, extra: 1 }],
  ])('refuse %s and keep what was saved', async (_label, body) => {
    await call('PUT', '/reminders', { service: 'kept', showDetails: false });
    expect((await call('PUT', '/reminders', body)).status).toBe(400);
    expect((await call('GET', '/reminders')).body.service).toBe('kept');
  });

  it('refuse a service where Home Assistant is not there, but allow switching off', async () => {
    available = false;
    const res = await call('PUT', '/reminders', { service: 'phone', showDetails: false });
    expect(res.status).toBe(409);
    expect((await call('PUT', '/reminders', { service: null, showDetails: false })).status).toBe(
      200,
    );
  });
});

describe('the test message', () => {
  it('sends a generic message to the chosen service', async () => {
    await call('PUT', '/reminders', { service: 'mobile_app_phone', showDetails: false });
    expect((await call('POST', '/reminders/test')).body).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0][0]).toBe('mobile_app_phone');
  });

  it('needs a service, and says so', async () => {
    expect((await call('POST', '/reminders/test')).status).toBe(409);
    expect(sent).toHaveLength(0);
  });

  it('reports a failure as 422, never a 5xx that reads as "server down"', async () => {
    await call('PUT', '/reminders', { service: 'nope', showDetails: false });
    failWith = new Error('Home Assistant has no notify.nope service');
    const res = await call('POST', '/reminders/test');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Home Assistant has no notify.nope service');
  });
});

describe('a schedule’s reminder lead', () => {
  const base_ = {
    name: 'Rent',
    amount: -150_000,
    recurrenceType: 'monthly',
    startDate: '2026-12-15',
  };

  it('is kept when set, changed alone, and cleared with null', async () => {
    const made = await call('POST', '/schedules', { ...base_, reminderDays: 3 });
    expect(made.status).toBe(201);
    expect(made.body.reminderDays).toBe(3);
    // Pausing must not wipe it (an update schema built on the create one would reset it)
    const paused = await call('PUT', `/schedules/${made.body.id}`, { status: 'paused' });
    expect(paused.body.reminderDays).toBe(3);
    expect(
      (await call('PUT', `/schedules/${made.body.id}`, { reminderDays: 0 })).body.reminderDays,
    ).toBe(0);
    expect(
      (await call('PUT', `/schedules/${made.body.id}`, { reminderDays: null })).body.reminderDays,
    ).toBeNull();
  });

  it('is off unless asked for, and bounded', async () => {
    const plain = await call('POST', '/schedules', base_);
    expect(plain.body.reminderDays).toBeNull();
    for (const bad of [-1, 31, 1.5, '3'])
      expect((await call('POST', '/schedules', { ...base_, reminderDays: bad })).status).toBe(400);
  });
});
