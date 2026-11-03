import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  schedules,
  transactions,
  upAccountMappings,
  upConnections,
} from '../db/schema.js';
import { accountsRouter } from './accounts.js';

let server: Server;
let base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/accounts', accountsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => {
  for (const table of [schedules, transactions, upAccountMappings, upConnections, accounts])
    db.delete(table).run();
  db.insert(accounts)
    .values([
      { id: 'dup', name: 'Everyday (CSV)', type: 'checking', startingBalance: 150000 },
      { id: 'keep', name: 'Savings', type: 'savings', startingBalance: 0 },
    ])
    .run();
});
const add = (id: string, accountId: string, amount: number, extra = {}) =>
  db
    .insert(transactions)
    .values({ id, accountId, date: '2026-09-01', amount, ...extra })
    .run();
async function send(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}
const count = (accountId: string) =>
  db.select().from(transactions).where(eq(transactions.accountId, accountId)).all().length;

it('deletes the account and its transactions only after the exact name is typed', async () => {
  for (let i = 0; i < 30; i++) add(`d${i}`, 'dup', -100);
  add('k', 'keep', -5);
  const preview = await send('GET', '/accounts/dup/deletion');
  expect(preview.body).toMatchObject({ name: 'Everyday (CSV)', transactions: 30, blockers: [] });

  const wrong = await send('POST', '/accounts/dup/delete-permanently', { confirmName: 'everyday' });
  expect(wrong).toMatchObject({ status: 400 });
  expect(count('dup')).toBe(30);

  const done = await send('POST', '/accounts/dup/delete-permanently', {
    confirmName: 'Everyday (CSV)',
  });
  expect(done).toMatchObject({ status: 200, body: { deleted: 30 } });
  expect(
    db
      .select()
      .from(accounts)
      .all()
      .map((a) => a.id),
  ).toEqual(['keep']);
  expect(count('dup')).toBe(0);
  expect(count('keep')).toBe(1);
});

it('keeps the other side of a transfer, as an ordinary transaction', async () => {
  add('out', 'dup', -1000, { transferTransactionId: 'in', payeeName: 'Transfer: Savings' });
  add('in', 'keep', 1000, { transferTransactionId: 'out', payeeName: 'Transfer: Everyday (CSV)' });
  await send('POST', '/accounts/dup/delete-permanently', { confirmName: 'Everyday (CSV)' });
  const left = db.select().from(transactions).get()!;
  expect(left).toMatchObject({
    id: 'in',
    accountId: 'keep',
    amount: 1000,
    transferTransactionId: null,
  });
});

it('refuses while a bank feed supplies the account, and says how to unlink', async () => {
  db.insert(upConnections)
    .values({ id: 'up', accessToken: 'mock-token-for-disposable-test' })
    .run();
  db.insert(upAccountMappings)
    .values({
      id: 'm',
      connectionId: 'up',
      upAccountId: 'mock',
      name: 'Spending',
      accountType: 'TRANSACTIONAL',
      accountId: 'dup',
    })
    .run();
  add('d', 'dup', -100);
  const res = await send('POST', '/accounts/dup/delete-permanently', {
    confirmName: 'Everyday (CSV)',
  });
  expect(res.status).toBe(409);
  expect(res.body.error).toMatch(/linked to Up\. Unlink it first: Settings → Connections → Up/);
  expect(count('dup')).toBe(1);
  expect(db.select().from(accounts).all()).toHaveLength(2);
});

it('refuses while recurring items use it, or a transfer partner is reconciled', async () => {
  db.insert(schedules)
    .values({
      id: 's',
      name: 'Rent',
      amount: -90000,
      recurrenceType: 'monthly',
      recurrenceRule: JSON.stringify({ type: 'monthly', interval: 1, anchorDay: 1 }),
      startDate: '2026-10-01',
      accountId: 'dup',
    })
    .run();
  const first = await send('POST', '/accounts/dup/delete-permanently', {
    confirmName: 'Everyday (CSV)',
  });
  expect(first.body.error).toMatch(/Recurring items use Everyday \(CSV\): Rent/);
  db.delete(schedules).run();
  add('out', 'dup', -1000, { transferTransactionId: 'in' });
  add('in', 'keep', 1000, { transferTransactionId: 'out', reconciled: 1 });
  const second = await send('POST', '/accounts/dup/delete-permanently', {
    confirmName: 'Everyday (CSV)',
  });
  expect(second.body.error).toMatch(/other side.*reconciled in another account/);
  expect(count('dup')).toBe(1);
});
