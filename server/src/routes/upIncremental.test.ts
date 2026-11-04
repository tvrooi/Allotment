import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
  upDeletedImports,
} from '../db/schema.js';
import { upRouter } from './up.js';
import { FULL_SWEEP_MS, syncUp } from '../services/upSyncService.js';
import { startUpMock, upMockTransaction, UP_TEST_TOKEN } from '../test/upMock.js';

// Audit F-10: between full sweeps, a sync asks Up only for recent rows and the open holds.

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
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  vi.useRealTimers();
  await mock.close();
  server.close();
  delete process.env.FLYBUDGET_UP_API;
});
beforeEach(() => {
  vi.useRealTimers();
  for (const table of [upConnections, upDeletedImports, transactions, accounts])
    db.delete(table).run();
  mock.setMode('normal');
});

const at = (day: string) => `${day}T09:00:00+10:00`;
function row(id: string, amount: number, day: string, status = 'SETTLED') {
  const t = upMockTransaction(id, amount, status, 'spending');
  return {
    ...t,
    attributes: {
      ...t.attributes,
      createdAt: at(day),
      settledAt: status === 'SETTLED' ? at(day) : null,
    },
  };
}
const post = (path: string, body: unknown) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
async function connect(history: unknown[]) {
  mock.setHistory('spending', history);
  expect((await post('/up/setup', { accessToken: UP_TEST_TOKEN })).ok).toBe(true);
  const mapped = await post('/up/map-accounts', {
    mappings: [
      { upAccountId: 'spending', action: 'create' },
      { upAccountId: 'saver', action: 'skip' },
    ],
  });
  expect(mapped.ok).toBe(true);
  expect((await syncUp()).errors).toEqual([]);
}
const imported = () =>
  db
    .select({ importedId: transactions.importedId })
    .from(transactions)
    .all()
    .map((t) => t.importedId)
    .sort();
const spendingRequests = () =>
  mock.requests().filter((r) => r.startsWith('/accounts/spending/transactions'));

describe('incremental Up sync (audit F-10)', () => {
  it('the first sync sweeps everything; the next asks only for recent rows and open holds', async () => {
    await connect([row('old', -1_000, '2026-06-01'), row('recent', -2_000, '2026-10-20')]);
    expect(spendingRequests()).toHaveLength(1);
    expect(spendingRequests()[0]).not.toContain('filter');

    mock.clearRequests();
    mock.setHistory('spending', [
      row('old', -1_000, '2026-06-01'),
      row('recent', -2_000, '2026-10-20'),
      row('new', -3_000, '2026-10-22'),
    ]);
    const second = await syncUp();
    expect(second.errors).toEqual([]);
    expect(second.added).toBe(1);
    const asked = spendingRequests().map((r) => decodeURIComponent(r));
    expect(asked).toHaveLength(2);
    // 14 days before the newest row (20 October), a day early for Up's offsets
    expect(asked[0]).toContain('filter[since]=2026-10-05T00:00:00+10:00');
    expect(asked[1]).toContain('filter[status]=HELD');
    expect(imported()).toEqual(['up:spending:new', 'up:spending:old', 'up:spending:recent']);
  });

  it('rows older than the window are not taken as gone from Up', async () => {
    await connect([row('old', -1_000, '2026-06-01'), row('recent', -2_000, '2026-10-20')]);
    await syncUp();
    const review = await (await fetch(`${base}/up/review`)).json();
    expect(JSON.stringify(review)).not.toContain('"missing"');
  });

  it('an old hold that settles late is still imported, under its own date', async () => {
    await connect([row('hotel', -50_000, '2026-08-01', 'HELD'), row('coffee', -500, '2026-10-20')]);
    expect(imported()).toEqual(['up:spending:coffee']);
    mock.setHistory('spending', [
      row('hotel', -48_000, '2026-08-01'),
      row('coffee', -500, '2026-10-20'),
    ]);
    const next = await syncUp();
    expect(next.errors).toEqual([]);
    // The window reached back to the hold's own date
    expect(decodeURIComponent(spendingRequests().at(-2)!)).toContain(
      'filter[since]=2026-07-31T00:00:00+10:00',
    );
    expect(imported()).toEqual(['up:spending:coffee', 'up:spending:hotel']);
  });

  it('sweeps all history again after a week, and when asked', async () => {
    await connect([row('recent', -2_000, '2026-10-20')]);
    mock.clearRequests();
    await syncUp({ full: true });
    expect(spendingRequests()).toHaveLength(1);
    expect(spendingRequests()[0]).not.toContain('filter');

    // A week on, the next sync is a full sweep by itself
    db.update(upAccountMappings)
      .set({ fullSyncedAt: new Date(Date.now() - FULL_SWEEP_MS - 60_000).toISOString() })
      .where(eq(upAccountMappings.upAccountId, 'spending'))
      .run();
    mock.clearRequests();
    await syncUp();
    expect(spendingRequests()).toHaveLength(1);
    expect(spendingRequests()[0]).not.toContain('filter');
    // …and the one after is incremental again
    mock.clearRequests();
    await syncUp();
    expect(spendingRequests()).toHaveLength(2);
  });
});
