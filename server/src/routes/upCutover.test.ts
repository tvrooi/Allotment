import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  transactions,
  upAccountMappings,
  upConnections,
  upSourceRecords,
  budgetSettings,
} from '../db/schema.js';
import { upRouter } from './up.js';
import { syncUp } from '../services/upSyncService.js';
import { accountIssues } from '../services/accountIntegrity.js';
import { startUpMock, UP_TEST_TOKEN, upMockTransaction } from '../test/upMock.js';

// Linking Up to an account that already has history, from a cut-over date. These tests pin the
// safety rules that make that acceptable: no silent duplicates, no silent merges, no rewriting
// existing or reconciled rows, nothing adjusted behind the owner's back.
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

/** An Up transaction on a chosen bank-local day */
function upTx(id: string, amount: number, date: string) {
  const tx = upMockTransaction(id, amount);
  tx.attributes.createdAt = `${date}T10:00:00+10:00`;
  tx.attributes.settledAt = `${date}T12:00:00+10:00`;
  return tx;
}
const csvRow = (id: string, date: string, amount: number, extra = {}) =>
  db
    .insert(transactions)
    .values({ id, accountId: 'old', date, amount, payeeName: 'Old ' + id, ...extra })
    .run();
function oldAccount(startingBalance = 0) {
  db.insert(accounts)
    .values({ id: 'old', name: 'Old CBA', type: 'checking', currency: 'AUD', startingBalance })
    .run();
}
const link = (cutoverDate?: string) =>
  request('/map-accounts', {
    mappings: [
      { upAccountId: 'spending', action: 'link', accountId: 'old', cutoverDate },
      { upAccountId: 'saver', action: 'skip' },
    ],
  });
const rows = (accountId = 'old') =>
  db.select().from(transactions).where(eq(transactions.accountId, accountId)).all();
const review = async () => (await request('/review', undefined, 'GET')).json();

// Up's mock "normal" balance for the spending account is $85.00 (8500).
const CUTOVER = '2026-09-01';
const UP_HISTORY = [
  upTx('aug-a', -700, '2026-08-20'),
  upTx('aug-b', -800, '2026-08-31'),
  upTx('sep-1', 10_000, '2026-09-01'),
  upTx('sep-5', -1_000, '2026-09-05'),
];

