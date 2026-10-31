import { readFileSync } from 'fs';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import Database from 'better-sqlite3';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { guideProgress } from '../db/schema.js';
import { guidesRouter } from './guides.js';
import { tokenAllows } from '../auth/accessTokens.js';
import { BACKUP_TABLES } from '../services/backupService.js';

let server: Server, base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/guides', guidesRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/guides`;
});
afterAll(() => server.close());
beforeEach(() => db.delete(guideProgress).run());

const send = async (method: string, path = '', body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

describe('guide progress', () => {
  it('a new budget offers the welcome tour with tips on', async () => {
    expect((await send('GET')).body).toEqual({
      tipsEnabled: true,
      pageGuidesEnabled: true,
      welcomeTour: 'offer',
      guidesNotice: false,
      seenGuides: {},
      dismissedTips: [],
    });
  });

  it('adds seen guides and dismissed tips to what is there', async () => {
    await send('PUT', '', { seenGuides: { welcome: 2, budget: 1 }, dismissedTips: ['a'] });
    // Another device, with an older idea of what was seen
    const { body } = await send('PUT', '', {
      seenGuides: { welcome: 1, accounts: 1 },
      dismissedTips: ['b', 'a'],
      welcomeTour: 'done',
      tipsEnabled: false,
    });
    expect(body.seenGuides).toEqual({ welcome: 2, budget: 1, accounts: 1 });
    expect(body.dismissedTips).toEqual(['a', 'b']);
    expect(body).toMatchObject({
      welcomeTour: 'done',
      tipsEnabled: false,
      pageGuidesEnabled: true,
    });
    expect((await send('GET')).body).toEqual(body);
  });

  it('refuses what the app never sends', async () => {
    for (const bad of [
      { seenGuides: { 'Not An Id': 1 } },
      { seenGuides: { welcome: 0 } },
      { welcomeTour: 'maybe' },
      { guidesNotice: true },
      { dismissedTips: 'a' },
      { somethingElse: 1 },
    ]) {
      expect((await send('PUT', '', bad)).status).toBe(400);
    }
    expect(db.select().from(guideProgress).all()).toEqual([]);
  });

  it('reset shows everything again but keeps the settings', async () => {
    await send('PUT', '', {
      seenGuides: { welcome: 1 },
      dismissedTips: ['a'],
      welcomeTour: 'dismissed',
      pageGuidesEnabled: false,
    });
    const { body } = await send('POST', '/reset');
    expect(body).toMatchObject({
      welcomeTour: 'offer',
      seenGuides: {},
      dismissedTips: [],
      pageGuidesEnabled: false,
      tipsEnabled: true,
    });
  });

  it('reads damaged stored lists as nothing seen', async () => {
    db.insert(guideProgress)
      .values({ id: 'default', seenGuides: 'not json', dismissedTips: '{"x":1}', welcomeTour: '?' })
      .run();
    expect((await send('GET')).body).toMatchObject({
      seenGuides: {},
      dismissedTips: [],
      welcomeTour: 'dismissed',
    });
  });

  it('is never reachable with an access token, and not in backups', () => {
    for (const scope of ['read', 'categorise', 'organise'] as const) {
      expect(tokenAllows(scope, 'GET', '/guides', undefined)).toBe(false);
      expect(tokenAllows(scope, 'PUT', '/guides', { tipsEnabled: false })).toBe(false);
      expect(tokenAllows(scope, 'POST', '/guides/reset', {})).toBe(false);
    }
    expect(BACKUP_TABLES).not.toContain('guideProgress');
  });
});

describe('migration 0058', () => {
  const statements = readFileSync('src/db/migrations/0058_guide_progress.sql', 'utf8').split(
    '--> statement-breakpoint',
  );
  const run = (setup: (d: Database.Database) => void) => {
    const d = new Database(':memory:');
    d.exec('create table accounts (id text primary key); create table transactions (id text);');
    setup(d);
    for (const s of statements) d.exec(s);
    return d.prepare('select * from guide_progress').all();
  };

  it('a budget already in use gets no tour or tips, and a note once', () => {
    expect(run((d) => d.exec("insert into accounts values ('a')"))).toMatchObject([
      { tips_enabled: 0, page_guides_enabled: 0, welcome_tour: 'dismissed', guides_notice: 1 },
    ]);
  });

  it('a new budget gets no row, so the defaults (tour offered, tips on)', () => {
    expect(run(() => {})).toEqual([]);
  });
});
