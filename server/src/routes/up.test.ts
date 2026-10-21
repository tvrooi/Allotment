import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, sql } from 'drizzle-orm';
import { db, sqlite } from '../db/index.js';
import {
  accounts,
  transactions,
  upAccountMappings,
  upConnections,
  upSourceRecords,
} from '../db/schema.js';
import { upRouter } from './up.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';
import { linkTransfer } from '../services/transferService.js';
import { syncUp, syncUpIfDue, nextUpSyncAt, setUpConnecting } from '../services/upSyncService.js';
import { getUpTransactions, validateUpPage } from '../services/upService.js';
import { startUpMock, UP_TEST_TOKEN, upMockTransaction } from '../test/upMock.js';
import { roundUpDays } from '../services/upReviewService.js';

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
  it('backs off a damaged encrypted connection without exposing it or calling the bank', async () => {
    await mapSpending();
    const calls = mock.calls();
    await request('/settings', { pollIntervalMinutes: 15 }, 'PATCH');
    sqlite.prepare('UPDATE up_connections SET access_token = ?').run('enc:v1:damaged-test-value');
    const result = await syncUp();
    expect(result.errors).toEqual([
      'Could not read the Up connection. Check the saved connection and encryption key.',
    ]);
    const connection = await (await request('/connection', undefined, 'GET')).json();
    expect(connection).toMatchObject({ syncStatus: 'error', pollIntervalMinutes: 15 });
    expect(connection.nextSyncAt).toBeTruthy();
    expect(mock.calls()).toBe(calls);
    expect(JSON.stringify(connection)).not.toContain('damaged-test-value');
  });
  it('keeps a previously settled bank regression in review, including after acknowledgement', async () => {
    await mapSpending();
    await syncUp();
    const snapshot = db.select().from(transactions).all();
    mock.setHistory('spending', [
      upMockTransaction('salary', 10000),
      upMockTransaction('coffee', -1000, 'HELD'),
      upMockTransaction('held', -500, 'HELD'),
    ]);
    await syncUp();
    const changed = db
      .select()
      .from(upSourceRecords)
      .where(eq(upSourceRecords.importedId, 'up:spending:coffee'))
      .get()!;
    expect(changed.reviewState).toBe('changed');
    await request('/review/acknowledge', {
      importedId: changed.importedId,
      revision: changed.revision,
    });
    await syncUp();
    expect(
      db
        .select()
        .from(upSourceRecords)
        .where(eq(upSourceRecords.importedId, changed.importedId))
        .get()!.reviewState,
    ).toBe('reviewed');
    expect(db.select().from(transactions).all()).toEqual(snapshot);
  });
  it('validates portable source details before any restore and preserves first-sync historical edits', async () => {
    await mapSpending();
    await syncUp();
    const original = db.select().from(transactions).get()!;
    db.update(transactions)
      .set({ notes: 'Already reviewed', reconciled: 1 })
      .where(eq(transactions.id, original.id))
      .run();
    db.delete(upSourceRecords).run();
    await syncUp();
    expect(
      db
        .select()
        .from(upSourceRecords)
        .all()
        .filter((r) => r.transactionId)
        .every((r) => r.reviewState === 'reviewed'),
    ).toBe(true);
    const backup = createBackup();
    const malformed = structuredClone(backup) as Record<string, any>;
    malformed.upSourceRecords[0].sourceJson = '{}';
    expect(() => parseBackup(malformed)).toThrow('invalid bank details');
    expect(
      db.select().from(transactions).where(eq(transactions.id, original.id)).get(),
    ).toMatchObject({ notes: 'Already reviewed', reconciled: 1 });
  });
  it('records independent bank observations, pending activity and idempotent new-import reviews', async () => {
    await mapSpending();
    await syncUp();
    const get = async () => (await request('/review', undefined, 'GET')).json();
    expect(await get()).toMatchObject({ total: 2, pending: 1 });
    const item = (await get()).items[0];
    expect(
      (
        await request('/review/acknowledge', {
          importedId: item.importedId,
          revision: item.revision,
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await request('/review/acknowledge', {
          importedId: item.importedId,
          revision: item.revision,
        })
      ).status,
    ).toBe(409);
    await syncUp();
    expect(await get()).toMatchObject({ total: 1, pending: 1 });
    expect(db.select().from(upSourceRecords).all()).toHaveLength(3);
    expect(JSON.stringify(createBackup())).toContain('upSourceRecords');
    expect(JSON.stringify(createBackup())).not.toContain(UP_TEST_TOKEN);
    const backup = createBackup();
    restoreBackup(parseBackup(backup));
    expect(await get()).toMatchObject({ total: 1, pending: 1 });
  });
  it('compares bank changes against bank history, preserves local edits, and rejects stale review', async () => {
    await mapSpending();
    await syncUp();
    const id = 'up:spending:coffee';
    const row = db.select().from(transactions).where(eq(transactions.importedId, id)).get()!;
    const revision = db
      .select()
      .from(upSourceRecords)
      .where(eq(upSourceRecords.importedId, id))
      .get()!.revision;
    db.update(transactions)
      .set({ amount: -900, notes: 'My note', reconciled: 1 })
      .where(eq(transactions.id, row.id))
      .run();
    const before = db.select().from(transactions).all();
    mock.setHistory('spending', [
      upMockTransaction('salary', 10000),
      upMockTransaction('coffee', -950),
      upMockTransaction('held', -500, 'HELD'),
    ]);
    await syncUp();
    const review = await (await request('/review', undefined, 'GET')).json();
    const item = review.items.find((r: { importedId: string }) => r.importedId === id);
    expect(item).toMatchObject({
      reviewState: 'changed',
      previous: { amount: -1000 },
      current: { amount: -950 },
    });
    expect(db.select().from(transactions).all()).toEqual(before);
    expect((await request('/review/acknowledge', { importedId: id, revision })).status).toBe(409);
    expect(
      (await request('/review/acknowledge', { importedId: id, revision: item.revision })).ok,
    ).toBe(true);
    await syncUp();
    expect(
      db.select().from(upSourceRecords).where(eq(upSourceRecords.importedId, id)).get()!
        .reviewState,
    ).toBe('reviewed');
  });
  it('groups settled round-up metadata by bank-local day and source, without inventing money', async () => {
    await mapSpending();
    const held = {
      ...upMockTransaction('late', -1760, 'HELD'),
      attributes: {
        ...upMockTransaction('late', -1760, 'HELD').attributes,
        createdAt: '2026-10-05T00:10:00+11:00',
        roundUp: {
          amount: { currencyCode: 'AUD', valueInBaseUnits: -240 },
          boostPortion: { currencyCode: 'AUD', valueInBaseUnits: -200 },
        },
      },
    };
    mock.setHistory('spending', [held]);
    await syncUp();
    expect(roundUpDays('2026-10-01')).toEqual([]);
    const settled = {
      ...held,
      attributes: { ...held.attributes, status: 'SETTLED', settledAt: '2026-10-07T09:00:00+11:00' },
    };
    mock.setHistory('spending', [settled]);
    await syncUp();
    expect(roundUpDays('2026-10-01')).toMatchObject([
      {
        date: '2026-10-05',
        amount: 240,
        boost: 200,
        purchases: [{ amount: -1760, roundUpAmount: 240 }],
      },
    ]);
    expect(db.select().from(transactions).all()).toHaveLength(1);
    await syncUp();
    expect(roundUpDays('2026-10-01')[0].amount).toBe(240);
    expect(db.select().from(transactions).get()!.importedId).toBe('up:spending:late');
  });
  it('flags omitted observations once without deleting ledger rows; failed pages cannot mark records missing', async () => {
    await mapSpending();
    await syncUp();
    const before = db.select().from(transactions).all();
    mock.setMode('page-failure');
    await syncUp();
    expect(
      db
        .select()
        .from(upSourceRecords)
        .all()
        .every((r) => r.seenInLatest === 1),
    ).toBe(true);
    mock.setMode('normal');
    mock.setHistory('spending', [
      upMockTransaction('salary', 10000),
      upMockTransaction('held', -500, 'HELD'),
    ]);
    await syncUp();
    const missing = db
      .select()
      .from(upSourceRecords)
      .where(eq(upSourceRecords.importedId, 'up:spending:coffee'))
      .get()!;
    expect(missing).toMatchObject({ reviewState: 'missing', seenInLatest: 0 });
    await syncUp();
    expect(
      db
        .select()
        .from(upSourceRecords)
        .where(eq(upSourceRecords.importedId, missing.importedId))
        .get()!.revision,
    ).toBe(missing.revision);
    expect(db.select().from(transactions).all()).toEqual(before);
  });
  it('does not bootstrap an initialized opening balance after its register was emptied', async () => {
    const id = await mapSpending();
    await syncUp();
    db.delete(transactions).run();
    mock.setHistory('spending', [
      upMockTransaction('salary', 10000),
      upMockTransaction('coffee', -1200),
      upMockTransaction('held', -500, 'HELD'),
    ]);
    expect((await syncUp()).errors.join(' ')).toContain('opening balance was preserved');
    expect(db.select().from(accounts).where(eq(accounts.id, id)).get()!.startingBalance).toBe(0);
  });
  it('polls only when opted in and due, pauses during setup, and backs off errors', async () => {
    await mapSpending();
    const calls = mock.calls();
    await syncUpIfDue();
    expect(mock.calls()).toBe(calls);
    expect((await request('/settings', { pollIntervalMinutes: 1 }, 'PATCH')).status).toBe(400);
    expect((await request('/settings', { pollIntervalMinutes: 15 }, 'PATCH')).ok).toBe(true);
    await syncUpIfDue();
    expect(mock.calls()).toBe(calls);
    db.update(upConnections).set({ nextSyncAt: '2000-01-01T00:00:00Z' }).run();
    setUpConnecting(true);
    await syncUpIfDue();
    expect(mock.calls()).toBe(calls);
    setUpConnecting(false);
    await syncUpIfDue();
    expect(mock.calls()).toBeGreaterThan(calls);
    mock.setMode('rate-limit');
    await syncUp();
    await syncUp();
    const connection = db.select().from(upConnections).get()!;
    expect(connection.failureCount).toBe(2);
    expect(Date.parse(connection.nextSyncAt!) - Date.parse(connection.lastCompletedAt!)).toBe(
      30 * 60000,
    );
    expect(nextUpSyncAt(15, 10, 0)).toBe(new Date(24 * 60 * 60000).toISOString());
    expect((await request('/settings', { pollIntervalMinutes: 0 }, 'PATCH')).ok).toBe(true);
    expect(db.select().from(upConnections).get()!.nextSyncAt).toBeNull();
  });
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
  it('reports matching balances when Up lists the round-up debit itself', async () => {
    await setup();
    await request('/map-accounts', {
      mappings: [
        { upAccountId: 'spending', action: 'create' },
        { upAccountId: 'saver', action: 'create' },
      ],
    });
    mock.setMode('round-ups');
    await syncUp();
    const checks = await (await request('/round-up-check', undefined, 'GET')).json();
    expect(checks.map((c: { verdict: string }) => c.verdict)).toEqual(['matches', 'matches']);
    expect(checks[0].missing).toEqual({ count: 0, total: 0 });
  });
  it('adds round-up debits only when the settled balance proves exactly those are missing', async () => {
    const id = await mapSpending();
    mock.setMode('implicit-round-ups-start');
    expect(await syncUp()).toMatchObject({ added: 1, errors: [] });
    mock.setMode('implicit-round-ups-odd');
    const odd = await syncUp();
    expect(odd.errors.join(' ')).toContain('opening balance was preserved');
    const check = async () =>
      (await (await request('/round-up-check', undefined, 'GET')).json())[0];
    // $79.99 at the bank vs $82.40 in the register: $2.40 of round-ups explains only part of it.
    expect(await check()).toMatchObject({
      verdict: 'unexplained',
      difference: -241,
      missing: { count: 1, total: -240 },
    });
    const refused = await request('/round-up-debits', { accountId: id, count: 1, total: -240 });
    expect(refused.status).toBe(409);
    expect(db.select().from(transactions).all()).toHaveLength(2);

    mock.setMode('implicit-round-ups');
    await syncUp();
    expect(await check()).toMatchObject({
      verdict: 'round-ups',
      settledBalance: 8000,
      register: 8240,
      difference: -240,
      missing: { count: 1, total: -240 },
      enabledAt: null,
    });
    const stale = await request('/round-up-debits', { accountId: id, count: 2, total: -480 });
    expect(stale.status).toBe(409);
    const purchase = db
      .select()
      .from(transactions)
      .where(eq(transactions.importedId, 'up:spending:later-purchase'))
      .get()!;
    const added = await request('/round-up-debits', { accountId: id, count: 1, total: -240 });
    expect(await added.json()).toMatchObject({ added: 1 });
    const debit = db
      .select()
      .from(transactions)
      .where(eq(transactions.importedId, 'up:spending:later-purchase:roundup'))
      .get()!;
    expect(debit).toMatchObject({ amount: -240, payeeName: 'Up round-up', categoryId: null });
    expect(debit.notes).toContain('includes $2.00 boost');
    // The purchase itself and the opening balance are untouched.
    expect(db.select().from(transactions).where(eq(transactions.id, purchase.id)).get()).toEqual(
      purchase,
    );
    expect(db.select().from(accounts).where(eq(accounts.id, id)).get()!.startingBalance).toBe(0);
    expect(await check()).toMatchObject({ verdict: 'matches', difference: 0 });
    // Later syncs neither duplicate the debit nor report a mismatch.
    expect(await syncUp()).toMatchObject({ added: 0, errors: [] });
    expect(db.select().from(transactions).all()).toHaveLength(3);
    expect(
      (await request('/round-up-debits', { accountId: id, count: 1, total: -240 })).status,
    ).toBe(200);
    expect(db.select().from(transactions).all()).toHaveLength(3);
    expect((await request(`/round-up-debits/${id}`, undefined, 'DELETE')).status).toBe(204);
    expect((await check()).enabledAt).toBeNull();
    expect(db.select().from(transactions).all()).toHaveLength(3);
  });
  it('adds new round-up debits during sync once enabled', async () => {
    const id = await mapSpending();
    mock.setMode('implicit-round-ups-start');
    await syncUp();
    db.update(upAccountMappings)
      .set({ roundUpDebitsAt: new Date().toISOString() })
      .where(eq(upAccountMappings.accountId, id))
      .run();
    mock.setMode('implicit-round-ups');
    expect(await syncUp()).toMatchObject({ added: 2, errors: [] });
    expect(
      db
        .select()
        .from(transactions)
        .all()
        .map((t) => t.importedId)
        .sort(),
    ).toEqual([
      'up:spending:later-purchase',
      'up:spending:later-purchase:roundup',
      'up:spending:salary',
    ]);
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
