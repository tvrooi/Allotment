import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  transactions,
  upAccountMappings,
  upConnections,
} from '../db/schema.js';
import { accountsRouter } from './accounts.js';
import { transactionsRouter } from './transactions.js';

// Switchers from YNAB or a spreadsheet: categories in the file, and an opening balance typed
// as "today's balance" that must still be right once older rows are imported.
let server: Server;
let base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transactions', transactionsRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  db.insert(categoryGroups).values({ id: 'g1', name: 'Everyday', isIncome: 0 }).run();
  db.insert(categories).values({ id: 'c-groc', groupId: 'g1', name: 'Groceries' }).run();
});
afterAll(() => server.close());

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const row = (n: number, amount: number, extra = {}) => ({
  date: `2026-08-${String(n).padStart(2, '0')}`,
  amount,
  payeeName: 'Shop ' + n,
  importedId: 'r' + n,
  ...extra,
});
const mkAccount = async (extra = {}) =>
  (
    await call('POST', '/accounts', {
      name: 'A' + Math.random(),
      type: 'checking',
      startingBalance: 150_000,
      balanceAsOf: '2026-10-30',
      ...extra,
    })
  ).body.id as string;
const balance = async (id: string) =>
  (await call('GET', '/accounts')).body.find((a: { id: string }) => a.id === id).balance as number;

describe('import categories', () => {
  it('files imported rows under the category chosen for them, and nothing else', async () => {
    const id = await mkAccount({ balanceAsOf: undefined });
    const res = await call('POST', '/transactions/import/confirm', {
      accountId: id,
      rows: [row(1, -500, { categoryId: 'c-groc' }), row(2, -700)],
    });
    expect(res.body.imported).toBe(2);
    const rows = db.select().from(transactions).where(eq(transactions.accountId, id)).all();
    expect(rows.find((r) => r.importedId === 'r1')!.categoryId).toBe('c-groc');
    expect(rows.find((r) => r.importedId === 'r2')!.categoryId).toBeNull();
  });
  it('refuses a category that does not exist, importing nothing', async () => {
    const id = await mkAccount({ balanceAsOf: undefined });
    const res = await call('POST', '/transactions/import/confirm', {
      accountId: id,
      rows: [row(1, -500, { categoryId: 'nope' })],
    });
    expect(res.status).toBe(400);
    expect(db.select().from(transactions).where(eq(transactions.accountId, id)).all()).toHaveLength(
      0,
    );
  });
});

describe("an opening balance typed as today's balance", () => {
  it('stays what was typed after older rows are imported, and says so', async () => {
    const id = await mkAccount();
    const res = await call('POST', '/transactions/import/confirm', {
      accountId: id,
      rows: [row(1, -500), row(2, 300_000), row(3, -1_000)],
    });
    expect(res.body).toMatchObject({
      imported: 3,
      startingBalanceAdjusted: true,
      balance: 150_000,
    });
    expect(await balance(id)).toBe(150_000);
    expect(db.select().from(accounts).where(eq(accounts.id, id)).get()!.startingBalance).toBe(
      150_000 - (300_000 - 1_500),
    );
  });
  it('does not count rows dated after the day it was typed', async () => {
    const id = await mkAccount();
    await call('POST', '/transactions/import/confirm', {
      accountId: id,
      rows: [row(1, -500), { ...row(2, -2_000), date: '2026-11-02' }],
    });
    expect(await balance(id)).toBe(150_000 - 2_000);
  });
  it('is not applied to an account created without a balance as of a day', async () => {
    const id = await mkAccount({ balanceAsOf: undefined });
    const res = await call('POST', '/transactions/import/confirm', {
      accountId: id,
      rows: [row(1, -500)],
    });
    expect(res.body.startingBalanceAdjusted).toBe(false);
    expect(await balance(id)).toBe(149_500);
  });
  it('is never applied to an account holding a reconciled row; the change is reported', async () => {
    const id = await mkAccount();
    db.insert(transactions)
      .values({ id: 'rec', accountId: id, date: '2026-07-01', amount: -100, reconciled: 1 })
      .run();
    const res = await call('POST', '/transactions/import/confirm', {
      accountId: id,
      rows: [row(1, -500)],
    });
    expect(res.body).toMatchObject({
      startingBalanceAdjusted: false,
      balanceBefore: 149_900,
      balance: 149_400,
    });
    expect(await balance(id)).toBe(149_400);
  });
  it('is never applied to a bank-linked account', async () => {
    const id = await mkAccount();
    db.insert(upConnections)
      .values({ id: 'default', accessToken: 'x' })
      .onConflictDoNothing()
      .run();
    db.insert(upAccountMappings)
      .values({
        id: 'm1',
        connectionId: 'default',
        upAccountId: 'u1',
        name: 'U',
        accountType: 'TRANSACTIONAL',
        accountId: id,
      })
      .run();
    const res = await call('POST', '/transactions/import/confirm', {
      accountId: id,
      rows: [row(1, -500)],
    });
    expect(res.body.startingBalanceAdjusted).toBe(false);
    expect(await balance(id)).toBe(149_500);
    db.delete(upConnections).run();
  });
  it('is dropped when the starting balance is edited by hand', async () => {
    const id = await mkAccount();
    await call('PUT', `/accounts/${id}`, { startingBalance: 1_000 });
    const res = await call('POST', '/transactions/import/confirm', {
      accountId: id,
      rows: [row(1, -500)],
    });
    expect(res.body.startingBalanceAdjusted).toBe(false);
    expect(await balance(id)).toBe(500);
  });
  it('is applied once: a second import of the same file changes nothing', async () => {
    const id = await mkAccount();
    const rows = [row(1, -500), row(2, -700)];
    await call('POST', '/transactions/import/confirm', { accountId: id, rows });
    const again = await call('POST', '/transactions/import/confirm', { accountId: id, rows });
    expect(again.body).toMatchObject({ imported: 0, startingBalanceAdjusted: false });
    expect(await balance(id)).toBe(150_000);
  });
});