describe('linking Up to an account with history, from a cut-over date', () => {
  it('refuses a non-empty account without a cut-over date, and a bad or pointless one', async () => {
    await setup();
    oldAccount();
    csvRow('c1', '2026-08-01', -500);
    expect((await link()).status).toBe(409);
    expect((await link('01/09/2026')).status).toBe(400);
    expect(db.select().from(upAccountMappings).get()!.accountId).toBeNull();
    // A cut-over only means something for an account that has history
    db.insert(accounts)
      .values({ id: 'empty', name: 'Empty', type: 'checking', currency: 'AUD' })
      .run();
    expect(
      (
        await request('/map-accounts', {
          mappings: [
            { upAccountId: 'spending', action: 'link', accountId: 'empty', cutoverDate: CUTOVER },
          ],
        })
      ).status,
    ).toBe(400);
    expect(db.select().from(upAccountMappings).get()!.accountId).toBeNull();
  });

  it('never imports an Up row dated before the cut-over', async () => {
    await setup();
    oldAccount();
    csvRow('c1', '2026-08-15', -500);
    mock.setHistory('spending', UP_HISTORY);
    expect((await link(CUTOVER)).status).toBe(200);
    expect(db.select().from(upAccountMappings).get()!.cutoverDate).toBe(CUTOVER);
    const result = await syncUp();
    expect(result.errors).toEqual([]);
    const imported = rows()
      .filter((r) => r.importedId?.startsWith('up:'))
      .map((r) => r.importedId)
      .sort();
    expect(imported).toEqual(['up:spending:sep-1', 'up:spending:sep-5']);
    expect(rows().every((r) => r.importedId?.startsWith('up:') || r.id === 'c1')).toBe(true);
    expect(rows().filter((r) => r.date < CUTOVER && r.id !== 'c1')).toEqual([]);
  });

  it('is idempotent: a second sync adds nothing and duplicates nothing', async () => {
    await setup();
    oldAccount();
    csvRow('c1', '2026-08-15', -500);
    mock.setHistory('spending', UP_HISTORY);
    await link(CUTOVER);
    await syncUp();
    const first = rows();
    const flagged = await review();
    const again = await syncUp();
    expect(again.added).toBe(0);
    expect(again.errors).toEqual([]);
    expect(rows()).toEqual(first);
    expect(new Set(rows().map((r) => r.id)).size).toBe(rows().length);
    expect((await review()).total).toBe(flagged.total);
  });

  it('leaves every existing row exactly as it was', async () => {
    await setup();
    oldAccount(1_234);
    csvRow('c1', '2026-08-15', -500, { notes: 'mine', categoryId: null, importedId: 'csv:1' });
    csvRow('c2', '2026-09-02', -1_000, { reviewedAt: '2026-09-03T00:00:00Z', importedId: 'csv:2' });
    csvRow('c3', '2026-07-01', 99, { reconciled: 1 });
    const accountBefore = db.select().from(accounts).where(eq(accounts.id, 'old')).get()!;
    const before = new Map(rows().map((r) => [r.id, JSON.stringify(r)]));
    mock.setHistory('spending', UP_HISTORY);
    await link(CUTOVER);
    await syncUp();
    await syncUp();
    for (const [id, snapshot] of before)
      expect(JSON.stringify(rows().find((r) => r.id === id))).toBe(snapshot);
    // The opening balance is theirs too
    expect(db.select().from(accounts).where(eq(accounts.id, 'old')).get()).toEqual(accountBefore);
  });

  it('leaves reconciled rows untouched and will not delete one as a duplicate', async () => {
    await setup();
    oldAccount();
    csvRow('rec', '2026-09-02', -1_000, { reconciled: 1, notes: 'locked' });
    const before = JSON.stringify(rows().find((r) => r.id === 'rec'));
    mock.setHistory('spending', [upTx('sep-2', -1_000, '2026-09-02')]);
    await link(CUTOVER);
    await syncUp();
    const item = (await review()).items.find(
      (i: { importedId: string }) => i.importedId === 'up:spending:sep-2',
    );
    expect(item).toMatchObject({
      reviewState: 'overlap',
      overlap: { id: 'rec', reconciled: true },
    });
    const res = await request('/review/overlap/delete-old', {
      importedId: item.importedId,
      revision: item.revision,
    });
    expect(res.status).toBe(409);
    expect(JSON.stringify(rows().find((r) => r.id === 'rec'))).toBe(before);
    expect(rows()).toHaveLength(2);
  });

  it('flags overlap candidates for review instead of merging them', async () => {
    await setup();
    oldAccount();
    // The CSV ran past the cut-over: the same coffee exists on both sides
    csvRow('dup', '2026-09-05', -1_000, { importedId: 'csv:dup' });
    csvRow('other', '2026-09-20', -1_000, { importedId: 'csv:other' });
    mock.setHistory('spending', UP_HISTORY);
    await link(CUTOVER);
    await syncUp();
    // Both exist: nothing was merged or dropped
    expect(rows()).toHaveLength(2 + 2);
    expect(rows().filter((r) => r.amount === -1_000)).toHaveLength(3);
    const data = await review();
    const flagged = data.items.filter((i: { reviewState: string }) => i.reviewState === 'overlap');
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toMatchObject({
      importedId: 'up:spending:sep-5',
      overlap: { id: 'dup', date: '2026-09-05', amount: -1_000, reconciled: false },
    });
    // The first sync's other rows are starting history: not listed as changes to review
    expect(data.items.map((i: { importedId: string }) => i.importedId)).toEqual([
      'up:spending:sep-5',
    ]);
    // A row that arrives later is an ordinary change to review
    mock.setHistory('spending', [...UP_HISTORY, upTx('sep-9', -250, '2026-09-09')]);
    await syncUp();
    expect(
      (await review()).items.find(
        (i: { importedId: string }) => i.importedId === 'up:spending:sep-9',
      ),
    ).toMatchObject({ reviewState: 'new' });
  });

  it('keeps both on request, or deletes only the old row, each one click', async () => {
    await setup();
    oldAccount();
    csvRow('dup', '2026-09-05', -1_000);
    csvRow('dup2', '2026-09-01', 10_000);
    mock.setHistory('spending', UP_HISTORY);
    await link(CUTOVER);
    await syncUp();
    const items = (await review()).items.filter(
      (i: { reviewState: string }) => i.reviewState === 'overlap',
    );
    expect(items).toHaveLength(2);
    const keep = items.find((i: { importedId: string }) => i.importedId === 'up:spending:sep-5');
    const drop = items.find((i: { importedId: string }) => i.importedId === 'up:spending:sep-1');
    expect(
      (
        await request('/review/acknowledge', {
          importedId: keep.importedId,
          revision: keep.revision,
        })
      ).ok,
    ).toBe(true);
    expect(rows().some((r) => r.id === 'dup')).toBe(true);
    expect(
      (
        await request('/review/overlap/delete-old', {
          importedId: drop.importedId,
          revision: drop.revision,
        })
      ).ok,
    ).toBe(true);
    expect(rows().some((r) => r.id === 'dup2')).toBe(false);
    // The Up row stays, and a stale click is refused
    expect(rows().some((r) => r.importedId === 'up:spending:sep-1')).toBe(true);
    expect(
      (
        await request('/review/overlap/delete-old', {
          importedId: drop.importedId,
          revision: drop.revision,
        })
      ).status,
    ).toBe(409);
    const remaining = await review();
    expect(
      remaining.items.filter((i: { reviewState: string }) => i.reviewState === 'overlap'),
    ).toHaveLength(0);
    // Later syncs do not bring the flags back
    await syncUp();
    expect(
      (await review()).items.filter((i: { reviewState: string }) => i.reviewState === 'overlap'),
    ).toHaveLength(0);
  });

  it('surfaces an opening-balance difference at the cut-over without adjusting anything', async () => {
    await setup();
    // Up's balance at the cut-over is 8500 - (10000 - 1000) = -500; the register says -300
    oldAccount();
    csvRow('c1', '2026-08-15', -300);
    mock.setHistory('spending', UP_HISTORY);
    await link(CUTOVER);
    const result = await syncUp();
    expect(result.errors).toEqual([]);
    expect(result.notices?.join(' ')).toMatch(/up to 31 Aug 2026|31 Aug/);
    const mapping = db.select().from(upAccountMappings).get()!;
    expect(mapping.cutoverDifference).toBe(-200);
    expect(mapping.settledBalance).toBe(8_500);
    const account = db.select().from(accounts).where(eq(accounts.id, 'old')).get()!;
    expect(account.startingBalance).toBe(0);
    // No invented opening-balance row, no adjustment row
    expect(
      rows().filter((r) => r.isAdjustment === 1 || /opening/i.test(r.payeeName ?? '')),
    ).toEqual([]);
    // The existing mismatch flow takes over: the register disagrees with the bank
    expect(accountIssues().find((i) => i.accountId === 'old')).toMatchObject({
      reason: 'bank-mismatch',
    });
  });

  it('stays quiet when the history already agrees with the bank at the cut-over', async () => {
    await setup();
    oldAccount();
    csvRow('c1', '2026-08-15', -500);
    mock.setHistory('spending', UP_HISTORY);
    await link(CUTOVER);
    const result = await syncUp();
    expect(result.notices ?? []).toEqual([]);
    expect(db.select().from(upAccountMappings).get()!.cutoverDifference).toBe(0);
    expect(accountIssues().find((i) => i.accountId === 'old')).toBeUndefined();
  });

  it('still bootstraps an empty account exactly as before, with no cut-over', async () => {
    await setup();
    oldAccount();
    mock.setHistory('spending', UP_HISTORY);
    expect((await link()).status).toBe(200);
    const result = await syncUp();
    expect(result.errors).toEqual([]);
    expect(db.select().from(upAccountMappings).get()!.cutoverDate).toBeNull();
    // Every Up row, old and new, and an opening balance that makes the register match the bank
    expect(rows()).toHaveLength(4);
    expect(db.select().from(accounts).where(eq(accounts.id, 'old')).get()!.startingBalance).toBe(
      8_500 - (-700 - 800 + 10_000 - 1_000),
    );
    expect(
      db
        .select()
        .from(upSourceRecords)
        .all()
        .every((r) => r.reviewState !== 'overlap'),
    ).toBe(true);
  });
});

