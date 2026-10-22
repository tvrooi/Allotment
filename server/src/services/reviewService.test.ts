import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  budgetSettings,
  categories,
  categoryGroups,
  categoryTargets,
  paydayFundingReceipts,
  paydayFundingEvents,
  paydayPlans,
  scheduleOccurrences,
  schedules,
  transactions,
} from '../db/schema.js';
import { bufferState, guideState, reviewState } from './reviewService.js';
import { budgetSummary } from './budgetService.js';
import { ratesChanged } from './mainAmountService.js';
import { reviewRouter } from '../routes/review.js';

// Synthetic budget. "Today" is 21 October 2026; the runway's history is July–September.
const assign = (categoryId: string, budgeted: number, month = '2026-10') =>
  db
    .insert(budgetMonths)
    .values({ id: `${categoryId}:${month}`, categoryId, month, budgeted })
    .run();
let n = 0;
const spend = (date: string, amount: number, categoryId: string | null, extra = {}) =>
  db
    .insert(transactions)
    .values({ id: `t${++n}`, accountId: 'cash', date, amount, categoryId, ...extra })
    .run();
const target = (categoryId: string, type: string, amount: number, extra = {}) =>
  db
    .insert(categoryTargets)
    .values({ categoryId, type, amount, createdMonth: '2026-10', ...extra })
    .run();
const step = (id: string) => guideState().steps.find((s) => s.id === id)!;

beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  for (const table of [
    categoryTargets,
    paydayFundingReceipts,
    paydayFundingEvents,
    paydayPlans,
    scheduleOccurrences,
    schedules,
    transactions,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
  ratesChanged();
  db.insert(accounts)
    .values({
      id: 'cash',
      name: 'Cash',
      type: 'checking',
      startingBalance: 500000,
      createdAt: '2026-06-01',
    })
    .run();
  db.insert(categoryGroups)
    .values([
      { id: 'income', name: 'Income', isIncome: 1 },
      { id: 'shared', name: 'Shared', sortOrder: 1 },
      { id: 'sam', name: 'Sam personal', sortOrder: 2 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'salary', name: 'Pay', groupId: 'income' },
      { id: 'food', name: 'Food', groupId: 'shared' },
      { id: 'rent', name: 'Rent', groupId: 'shared' },
      { id: 'insurance', name: 'Insurance', groupId: 'shared', budgetType: 'non_monthly' },
      { id: 'hobbies', name: 'Hobbies', groupId: 'sam' },
    ])
    .run();
  // $920 of food over July–September: 92 days at $10 a day.
  assign('food', 92000, '2026-07');
  spend('2026-07-10', -30000, 'food');
  spend('2026-08-10', -30000, 'food');
  spend('2026-09-10', -32000, 'food');
});

describe('buffer and next-month funding (6F)', () => {
  it('shows next month’s commitments and needs and a runway excluding true-expense reserves', () => {
    assign('insurance', 120000);
    target('insurance', 'recurring', 120000, { dueDate: '2027-03-15', cycleMonths: 12 });
    assign('food', 30000);
    assign('food', 20000, '2026-11');
    assign('rent', 10000, '2026-12');
    target('food', 'monthly', 25000);
    const buffer = bufferState();
    expect(buffer).toMatchObject({
      nextMonth: '2026-11',
      nextAssigned: 20000,
      laterAssigned: 10000,
      nextUnderfunded: 5000,
      nextNeeds: [{ categoryId: 'food', required: 25000, assigned: 20000, underfunded: 5000 }],
    });
    expect(buffer.runway).toMatchObject({
      resources: 408000,
      restricted: 120000,
      restrictedRows: [{ categoryId: 'insurance', kind: 'true-expense', amount: 120000 }],
      unrestricted: 288000,
      spending: { from: '2026-07-01', to: '2026-09-30', total: 92000, days: 92 },
      days: 288,
      incomplete: [],
    });
  });
  it('does not extend runway with retirement assets or borrowed money', () => {
    const before = bufferState().runway;
    db.insert(accounts)
      .values([
        {
          id: 'super',
          name: 'Super',
          type: 'investment',
          startingBalance: 9_000_000,
          createdAt: '2026-06-01',
        },
        { id: 'loc', name: 'Line of credit', type: 'line_of_credit', createdAt: '2026-06-01' },
      ])
      .run();
    // Drawing $1,000 from a line of credit into cash is borrowing, not saving.
    db.insert(transactions)
      .values([
        {
          id: 'in',
          accountId: 'cash',
          date: '2026-10-02',
          amount: 100000,
          transferTransactionId: 'out',
        },
        {
          id: 'out',
          accountId: 'loc',
          date: '2026-10-02',
          amount: -100000,
          transferTransactionId: 'in',
        },
      ])
      .run();
    expect(bufferState().runway).toMatchObject({
      unrestricted: before.unrestricted,
      days: before.days,
    });
  });
  it('reports a visibly incomplete runway for short history or missing rates', () => {
    db.delete(transactions).run();
    db.update(accounts).set({ createdAt: '2026-09-15' }).where(eq(accounts.id, 'cash')).run();
    spend('2026-09-20', -1000, 'food');
    const short = bufferState().runway;
    expect(short.days).toBeNull();
    expect(short.incomplete.join(' ')).toMatch(/History starts on 2026-09-15/);

    db.insert(budgetSettings).values({ id: 'budget', currency: 'AUD' }).run();
    db.insert(accounts)
      .values({
        id: 'usd',
        name: 'USD',
        type: 'checking',
        currency: 'USD',
        startingBalance: 1,
        createdAt: '2026-06-01',
      })
      .run();
    ratesChanged();
    const missing = bufferState();
    expect(missing.complete).toBe(false);
    expect(missing.runway).toMatchObject({ resources: null, unrestricted: null, days: null });
    expect(missing.runway.incomplete[0]).toMatch(/exchange rates/);
  });
});

