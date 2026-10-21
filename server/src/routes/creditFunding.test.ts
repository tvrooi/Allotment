import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  householdGroups,
  transactions,
  creditCardPlans,
  creditFundingEvents,
  creditEventOrder,
  budgetMonths,
} from '../db/schema.js';
import { budgetRouter } from './budget.js';
import { createBackup, parseBackup } from '../services/backupService.js';
import { todayIso } from '../services/mainAmountService.js';
let server: Server, base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/budget', budgetRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/budget`;
});
afterAll(() => server.close());
beforeEach(() => {
  for (const t of [
    householdGroups,
    creditFundingEvents,
    creditCardPlans,
    transactions,
    budgetMonths,
    accounts,
    creditEventOrder,
  ])
    db.delete(t).run();
  db.insert(accounts)
    .values([
      {
        id: 'cash',
        name: 'Cash',
        type: 'checking',
        startingBalance: 100000,
        createdAt: '2020-01-01',
      },
      {
        id: 'card',
        name: 'Card',
        type: 'credit',
        startingBalance: -50000,
        createdAt: '2020-01-01',
      },
      { id: 'off', name: 'Off-budget card', type: 'credit', isOffBudget: 1 },
    ])
    .run();
});
async function call(path: string, body: unknown = {}) {
  const r = await fetch(`${base}/cards${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
async function setup() {
  const p = await call('/card/setup/preview');
  expect(p.status).toBe(200);
  expect((await call('/card/setup/apply', { revision: p.data.revision })).status).toBe(200);
}
it('previews and explicitly enables existing debt without ledger or assignment writes', async () => {
  const before = createBackup();
  const p = await call('/card/setup/preview');
  expect(p.data).toMatchObject({
    beforeUnassigned: 50000,
    afterUnassigned: 100000,
    debt: 50000,
    reserved: 0,
    shortfall: 50000,
    enabledFrom: todayIso(),
  });
  expect(createBackup()).toEqual({ ...before, exportedAt: expect.any(String) });
  expect((await call('/card/setup/apply', { revision: p.data.revision })).status).toBe(200);
  expect((await call('/card/setup/apply', { revision: p.data.revision })).status).toBe(409);
  expect(db.select().from(transactions).all()).toEqual([]);
  expect(db.select().from(budgetMonths).all()).toEqual([]);
});
it('caps debt-paydown funding, rejects competing previews and retains a durable event', async () => {
  await setup();
  const p = await call('/card/funding/preview', { amount: 20000 });
  expect(p.data).toMatchObject({
    reservedAfter: 20000,
    unassignedAfter: 80000,
    shortfallAfter: 30000,
  });
  expect(db.select().from(creditFundingEvents).all()).toEqual([]);
  expect(
    (await call('/card/funding/apply', { amount: 20000, revision: p.data.revision })).status,
  ).toBe(200);
  expect(
    (await call('/card/funding/apply', { amount: 20000, revision: p.data.revision })).status,
  ).toBe(409);
  expect((await call('/card/funding/preview', { amount: 30001 })).status).toBe(409);
  expect(db.select().from(creditFundingEvents).all()).toHaveLength(1);
  const release = await call('/card/funding/preview', { amount: -5000 });
  expect(release.data).toMatchObject({ reservedAfter: 15000, unassignedAfter: 85000 });
  expect(
    (await call('/card/funding/apply', { amount: -5000, revision: release.data.revision })).status,
  ).toBe(200);
  const backup = createBackup();
  expect((backup.creditFundingEvents as unknown[]).length).toBe(2);
});
it('rejects stale setup and funding after a bank import changes the budget', async () => {
  const preview = await call('/card/setup/preview');
  db.insert(transactions)
    .values({
      id: 'bank',
      accountId: 'cash',
      amount: 500,
      date: todayIso(),
      importedId: 'bank:stable',
      reconciled: 1,
    })
    .run();
  expect((await call('/card/setup/apply', { revision: preview.data.revision })).status).toBe(409);
  await setup();
  const p = await call('/card/funding/preview', { amount: 1000 });
  db.insert(transactions)
    .values({ id: 'bank-two', accountId: 'cash', amount: 100, date: todayIso() })
    .run();
  expect(
    (await call('/card/funding/apply', { amount: 1000, revision: p.data.revision })).status,
  ).toBe(409);
  expect(db.select().from(creditFundingEvents).all()).toEqual([]);
});
it('validates card identity, integer amounts and available reserves', async () => {
  expect((await call('/cash/setup/preview')).status).toBe(400);
  expect((await call('/off/setup/preview')).status).toBe(400);
  await setup();
  for (const amount of [0, 1.5, 1e14])
    expect((await call('/card/funding/preview', { amount })).status).toBe(400);
  expect((await call('/card/funding/preview', { amount: -1 })).status).toBe(409);
});
it('validates new backup dates and accepts older backups without card settings', async () => {
  const old = createBackup();
  delete old.creditCardPlans;
  delete old.creditFundingEvents;
  old.version = 7;
  expect(parseBackup(old).creditCardPlans).toEqual([]);
  const bad = createBackup();
  bad.creditCardPlans = [{ accountId: 'card', enabledFrom: '2026-99-99', createdAt: '' }];
  expect(() => parseBackup(bad)).toThrow(/setup date/);
});

it('keeps household pool cards outside personal payment funding', async () => {
  db.insert(householdGroups)
    .values({ id: 'home', name: 'Home', currency: 'AUD', accountId: 'card' })
    .run();
  expect((await call('/card/setup/preview')).status).toBe(400);
  const response = await fetch(`${base}/cards`),
    context = await response.json();
  expect(context.cards.some((c: { accountId: string }) => c.accountId === 'card')).toBe(false);
});
