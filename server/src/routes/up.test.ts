import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, sql } from 'drizzle-orm';
import { db, sqlite } from '../db/index.js';
import { accounts, transactions, upAccountMappings, upConnections } from '../db/schema.js';
import { upRouter } from './up.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';
import { linkTransfer } from '../services/transferService.js';
import { syncUp } from '../services/upSyncService.js';
import { getUpTransactions, validateUpPage } from '../services/upService.js';
import { startUpMock, UP_TEST_TOKEN } from '../test/upMock.js';

let mock: Awaited<ReturnType<typeof startUpMock>>;
let server: Server;
let base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  mock = await startUpMock();
  process.env.FLYBUDGET_UP_API = mock.base;
  const app = express();
  app.use(express.json());
  app.use('/up', upRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/up`;
});
afterAll(async () => {
  await mock.close();
  server.close();
  delete process.env.FLYBUDGET_UP_API;
});
beforeEach(() => {
  db.delete(upConnections).run();
  db.delete(transactions).run();
  db.delete(accounts).run();
  mock.setMode('normal');
});
const request = (path: string, data?: unknown, method = 'POST') =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
const setup = () => request('/setup', { accessToken: UP_TEST_TOKEN });
async function mapSpending() {
  expect((await setup()).ok).toBe(true);
  expect(
    (
      await request('/map-accounts', {
        mappings: [
          { upAccountId: 'spending', action: 'create' },
          { upAccountId: 'saver', action: 'skip' },
        ],
      })
    ).ok,
  ).toBe(true);
  return db
    .select()
    .from(upAccountMappings)
    .where(eq(upAccountMappings.upAccountId, 'spending'))
    .get()!.accountId!;
}

describe('native Up integration', () => {
  it('validates a token before saving it and never exposes it in responses or backups', async () => {
    expect((await request('/setup', { accessToken: 'wrong' })).status).toBe(422);
    expect(db.select().from(upConnections).all()).toHaveLength(0);
    expect((await setup()).status).toBe(200);
    const stored = sqlite.prepare('select access_token from up_connections').get() as {
      access_token: string;
    };
    expect(stored.access_token).toMatch(/^enc:v1:/);
    const response = await (await request('/connection', undefined, 'GET')).text();
    expect(response).not.toContain(UP_TEST_TOKEN);
    expect(JSON.stringify(createBackup())).not.toContain(UP_TEST_TOKEN);
    expect(JSON.stringify(createBackup())).not.toContain('accessToken');
  });
  it('imports all pages, skips holds, deduplicates and preserves user edits', async () => {
    const id = await mapSpending();
    expect(await syncUp()).toMatchObject({ added: 2, errors: [] });
    expect(db.select().from(transactions).all()).toHaveLength(2);
    expect(db.select().from(accounts).where(eq(accounts.id, id)).get()!.startingBalance).toBe(0);
    const coffee = db
      .select()
      .from(transactions)
      .where(eq(transactions.importedId, 'up:spending:coffee'))
      .get()!;
    db.update(transactions)
      .set({ notes: 'My note', payeeName: 'My coffee', reconciled: 1 })
      .where(eq(transactions.id, coffee.id))
      .run();
    expect(await syncUp()).toMatchObject({ added: 0, skipped: 2, errors: [] });
    expect(
      db.select().from(transactions).where(eq(transactions.id, coffee.id)).get(),
    ).toMatchObject({ notes: 'My note', payeeName: 'My coffee', reconciled: 1 });
  });
  it('imports an explicit round-up pair once, without changing the purchase or counting the boost twice', async () => {
    await setup();
    await request('/map-accounts', {
      mappings: [
        { upAccountId: 'spending', action: 'create' },
        { upAccountId: 'saver', action: 'create' },
      ],
    });
    mock.setMode('round-ups');
    expect(await syncUp()).toMatchObject({ added: 4, errors: [] });
    const find = (importedId: string) =>
      db.select().from(transactions).where(eq(transactions.importedId, importedId)).get()!;
    const purchase = find('up:spending:purchase');
    const debit = find('up:spending:round-debit');
    const credit = find('up:saver:round-credit');
    expect(purchase.amount).toBe(-1760);
    expect(debit.amount).toBe(-240);
    expect(credit.amount).toBe(240);
    const opening = () =>
      db
        .select({ id: accounts.id, startingBalance: accounts.startingBalance })
        .from(accounts)
        .all();
    const initial = opening();
    expect(initial.find((a) => a.id === purchase.accountId)?.startingBalance).toBe(0);
    expect(initial.find((a) => a.id === credit.accountId)?.startingBalance).toBe(5000);
    linkTransfer(debit.id, credit.id);
    db.update(transactions)
      .set({ notes: 'Reviewed transfer', reconciled: 1 })
      .where(eq(transactions.id, credit.id))
      .run();
    db.update(transactions)
      .set({ payeeName: 'My purchase', notes: 'Keep my note' })
      .where(eq(transactions.id, purchase.id))
      .run();
    const snapshot = db.select().from(transactions).all();
    expect(await syncUp()).toMatchObject({ added: 0, skipped: 4, errors: [] });
    expect(db.select().from(transactions).all()).toEqual(snapshot);
    expect(opening()).toEqual(initial);
    mock.setMode('round-ups-mismatch');
    const mismatch = await syncUp();
    expect(mismatch).toMatchObject({ added: 0, skipped: 4 });
    expect(mismatch.errors.join(' ')).toContain('opening balance was preserved');
    expect(opening()).toEqual(initial);
    expect(db.select().from(transactions).all()).toEqual(snapshot);
  });
  it('reports a changed amount for an existing import without rewriting a user edit or opening balance', async () => {
    const id = await mapSpending();
    await syncUp();
    const coffee = db
      .select()
      .from(transactions)
      .where(eq(transactions.importedId, 'up:spending:coffee'))
      .get()!;
    db.update(transactions)
      .set({ amount: -900, notes: 'Reviewed amount', reconciled: 1 })
      .where(eq(transactions.id, coffee.id))
      .run();
    const edited = db.select().from(transactions).where(eq(transactions.id, coffee.id)).get();
    expect((await syncUp()).errors.join(' ')).toContain('Review transactions and reconcile');
    expect(db.select().from(transactions).where(eq(transactions.id, coffee.id)).get()).toEqual(
      edited,
    );
    expect(db.select().from(accounts).where(eq(accounts.id, id)).get()!.startingBalance).toBe(0);
  });
  it('shares concurrent syncs rather than importing twice', async () => {
    await mapSpending();
    mock.setMode('slow');
    const first = syncUp();
    const second = syncUp();
    expect(first).toBe(second);
    expect((await request('/connection', undefined, 'DELETE')).status).toBe(409);
    expect((await request('/setup', { accessToken: UP_TEST_TOKEN })).status).toBe(409);
    expect((await first).added).toBe(2);
    expect(db.select().from(transactions).all()).toHaveLength(2);
  });
  it.each(['page-failure', 'bad-page', 'repeat-page', 'malformed', 'rate-limit', 'unauthorized'])(
    'imports no partial account after %s',
    async (mode) => {
      const id = await mapSpending();
      mock.setMode(mode);
      const result = await syncUp();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.added).toBe(0);
      expect(db.select().from(transactions).all()).toHaveLength(0);
      expect(db.select().from(accounts).where(eq(accounts.id, id)).get()!.startingBalance).toBe(0);
      expect(db.select().from(upConnections).get()!.lastSyncedAt).toBeNull();
    },
  );
  it('does not send a bearer token to another pagination origin, path, fragment or credentials', () => {
    const current = 'https://api.up.com.au/api/v1/transactions?page=1';
    for (const next of [
      'https://evil.test/transactions',
      'https://api.up.com.au/api/v1/accounts',
      'https://user:pass@api.up.com.au/api/v1/transactions',
      '?page=2#secret',
      'http://api.up.com.au/api/v1/transactions',
    ])
      expect(() => validateUpPage(next, current)).toThrow();
    expect(validateUpPage('?page=2', current).search).toBe('?page=2');
  });
  it('refreshes tokens without losing account mappings, then disconnects without deleting history', async () => {
    const id = await mapSpending();
    await syncUp();
    await setup();
    expect(
      db
        .select()
        .from(upAccountMappings)
        .where(eq(upAccountMappings.upAccountId, 'spending'))
        .get()!.accountId,
    ).toBe(id);
    expect((await request('/connection', undefined, 'DELETE')).status).toBe(204);
    expect(db.select().from(upAccountMappings).all()).toHaveLength(0);
    expect(db.select().from(transactions).all()).toHaveLength(2);
  });
  it('restores mappings and reimports missing history after a backup restore', async () => {
    const id = await mapSpending();
    const backup = createBackup();
    await syncUp();
    restoreBackup(parseBackup(backup));
    expect(
      db
        .select()
        .from(upAccountMappings)
        .where(eq(upAccountMappings.upAccountId, 'spending'))
        .get()!.accountId,
    ).toBe(id);
    expect((await syncUp()).added).toBe(2);
  });
  it('rejects invalid or duplicate account mappings atomically', async () => {
    await setup();
    const result = await request('/map-accounts', {
      mappings: [
        { upAccountId: 'spending', action: 'create' },
        { upAccountId: 'missing', action: 'create' },
      ],
    });
    expect(result.status).toBe(400);
    expect(db.select().from(accounts).all()).toHaveLength(0);
  });
  it('creates Saver accounts with the correct type and AUD currency', async () => {
    await setup();
    await request('/map-accounts', { mappings: [{ upAccountId: 'saver', action: 'create' }] });
    expect(db.select().from(accounts).get()!.type).toBe('savings');
    expect((await syncUp()).errors).toEqual([]);
  });
  it('refuses to merge CSV history or link accounts in another currency', async () => {
    await setup();
    db.insert(accounts)
      .values({ id: 'csv', name: 'Old CSV', type: 'checking', currency: 'AUD' })
      .run();
    db.insert(transactions)
      .values({ id: 'old', accountId: 'csv', date: '2026-10-01', amount: -100 })
      .run();
    expect(
      (
        await request('/map-accounts', {
          mappings: [{ upAccountId: 'spending', action: 'link', accountId: 'csv' }],
        })
      ).status,
    ).toBe(409);
    db.insert(accounts).values({ id: 'usd', name: 'USD', type: 'checking', currency: 'USD' }).run();
    expect(
      (
        await request('/map-accounts', {
          mappings: [{ upAccountId: 'spending', action: 'link', accountId: 'usd' }],
        })
      ).status,
    ).toBe(400);
    expect(
      db
        .select()
        .from(upAccountMappings)
        .all()
        .every((m) => m.accountId === null),
    ).toBe(true);
  });
  it('links empty AUD accounts and refuses two bank accounts sharing one target', async () => {
    await setup();
    db.insert(accounts)
      .values({ id: 'empty', name: 'Empty', type: 'checking', currency: 'AUD' })
      .run();
    expect(
      (
        await request('/map-accounts', {
          mappings: [
            { upAccountId: 'spending', action: 'link', accountId: 'empty' },
            { upAccountId: 'saver', action: 'link', accountId: 'empty' },
          ],
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request('/map-accounts', {
          mappings: [{ upAccountId: 'spending', action: 'link', accountId: 'empty' }],
        })
      ).status,
    ).toBe(200);
    db.insert(accounts)
      .values({ id: 'another', name: 'Another', type: 'checking', currency: 'AUD' })
      .run();
    expect(
      (
        await request('/map-accounts', {
          mappings: [{ upAccountId: 'spending', action: 'link', accountId: 'another' }],
        })
      ).status,
    ).toBe(409);
  });
});
