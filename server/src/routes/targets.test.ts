import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  cardFunding,
  categories,
  categoryGroups,
  categoryTargets,
  transactions,
} from '../db/schema.js';
import { budgetRouter } from './budget.js';
import { currentDueDate } from '../services/targetService.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';

// Synthetic budget. "Today" is 21 October 2026.
let server: Server, base: string;
const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};
const assign = (categoryId: string, month: string, budgeted: number) =>
  db
    .insert(budgetMonths)
    .values({ id: `${categoryId}:${month}`, categoryId, month, budgeted })
    .onConflictDoUpdate({
      target: [budgetMonths.month, budgetMonths.categoryId],
      set: { budgeted },
    })
    .run();
const target = (categoryId: string, body: unknown) =>
  call('PUT', `/category/${categoryId}/target`, body);
async function status(month: string, categoryId: string) {
  const groups = (await call('GET', `/${month}`)).body as {
    categories: { id: string; target: Record<string, unknown> | null }[];
  }[];
  return groups.flatMap((g) => g.categories).find((c) => c.id === categoryId)!.target;
}

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
  const app = express();
  app.use(express.json());
  app.use('/budget', budgetRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/budget`;
});
afterAll(() => {
  vi.useRealTimers();
  server.close();
});
beforeEach(() => {
  for (const table of [
    categoryTargets,
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
      { id: 'income', name: 'Income', isIncome: 1 },
      { id: 'bills', name: 'Bills', sortOrder: 1 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'salary', name: 'Pay', groupId: 'income' },
      ...['insurance', 'rego', 'food', 'gifts'].map((id, i) => ({
        id,
        name: id,
        groupId: 'bills',
        sortOrder: i,
      })),
    ])
    .run();
});

describe('target requirements', () => {
  it('spreads a deadline over the remaining months and catches up after a missed month', async () => {
    assign('insurance', '2026-09', 30000);
    expect(
      (await target('insurance', { type: 'by-date', amount: 120000, dueDate: '2027-03-15' }))
        .status,
    ).toBe(200);
    // $1,200 due in six funding months (Oct–Mar) with $300 reserved needs $150 a month.
    expect(await status('2026-10', 'insurance')).toMatchObject({
      required: 15000,
      periodsLeft: 6,
      underfunded: 15000,
      catchUp: 0,
    });
    // Nothing assigned in October: November needs $900 over five months. That is more than
    // October's $150 but still below the even $200 for the whole $1,200, so no catch-up.
    expect(await status('2026-11', 'insurance')).toMatchObject({
      required: 18000,
      periodsLeft: 5,
      catchUp: 0,
    });
    assign('insurance', '2026-10', 10000);
    expect(await status('2026-10', 'insurance')).toMatchObject({
      assigned: 10000,
      underfunded: 5000,
    });
    expect(await status('2027-04', 'insurance')).toMatchObject({ ended: true, required: 0 });
  });

  it('advances recurring bills by whole cycles without rewriting activity', async () => {
    db.insert(transactions)
      .values({
        id: 'paid',
        accountId: 'cash',
        date: '2026-08-20',
        amount: -60000,
        categoryId: 'rego',
      })
      .run();
    assign('rego', '2026-08', 60000);
    await target('rego', {
      type: 'recurring',
      amount: 60000,
      dueDate: '2026-08-20',
      cycleMonths: 3,
    });
    // Next due 20 November: two months to fund $600, $300 a month against an even $200.
    expect(await status('2026-10', 'rego')).toMatchObject({
      dueDate: '2026-11-20',
      periodsLeft: 2,
      required: 30000,
      catchUp: 10000,
    });
    expect(await status('2026-12', 'rego')).toMatchObject({
      dueDate: '2027-02-20',
      periodsLeft: 3,
    });
    expect(db.select().from(transactions).all()).toHaveLength(1);
    expect(currentDueDate({ dueDate: '2026-01-31', cycleMonths: 1 }, '2026-02')).toBe('2026-02-28');
    expect(currentDueDate({ dueDate: '2026-01-31', cycleMonths: 1 }, '2026-03')).toBe('2026-03-31');
  });

  it('supports monthly and refill targets', async () => {
    await target('food', { type: 'monthly', amount: 50000 });
    assign('gifts', '2026-09', 4000);
    await target('gifts', { type: 'refill', amount: 10000 });
    expect(await status('2026-10', 'food')).toMatchObject({ required: 50000, underfunded: 50000 });
    expect(await status('2026-10', 'gifts')).toMatchObject({ required: 6000 });
    expect(await status('2026-10', 'insurance')).toBeNull();
  });

  it('rejects income and card payment categories and keeps assignments when removed', async () => {
    expect((await target('salary', { type: 'monthly', amount: 1 })).status).toBe(400);
    expect((await target('food', { type: 'by-date', amount: 1 })).status).toBe(400);
    db.insert(accounts)
      .values({ id: 'card', name: 'Card', type: 'credit', createdAt: '2020-01-01' })
      .run();
    db.insert(cardFunding)
      .values({
        accountId: 'card',
        categoryId: 'gifts',
        startDate: '2026-10-01',
        baselineIds: '[]',
        reviewedBalance: 0,
        initialFunding: 0,
        createdAt: '2026-10-01',
      })
      .run();
    expect((await target('gifts', { type: 'monthly', amount: 1 })).status).toBe(400);
    await target('food', { type: 'monthly', amount: 50000 });
    assign('food', '2026-10', 50000);
    expect((await call('DELETE', '/category/food/target')).status).toBe(204);
    expect(await status('2026-10', 'food')).toBeNull();
    expect(db.select().from(budgetMonths).all()).toHaveLength(1);
  });
});

describe('funding targets', () => {
  it('previews suggestions capped at unassigned money and applies them once', async () => {
    await target('food', { type: 'monthly', amount: 60000 });
    await target('gifts', { type: 'monthly', amount: 60000 });
    const preview = (await call('POST', '/2026-10/targets/preview')).body;
    // $1,000 of cash: food is fully funded, gifts gets the remaining $400.
    expect(preview).toMatchObject({
      available: 100000,
      total: 100000,
      shortfall: 20000,
      rows: [
        { categoryId: 'food', proposed: 60000, shortfall: 0 },
        { categoryId: 'gifts', proposed: 40000, shortfall: 20000 },
      ],
    });
    expect(db.select().from(budgetMonths).all()).toHaveLength(0);
    const stale = await call('POST', '/2026-10/targets/apply', {
      revision: preview.revision,
      rows: [{ categoryId: 'food', proposed: 60000 }],
    });
    expect(stale.status).toBe(409);
    const applied = await call('POST', '/2026-10/targets/apply', {
      revision: preview.revision,
      rows: preview.rows,
    });
    expect(applied.body).toMatchObject({ applied: 100000 });
    expect(
      db
        .select()
        .from(budgetMonths)
        .all()
        .map((r) => [r.categoryId, r.budgeted])
        .sort(),
    ).toEqual([
      ['food', 60000],
      ['gifts', 40000],
    ]);
    // Repeating the same reviewed request cannot assign the money twice.
    expect(
      (
        await call('POST', '/2026-10/targets/apply', {
          revision: preview.revision,
          rows: preview.rows,
        })
      ).status,
    ).toBe(409);
    expect((await call('POST', '/2026-10/targets/preview')).body).toMatchObject({
      available: 0,
      total: 0,
      rows: [{ categoryId: 'gifts', underfunded: 20000, proposed: 0 }],
    });
  });

  it('round-trips targets in backups and rejects invalid ones', async () => {
    await target('rego', {
      type: 'recurring',
      amount: 60000,
      dueDate: '2026-11-20',
      cycleMonths: 3,
    });
    const backup = createBackup() as Record<string, unknown>;
    expect(backup.version).toBe(13);
    db.delete(categoryTargets).run();
    restoreBackup(parseBackup(backup));
    expect(db.select().from(categoryTargets).all()).toMatchObject([
      { categoryId: 'rego', type: 'recurring', cycleMonths: 3 },
    ]);
    const bad = structuredClone(backup) as { categoryTargets: Record<string, unknown>[] };
    bad.categoryTargets[0].categoryId = 'salary';
    expect(() => parseBackup(bad)).toThrow('Invalid category target');
    const older = structuredClone(backup) as Record<string, unknown>;
    delete older.categoryTargets;
    older.version = 9;
    restoreBackup(parseBackup(older));
    expect(db.select().from(categoryTargets).all()).toHaveLength(0);
  });
});

describe('history and bulk planning', () => {
  it('averages over every month in the window, including months without spending', async () => {
    db.insert(transactions)
      .values({
        id: 'tv',
        accountId: 'cash',
        date: '2026-07-04',
        amount: -60000,
        categoryId: 'gifts',
      })
      .run();
    const history = (await call('GET', '/category/gifts/history?months=6&currentMonth=2026-10'))
      .body;
    expect(history.average).toBe(10000);
  });

  it('shows the months a bulk change overwrites and applies only the reviewed preview', async () => {
    assign('food', '2026-12', 7000);
    const preview = (
      await call('GET', '/category/food/bulk-preview?budgeted=5000&fromMonth=2026-10')
    ).body;
    expect(preview.months).toHaveLength(12);
    expect(preview.months[2]).toEqual({ month: '2026-12', current: 7000, next: 5000 });
    const expected = Object.fromEntries(
      preview.months.map((m: { month: string; current: number }) => [m.month, m.current]),
    );
    assign('food', '2027-01', 1);
    const stale = await call('PUT', '/category/food/bulk', {
      budgeted: 5000,
      fromMonth: '2026-10',
      expected,
    });
    expect(stale.status).toBe(409);
    expected['2027-01'] = 1;
    const ok = await call('PUT', '/category/food/bulk', {
      budgeted: 5000,
      fromMonth: '2026-10',
      expected,
    });
    expect(ok.status).toBe(200);
    expect(
      db
        .select()
        .from(budgetMonths)
        .all()
        .every((r) => r.budgeted === 5000),
    ).toBe(true);
  });
});
