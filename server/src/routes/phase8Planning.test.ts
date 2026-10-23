import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { inArray } from 'drizzle-orm';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  categories,
  categoryGroups,
  payees,
  transactions,
} from '../db/schema.js';
import { reportsRouter } from './reports.js';
import { budgetRouter } from './budget.js';
import { annualOverview } from '../services/annualOverview.js';
import { budgetGroups, fundingState } from '../services/budgetService.js';

// Phase 8 merchant breakdown and annual overview (docs/MONARCH-DEVELOPMENT-PHASE.md), on
// the brief's mock fixture plus a refund and plans. Mock data only.

const TODAY = '2026-10-22';
let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  db.insert(accounts)
    .values({
      id: 'mock',
      name: 'Mock account',
      type: 'checking',
      startingBalance: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    .run();
  db.insert(categoryGroups)
    .values([
      { id: 'income', name: 'Income', isIncome: 1 },
      { id: 'living', name: 'Living' },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'paychecks', name: 'Paychecks', groupId: 'income' },
      { id: 'groceries', name: 'Groceries', groupId: 'living' },
      { id: 'dining', name: 'Dining', groupId: 'living' },
    ])
    .run();
  db.insert(payees)
    .values([
      { id: 'grocer', name: 'Mock grocer' },
      { id: 'cafe', name: 'Mock cafe' },
      { id: 'shop', name: 'Mock shop' },
    ])
    .run();
  const tx = (
    id: string,
    date: string,
    amount: number,
    categoryId: string | null,
    payeeId: string | null,
    payeeName: string | null,
  ) => ({ id, accountId: 'mock', date, amount, categoryId, payeeId, payeeName });
  db.insert(transactions)
    .values([
      tx('pay', '2026-10-05', 200000, 'paychecks', null, 'Mock payroll'),
      tx('groc-oct', '2026-10-07', -12000, 'groceries', 'grocer', 'Mock grocer'),
      tx('cafe', '2026-10-09', -4500, 'dining', 'cafe', 'Mock cafe'),
      tx('groc-sep', '2026-09-07', -9000, 'groceries', 'grocer', 'Mock grocer'),
    ])
    .run();
  db.insert(budgetMonths)
    .values([
      { id: 'b-sep', month: '2026-09', categoryId: 'groceries', budgeted: 10000 },
      { id: 'b-oct', month: '2026-10', categoryId: 'groceries', budgeted: 15000 },
      { id: 'b-oct-d', month: '2026-10', categoryId: 'dining', budgeted: 5000 },
      { id: 'b-nov', month: '2026-11', categoryId: 'groceries', budgeted: 15000 },
      { id: 'b-dec', month: '2026-12', categoryId: 'groceries', budgeted: 15000 },
    ])
    .run();
  const app = express();
  app.use('/api/reports', reportsRouter);
  app.use('/api/budget', budgetRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

const get = async <T>(path: string) => {
  const res = await fetch(base + path);
  return { status: res.status, body: (await res.json()) as T };
};
type PayeeRow = { payeeId: string | null; payeeName: string; net: number; count: number };

describe('merchant breakdown', () => {
  it('preserves the period spending total that categories show', async () => {
    const { body: rows } = await get<PayeeRow[]>(
      '/reports/spending-by-payee?from=2026-10&to=2026-10',
    );
    expect(rows.map((r) => [r.payeeName, r.net])).toEqual([
      ['Mock grocer', -12000],
      ['Mock cafe', -4500],
    ]);
    const { body: ie } = await get<{ expenseNet: number }[]>(
      '/reports/income-vs-expenses?from=2026-10&to=2026-10',
    );
    expect(rows.reduce((s, r) => s + r.net, 0)).toBe(ie[0].expenseNet);
    const { body: all } = await get<PayeeRow[]>('/reports/spending-by-payee');
    expect(all.find((r) => r.payeeId === 'grocer')).toMatchObject({ net: -21000, count: 2 });
    expect(-all.reduce((s, r) => s + r.net, 0)).toBe(25500);
  });

  it('keeps net refunds and payee-less spending so rows still add up', async () => {
    db.insert(transactions)
      .values([
        {
          id: 'refund',
          accountId: 'mock',
          date: '2026-10-10',
          amount: 3000,
          categoryId: 'groceries',
          payeeId: 'shop',
          payeeName: 'Mock shop',
        },
        { id: 'cash', accountId: 'mock', date: '2026-10-11', amount: -700, categoryId: 'dining' },
      ])
      .run();
    try {
      const { body: rows } = await get<PayeeRow[]>(
        '/reports/spending-by-payee?from=2026-10&to=2026-10',
      );
      expect(rows.find((r) => r.payeeId === 'shop')?.net).toBe(3000);
      expect(rows.find((r) => r.payeeId === null)).toMatchObject({ payeeName: '', net: -700 });
      const { body: ie } = await get<{ expenseNet: number }[]>(
        '/reports/income-vs-expenses?from=2026-10&to=2026-10',
      );
      expect(rows.reduce((s, r) => s + r.net, 0)).toBe(ie[0].expenseNet);
    } finally {
      db.delete(transactions)
        .where(inArray(transactions.id, ['refund', 'cash']))
        .run();
    }
  });

  it('rejects malformed months', async () => {
    expect((await get('/reports/spending-by-payee?from=2026-13')).status).toBe(400);
  });
});

describe('annual overview', () => {
  it('sums monthly assignments and activity, matching each month of the budget', () => {
    const year = annualOverview(2026, TODAY);
    const groceries = year.groups.flatMap((g) => g.categories).find((c) => c.id === 'groceries')!;
    for (const cell of groceries.months) {
      const monthly = budgetGroups(cell.month, TODAY)
        .flatMap((g) => g.categories)
        .find((c) => c.id === 'groceries')!;
      expect(cell.assigned).toBe(monthly.budgeted);
      expect(cell.activity).toBe(monthly.activity);
    }
    expect(groceries.assigned).toBe(55000);
    expect(groceries.activity).toBe(-21000);
    // Available is October's closing balance, never a sum of balances (or carry-over again)
    const october = budgetGroups('2026-10', TODAY)
      .flatMap((g) => g.categories)
      .find((c) => c.id === 'groceries')!;
    expect(groceries.available).toBe(october.balance);
    expect(groceries.available).toBe(10000 - 9000 + 15000 - 12000);
    expect(year.balanceMonth).toBe('2026-10');
  });

  it('keeps future assignments as plans that add nothing to money available today', () => {
    const year = annualOverview(2026, TODAY);
    expect(year.months.filter((m) => m.planned).map((m) => m.month)).toEqual([
      '2026-11',
      '2026-12',
    ]);
    expect(year.totals.plannedAssigned).toBe(30000);
    expect(year.months.find((m) => m.month === '2026-11')).toMatchObject({ activity: 0 });
    const state = fundingState(TODAY);
    expect(year.today).toMatchObject({
      available: state.available,
      unassigned: state.unassigned,
      futureAssigned: state.futureAssigned,
    });
    expect(state.futureAssigned).toBe(30000);
  });

  it('reports income and spending totals that agree with the monthly activity', () => {
    const year = annualOverview(2026, TODAY);
    expect(year.totals.income).toBe(200000);
    expect(year.totals.activity).toBe(-25500);
    const october = year.months.find((m) => m.month === '2026-10')!;
    expect(october).toMatchObject({ income: 200000, activity: -16500, assigned: 20000 });
  });

  it('has no closing balance for a year that has not started', () => {
    const next = annualOverview(2027, TODAY);
    expect(next.balanceMonth).toBeNull();
    expect(next.groups.flatMap((g) => g.categories).every((c) => c.available === null)).toBe(true);
    expect(next.months.every((m) => m.planned)).toBe(true);
  });

  it('validates the year', async () => {
    expect((await get('/budget/year/26')).status).toBe(400);
    expect((await get('/budget/year/abcd')).status).toBe(400);
    expect((await get('/budget/year/2026')).status).toBe(200);
  });
});