describe('household review (6G)', () => {
  it('reconciles with the monthly summary and refreshes when an item is resolved', () => {
    spend('2026-10-05', -5000, null, { payeeName: 'Unknown shop' });
    spend('2026-10-06', -8000, 'rent');
    assign('food', 10000);
    assign('food', 20000, '2026-11');
    assign('hobbies', 10000, '2026-12');
    target('food', 'monthly', 25000);
    const review = reviewState();
    const summary = budgetSummary('2026-10');
    expect(review.totals).toMatchObject({
      uncategorised: summary.uncategorized,
      deficits: summary.overspent,
      futureCommitments: summary.futureAssigned,
      targetShortfalls: 15000,
    });
    expect(review.totals).toMatchObject({
      uncategorised: 5000,
      deficits: 8000,
      futureCommitments: 30000,
    });
    expect(review.uncategorised).toMatchObject([{ payee: 'Unknown shop', amount: -5000 }]);
    expect(review.deficits).toMatchObject([
      { categoryId: 'rent', amount: 8000, groupName: 'Shared' },
    ]);
    expect(review.commitments.map((c) => [c.month, c.amount, c.categories[0].groupName])).toEqual([
      ['2026-11', 20000, 'Shared'],
      ['2026-12', 10000, 'Sam personal'],
    ]);
    expect(review.groups.map((g) => g.name)).toEqual(['Shared', 'Sam personal']);
    expect(review.resolved).toBe(false);

    db.update(transactions)
      .set({ categoryId: 'food' })
      .where(eq(transactions.id, review.uncategorised[0].id))
      .run();
    expect(reviewState().totals.uncategorised).toBe(0);
    expect(budgetSummary('2026-10').uncategorized).toBe(0);
  });
});

describe('guided setup (6G)', () => {
  const rentBill = () =>
    db
      .insert(schedules)
      .values({
        id: 'rent-bill',
        name: 'Rent',
        amount: -120000,
        recurrenceType: 'monthly',
        recurrenceRule: JSON.stringify({ type: 'monthly', interval: 1, anchorDay: 25 }),
        startDate: '2026-10-25',
        accountId: 'cash',
        categoryId: 'rent',
      })
      .run();
  it('finds needs before the next income without counting expected salary as money', () => {
    rentBill();
    assign('rent', 50000);
    const before = guideState();
    expect(before.nextIncome).toBeNull();
    expect(before.needsUntil).toBe('2026-11-04');
    expect(before.needs).toMatchObject([{ categoryId: 'rent', due: 120000, uncovered: 70000 }]);
    expect(step('before-income').status).toBe('todo');

    db.insert(paydayPlans)
      .values({
        id: 'plan',
        configJson: JSON.stringify({
          name: 'Work',
          anchorDate: '2026-10-15',
          expectedIncome: 9_000_000,
          weekendAdjust: 'none',
          timeZone: 'Australia/Melbourne',
          rules: [],
        }),
      })
      .run();
    const withPlan = guideState();
    expect(withPlan.nextIncome).toBe('2026-10-29');
    // Expected pay is a date to plan to, never money to assign.
    expect(withPlan.unassigned).toBe(before.unassigned);
    assign('food', 0, '2026-12');
    db.update(budgetMonths)
      .set({ budgeted: 120000 })
      .where(eq(budgetMonths.id, 'rent:2026-10'))
      .run();
    expect(step('before-income').status).toBe('done');
  });
  it('derives every step from the budget', () => {
    expect(step('balances').status).toBe('todo');
    db.update(transactions).set({ reconciled: 1 }).run();
    expect(step('balances').status).toBe('done');

    expect(step('assign').status).toBe('todo');
    assign('food', 408000);
    expect(step('assign').status).toBe('done');

    expect(guideState().irregular).toEqual([
      { categoryId: 'insurance', name: 'Insurance', hasTarget: false },
    ]);
    expect(step('irregular').status).toBe('todo');
    target('insurance', 'by-date', 60000, { dueDate: '2027-06-01' });
    expect(step('irregular').status).toBe('done');

    expect(step('before-spending').status).toBe('done');
    spend('2026-10-07', -100, null);
    expect(step('before-spending').status).toBe('attention');
  });
});

describe('review routes', () => {
  let server: Server;
  afterAll(() => server?.close());
  it('serves the review, buffer and guide read-only', async () => {
    const app = express();
    app.use('/review', reviewRouter);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/review`;
    const before = db.select().from(budgetMonths).all();
    for (const path of ['', '/buffer', '/guide']) {
      const res = await fetch(base + path);
      expect(res.status).toBe(200);
      expect(await res.json()).toHaveProperty('asOf', '2026-10-21');
    }
    expect(db.select().from(budgetMonths).all()).toEqual(before);
  });
});
