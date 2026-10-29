import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  payees,
  transactions,
  upConnections,
} from '../db/schema.js';
import { seedDefaultCategories } from '../db/defaultCategories.js';
import { upRouter } from './up.js';
import { reportsRouter } from './reports.js';
import { syncUp } from '../services/upSyncService.js';
import { detectSalary, uncategorisedSummary } from '../services/importTidy.js';
import { startUpMock, UP_TEST_TOKEN } from '../test/upMock.js';

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
  app.use('/reports', reportsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await mock.close();
  server.close();
  delete process.env.FLYBUDGET_UP_API;
  delete process.env.FLYBUDGET_CATEGORY_TEMPLATE;
});
beforeEach(() => {
  db.delete(upConnections).run();
  db.delete(transactions).run();
  db.delete(payees).run();
  db.delete(accounts).run();
  db.delete(categories).run();
  db.delete(categoryGroups).run();
  process.env.FLYBUDGET_CATEGORY_TEMPLATE = 'au';
  seedDefaultCategories();
  mock.setMode('rich');
});
const post = (path: string, data: unknown) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
async function firstSync() {
  expect((await post('/up/setup', { accessToken: UP_TEST_TOKEN })).ok).toBe(true);
  expect(
    (
      await post('/up/map-accounts', {
        mappings: [
          { upAccountId: 'spending', action: 'create' },
          { upAccountId: 'saver', action: 'create' },
        ],
      })
    ).ok,
  ).toBe(true);
  const result = await syncUp();
  expect(result.errors).toEqual([]);
  return result;
}
const categoryName = (id: string | null) =>
  id ? db.select().from(categories).where(eq(categories.id, id)).get()?.name : null;
const isTransfer = (notes: string | null) => !!notes?.includes('Up internal transfer');

describe('first Up sync uses Up’s own categories', () => {
  it('leaves under 15% of spending uncategorised, and maps to the budget’s names', async () => {
    await firstSync();
    const spending = db
      .select()
      .from(transactions)
      .all()
      .filter((t) => t.amount < 0 && !isTransfer(t.notes));
    expect(spending.length).toBeGreaterThan(100);
    const missing = spending.filter((t) => !t.categoryId);
    expect(missing.length / spending.length).toBeLessThan(0.15);
    const by = (payee: string) => [
      ...new Set(
        spending.filter((t) => t.payeeName === payee).map((t) => categoryName(t.categoryId)),
      ),
    ];
    expect(by('Coles')).toEqual(['Groceries']);
    expect(by('Ray White Property Mgmt')).toEqual(['Rent']);
    expect(by('Transport for NSW Opal')).toEqual(['Public Transport']);
    expect(by('Netflix')).toEqual(['Streaming & Subscriptions']);
    // Up's category with no counterpart here stays for the owner to sort
    expect(by('Service NSW')).toEqual([null]);
  });

  it('never categorises transfers or pay from Up', async () => {
    await firstSync();
    const rows = db.select().from(transactions).all();
    const transfers = rows.filter((t) => isTransfer(t.notes));
    expect(transfers.length).toBeGreaterThan(0);
    expect(transfers.every((t) => !t.categoryId)).toBe(true);
    const pay = rows.filter((t) => t.payeeName === 'ACME LOGISTICS PTY LTD SALARY');
    expect(pay.length).toBeGreaterThanOrEqual(6);
    expect(pay.every((t) => !t.categoryId)).toBe(true);
  });

  it('lets a payee default win over Up’s category', async () => {
    db.insert(payees)
      .values({
        id: 'coles',
        name: 'Coles',
        defaultCategoryId: db
          .select()
          .from(categories)
          .where(eq(categories.name, 'Entertainment'))
          .get()!.id,
      })
      .run();
    await firstSync();
    const coles = db
      .select()
      .from(transactions)
      .all()
      .filter((t) => t.payeeName === 'Coles');
    expect(coles.length).toBeGreaterThan(3);
    expect(new Set(coles.map((t) => categoryName(t.categoryId)))).toEqual(
      new Set(['Entertainment']),
    );
  });

  it('never changes a row that already exists on a later sync', async () => {
    await firstSync();
    const row = db
      .select()
      .from(transactions)
      .all()
      .find((t) => t.payeeName === 'Coles')!;
    db.update(transactions).set({ categoryId: null }).where(eq(transactions.id, row.id)).run();
    const again = await syncUp();
    expect(again.added).toBe(0);
    expect(
      db.select().from(transactions).where(eq(transactions.id, row.id)).get()!.categoryId,
    ).toBe(null);
  });

  it('leaves a budget without a matching category uncategorised', async () => {
    db.delete(categories).where(eq(categories.name, 'Groceries')).run();
    await firstSync();
    const coles = db
      .select()
      .from(transactions)
      .all()
      .filter((t) => t.payeeName === 'Coles');
    expect(coles.every((t) => !t.categoryId)).toBe(true);
  });
});

describe('what is left after the import', () => {
  it('finds fortnightly pay from a stable payee, not the transfers', async () => {
    await firstSync();
    const salary = detectSalary()!;
    expect(salary).toMatchObject({
      payeeName: 'ACME LOGISTICS PTY LTD SALARY',
      schedule: 'fortnightly',
      intervalDays: 14,
      latestAmount: 320_000,
      categoryName: 'Pay',
    });
    expect(salary.occurrences).toBeGreaterThanOrEqual(6);
    expect(salary.uncategorisedCount).toBe(salary.occurrences);
    const live = await (await fetch(`${base}/reports/salary`)).json();
    expect(live.payeeName).toBe(salary.payeeName);
  });

  it('finds no pay without a repeating credit', () => {
    expect(detectSalary()).toBeNull();
  });

  it('reports uncategorised spending and money in over a window', async () => {
    await firstSync();
    const all = uncategorisedSummary();
    expect(all.uncategorisedIncomeCount).toBeGreaterThanOrEqual(6);
    expect(all.categorisedIncome).toBe(0);
    expect(all.share).toBeGreaterThan(0);
    expect(all.share).toBeLessThan(0.15);
    const live = await (await fetch(`${base}/reports/uncategorised-summary`)).json();
    expect(live.uncategorisedSpending).toBe(all.uncategorisedSpending);
    const empty = await (
      await fetch(`${base}/reports/uncategorised-summary?from=2001-01-01&to=2001-01-31`)
    ).json();
    expect(empty).toMatchObject({ spending: 0, share: 0 });
    expect((await fetch(`${base}/reports/uncategorised-summary?from=nope`)).status).toBe(400);
  });

  it('counts everything as uncategorised before any sorting (the default-template names too)', async () => {
    process.env.FLYBUDGET_CATEGORY_TEMPLATE = 'default';
    db.delete(categories).run();
    db.delete(categoryGroups).run();
    seedDefaultCategories();
    await firstSync();
    const spending = db
      .select()
      .from(transactions)
      .all()
      .filter((t) => t.amount < 0 && !isTransfer(t.notes));
    const names = new Set(spending.map((t) => categoryName(t.categoryId)));
    expect(names).toContain('Groceries');
    expect(names).toContain('Rent / Mortgage');
    expect(names).toContain('Public Transit');
  });
});
