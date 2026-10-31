import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accounts,
  transactions,
  upAccountMappings,
  upConnections,
  upDeletedImports,
} from '../db/schema.js';
import { upRouter } from './up.js';
import { transactionsRouter } from './transactions.js';
import { syncUp, syncErrorMessage } from '../services/upSyncService.js';
import { UpError } from '../services/upService.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';
import { startUpMock, UP_TEST_TOKEN } from '../test/upMock.js';

// Up keeps returning a transaction the owner deleted here. The sync must not bring it back, Up
// review must list it to restore, and a bank-fed row must not move to another account (Up's
// rows have fixed ids, so a moved row used to stop every later sync of its account).

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
  app.use('/transactions', transactionsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await mock.close();
  server.close();
  delete process.env.FLYBUDGET_UP_API;
});
beforeEach(() => {
  db.delete(upConnections).run();
  db.delete(upDeletedImports).run();
  db.delete(transactions).run();
  db.delete(accounts).run();
  mock.setMode('normal');
});

const call = (path: string, data?: unknown, method = 'POST') =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });

async function syncedSpending() {
  expect((await call('/up/setup', { accessToken: UP_TEST_TOKEN })).ok).toBe(true);
  const mapped = await call('/up/map-accounts', {
    mappings: [
      { upAccountId: 'spending', action: 'create' },
      { upAccountId: 'saver', action: 'skip' },
    ],
  });
  expect(mapped.ok).toBe(true);
  await syncUp();
  const accountId = db
    .select()
    .from(upAccountMappings)
    .where(eq(upAccountMappings.upAccountId, 'spending'))
    .get()!.accountId!;
  const rows = () =>
    db.select().from(transactions).where(eq(transactions.accountId, accountId)).all();
  return { accountId, rows };
}

describe('Up transactions deleted here', () => {
  it('stay deleted on the next sync, and can be restored from Up review', async () => {
    const { accountId, rows } = await syncedSpending();
    const victim = rows().find((t) => t.amount < 0)!;
    expect((await call(`/transactions/${victim.id}`, undefined, 'DELETE')).status).toBe(204);

    const again = await syncUp();
    expect(again.errors).toEqual([]);
    expect(again.added).toBe(0);
    expect(rows().some((t) => t.importedId === victim.importedId)).toBe(false);
    // The register no longer matches Up, and the notice says why
    expect(again.notices?.join(' ')).toContain('1 transaction you deleted is still at Up');

    const review = await (await call('/up/review', undefined, 'GET')).json();
    expect(review.deleted).toEqual([
      expect.objectContaining({
        accountId,
        importedId: victim.importedId,
        amount: victim.amount,
        date: victim.date,
      }),
    ]);

    const restored = await call('/up/review/restore', {
      accountId,
      importedId: victim.importedId,
    });
    expect(restored.ok).toBe(true);
    expect((await restored.json()).sync.added).toBe(1);
    expect(rows().some((t) => t.importedId === victim.importedId)).toBe(true);
    expect((await (await call('/up/review', undefined, 'GET')).json()).deleted).toEqual([]);
    // A second restore of the same row has nothing to do
    expect(
      (await call('/up/review/restore', { accountId, importedId: victim.importedId })).status,
    ).toBe(404);
  });

  it('stay deleted after a bulk delete too', async () => {
    const { rows } = await syncedSpending();
    const before = rows().length;
    expect(before).toBeGreaterThan(0);
    const target = { selection: { datePreset: 'all' }, ids: rows().map((t) => t.id) };
    const preview = await call('/transactions/bulk-delete', { ...target, preview: true });
    expect(preview.ok).toBe(true);
    const { deletable } = await preview.json();
    expect(deletable).toBe(before);
    const deleted = await call('/transactions/bulk-delete', {
      ...target,
      expectedCount: deletable,
    });
    expect(deleted.ok).toBe(true);
    await syncUp();
    expect(rows()).toHaveLength(0);
  });

  it('travel with a backup, so a restored budget does not import them again', async () => {
    const { rows } = await syncedSpending();
    const victim = rows().find((t) => t.amount < 0)!;
    await call(`/transactions/${victim.id}`, undefined, 'DELETE');
    const backup = createBackup();
    expect(backup.upDeletedImports).toHaveLength(1);
    restoreBackup(parseBackup(JSON.parse(JSON.stringify(backup))));
    await syncUp();
    expect(rows().some((t) => t.importedId === victim.importedId)).toBe(false);
  });
});

describe('Up transactions and other accounts', () => {
  it('a bank-fed transaction cannot move to another account', async () => {
    const { accountId, rows } = await syncedSpending();
    const cash = db.select().from(accounts).where(eq(accounts.id, accountId)).get()!;
    const otherId = nanoid();
    db.insert(accounts)
      .values({ ...cash, id: otherId, name: 'Cash' })
      .run();
    const row = rows().find((t) => t.amount < 0)!;
    const moved = await call(`/transactions/${row.id}`, { accountId: otherId }, 'PUT');
    expect(moved.status).toBe(400);
    expect((await moved.json()).error).toContain('came from your bank feed');
    // Everything else about it can still change
    expect((await call(`/transactions/${row.id}`, { notes: 'Coffee' }, 'PUT')).ok).toBe(true);
    const next = await syncUp();
    expect(next.errors).toEqual([]);
  });

  it('a fault in Allotment is reported as one, not as Up being unreachable', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(syncErrorMessage(new UpError('Up did not accept your token.'))).toBe(
        'Up did not accept your token.',
      );
      const internal = syncErrorMessage(
        new Error('UNIQUE constraint failed: transactions.id'),
        'Spending',
      );
      expect(internal).toContain('Spending: Allotment could not save');
      expect(internal).not.toContain('Could not reach Up');
      expect(log).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
    }
  });
});
