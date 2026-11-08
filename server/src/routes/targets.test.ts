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
    expect(backup.version).toBe(33);
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

describe('auto-assign', () => {
  const spend = (id: string, categoryId: string, date: string, amount: number) =>
    db.insert(transactions).values({ id, accountId: 'cash', date, amount, categoryId }).run();

  it('tops envelopes up by strategy, never lowers one, and applies the preview once', async () => {
    assign('food', '2026-09', 30000);
    assign('gifts', '2026-09', 5000);
    assign('gifts', '2026-10', 8000);
    spend('f9', 'food', '2026-09-10', -25000);
    spend('f8', 'food', '2026-08-10', -11000);
    spend('i10', 'insurance', '2026-10-05', -12000);
    const preview = async (strategy: string) =>
      (await call('POST', '/2026-10/auto-assign/preview', { strategy })).body;

    // Insurance is overspent by $120 this month; nothing else is.
    expect((await preview('overspent')).rows).toEqual([
      expect.objectContaining({ categoryId: 'insurance', need: 12000, proposed: 12000 }),
    ]);
    // Gifts already has more than last month's $50, so only food is topped up.
    expect((await preview('assigned_last_month')).rows).toEqual([
      expect.objectContaining({ categoryId: 'food', need: 30000 }),
    ]);
    expect((await preview('spent_last_month')).rows).toEqual([
      expect.objectContaining({ categoryId: 'food', need: 25000 }),
    ]);
    // ($250 + $110 + $0) / 3 months
    expect((await preview('average_spent')).rows).toEqual([
      expect.objectContaining({ categoryId: 'food', need: 12000 }),
    ]);
    expect((await call('POST', '/2026-10/auto-assign/preview', { strategy: 'x' })).status).toBe(
      400,
    );

    const reviewed = await preview('overspent');
    const apply = () =>
      call('POST', '/2026-10/auto-assign/apply', {
        strategy: 'overspent',
        revision: reviewed.revision,
        rows: reviewed.rows,
      });
    expect((await apply()).body).toMatchObject({ applied: 12000 });
    expect((await apply()).status).toBe(409);
    expect((await preview('overspent')).rows).toEqual([]);
  });

  const postPreview = async (body: Record<string, unknown>) =>
    (await call('POST', '/2026-10/auto-assign/preview', body)).body;

  it('replace mode copies, averages or clears a month, lowering an assignment only to zero', async () => {
    assign('food', '2026-09', 30000);
    assign('food', '2026-10', 50000);
    assign('gifts', '2026-09', 5000);
    assign('gifts', '2026-10', 8000);
    assign('rego', '2026-10', 7000);
    spend('f9', 'food', '2026-09-10', -25000);
    // Adding never lowers: food already has more than last month
    expect((await postPreview({ strategy: 'assigned_last_month' })).rows).toEqual([]);
    // Replacing makes this month match last month, including lowering and clearing
    const copy = await postPreview({ strategy: 'assigned_last_month', mode: 'replace' });
    expect(copy.mode).toBe('replace');
    expect(
      copy.rows.map((r: { categoryId: string; proposed: number }) => [r.categoryId, r.proposed]),
    ).toEqual([
      ['rego', -7000],
      ['food', -20000],
      ['gifts', -3000],
    ]);
    // Taking money back raises Ready to assign by the same amount
    expect(copy.total).toBe(-30000);
    // Zero clears every assignment, whatever mode is asked for, and never goes below zero
    const zero = await postPreview({ strategy: 'zero' });
    expect(zero.mode).toBe('replace');
    expect(
      zero.rows.map((r: { proposed: number }) => r.proposed).sort((a: number, b: number) => a - b),
    ).toEqual([-50000, -8000, -7000]);
    // Cover overspending and target funding can only add
    expect((await postPreview({ strategy: 'overspent', mode: 'replace' })).mode).toBe('add');
    // Taking back is applied and the month is left as previewed
    const applied = await call('POST', '/2026-10/auto-assign/apply', {
      strategy: 'zero',
      revision: zero.revision,
      rows: zero.rows,
    });
    expect(applied.body).toMatchObject({ applied: -65000 });
    expect(
      db
        .select()
        .from(budgetMonths)
        .all()
        .filter((r) => r.month === '2026-10' && r.budgeted !== 0),
    ).toEqual([]);
    expect(
      db
        .select()
        .from(budgetMonths)
        .all()
        .find((r) => r.month === '2026-09' && r.categoryId === 'food')?.budgeted,
    ).toBe(30000);
  });

  it('does not take an assignment below zero to offset a transfer into a linked account', async () => {
    db.insert(accounts)
      .values({ id: 'saver', name: 'Saver', type: 'savings', createdAt: '2020-01-01' })
      .run();
    db.insert(categories)
      .values({ id: 'goal', name: 'goal', groupId: 'bills', linkedAccountId: 'saver' })
      .run();
    db.insert(transactions)
      .values([
        {
          id: 'out',
          accountId: 'cash',
          date: '2026-10-02',
          amount: -20000,
          transferTransactionId: 'in',
        },
        {
          id: 'in',
          accountId: 'saver',
          date: '2026-10-02',
          amount: 20000,
          transferTransactionId: 'out',
        },
      ])
      .run();
    assign('goal', '2026-10', 5000);
    const zero = await postPreview({ strategy: 'zero', categoryIds: ['goal'] });
    // $200 already arrived by transfer, so the $50 assignment goes to zero and no further
    expect(zero.rows).toEqual([expect.objectContaining({ categoryId: 'goal', proposed: -5000 })]);
  });

  it('Set to zero clears the assignment whatever transfers moved through a linked account', async () => {
    db.insert(accounts)
      .values({ id: 'saver', name: 'Saver', type: 'savings', createdAt: '2020-01-01' })
      .run();
    db.insert(categories)
      .values({ id: 'goal', name: 'goal', groupId: 'bills', linkedAccountId: 'saver' })
      .run();
    // $200 left the saver this month
    db.insert(transactions)
      .values([
        {
          id: 'out',
          accountId: 'saver',
          date: '2026-10-02',
          amount: -20000,
          transferTransactionId: 'in',
        },
        {
          id: 'in',
          accountId: 'cash',
          date: '2026-10-02',
          amount: 20000,
          transferTransactionId: 'out',
        },
      ])
      .run();
    assign('goal', '2026-10', 5000);
    const zero = await postPreview({ strategy: 'zero', categoryIds: ['goal'] });
    expect(zero.rows).toEqual([expect.objectContaining({ categoryId: 'goal', proposed: -5000 })]);
  });

  it('averages over 3, 6 or 12 months, counting months without spending', async () => {
    spend('a', 'food', '2026-09-10', -30000);
    spend('b', 'food', '2026-05-10', -60000);
    spend('c', 'food', '2025-12-10', -120000);
    const need = async (months?: number) =>
      (await postPreview({ strategy: 'average_spent', months })).rows[0]?.need;
    expect(await need()).toBe(10000); // $300 over 3 months
    expect(await need(6)).toBe(15000); // $300 + $600 over 6 months (Apr to Sep)
    expect(await need(12)).toBe(17500); // $2,100 over Oct 2025 to Sep 2026
    expect(
      (await call('POST', '/2026-10/auto-assign/preview', { strategy: 'average_spent', months: 4 }))
        .status,
    ).toBe(400);
  });

  it('can be limited to chosen categories, for auto-assign and for target funding', async () => {
    spend('i', 'insurance', '2026-10-05', -12000);
    spend('r', 'rego', '2026-10-06', -3000);
    const all = await postPreview({ strategy: 'overspent' });
    expect(all.rows).toHaveLength(2);
    const only = await postPreview({ strategy: 'overspent', categoryIds: ['rego'] });
    expect(only.rows).toEqual([expect.objectContaining({ categoryId: 'rego', proposed: 3000 })]);
    expect(only.total).toBe(3000);
    // The reviewed scope is part of the apply: a different scope changes the plan, so it is refused
    const body = { strategy: 'overspent', revision: only.revision, rows: only.rows };
    expect((await call('POST', '/2026-10/auto-assign/apply', body)).status).toBe(409);
    const applied = await call('POST', '/2026-10/auto-assign/apply', {
      ...body,
      categoryIds: ['rego'],
    });
    expect(applied.body).toMatchObject({ applied: 3000 });
    expect(
      db
        .select()
        .from(budgetMonths)
        .all()
        .map((r) => r.categoryId),
    ).toEqual(['rego']);

    await target('food', { type: 'monthly', amount: 20000 });
    await target('gifts', { type: 'monthly', amount: 10000 });
    const targets = (await call('POST', '/2026-10/targets/preview', { categoryIds: ['gifts'] }))
      .body;
    expect(targets.rows).toEqual([
      expect.objectContaining({ categoryId: 'gifts', proposed: 10000 }),
    ]);
    const fund = await call('POST', '/2026-10/targets/apply', {
      revision: targets.revision,
      rows: targets.rows,
      categoryIds: ['gifts'],
    });
    expect(fund.body).toMatchObject({ applied: 10000 });
    expect(
      (await call('POST', '/2026-10/targets/preview')).body.rows.map(
        (r: { categoryId: string }) => r.categoryId,
      ),
    ).toEqual(['food']);
  });
});