describe('currency when linking', () => {
  it('links an account with no currency of its own while the budget has none, and makes the budget AUD', async () => {
    await setup();
    db.delete(budgetSettings).run();
    db.insert(accounts).values({ id: 'old', name: 'Everyday', type: 'checking' }).run();
    csvRow('c1', '2026-08-15', -500);
    mock.setHistory('spending', UP_HISTORY);
    expect((await link(CUTOVER)).status).toBe(200);
    expect(db.select().from(budgetSettings).get()?.currency).toBe('AUD');
    expect((await syncUp()).errors).toEqual([]);
  });
  it('uses the budget currency when the account has none, and names the reason when it is not AUD', async () => {
    await setup();
    db.delete(budgetSettings).run();
    db.insert(budgetSettings).values({ id: 'budget', currency: 'USD' }).run();
    db.insert(accounts).values({ id: 'old', name: 'Everyday', type: 'checking' }).run();
    const res = await link();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Everyday uses USD');
    db.update(budgetSettings).set({ currency: 'AUD' }).run();
    expect((await link()).status).toBe(200);
  });
});

describe('settling the cut-over difference', () => {
  async function linked(starting = 0) {
    await setup();
    oldAccount(starting);
    csvRow('c1', '2026-08-15', -300);
    mock.setHistory('spending', UP_HISTORY);
    await link(CUTOVER);
    await syncUp();
  }
  const settle = (expected: number) =>
    request('/cutover/opening-balance', { accountId: 'old', expected });
  it('adds one balance adjustment dated the day before the cut-over, not income, and nothing else changes', async () => {
    await linked();
    const before = rows();
    const res = await settle(-200);
    expect(res.status).toBe(200);
    const added = rows().filter((r) => !before.some((b) => b.id === r.id));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      date: '2026-08-31',
      amount: -200,
      isAdjustment: 1,
      categoryId: null,
      reconciled: 0,
    });
    for (const old of before)
      expect(JSON.stringify(rows().find((r) => r.id === old.id))).toBe(JSON.stringify(old));
    expect(db.select().from(upAccountMappings).get()!.cutoverDifference).toBe(0);
    expect(accountIssues().find((i) => i.accountId === 'old')).toBeUndefined();
    // Later syncs stay quiet and add nothing
    const again = await syncUp();
    expect(again.added).toBe(0);
    expect(again.notices ?? []).toEqual([]);
  });
  it('refuses a stale amount, an account with no difference, and a second click', async () => {
    await linked();
    expect((await settle(-100)).status).toBe(409);
    expect(rows().some((r) => r.isAdjustment === 1)).toBe(false);
    expect((await settle(-200)).status).toBe(200);
    expect((await settle(-200)).status).toBe(409);
    expect(rows().filter((r) => r.isAdjustment === 1)).toHaveLength(1);
  });
  it('is refused for an account that is not linked from a cut-over', async () => {
    await setup();
    oldAccount();
    expect((await settle(-200)).status).toBe(409);
  });
});

describe('the cut-over difference follows the register', () => {
  it('is recomputed when an older row is deleted, so the opening balance is never stale', async () => {
    await setup();
    oldAccount();
    csvRow('c1', '2026-08-15', -300);
    csvRow('dup', '2026-09-05', -1_000);
    mock.setHistory('spending', UP_HISTORY);
    await link(CUTOVER);
    await syncUp();
    const item = (await review()).items.find(
      (i: { reviewState: string }) => i.reviewState === 'overlap',
    );
    // c1 alone is -300 against Up's -500 at the cut-over: -200 short. Deleting "dup" (dated
    // after the cut-over) does not change the history before it.
    expect(db.select().from(upAccountMappings).get()!.cutoverDifference).toBe(-200);
    csvRow('before', '2026-08-20', -100);
    await request('/review/overlap/delete-old', {
      importedId: item.importedId,
      revision: item.revision,
    });
    expect(db.select().from(upAccountMappings).get()!.cutoverDifference).toBe(-100);
    expect(
      (await request('/cutover/opening-balance', { accountId: 'old', expected: -200 })).status,
    ).toBe(409);
    expect(
      (await request('/cutover/opening-balance', { accountId: 'old', expected: -100 })).status,
    ).toBe(200);
  });
});
