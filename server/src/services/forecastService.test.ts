import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  categories,
  categoryGroups,
  categoryPurposes,
  goals,
  householdBills,
  householdEvents,
  householdGroups,
  householdPeople,
  paydayPlans,
  scheduleOccurrences,
  schedules,
  transactions,
} from '../db/schema.js';
import { buildForecast } from './forecastService.js';
import { forecastRequestSchema, type ForecastRequest } from './forecastConfig.js';
import { forecastRouter } from '../routes/forecast.js';

// Synthetic fixtures only. "Today" is Wednesday 21 October 2026; pay is fortnightly from
// 1 October, so the next paydays are 29 October, 12 November, 26 November and 10 December.
const forecast = (input: Partial<ForecastRequest> | Record<string, unknown> = {}) =>
  buildForecast(forecastRequestSchema.parse(input));
const base = (input: Record<string, unknown> = {}) =>
  forecast({ scenarios: [{ name: 'Base' }], ...input }).scenarios[0];
const balanceOn = (s: ReturnType<typeof base>, date: string) =>
  s.days.find((d) => d.date === date)!.balance;

function plan(rules: unknown[] = [], extra = {}) {
  db.insert(paydayPlans)
    .values({
      id: 'plan',
      configJson: JSON.stringify({
        name: 'Work',
        anchorDate: '2026-10-01',
        expectedIncome: 300000,
        weekendAdjust: 'none',
        timeZone: 'Australia/Sydney',
        rules,
        ...extra,
      }),
    })
    .run();
}
function tx(id: string, date: string, amount: number, extra = {}) {
  db.insert(transactions)
    .values({ id, accountId: 'cash', date, amount, categoryId: 'food', ...extra })
    .run();
}
function schedule(id: string, amount: number, startDate: string, extra = {}) {
  db.insert(schedules)
    .values({
      id,
      name: id,
      amount,
      recurrenceType: 'monthly',
      recurrenceRule: JSON.stringify({
        type: 'monthly',
        interval: 1,
        anchorDay: Number(startDate.slice(8)),
      }),
      startDate,
      accountId: 'cash',
      categoryId: 'rent',
      ...extra,
    })
    .run();
}
function snapshot() {
  const tables = db
    .all<{
      name: string;
    }>(
      sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%'`,
    )
    .map((t) => t.name);
  return Object.fromEntries(
    tables.map((t) => [t, db.all(sql.raw(`select * from "${t}" order by rowid`))]),
  );
}

