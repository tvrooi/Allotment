import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  budgetMoves,
  budgetSettings,
  cardFunding,
  categories,
  categoryGroups,
  payees,
  rules,
  schedules,
  transactions,
} from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { budgetGroups, budgetSummary } from '../services/budgetService.js';
import { ratesChanged } from '../services/mainAmountService.js';
import { categoriesRouter } from './categories.js';

// Deleting a category into another keeps the budget a ledger: the assigned money moves with the
// spending, so no month's Ready to Assign or envelope Available changes (docs/ENVELOPE-FUNDING.md).

const TODAY = '2026-10-21';
const MONTHS = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  const app = express();
  app.use(express.json());
  app.use('/api/categories', categoriesRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => {
  server.close();
  vi.useRealTimers();
});
afterEach(() => vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`)));

const send = async (method: string, path: string) => {
  const res = await fetch(base + path, { method });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

let seq = 0;
function txn(date: string, amount: number, categoryId: string | null) {
  db.insert(transactions)
    .values({ id: `t${++seq}`, accountId: 'cash', date, amount, categoryId })
    .run();
}
function assign(categoryId: string, month: string, budgeted: number) {
  db.insert(budgetMonths)
    .values({ id: `${categoryId}:${month}`, month, categoryId, budgeted })
    .run();
}
const available = (month: string, id: string) =>
  budgetGroups(month)
    .flatMap((g) => g.categories)
    .find((c) => c.id === id)?.balance;
const rta = (month: string) => budgetSummary(month).toBeBudgeted;

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`));
  for (const table of [
    budgetMoves,
    schedules,
    payees,
    rules,
    transactions,
    budgetMonths,
    cardFunding,
    categories,
    categoryGroups,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
  ratesChanged();
  db.insert(categoryGroups)
    .values([
      { id: 'expense', name: 'Expenses' },
      { id: 'income', name: 'Income', isIncome: 1 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'food', name: 'Food', groupId: 'expense' },
      { id: 'groceries', name: 'Groceries', groupId: 'expense' },
      { id: 'empty', name: 'Empty', groupId: 'expense' },
      { id: 'salary', name: 'Salary', groupId: 'income' },
      { id: 'bonus', name: 'Bonus', groupId: 'income' },
    ])
    .run();
  db.insert(accounts)
    .values({
      id: 'cash',
      name: 'cash',
      type: 'checking',
      startingBalance: 0,
      createdAt: '2026-07-01',
    })
    .run();
});

/**
 * Three months of income, assignments and spending in both categories. With `mixed`, August
 * leaves Food in credit and Groceries overspent; otherwise both end the same way every month.
 */
function seedHistory(mixed = false) {
  txn('2026-08-03', 300000, 'salary');
  txn('2026-09-03', 300000, 'salary');
  txn('2026-10-03', 300000, 'salary');
  assign('food', '2026-08', 50000);
  assign('groceries', '2026-08', 30000);
  assign('food', '2026-09', 50000);
  assign('groceries', '2026-09', 20000);
  assign('food', '2026-10', 40000);
  assign('groceries', '2026-10', 10000);
  txn('2026-08-10', mixed ? -20000 : -60000, 'food');
  txn('2026-08-12', -35000, 'groceries'); // overspent: 50 short at month end
  txn('2026-09-10', -50000, 'food');
  txn('2026-09-15', -5000, 'groceries');
  txn('2026-10-05', -45000, 'food'); // overspent
  txn('2026-10-06', mixed ? -2000 : -40000, 'groceries');
}

