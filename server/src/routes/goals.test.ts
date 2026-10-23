import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  budgetMonths,
  transactions,
  goals,
  cardFunding,
} from '../db/schema.js';
import { goalsRouter } from './goals.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';
let server: Server, base: string;
const today = new Date().toISOString().slice(0, 10),
  month = today.slice(0, 7);
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/goals', goalsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/goals`;
});
afterAll(() => server.close());
beforeEach(() => {
  for (const table of [
    goals,
    cardFunding,
    transactions,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
  ])
    db.delete(table).run();
  db.insert(accounts)
    .values({
      id: 'cash',
      name: 'Cash',
      type: 'checking',
      startingBalance: 100000,
      createdAt: '2020-01-01',
    })
    .run();
  db.insert(categoryGroups)
    .values([
      { id: 'expense', name: 'Expenses' },
      { id: 'income', name: 'Income', isIncome: 1 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'save', name: 'Trip', groupId: 'expense' },
      { id: 'salary', name: 'Salary', groupId: 'income' },
    ])
    .run();
});
const write = (body: unknown, id = '') =>
  fetch(base + (id ? `/${id}` : ''), {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const list = () => fetch(base).then((r) => r.json());
it('derives category progress from assignment, money moves, spending and refunds; keeps manual history', async () => {
  const manual = await (
    await write({ name: 'Trip', targetAmount: 50000, currentAmount: 1234 })
  ).json();
  expect((await write({ categoryId: 'save' }, manual.id)).status).toBe(200);
  db.insert(budgetMonths)
    .values({ id: 'allocation', month, categoryId: 'save', budgeted: 20000 })
    .run();
  expect((await list())[0]).toMatchObject({
    currentAmount: 1234,
    fundedAmount: 20000,
    assignedThisMonth: 20000,
    available: 20000,
  });
  db.update(budgetMonths).set({ budgeted: 15000 }).where(eq(budgetMonths.id, 'allocation')).run();
  expect((await list())[0].fundedAmount).toBe(15000);
  db.insert(transactions)
    .values({ id: 'spend', accountId: 'cash', categoryId: 'save', date: today, amount: -5000 })
    .run();
  expect((await list())[0]).toMatchObject({
    fundedAmount: 10000,
    activity: -5000,
    available: 10000,
  });
  db.insert(transactions)
    .values({ id: 'refund', accountId: 'cash', categoryId: 'save', date: today, amount: 1000 })
    .run();
  expect((await list())[0].fundedAmount).toBe(11000);
  expect((await write({ currentAmount: 9999 }, manual.id)).status).toBe(400);
  expect((await (await write({ categoryId: null }, manual.id)).json()).currentAmount).toBe(1234);
});
it('does not fund a category goal from account transfers and excludes future assignments', async () => {
  await write({ name: 'Trip', targetAmount: 50000, categoryId: 'save', accountId: 'cash' });
  db.insert(accounts).values({ id: 'saver', name: 'Saver', type: 'savings' }).run();
  db.insert(transactions)
    .values([
      { id: 'out', accountId: 'cash', date: today, amount: -20000, transferTransactionId: 'in' },
      { id: 'in', accountId: 'saver', date: today, amount: 20000, transferTransactionId: 'out' },
    ])
    .run();
  db.insert(budgetMonths)
    .values({ id: 'future', month: '2099-01', categoryId: 'save', budgeted: 20000 })
    .run();
  expect((await list())[0].fundedAmount).toBe(0);
});
it('rejects duplicate, missing, income and payment reserve categories', async () => {
  for (const categoryId of ['missing', 'salary'])
    expect((await write({ name: 'Bad', targetAmount: 1, categoryId })).status).toBe(400);
  expect((await write({ name: 'Trip', targetAmount: 1, categoryId: 'save' })).status).toBe(201);
  expect((await write({ name: 'Duplicate', targetAmount: 1, categoryId: 'save' })).status).toBe(
    400,
  );
  expect(
    (await write({ name: 'Editable', targetAmount: 1, categoryId: 'save', currentAmount: 50 }))
      .status,
  ).toBe(400);
  db.delete(goals).run();
  db.insert(accounts).values({ id: 'card', name: 'Card', type: 'credit' }).run();
  db.insert(cardFunding)
    .values({
      accountId: 'card',
      reviewedBalance: 0,
      createdAt: new Date().toISOString(),
      categoryId: 'save',
      startDate: today,
      baselineIds: '[]',
      initialFunding: 0,
    })
    .run();
  expect((await write({ name: 'Payment', targetAmount: 1, categoryId: 'save' })).status).toBe(400);
});
it('preserves linkage and manual values through backup; rejects duplicated claims and accepts legacy backups', async () => {
  const manual = await (
    await write({ name: 'Trip', targetAmount: 50000, currentAmount: 1234 })
  ).json();
  await write({ categoryId: 'save' }, manual.id);
  db.insert(budgetMonths)
    .values({ id: 'allocation', month, categoryId: 'save', budgeted: 20000 })
    .run();
  const backup = createBackup() as ReturnType<typeof createBackup> & {
    goals: (typeof goals.$inferSelect)[];
  };
  restoreBackup(parseBackup(backup));
  expect((await list())[0]).toMatchObject({
    categoryId: 'save',
    currentAmount: 1234,
    fundedAmount: 20000,
  });
  const bad = { ...backup, goals: [...backup.goals, { ...backup.goals[0], id: 'other' }] };
  expect(() => parseBackup(bad)).toThrow('Invalid or duplicate goal category');
  const legacy = { ...backup, version: 8, goals: backup.goals.map(({ categoryId: _, ...g }) => g) };
  restoreBackup(parseBackup(legacy));
  expect((await list())[0]).toMatchObject({ categoryId: null, currentAmount: 1234 });
});
it('category deletion preserves the original manually tracked amount', async () => {
  const manual = await (
    await write({ name: 'Trip', targetAmount: 50000, currentAmount: 1234 })
  ).json();
  await write({ categoryId: 'save' }, manual.id);
  db.delete(categories).where(eq(categories.id, 'save')).run();
  expect((await list())[0]).toMatchObject({ categoryId: null, currentAmount: 1234 });
});
it('does not present missing exchange rates as fully funded progress', async () => {
  await write({ name: 'Trip', targetAmount: 50000, categoryId: 'save' });
  db.insert(accounts)
    .values({
      id: 'foreign',
      name: 'Foreign',
      type: 'checking',
      currency: 'USD',
      startingBalance: 10000,
      createdAt: '2020-01-01',
    })
    .run();
  db.insert(budgetMonths)
    .values({ id: 'allocation', month, categoryId: 'save', budgeted: 20000 })
    .run();
  expect((await list())[0]).toMatchObject({
    fundingComplete: false,
    fundedAmount: null,
    available: null,
  });
});