let server: Server, url: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
  const app = express();
  app.use(express.json());
  app.use('/forecast', forecastRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/forecast`;
});
afterAll(() => {
  vi.useRealTimers();
  server.close();
});
beforeEach(() => {
  for (const table of [
    categoryPurposes,
    householdBills,
    householdEvents,
    householdPeople,
    householdGroups,
    goals,
    paydayPlans,
    scheduleOccurrences,
    schedules,
    transactions,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
  ])
    db.delete(table).run();
  db.insert(accounts)
    .values([
      {
        id: 'cash',
        name: 'Everyday',
        type: 'checking',
        startingBalance: 100000,
        createdAt: '2020-01-01',
      },
      { id: 'super', name: 'Super', type: 'retirement', isOffBudget: 1, startingBalance: 9000000 },
      { id: 'home', name: 'Home loan', type: 'mortgage', startingBalance: -5000000 },
    ])
    .run();
  db.insert(categoryGroups)
    .values([
      { id: 'income', name: 'Income', isIncome: 1 },
      { id: 'expenses', name: 'Expenses' },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'salary', name: 'Pay', groupId: 'income' },
      ...['rent', 'food', 'holiday', 'house'].map((id) => ({ id, name: id, groupId: 'expenses' })),
    ])
    .run();
  // 28 days of history: one salary and $280 of food, i.e. $10 a day of variable spending.
  tx('salary', '2026-09-24', 50000, { categoryId: 'salary' });
  for (const [i, date] of ['2026-09-30', '2026-10-07', '2026-10-14', '2026-10-20'].entries())
    tx(`food${i}`, date, -7000);
});

describe('cash runway', () => {
  it('says how much spending in the lookback has no category, so the average is not trusted blindly', () => {
    plan();
    // Fully categorised: nothing to warn about
    expect(forecast({ lookbackDays: 28 }).spending.uncategorised).toMatchObject({
      total: 0,
      count: 0,
      significant: false,
    });
    // $70 of $350 (20%) has no category and is left out of the $280 average
    tx('mystery', '2026-10-18', -7000, { categoryId: null });
    const result = forecast({ lookbackDays: 28 });
    expect(result.spending.total).toBe(28000);
    expect(result.spending.uncategorised).toMatchObject({
      total: 7000,
      count: 1,
      significant: true,
    });
    expect(result.spending.uncategorised.share).toBeCloseTo(0.2);
    // Up to 5% is not worth a banner
    db.delete(transactions)
      .where(sql`id = 'mystery'`)
      .run();
    tx('mystery', '2026-10-18', -1000, { categoryId: null });
    expect(forecast({ lookbackDays: 28 }).spending.uncategorised.significant).toBe(false);
  });

  it('projects liquid personal cash with expected pay and averaged spending', () => {
    plan();
    const result = forecast({ horizonDays: 14, lookbackDays: 28 });
    // $1,000 start + $500 pay − $280 food. Super and the mortgage are not spendable cash.
    expect(result.startBalance).toBe(122000);
    expect(result.accounts.map((a) => a.id)).toEqual(['cash']);
    expect(result.spending).toMatchObject({ days: 28, total: 28000 });
    const [b, conservative, stretch] = result.scenarios;
    expect(b.days).toHaveLength(15);
    expect(b.days[1]).toMatchObject({ date: '2026-10-22', variable: 1000 });
    expect(balanceOn(b, '2026-10-28')).toBe(122000 - 7 * 1000);
    expect(balanceOn(b, '2026-10-29')).toBe(122000 - 8 * 1000 + 300000);
    expect(b.nextPayday).toBe('2026-10-29');
    expect(b.lowestBeforeNextPayday).toEqual({ date: '2026-10-28', balance: 115000 });
    expect(b.endBalance).toBe(122000 - 14 * 1000 + 300000);
    // Conservative: 120% spending, 95% pay. Stretch: 85% spending.
    expect(conservative.endBalance).toBe(122000 - 14 * 1200 + 285000);
    expect(stretch.endBalance).toBe(122000 - 14 * 850 + 300000);
  });

  it('rounds cumulatively so the daily average never drifts', () => {
    plan();
    db.delete(transactions).run();
    tx('opening', '2026-09-01', 50000, { categoryId: 'salary' });
    tx('odd', '2026-10-15', -1000);
    const s = base({ horizonDays: 21, lookbackDays: 21 });
    // $10 over 21 days: cents must add back to exactly $10 after 21 days.
    expect(s.variableTotal).toBe(1000);
    expect(new Set(s.days.slice(1).map((d) => d.variable))).toEqual(new Set([47, 48]));
  });

  it('forecasts pending bills once and drops occurrences already matched or skipped', () => {
    plan();
    schedule('rent', -120000, '2026-10-25');
    tx('rentPaid', '2026-10-21', -120000, { categoryId: 'rent' });
    db.insert(scheduleOccurrences)
      .values([
        {
          id: 'o1',
          scheduleId: 'rent',
          scheduledDate: '2026-10-25',
          expectedDate: '2026-10-25',
          expectedAmount: -120000,
          status: 'paid',
          matchedTransactionId: 'rentPaid',
        },
        {
          id: 'o2',
          scheduleId: 'rent',
          scheduledDate: '2026-12-25',
          expectedDate: '2026-12-25',
          expectedAmount: -120000,
          status: 'skipped',
        },
      ])
      .run();
    const s = base({ horizonDays: 100, lookbackDays: 28 });
    expect(s.events.filter((e) => e.description === 'rent').map((e) => e.date)).toEqual([
      '2026-11-25',
      '2027-01-25',
    ]);
    // The matched rent payment is a scheduled payment, so it is not variable spending.
    expect(forecast({ lookbackDays: 28 }).spending.total).toBe(28000);
  });

  it('never double counts scheduled salary alongside payday plans', () => {
    schedule('wage', 300000, '2026-10-29', {
      categoryId: 'salary',
      recurrenceType: 'biweekly',
      recurrenceRule: JSON.stringify({ type: 'biweekly', anchorDay: 4 }),
    });
    const fromSchedules = forecast({ horizonDays: 14, scenarios: [{ name: 'Base' }] });
    expect(fromSchedules.incomeSource).toBe('schedules');
    expect(fromSchedules.scenarios[0].events.filter((e) => e.kind === 'income')).toHaveLength(1);
    plan();
    const fromPlan = forecast({ horizonDays: 14, scenarios: [{ name: 'Base' }] });
    expect(fromPlan.incomeSource).toBe('payday');
    const income = fromPlan.scenarios[0].events.filter((e) => e.kind === 'income');
    expect(income.map((e) => e.id)).toEqual(['payday:plan:2026-10-29']);
    expect(fromPlan.assumptions.join(' ')).toContain('Scheduled income is excluded');
  });

  it('includes future-dated register rows, internal transfers net to zero and one-offs apply', () => {
    plan();
    db.insert(accounts)
      .values({ id: 'saver', name: 'Saver', type: 'savings', createdAt: '2020-01-01' })
      .run();
    tx('later', '2026-10-30', -5000, { payeeName: 'Car rego' });
    schedule('toSaver', -10000, '2026-10-26', { transferAccountId: 'saver', categoryId: null });
    const s = base({
      horizonDays: 14,
      lookbackDays: 28,
      scenarios: [
        { name: 'Base', oneOffs: [{ date: '2026-11-02', amount: -40000, description: 'Tyres' }] },
      ],
    });
    expect(s.events.map((e) => [e.date, e.kind, e.amount])).toEqual([
      ['2026-10-29', 'income', 300000],
      ['2026-10-30', 'register', -5000],
      ['2026-11-02', 'one-off', -40000],
    ]);
    expect(s.endBalance).toBe(122000 - 14000 + 300000 - 5000 - 40000);
  });

  it('warns about overdue unmatched occurrences instead of guessing they were paid', () => {
    plan();
    schedule('power', -20000, '2026-10-10');
    const result = forecast({ horizonDays: 14 });
    expect(result.warnings.join(' ')).toMatch(/1 scheduled occurrence is overdue/);
    expect(result.scenarios[0].events.some((e) => e.description === 'power')).toBe(false);
  });

  it('writes nothing to the budget', async () => {
    plan([{ categoryId: 'holiday', method: 'fixed', amount: 10000, dueDate: null, percent: 0 }]);
    schedule('rent', -120000, '2026-10-25');
    db.insert(goals)
      .values({
        id: 'g',
        name: 'Trip',
        targetAmount: 100000,
        categoryId: 'holiday',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      })
      .run();
    const before = snapshot();
    forecast({ horizonDays: 365 });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ horizonDays: 60 }),
    });
    expect(response.status).toBe(200);
    expect(snapshot()).toEqual(before);
  });
});

describe('household shares', () => {
  beforeEach(() => {
    plan();
    db.insert(accounts)
      .values({
        id: 'joint',
        name: 'Joint',
        type: 'checking',
        startingBalance: 9999900,
        createdAt: '2020-01-01',
      })
      .run();
    db.insert(householdGroups)
      .values({ id: 'hh', name: 'Home', currency: 'AUD', accountId: 'joint' })
      .run();
    db.insert(householdPeople)
      .values([
        { id: 'me', groupId: 'hh', name: 'Me', isSelf: 1 },
        { id: 'sam', groupId: 'hh', name: 'Sam', isSelf: 0 },
      ])
      .run();
    // $300 bill, my share $150, $100 already reserved in the pool => $50 of my share covered.
    db.insert(householdBills)
      .values({
        id: 'water',
        groupId: 'hh',
        description: 'Water',
        dueDate: '2026-10-25',
        amount: 30000,
        personalShare: 15000,
        reserved: 10000,
      })
      .run();
  });

  it('adds my unreserved share and excludes pool cash', () => {
    const result = forecast({ horizonDays: 14, lookbackDays: 28 });
    expect(result.includeHousehold).toBe(true);
    expect(result.startBalance).toBe(122000);
    const water = result.scenarios[0].events.find((e) => e.kind === 'household')!;
    expect(water).toMatchObject({ date: '2026-10-25', amount: -10000 });
  });

  it('excludes household-linked payments from the variable average', () => {
    tx('mine', '2026-10-10', -14000, { categoryId: 'house' });
    db.insert(householdEvents)
      .values({
        id: 'e',
        groupId: 'hh',
        kind: 'expense',
        date: '2026-10-10',
        description: 'Groceries',
        amount: 14000,
        payerId: 'me',
        transactionId: 'mine',
      })
      .run();
    expect(forecast({ lookbackDays: 28 }).spending.total).toBe(28000);
    expect(forecast({ lookbackDays: 28, includeHousehold: false }).spending.total).toBe(42000);
  });

  it('turns shares off by default when pool contributions are already scheduled', () => {
    schedule('contribution', -20000, '2026-10-27', {
      transferAccountId: 'joint',
      categoryId: 'house',
    });
    const result = forecast({ horizonDays: 14 });
    expect(result.includeHousehold).toBe(false);
    expect(result.assumptions.join(' ')).toContain('already scheduled');
    const kinds = result.scenarios[0].events.map((e) => [e.kind, e.amount]);
    expect(kinds).toContainEqual(['bill', -20000]);
    expect(kinds.some(([k]) => k === 'household')).toBe(false);
  });

  it('skips bills that are already paid', () => {
    db.insert(householdEvents)
      .values({
        id: 'paid',
        groupId: 'hh',
        kind: 'expense',
        date: '2026-10-20',
        description: 'Water',
        amount: 30000,
        billId: 'water',
      })
      .run();
    expect(
      forecast({ horizonDays: 14 }).scenarios[0].events.some((e) => e.kind === 'household'),
    ).toBe(false);
  });
});

describe('goal trajectory', () => {
  function goal(id: string, extra = {}) {
    db.insert(goals)
      .values({
        id,
        name: id,
        targetAmount: 100000,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        ...extra,
      })
      .run();
  }

  it('projects category-funded progress from planned per-pay contributions', () => {
    plan([{ categoryId: 'holiday', method: 'fixed', amount: 20000, dueDate: null, percent: 0 }]);
    db.insert(budgetMonths)
      .values({ id: 'b', month: '2026-10', categoryId: 'holiday', budgeted: 50000 })
      .run();
    goal('trip', { categoryId: 'holiday', targetDate: '2026-11-20' });
    const g = base({ horizonDays: 60 }).goals[0];
    expect(g).toMatchObject({ source: 'category', start: 50000, attainmentDate: '2026-11-26' });
    expect(g.onTrack).toBe(false);
    expect(g.points.slice(0, 4)).toEqual([
      { date: '2026-10-21', balance: 50000 },
      { date: '2026-10-29', balance: 70000 },
      { date: '2026-11-12', balance: 90000 },
      { date: '2026-11-26', balance: 110000 },
    ]);
  });

  it('reduces a goal by scheduled bills in its category and honours overrides and growth', () => {
    plan([{ categoryId: 'holiday', method: 'percentage', amount: 0, dueDate: null, percent: 10 }]);
    schedule('flights', -15000, '2026-11-15', { categoryId: 'holiday' });
    goal('trip', { categoryId: 'holiday' });
    goal('manual', { currentAmount: 120000, targetAmount: 200000 });
    const [trip, manual] = forecast({
      horizonDays: 30,
      scenarios: [
        {
          name: 'Base',
          annualReturnBasisPoints: 1200,
          goalContributions: [{ goalId: 'manual', amountPerPay: 5000 }],
        },
      ],
    }).scenarios[0].goals;
    // 10% of $3,000 on 29 Oct and 12 Nov, minus the $150 flights on 15 Nov.
    expect(trip.end).toBe(30000 + 30000 - 15000 + Math.floor(30000 / 100));
    expect(trip.contributed).toBe(60000);
    // Manual value, $50 overrides on two paydays, 1% month-end growth on 31 Oct.
    expect(manual.source).toBe('manual');
    expect(manual.end).toBe(120000 + 5000 + 1250 + 5000);
  });

  it('treats a goal funded today as reached even after its target date', () => {
    plan();
    goal('laptop', { currentAmount: 130000, targetAmount: 130000, targetDate: '2026-08-06' });
    goal('late', { currentAmount: 1000, targetDate: '2026-08-06' });
    const [laptop, late] = base({ horizonDays: 14 }).goals;
    expect(laptop).toMatchObject({ attainmentDate: '2026-10-21', onTrack: true });
    expect(late).toMatchObject({ attainmentDate: null, onTrack: false });
  });

  it('rejects contributions for unknown goals and one-offs outside the horizon', async () => {
    plan();
    expect(() =>
      base({
        scenarios: [{ name: 'X', goalContributions: [{ goalId: 'nope', amountPerPay: 1 }] }],
      }),
    ).toThrow(/no longer exists/);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        horizonDays: 7,
        scenarios: [{ name: 'X', oneOffs: [{ date: '2027-01-01', amount: -1, description: 'x' }] }],
      }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/horizon/);
    db.delete(paydayPlans).run();
    const noPlan = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ incomeSource: 'payday' }),
    });
    expect(noPlan.status).toBe(400);
  });
});

describe('adverse-event scenarios (phase 7C)', () => {
  const zeroCash = () => {
    db.delete(transactions).run();
    db.update(accounts)
      .set({ startingBalance: 0 })
      .where(sql`id = 'cash'`)
      .run();
  };

  it('finds the first dated shortfall even when the period ends positive', () => {
    zeroCash();
    schedule('bill', -50000, '2026-10-26');
    const s = base({
      horizonDays: 14,
      scenarios: [
        {
          name: 'Base',
          dailySpending: 0,
          oneOffs: [{ date: '2026-10-31', amount: 100000, description: 'Refund' }],
        },
      ],
    });
    expect(s.firstShortfall).toEqual({ date: '2026-10-26', balance: -50000 });
    expect(s.endBalance).toBe(50000);
  });

  it('shows an emergency leaving the second month end short', () => {
    db.delete(transactions).run();
    db.update(accounts)
      .set({ startingBalance: 600000 })
      .where(sql`id = 'cash'`)
      .run();
    schedule('essentials', -300000, '2026-10-31');
    const s = base({
      horizonDays: 60,
      scenarios: [
        {
          name: 'Base',
          dailySpending: 0,
          oneOffs: [{ date: '2026-10-22', amount: -200000, description: 'Emergency' }],
        },
      ],
    });
    expect(balanceOn(s, '2026-10-31')).toBe(100000);
    expect(s.firstShortfall).toEqual({ date: '2026-11-30', balance: -200000 });
  });

  it('pauses income and keeps combined events exactly once', () => {
    plan();
    const request = {
      horizonDays: 30,
      scenarios: [
        {
          name: 'Missed pay',
          dailySpending: 0,
          incomePauses: [{ from: '2026-10-29', to: '2026-10-29' }],
          oneOffs: [{ date: '2026-11-02', amount: -80000, description: 'Car repair' }],
        },
      ],
    };
    const s = forecast(request).scenarios[0];
    expect(s.pausedIncome).toBe(300000);
    expect(s.events.filter((e) => e.kind === 'income').map((e) => e.date)).toEqual(['2026-11-12']);
    expect(s.events.filter((e) => e.kind === 'one-off')).toHaveLength(1);
    expect(balanceOn(s, '2026-11-02')).toBe(122000 - 80000);
    expect(forecast(request)).toEqual(forecast(request));
  });

  it('stops goal contributions while income is paused', () => {
    plan([{ categoryId: 'house', method: 'fixed', amount: 20000, dueDate: null, percent: 0 }]);
    db.insert(goals)
      .values({ id: 'g', name: 'House', targetAmount: 1e6, categoryId: 'house' })
      .run();
    const paused = base({
      horizonDays: 30,
      scenarios: [{ name: 'Base', incomePauses: [{ from: '2026-10-22', to: '2026-11-30' }] }],
    });
    expect(paused.goals[0].contributed).toBe(0);
  });

  it('applies a monthly cost change from its date, falling back to month ends', () => {
    const s = base({
      horizonDays: 45,
      scenarios: [
        {
          name: 'Rent rise',
          dailySpending: 0,
          costChanges: [{ from: '2026-10-31', monthlyAmount: 20000, description: 'Rent rise' }],
        },
      ],
    });
    expect(s.events.filter((e) => e.kind === 'cost-change').map((e) => [e.date, e.amount])).toEqual(
      [
        ['2026-10-31', -20000],
        ['2026-11-30', -20000],
      ],
    );
  });

  it('rejects pauses and cost changes outside the horizon', () => {
    for (const scenario of [
      { name: 'x', incomePauses: [{ from: '2026-11-05', to: '2026-11-01' }] },
      { name: 'x', incomePauses: [{ from: '2027-06-01', to: '2027-06-30' }] },
      { name: 'x', costChanges: [{ from: '2026-10-01', monthlyAmount: 1, description: 'x' }] },
    ])
      expect(() => forecast({ horizonDays: 30, scenarios: [scenario] })).toThrow();
  });

  it('reports how far the lowest balance falls into the flexibility reserve', () => {
    expect(base({ horizonDays: 14 }).reserveUse).toBeNull();
    db.insert(categoryPurposes).values({ categoryId: 'holiday', purpose: 'flexibility' }).run();
    db.insert(budgetMonths)
      .values({ id: 'h', categoryId: 'holiday', month: '2026-10', budgeted: 50000 })
      .run();
    const s = base({
      horizonDays: 14,
      scenarios: [
        {
          name: 'Base',
          dailySpending: 0,
          oneOffs: [{ date: '2026-10-25', amount: -100000, description: 'Emergency' }],
        },
      ],
    });
    // $1,220 cash − $1,000 emergency leaves $220, $280 into the $500 reserve.
    expect(s.lowest.balance).toBe(22000);
    expect(s.reserveUse).toBe(28000);
    db.delete(categoryPurposes).run();
  });
});