describe('deleting a category into another', () => {
  it('leaves Ready to Assign and every envelope unchanged in every month', async () => {
    seedHistory();
    const before = MONTHS.map((m) => ({
      rta: rta(m),
      food: available(m, 'food'),
      groceries: available(m, 'groceries'),
      salary: available(m, 'salary'),
    }));

    const res = await send('DELETE', '/categories/food?reassignTo=groceries');
    expect(res.status).toBe(204);

    MONTHS.forEach((m, i) => {
      expect(rta(m), `${m} ready to assign`).toBe(before[i].rta);
      expect(available(m, 'food'), `${m} food gone`).toBeUndefined();
      expect(available(m, 'salary'), `${m} salary`).toBe(before[i].salary);
      expect(available(m, 'groceries'), `${m} groceries`).toBe(
        (before[i].food ?? 0) + (before[i].groceries ?? 0),
      );
    });
    // the assignments were summed, not dropped
    const sep = db.select().from(budgetMonths).where(eq(budgetMonths.month, '2026-09')).all();
    expect(sep).toHaveLength(1);
    expect(sep[0]).toMatchObject({ categoryId: 'groceries', budgeted: 70000 });
    expect(db.select().from(categories).where(eq(categories.id, 'food')).get()).toBeUndefined();
    expect(db.select().from(transactions).where(eq(transactions.categoryId, 'food')).all()).toEqual(
      [],
    );
  });

  it('keeps total money unchanged when one envelope was overspent and the other in credit', async () => {
    seedHistory(true);
    // The target's Available is the sum, so the overspent envelope's deficit is now covered by
    // the other one's surplus: Ready to Assign plus the envelopes still add up as before.
    const total = (m: string) =>
      rta(m) +
      budgetGroups(m)
        .flatMap((g) => g.categories)
        .reduce((sum, c) => sum + c.balance, 0);
    const before = MONTHS.map(total);
    expect((await send('DELETE', '/categories/food?reassignTo=groceries')).status).toBe(204);
    expect(MONTHS.map(total)).toEqual(before);
  });

  it('creates the target row where it had none and keeps the target notes where it did', async () => {
    assign('food', '2026-09', 1000);
    assign('food', '2026-10', 2000);
    assign('groceries', '2026-10', 500);
    db.update(budgetMonths)
      .set({ notes: 'keep me' })
      .where(eq(budgetMonths.id, 'groceries:2026-10'))
      .run();

    expect((await send('DELETE', '/categories/food?reassignTo=groceries')).status).toBe(204);
    const rows = db.select().from(budgetMonths).all();
    const by = (month: string) => rows.find((r) => r.month === month)!;
    expect(by('2026-09')).toMatchObject({ categoryId: 'groceries', budgeted: 1000 });
    expect(by('2026-10')).toMatchObject({ budgeted: 2500, notes: 'keep me' });
    expect(rows).toHaveLength(2);
  });

  it('refuses a category with transactions or assignments unless a target is given', async () => {
    txn('2026-10-05', -100, 'food');
    expect((await send('DELETE', '/categories/food')).status).toBe(409);
    assign('groceries', '2026-10', 100);
    const res = await send('DELETE', '/categories/groceries');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/reassignTo/);
    for (const id of ['food', 'groceries'])
      expect(db.select().from(categories).where(eq(categories.id, id)).get()).toBeDefined();
    expect(db.select().from(budgetMonths).all()).toHaveLength(1);
  });

  it('reports assignments from the count endpoint', async () => {
    assign('groceries', '2026-10', 100);
    assign('empty', '2026-10', 0);
    expect((await send('GET', '/categories/groceries/transaction-count')).body).toEqual({
      count: 0,
      hasAssignments: true,
    });
    expect((await send('GET', '/categories/empty/transaction-count')).body).toEqual({
      count: 0,
      hasAssignments: false,
    });
  });

  it('still deletes an empty category directly, even with a zero assignment row', async () => {
    assign('empty', '2026-10', 0);
    expect((await send('DELETE', '/categories/empty')).status).toBe(204);
    expect(db.select().from(categories).where(eq(categories.id, 'empty')).get()).toBeUndefined();
    expect(db.select().from(budgetMonths).all()).toEqual([]);
  });

  it('refuses income into expense, expense into income, payment envelopes and unknown targets', async () => {
    db.insert(accounts)
      .values({
        id: 'card',
        name: 'card',
        type: 'credit',
        startingBalance: 0,
        createdAt: '2026-07-01',
      })
      .run();
    db.insert(cardFunding)
      .values({
        accountId: 'card',
        categoryId: 'empty',
        startDate: '2026-07-01',
        baselineIds: '[]',
        reviewedBalance: 0,
        initialFunding: 0,
        createdAt: '2026-07-01',
      })
      .run();
    txn('2026-10-05', -100, 'food');
    txn('2026-10-05', 100, 'salary');
    expect((await send('DELETE', '/categories/food?reassignTo=salary')).status).toBe(400);
    expect((await send('DELETE', '/categories/salary?reassignTo=food')).status).toBe(400);
    expect((await send('DELETE', '/categories/food?reassignTo=empty')).status).toBe(400);
    expect((await send('DELETE', '/categories/food?reassignTo=nope')).status).toBe(400);
    expect((await send('DELETE', '/categories/food?reassignTo=food')).status).toBe(400);
    // income folds into income
    expect((await send('DELETE', '/categories/salary?reassignTo=bonus')).status).toBe(204);
    expect(
      db.select().from(transactions).where(eq(transactions.categoryId, 'bonus')).all(),
    ).toHaveLength(1);
    expect(db.select().from(categories).where(eq(categories.id, 'food')).get()).toBeDefined();
  });

  it('re-points schedules, payee defaults and rules', async () => {
    db.insert(schedules)
      .values({
        id: 's1',
        name: 'Shop',
        amount: -100,
        recurrenceType: 'monthly',
        startDate: '2026-10-01',
        categoryId: 'food',
      })
      .run();
    db.insert(payees).values({ id: 'p1', name: 'Shop', defaultCategoryId: 'food' }).run();
    db.insert(rules)
      .values([
        {
          id: 'r1',
          conditions: JSON.stringify([
            { field: 'category', op: 'is', value: 'food' },
            { field: 'notes', op: 'contains', value: 'food' },
          ]),
          actions: JSON.stringify([
            { type: 'set_category', value: 'food' },
            { type: 'set_notes', value: 'food' },
          ]),
        },
        {
          id: 'r2',
          conditions: JSON.stringify([
            { field: 'category', op: 'one_of', value: ['food', 'groceries'] },
          ]),
          actions: JSON.stringify([
            {
              type: 'split',
              parts: [
                { kind: 'percent', value: 50, categoryId: 'food', notes: null },
                { kind: 'remainder', value: 0, categoryId: 'empty', notes: null },
              ],
            },
          ]),
        },
        {
          id: 'r3',
          conditions: JSON.stringify([{ field: 'category', op: 'is', value: 'empty' }]),
          actions: JSON.stringify([{ type: 'set_category', value: 'empty' }]),
        },
      ])
      .run();

    expect((await send('DELETE', '/categories/food?reassignTo=groceries')).status).toBe(204);

    expect(db.select().from(schedules).get()!.categoryId).toBe('groceries');
    expect(db.select().from(payees).get()!.defaultCategoryId).toBe('groceries');
    const rule = (id: string) => {
      const r = db.select().from(rules).where(eq(rules.id, id)).get()!;
      return { conditions: JSON.parse(r.conditions), actions: JSON.parse(r.actions) };
    };
    expect(rule('r1')).toEqual({
      conditions: [
        { field: 'category', op: 'is', value: 'groceries' },
        { field: 'notes', op: 'contains', value: 'food' },
      ],
      actions: [
        { type: 'set_category', value: 'groceries' },
        { type: 'set_notes', value: 'food' },
      ],
    });
    expect(rule('r2').conditions[0].value).toEqual(['groceries']);
    expect(rule('r2').actions[0].parts[0].categoryId).toBe('groceries');
    expect(rule('r2').actions[0].parts[1].categoryId).toBe('empty');
    expect(rule('r3').actions[0].value).toBe('empty');
  });
});
