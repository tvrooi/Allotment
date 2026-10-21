import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, budgetMonths, categories, categoryGroups, transactions } from '../db/schema.js';
import { reportsRouter } from './reports.js';
import { budgetRouter } from './budget.js';
import { transactionsRouter } from './transactions.js';
import { linkTransfer, unlinkTransfer } from '../services/transferService.js';

let server: Server;
let base: string;
const date = '2026-05-15';
const row = (id: string) => db.select().from(transactions).where(eq(transactions.id, id)).get()!;
const add = (id: string, amount: number, extra: Partial<typeof transactions.$inferInsert> = {}) => {
  db.insert(transactions)
    .values({ id, accountId: 'spending', date, amount, ...extra })
    .run();
};
const get = async (path: string) => (await fetch(base + path)).json();
const update = (id: string, data: unknown) =>
  fetch(`${base}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  db.insert(accounts)
    .values([
      { id: 'spending', name: 'Spending', type: 'checking' },
      { id: 'saver', name: 'Saver', type: 'savings' },
      { id: 'super', name: 'Retirement', type: 'retirement', isOffBudget: 1 },
      { id: 'tracking', name: 'Tracking', type: 'investment', isOffBudget: 1 },
    ])
    .run();
  db.insert(categoryGroups)
    .values([
      { id: 'expenses', name: 'Expenses', isIncome: 0 },
      { id: 'income', name: 'Income', isIncome: 1 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'saving', groupId: 'expenses', name: 'Contributions' },
      { id: 'salary', groupId: 'income', name: 'Salary' },
    ])
    .run();
  const app = express();
  app.use(express.json());
  app.use('/reports', reportsRouter);
  app.use('/budget', budgetRouter);
  app.use('/transactions', transactionsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => {
  db.delete(transactions).run();
  db.delete(budgetMonths).run();
});

describe('budget boundary and report account scopes', () => {
  it('counts only the budget leg; preserves imported rows and categories when explicitly linking', async () => {
    add('out', -1000, {
      categoryId: 'saving',
      importedId: 'bank-out',
      notes: 'My contribution',
      importedPayee: 'BANK PAYMENT',
    });
    add('in', 1000, { accountId: 'super', importedId: 'bank-in', categoryId: 'salary' });
    const before = [row('out'), row('in')];
    linkTransfer('out', 'in');
    for (const original of before) {
      expect(row(original.id)).toMatchObject({
        id: original.id,
        importedId: original.importedId,
        amount: original.amount,
        categoryId: original.categoryId,
        notes: original.notes,
      });
    }
    expect((await get('/reports/spending-by-category?from=2026-05&to=2026-05'))[0]).toMatchObject({
      categoryId: 'saving',
      totalSpent: 1000,
    });
    expect(await get('/reports/income-by-category?from=2026-05&to=2026-05')).toEqual([]);
    expect((await get('/reports/cash-flow?from=2026-05&to=2026-05'))[0].net).toBe(-1000);
    expect((await get('/reports/daily-flow?from=2026-05&to=2026-05'))[0]).toMatchObject({
      expenses: 1000,
      income: 0,
      count: 1,
    });
    expect((await get('/reports/net-worth?from=2026-05&to=2026-05'))[0].assets).toBe(1000);
    const list = await get('/transactions?budget_report=1');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'out', isBudgetBoundary: true });
    const budget = await get('/budget/2026-05');
    expect(budget.find((g: { id: string }) => g.id === 'expenses').categories[0].spent).toBe(1000);
    const history = await get('/budget/category/saving/history?months=1&currentMonth=2026-05');
    expect(history.history).toEqual([{ month: '2026-05', amount: 1000 }]);
    const june = await get('/budget/2026-06');
    expect(june.find((g: { id: string }) => g.id === 'expenses').categories[0].carryOver).toBe(
      -1000,
    );
    unlinkTransfer('out');
    expect(row('out')).toMatchObject({
      categoryId: 'saving',
      importedId: 'bank-out',
      payeeName: 'BANK PAYMENT',
    });
  });

  it('supports reviewed boundary categories and protects a reconciled counterpart', async () => {
    add('out', -2500);
    add('in', 2500, { accountId: 'super' });
    linkTransfer('out', 'in');
    expect((await update('out', { categoryId: 'saving' })).status).toBe(200);
    expect((await update('in', { categoryId: 'salary' })).status).toBe(400);
    db.update(transactions).set({ reconciled: 1 }).where(eq(transactions.id, 'in')).run();
    const locked = row('in');
    expect((await update('out', { date: '2026-05-16' })).status).toBe(403);
    expect((await update('out', { amount: -2600 })).status).toBe(403);
    expect((await update('out', { notes: 'Reviewed' })).status).toBe(200);
    expect((await fetch(`${base}/transactions/out`, { method: 'DELETE' })).status).toBe(403);
    expect(row('in')).toEqual(locked);
    expect((await update('in', { categoryId: null })).status).toBe(403);
  });

  it('nets a return to the expense category and treats a categorized boundary receipt as income', async () => {
    add('out', -1000, { categoryId: 'saving' });
    add('in', 1000, { accountId: 'super' });
    linkTransfer('out', 'in');
    add('refund', 200, { categoryId: 'saving' });
    add('refund-source', -200, { accountId: 'super' });
    linkTransfer('refund', 'refund-source');
    add('income', 300, { categoryId: 'salary' });
    add('income-source', -300, { accountId: 'super' });
    linkTransfer('income', 'income-source');
    expect((await get('/reports/spending-by-category?from=2026-05&to=2026-05'))[0].totalSpent).toBe(
      800,
    );
    expect(
      (await get('/reports/income-by-category?from=2026-05&to=2026-05'))[0].totalReceived,
    ).toBe(300);
    expect(await get('/budget/2026-05/summary')).toMatchObject({
      income: 300,
      toBeBudgeted: -500,
      overspent: 800,
    });
    expect(await get('/budget/2026-06/summary')).toMatchObject({
      income: 0,
      toBeBudgeted: -500,
      overspent: 800,
    });
  });

  it('uses budget accounts in every default activity report, drill-down and custom aggregation', async () => {
    add('pay', 10000, { categoryId: 'salary' });
    add('purchase', -1000, { categoryId: 'saving' });
    add('refund', 200, { categoryId: 'saving' });
    add('split', -600, { isParent: 1 });
    add('part-a', -250, { parentTransactionId: 'split', categoryId: 'saving' });
    add('part-b', -350, { parentTransactionId: 'split', categoryId: 'saving' });
    add('adjustment', 99999, { isAdjustment: 1 });
    add('off-income', 50000, { accountId: 'super', categoryId: 'salary' });
    add('off-expense', -7000, { accountId: 'super', categoryId: 'saving' });
    add('internal-out', -500, { categoryId: 'saving' });
    add('internal-in', 500, { accountId: 'saver', categoryId: 'salary' });
    linkTransfer('internal-out', 'internal-in');
    add('off-transfer-out', -800, { accountId: 'super', categoryId: 'saving' });
    add('off-transfer-in', 800, { accountId: 'tracking', categoryId: 'salary' });
    linkTransfer('off-transfer-out', 'off-transfer-in');
    const snapshot = db.select().from(transactions).all();
    const query = '?from=2026-05&to=2026-05';
    expect((await get('/reports/spending-by-category' + query))[0].totalSpent).toBe(1400);
    expect((await get('/reports/income-by-category' + query))[0].totalReceived).toBe(10000);
    expect((await get('/reports/income-vs-expenses' + query))[0]).toMatchObject({
      income: 10000,
      expenses: 1400,
      net: 8600,
    });
    expect((await get('/reports/cash-flow' + query))[0].net).toBe(8600);
    expect((await get('/reports/daily-flow' + query))[0]).toMatchObject({
      income: 10200,
      expenses: 1600,
      count: 4,
    });
    expect((await get('/reports/spending-trends' + query + '&category_ids=saving'))[0].total).toBe(
      1400,
    );
    expect(
      (await get('/reports/custom' + query + '&balance_type=total')).data.reduce(
        (sum: number, r: { value: number }) => sum + r.value,
        0,
      ),
    ).toBe(8600);
    expect(
      (await get('/reports/custom' + query + '&balance_type=total&account_ids=super')).data.reduce(
        (sum: number, r: { value: number }) => sum + r.value,
        0,
      ),
    ).toBe(43000);
    const drilldown = await get('/transactions?budget_report=1&category_id=saving');
    expect(drilldown.map((r: { id: string }) => r.id).sort()).toEqual([
      'purchase',
      'refund',
      'split',
    ]);
    expect(db.select().from(transactions).all()).toEqual(snapshot);
  });
  it('uses the budget scope for the current spending comparison too', async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    add('purchase', -700, { date: today, categoryId: 'saving' });
    add('off-purchase', -99999, { date: today, accountId: 'super', categoryId: 'saving' });
    add('boundary-out', -300, { date: today, categoryId: 'saving' });
    add('boundary-in', 300, { date: today, accountId: 'super' });
    linkTransfer('boundary-out', 'boundary-in');
    expect(await get('/reports/spending-comparison')).toMatchObject({ currentTotal: 1000 });
  });
});
