import { addMonthsTo } from '../services/fundingMath.js';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, categories, categoryGroups, budgetMonths, transactions } from '../db/schema.js';
import { budgetRouter } from './budget.js';
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
  for (const table of [transactions, budgetMonths, categories, categoryGroups, accounts])
    db.delete(table).run();
  db.insert(accounts)
    .values({
      id: 'cash',
      name: 'Cash',
      type: 'checking',
      startingBalance: 10000,
      createdAt: '2020-01-01',
    })
    .run();
  db.insert(categoryGroups).values({ id: 'expense', name: 'Expenses' }).run();
  db.insert(categories)
    .values([
      { id: 'food', name: 'Food', groupId: 'expense' },
      { id: 'rent', name: 'Rent', groupId: 'expense' },
    ])
    .run();
});
const month = new Date().toISOString().slice(0, 7);
const put = (path: string, body: unknown) =>
  fetch(`${base}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
it('assigns opening funds once and rejects overcommitment without changing either purpose', async () => {
  expect((await put(`/${month}/food`, { budgeted: 10000 })).status).toBe(200);
  expect((await put(`/${month}/rent`, { budgeted: 1 })).status).toBe(409);
  expect(
    db
      .select()
      .from(budgetMonths)
      .all()
      .map((r) => r.budgeted),
  ).toEqual([10000]);
});
it('reserves future assignments against today and atomically rejects an unfunded bulk write', async () => {
  expect((await put('/2099-01/food', { budgeted: 10000 })).status).toBe(200);
  expect((await put(`/${month}/rent`, { budgeted: 1 })).status).toBe(409);
  const expected = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [addMonthsTo(month, i), 0]),
  );
  expect(
    (await put('/category/rent/bulk', { fromMonth: month, budgeted: 1, expected })).status,
  ).toBe(409);
  expect(db.select().from(budgetMonths).all()).toHaveLength(1);
});
it('preserves old overcommitments while allowing reductions and rejects stale edit undo', async () => {
  db.insert(budgetMonths).values({ id: 'old', categoryId: 'food', month, budgeted: 20000 }).run();
  const result = await (await put(`/${month}/food`, { budgeted: 10000 })).json();
  expect(result.previousBudgeted).toBe(20000);
  await put(`/${month}/food`, { budgeted: 9000 });
  expect((await put(`/${month}/food`, { budgeted: 20000, revision: result.revision })).status).toBe(
    409,
  );
});
it('validates months and category identities', async () => {
  expect((await put('/category/food/bulk', { fromMonth: '2026-99', budgeted: 1 })).status).toBe(
    400,
  );
  expect((await put(`/${month}/missing`, { budgeted: 1 })).status).toBe(404);
});
it('sets, validates and clears the budget start', async () => {
  const start = async () => (await (await fetch(`${base}/start`)).json()).month;
  expect(await start()).toBeNull();
  for (const bad of ['2026-13', '26-01', 202601, addMonthsTo(month, 1)])
    expect((await put('/start', { month: bad })).status).toBe(400);
  expect((await put('/start', { month })).status).toBe(200);
  expect(await start()).toBe(month);
  const summary = await (await fetch(`${base}/${month}/summary`)).json();
  expect(summary.budgetStartMonth).toBe(month);
  expect((await put('/start', { month: null })).status).toBe(200);
  expect(await start()).toBeNull();
});
