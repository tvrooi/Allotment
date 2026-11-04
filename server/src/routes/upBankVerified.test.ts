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
  upDeletedImports,
} from '../db/schema.js';
import { upRouter } from './up.js';
import { transactionsRouter } from './transactions.js';
import { syncUp } from '../services/upSyncService.js';
import { resumeState } from '../services/resilienceService.js';
import { guideState } from '../services/reviewService.js';
import { bankVerifiedAccountIds } from '../services/bankVerified.js';
import { startUpMock, UP_TEST_TOKEN } from '../test/upMock.js';

// Audit F-17: right after an Up sync, Review asked to reconcile accounts the sync had just
// compared with Up. An Up account whose register equals Up's settled balance is not asked about;
// anything that makes them differ brings the request back. Nothing is marked reconciled.

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
  for (const table of [upConnections, upDeletedImports, transactions, accounts])
    db.delete(table).run();
  mock.setMode('normal');
});

const call = (path: string, data?: unknown, method = 'POST') =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });

async function connectBoth() {
  expect((await call('/up/setup', { accessToken: UP_TEST_TOKEN })).ok).toBe(true);
  const mapped = await call('/up/map-accounts', {
    mappings: ['spending', 'saver'].map((upAccountId) => ({ upAccountId, action: 'create' })),
  });
  expect(mapped.ok).toBe(true);
  expect((await syncUp()).errors).toEqual([]);
  const idOf = (up: string) =>
    db.select().from(upAccountMappings).where(eq(upAccountMappings.upAccountId, up)).get()!
      .accountId!;
  return { spending: idOf('spending'), saver: idOf('saver') };
}
const today = () => new Date().toISOString().slice(0, 10);

describe('bank-verified Up accounts (audit F-17)', () => {
  it('a fresh Up import asks to reconcile nothing, and no row is marked reconciled', async () => {
    const ids = await connectBoth();
    expect(bankVerifiedAccountIds()).toEqual(new Set([ids.spending, ids.saver]));
    expect(resumeState().unreconciledAccounts).toBe(0);
    const guide = guideState();
    expect(guide.steps.find((s) => s.id === 'balances')?.status).toBe('done');
    expect(guide.balances.every((b) => b.bankVerified && b.unreconciled === 0)).toBe(true);
    expect(
      db
        .select()
        .from(transactions)
        .all()
        .every((t) => t.reconciled === 0),
    ).toBe(true);
  });

  it('a transaction added by hand makes the account differ from Up, and Review asks again', async () => {
    const ids = await connectBoth();
    const added = await call('/transactions', {
      accountId: ids.spending,
      date: today(),
      amount: -1_234,
      payeeName: 'Cash at the market',
    });
    expect(added.ok, await added.clone().text()).toBe(true);
    expect(bankVerifiedAccountIds().has(ids.spending)).toBe(false);
    expect(resumeState().unreconciledAccounts).toBe(1);
    const spending = guideState().balances.find((b) => b.accountId === ids.spending)!;
    expect(spending).toMatchObject({ bankVerified: false });
    expect(spending.unreconciled).toBeGreaterThan(0);
  });

  it('a transaction deleted here that Up still has brings the request back too', async () => {
    const ids = await connectBoth();
    const victim = db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, ids.spending))
      .get()!;
    expect((await call(`/transactions/${victim.id}`, undefined, 'DELETE')).status).toBe(204);
    expect(bankVerifiedAccountIds().has(ids.spending)).toBe(false);
    expect(bankVerifiedAccountIds().has(ids.saver)).toBe(true);
    expect(resumeState().unreconciledAccounts).toBe(1);
  });

  it('a turned-off mapping, or a balance never synced, is not taken as checked', async () => {
    const ids = await connectBoth();
    db.update(upAccountMappings)
      .set({ isEnabled: 0 })
      .where(eq(upAccountMappings.accountId, ids.saver))
      .run();
    db.update(upAccountMappings)
      .set({ settledBalance: null })
      .where(eq(upAccountMappings.accountId, ids.spending))
      .run();
    expect(bankVerifiedAccountIds().size).toBe(0);
    expect(resumeState().unreconciledAccounts).toBe(2);
  });
});
