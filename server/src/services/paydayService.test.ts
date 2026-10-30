import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  householdGroups,
  accounts,
  categories,
  categoryGroups,
  budgetMonths,
  transactions,
  schedules,
  scheduleOccurrences,
  paydayPlans,
  paydayFundingEvents,
  paydayFundingReceipts,
  paydayFundingUndos,
  categoryTargets,
} from '../db/schema.js';
import {
  applyPayday,
  undoPayday,
  previewPayday,
  paydays,
  paydaysInYear,
  incomeOptions,
  billCoverage,
} from './paydayService.js';
import { paydayConfigSchema, dateInZone, type PaydayConfig } from './paydayConfig.js';
import { createBackup, parseBackup, restoreBackup } from './backupService.js';

const request = { scheduledDate: '2026-10-15', actualPayDate: '2026-10-15', incomeIds: ['pay'] };
const rule = (
  categoryId: string,
  method: PaydayConfig['rules'][number]['method'],
  amount = 0,
  extra = {},
) => ({ categoryId, method, amount, dueDate: null, percent: 0, ...extra });
const config = (rules = [rule('rent', 'fixed', 10000)]): PaydayConfig => ({
  name: 'Fortnightly',
  anchorDate: '2026-10-01',
  expectedIncome: 300000,
  weekendAdjust: 'none',
  timeZone: 'Australia/Sydney',
  rules,
});
function plan(c = config(), id = 'plan') {
  db.insert(paydayPlans)
    .values({ id, configJson: JSON.stringify(c) })
    .run();
  return id;
}
function income(id = 'pay', amount = 200000, extra = {}) {
  db.insert(transactions)
    .values({ id, accountId: 'cash', date: '2026-10-15', categoryId: 'salary', amount, ...extra })
    .run();
}
function assign(categoryId: string, amount: number, month = '2026-09') {
  db.insert(budgetMonths)
    .values({ id: `${categoryId}:${month}`, categoryId, month, budgeted: amount })
    .run();
}
function bill(id = 'bill', extra = {}) {
  db.insert(schedules)
    .values({
      id,
      name: id,
      amount: -120000,
      recurrenceType: 'monthly',
      recurrenceRule: JSON.stringify({ type: 'monthly', interval: 1, anchorDay: 20 }),
      startDate: '2026-10-20',
      accountId: 'cash',
      categoryId: 'rent',
      ...extra,
    })
    .run();
}
beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  for (const table of [
    categoryTargets,
    householdGroups,
    paydayFundingReceipts,
    paydayFundingUndos,
    paydayFundingEvents,
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
      { id: 'cash', name: 'Cash', type: 'checking' },
      { id: 'off', name: 'Retirement', type: 'retirement', isOffBudget: 1 },
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
      ...['rent', 'food', 'savings', 'other'].map((id) => ({ id, name: id, groupId: 'expenses' })),
    ])
    .run();
});

describe('payday funding', () => {
  it('excludes household pool receipts and pool cash from personal payday funding', () => {
    income();
    db.insert(accounts)
      .values({ id: 'joint', name: 'Joint', type: 'checking', startingBalance: 9999999 })
      .run();
    db.insert(householdGroups)
      .values({ id: 'home', name: 'Home', currency: 'AUD', accountId: 'joint' })
      .run();
    income('housemate', 9999999, { accountId: 'joint' });
    expect(incomeOptions('2026-10-15').map((r) => r.id)).toEqual(['pay']);
    const id = plan();
    expect(previewPayday(id, request).available).toBe(200000);
  });
  it('enumerates exact fortnightly dates, three-pay months, year boundaries and 27-pay years', () => {
    const c = config();
    expect(paydays(c, '2026-10-01', '2026-11-15').map((p) => p.expectedDate)).toEqual([
      '2026-10-01',
      '2026-10-15',
      '2026-10-29',
      '2026-11-12',
    ]);
    expect(paydays(c, '2026-12-20', '2027-01-20').map((p) => p.expectedDate)).toEqual([
      '2026-12-24',
      '2027-01-07',
    ]);
    expect(paydays({ ...c, anchorDate: '2026-01-01' }, '2026-01-01', '2026-12-31')).toHaveLength(
      27,
    );
  });
  it('uses the plan time zone and preserves nominal identities across weekend adjustments', () => {
    vi.setSystemTime(new Date('2026-10-20T14:30:00Z'));
    expect(dateInZone('Australia/Sydney')).toBe('2026-10-21');
    expect(dateInZone('UTC')).toBe('2026-10-20');
    expect(
      paydays(
        { ...config(), anchorDate: '2026-10-03', weekendAdjust: 'before' },
        '2026-10-01',
        '2026-10-04',
      ),
    ).toEqual([{ scheduledDate: '2026-10-03', expectedDate: '2026-10-02' }]);
    vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
  });
  it('counts the full calendar-year cycle for smoothing, including plans started midyear', () => {
    expect(paydaysInYear(config(), '2026-10-15')).toHaveLength(26);
    expect(paydaysInYear({ ...config(), anchorDate: '2026-12-31' }, '2026-12-31')).toHaveLength(27);
    expect(
      paydaysInYear(
        { ...config(), anchorDate: '2027-01-01', weekendAdjust: 'before' },
        '2027-01-01',
      ),
    ).toHaveLength(27);
  });
  it('previews without writes and applies additive monthly allocations once, preserving ledger and rollover', () => {
    plan();
    income();
    assign('rent', 20000);
    const ledger = db.select().from(transactions).all();
    const preview = previewPayday('plan', request);
    expect(db.select().from(paydayFundingEvents).all()).toEqual([]);
    expect(preview.rows[0]).toMatchObject({ balance: 20000, allocated: 10000 });
    const event = applyPayday('plan', request, JSON.stringify(preview));
    expect(event.alreadyApplied).toBe(false);
    expect(applyPayday('plan', request, JSON.stringify(preview))).toMatchObject({
      id: event.id,
      alreadyApplied: true,
    });
    expect(
      db
        .select()
        .from(budgetMonths)
        .all()
        .map((b) => b.budgeted),
    ).toEqual([20000, 10000]);
    expect(db.select().from(transactions).all()).toEqual(ledger);
  });
  it('funds bills once per category, reuses rollover and excludes paid/skipped/internal/off-budget bills', () => {
    plan(config([]));
    income();
    assign('rent', 20000);
    bill();
    bill('second', { amount: -10000 });
    bill('offbill', { accountId: 'off' });
    bill('transfer', { transferAccountId: 'cash' });
    bill('paid');
    bill('skipped');
    db.insert(scheduleOccurrences)
      .values([
        {
          id: 'paid',
          scheduleId: 'paid',
          scheduledDate: '2026-10-20',
          expectedDate: '2026-10-20',
          expectedAmount: -120000,
          status: 'paid',
        },
        {
          id: 'skipped',
          scheduleId: 'skipped',
          scheduledDate: '2026-10-20',
          expectedDate: '2026-10-20',
          expectedAmount: -120000,
          status: 'skipped',
        },
      ])
      .run();
    const p = previewPayday('plan', request);
    expect(p.bills).toHaveLength(2);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({
      balance: 20000,
      billsDue: 130000,
      allocated: 110000,
      uncoveredBills: 0,
    });
  });
  it('caps variable pay to received and available money and honours priorities', () => {
    plan(
      config([
        rule('food', 'fixed', 8000),
        rule('rent', 'fixed', 8000),
        rule('savings', 'remainder'),
      ]),
    );
    income('pay', 10000);
    const p = previewPayday('plan', request);
    expect(p).toMatchObject({
      received: 10000,
      available: 10000,
      totalAllocated: 10000,
      shortfall: 6000,
    });
    expect(p.rows.map((r) => r.allocated)).toEqual([8000, 2000, 0]);
  });
  it('excludes future, off-budget, generated and already-used income', () => {
    plan();
    income('pay', 10000);
    income('future', 900000, { date: '2026-11-01' });
    income('offpay', 900000, { accountId: 'off' });
    income('generated', 900000, { importedId: 'schedule:salary:one' });
    expect(incomeOptions('2026-10-21').map((r) => r.id)).toEqual(['pay']);
    const p = previewPayday('plan', request);
    expect(p.available).toBe(10000);
    applyPayday('plan', request, JSON.stringify(p));
    expect(incomeOptions('2026-10-21')).toEqual([]);
  });
  it('does not let a future payday allocate cash already received', () => {
    plan();
    income();
    const req = { ...request, scheduledDate: '2026-10-29', actualPayDate: '2026-10-29' };
    const p = previewPayday('plan', req);
    expect(p).toMatchObject({ future: true, available: 0, totalAllocated: 0 });
    expect(() => applyPayday('plan', req, JSON.stringify(p))).toThrow(/received income/);
  });
  it('reserves future allocations and overspending and caps to actual cash', () => {
    plan();
    income('pay', 100000);
    assign('rent', 20000, '2026-11');
    db.insert(transactions)
      .values({
        id: 'spend',
        accountId: 'cash',
        date: '2026-10-20',
        amount: -30000,
        categoryId: 'other',
      })
      .run();
    expect(previewPayday('plan', request).available).toBe(50000);
    db.insert(transactions)
      .values({ id: 'uncategorized', accountId: 'cash', date: '2026-10-20', amount: -20000 })
      .run();
    expect(previewPayday('plan', request).available).toBe(30000);
  });
  it('divides a due-date shortfall across actual remaining paydays, including a third pay', () => {
    plan(config([rule('savings', 'due', 100001, { dueDate: '2026-10-30' })]));
    income();
    assign('savings', 1);
    const p = previewPayday('plan', request);
    expect(p.rows[0]).toMatchObject({ balance: 1, needed: 50000, allocated: 50000 });
  });
  it('catches up a target due before the next pay without counting future wages', () => {
    plan(config([rule('savings', 'due', 250000, { dueDate: '2026-10-20' })]));
    income('pay', 100000);
    expect(previewPayday('plan', request).rows[0]).toMatchObject({
      needed: 250000,
      allocated: 100000,
      shortfall: 150000,
    });
  });
  it('smooths monthly costs but funds the next bill shortfall immediately', () => {
    plan(config([rule('rent', 'monthly', 120000)]));
    income();
    bill();
    assign('rent', 20000);
    expect(previewPayday('plan', request).rows[0]).toMatchObject({
      needed: 100000,
      allocated: 100000,
    });
    db.delete(schedules).run();
    expect(previewPayday('plan', request).rows[0].needed).toBe(55385); // 26 calendar-year paydays on this cycle
  });
  it('uses integer percentages and puts the remainder last', () => {
    plan(config([rule('savings', 'remainder'), rule('food', 'percentage', 0, { percent: 33 })]));
    income('pay', 101);
    const p = previewPayday('plan', request);
    expect(p.rows.map((r) => r.allocated)).toEqual([33, 68]);
  });
  it('rejects stale previews after any relevant budget, plan or income change', () => {
    plan();
    income();
    const p = previewPayday('plan', request);
    assign('rent', 1000);
    expect(() => applyPayday('plan', request, JSON.stringify(p))).toThrow(/changed/);
    expect(db.select().from(paydayFundingEvents).all()).toEqual([]);
    const refreshed = previewPayday('plan', request);
    db.update(paydayPlans)
      .set({ configJson: JSON.stringify(config([rule('rent', 'fixed', 20000)])) })
      .where(eq(paydayPlans.id, 'plan'))
      .run();
    expect(() => applyPayday('plan', request, JSON.stringify(refreshed))).toThrow(/changed/);
  });
  it('prevents one deposit funding two employers/plans and allows distinct deposits', () => {
    plan();
    plan(config(), 'second');
    income();
    income('secondPay');
    const p = previewPayday('plan', request);
    applyPayday('plan', request, JSON.stringify(p));
    expect(() => previewPayday('second', request)).toThrow(/already funded/);
    const req = { ...request, incomeIds: ['secondPay'] };
    const second = previewPayday('second', req);
    expect(applyPayday('second', req, JSON.stringify(second)).alreadyApplied).toBe(false);
  });
  it('preserves history and duplicate guards through portable backup and restore', () => {
    plan();
    income();
    const p = previewPayday('plan', request);
    applyPayday('plan', request, JSON.stringify(p));
    const backup = createBackup();
    expect(backup.version).toBe(20);
    restoreBackup(parseBackup(backup));
    expect(applyPayday('plan', request, JSON.stringify(p)).alreadyApplied).toBe(true);
    expect(incomeOptions('2026-10-21')).toEqual([]);
    expect(db.select().from(paydayFundingEvents).all()[0].snapshotJson).toBe(JSON.stringify(p));
  });
  it('retains receipt identity when the source transaction is deleted', () => {
    plan();
    income();
    const p = previewPayday('plan', request);
    applyPayday('plan', request, JSON.stringify(p));
    db.delete(transactions).run();
    expect(db.select().from(paydayFundingReceipts).all()).toHaveLength(1);
  });
  it('allows a generated salary only after reconciliation confirms its receipt', () => {
    plan();
    income('pay', 10000, { importedId: 'schedule:salary:one' });
    expect(incomeOptions('2026-10-21')).toEqual([]);
    db.update(transactions).set({ reconciled: 1 }).where(eq(transactions.id, 'pay')).run();
    expect(previewPayday('plan', request).available).toBe(10000);
  });
  it('rolls back all allocations if a later category fails validation', () => {
    plan(config([rule('food', 'fixed', 100), rule('rent', 'fixed', 100)]));
    income('pay', 1e13);
    income('otherPay', 1e13);
    assign('rent', 1e13, '2026-10');
    const before = db.select().from(budgetMonths).all();
    const p = previewPayday('plan', request);
    expect(() => applyPayday('plan', request, JSON.stringify(p))).toThrow(/too large/);
    expect(db.select().from(budgetMonths).all()).toEqual(before);
    expect(db.select().from(paydayFundingEvents).all()).toEqual([]);
    expect(db.select().from(paydayFundingReceipts).all()).toEqual([]);
  });
  it('supports early/late pay while keeping the original allocation identity', () => {
    plan();
    income();
    const early = previewPayday('plan', { ...request, actualPayDate: '2026-10-14' });
    const late = previewPayday('plan', { ...request, actualPayDate: '2026-10-17' });
    expect(early.nextPayday).toBe('2026-10-29');
    expect(late.nextPayday).toBe('2026-10-29');
    expect(early.scheduledDate).toBe(late.scheduledDate);
  });
  it('shows estimated bills and respects adjusted occurrence dates without generating ledger rows', () => {
    bill('estimate', { amountType: 'variable' });
    db.insert(scheduleOccurrences)
      .values({
        id: 'moved',
        scheduleId: 'estimate',
        scheduledDate: '2026-10-20',
        expectedDate: '2026-10-25',
        expectedAmount: -5000,
      })
      .run();
    expect(billCoverage('2026-10-15', '2026-10-29', '2026-10-21')).toMatchObject([
      { date: '2026-10-25', amount: 5000, estimated: true },
    ]);
    expect(db.select().from(transactions).all()).toEqual([]);
  });
  it('validates real dates, categories, time zones and allocation configuration', () => {
    expect(paydayConfigSchema.safeParse({ ...config(), anchorDate: '2026-02-30' }).success).toBe(
      false,
    );
    expect(paydayConfigSchema.safeParse({ ...config(), timeZone: 'fake/place' }).success).toBe(
      false,
    );
    expect(
      paydayConfigSchema.safeParse(config([rule('rent', 'fixed'), rule('rent', 'remainder')]))
        .success,
    ).toBe(false);
    expect(
      paydayConfigSchema.safeParse(
        config([
          rule('rent', 'percentage', 0, { percent: 80 }),
          rule('food', 'percentage', 0, { percent: 80 }),
        ]),
      ).success,
    ).toBe(false);
    plan(config([rule('salary', 'fixed', 100)]));
    income();
    expect(() => previewPayday('plan', request)).toThrow(/expense or savings/);
  });
});

describe('payday funding with category targets (6E)', () => {
  const target = (categoryId: string, type: string, amount: number, extra = {}) =>
    db
      .insert(categoryTargets)
      .values({ categoryId, type, amount, createdMonth: '2026-10', ...extra })
      .run();
  it('spreads what a target still needs this month over the month’s remaining paydays', () => {
    // October 2026 has three paydays (1, 15, 29); today is the 21st, so the 15th and 29th remain.
    plan(config([rule('savings', 'target'), rule('food', 'target'), rule('other', 'target')]));
    income();
    target('savings', 'monthly', 30000);
    target('food', 'monthly', 20000);
    assign('food', 5000, '2026-10');
    const p = previewPayday('plan', request);
    expect(p.rows.map((r) => [r.categoryId, r.targetUnderfunded, r.needed])).toEqual([
      ['savings', 30000, 15000],
      ['food', 15000, 7500],
      // No target: the rule funds nothing rather than guessing.
      ['other', null, 0],
    ]);
    applyPayday('plan', request, JSON.stringify(p));
    // The month's target figures now include the payday's assignments, so the next payday
    // needs only the rest, and reapplying the same payday assigns nothing more.
    expect(
      db
        .select()
        .from(budgetMonths)
        .all()
        .filter((b) => b.month === '2026-10')
        .map((b) => [b.categoryId, b.budgeted])
        .sort(),
    ).toEqual([
      ['food', 12500],
      ['savings', 15000],
    ]);
    expect(applyPayday('plan', request, JSON.stringify(p)).alreadyApplied).toBe(true);
    db.insert(transactions)
      .values({
        id: 'pay2',
        accountId: 'cash',
        date: '2026-10-21',
        categoryId: 'salary',
        amount: 100000,
      })
      .run();
    const second = previewPayday('plan', {
      scheduledDate: '2026-10-29',
      actualPayDate: '2026-10-21',
      incomeIds: ['pay2'],
    });
    expect(second.rows.map((r) => r.needed)).toEqual([15000, 7500, 0]);
  });
  it('funds a balance-by-date target across a year boundary from the shared requirement', () => {
    vi.setSystemTime(new Date('2026-12-28T02:00:00Z'));
    try {
      plan(config([rule('savings', 'target')]));
      db.insert(transactions)
        .values({
          id: 'pay',
          accountId: 'cash',
          date: '2026-12-24',
          categoryId: 'salary',
          amount: 200000,
        })
        .run();
      // $1,200 by February with $300 carried in: three months (Dec–Feb) need $300 each.
      target('savings', 'by-date', 120000, { dueDate: '2027-02-15' });
      assign('savings', 30000, '2026-11');
      const p = previewPayday('plan', {
        scheduledDate: '2026-12-24',
        actualPayDate: '2026-12-24',
        incomeIds: ['pay'],
      });
      // The next payday (7 January) is in another month, so this pay funds December's need.
      expect(p.rows[0]).toMatchObject({
        targetUnderfunded: 30000,
        needed: 30000,
        allocated: 30000,
      });
      expect(p.month).toBe('2026-12');
    } finally {
      vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
    }
  });
  it('counts remaining paydays to the real end of a 30-day month', () => {
    vi.setSystemTime(new Date('2026-11-20T02:00:00Z'));
    try {
      plan(config([rule('savings', 'target')]));
      db.insert(transactions)
        .values({
          id: 'pay',
          accountId: 'cash',
          date: '2026-11-12',
          categoryId: 'salary',
          amount: 200000,
        })
        .run();
      target('savings', 'monthly', 30000);
      // November paydays: 12 and 26. On the 20th, this pay and the 26th share the need.
      const p = previewPayday('plan', {
        scheduledDate: '2026-11-12',
        actualPayDate: '2026-11-12',
        incomeIds: ['pay'],
      });
      expect(p.rows[0]).toMatchObject({ targetUnderfunded: 30000, needed: 15000 });
    } finally {
      vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
    }
  });
  it('accepts plans saved before target rules existed and caps target funding to received pay', () => {
    expect(
      paydayConfigSchema.parse(config([rule('rent', 'due', 1000, { dueDate: '2026-12-01' })])),
    ).toBeTruthy();
    plan(config([rule('savings', 'target')]));
    income('pay', 10000);
    target('savings', 'monthly', 50000);
    expect(previewPayday('plan', request).rows[0]).toMatchObject({
      needed: 25000,
      allocated: 10000,
      shortfall: 15000,
    });
  });
});

it('does not consume a payday or its receipts while account balances need reconciliation', () => {
  plan();
  income();
  const preview = previewPayday('plan', request);
  db.insert(accounts)
    .values({
      id: 'closed-residual',
      name: 'Old saver',
      type: 'savings',
      startingBalance: 1000,
      createdAt: '2026-10-01',
      closedAt: '2026-10-20',
    })
    .run();
  expect(() => applyPayday('plan', request, JSON.stringify(preview))).toThrow(
    /Reconcile account balance/,
  );
  expect(db.select().from(paydayFundingEvents).all()).toEqual([]);
  expect(db.select().from(paydayFundingReceipts).all()).toEqual([]);
  expect(db.select().from(budgetMonths).all()).toEqual([]);
});

describe('undoing a payday funding', () => {
  const budgeted = (categoryId: string, month = '2026-10') =>
    db
      .select()
      .from(budgetMonths)
      .all()
      .find((r) => r.categoryId === categoryId && r.month === month)?.budgeted;
  const apply = () => {
    const preview = previewPayday('plan', request);
    return { preview, event: applyPayday('plan', request, JSON.stringify(preview)) };
  };

  it('reverses exactly what apply added, frees the deposit and gives the same preview again', () => {
    plan(config([rule('rent', 'fixed', 10000), rule('food', 'fixed', 5000)]));
    income();
    assign('rent', 7000, '2026-10');
    const before = previewPayday('plan', request);
    const { event } = apply();
    expect(budgeted('rent')).toBe(17000);
    expect(budgeted('food')).toBe(5000);
    const result = undoPayday('plan', event.id);
    expect(result.reversed.map((r) => [r.categoryId, r.amount]).sort()).toEqual([
      ['food', 5000],
      ['rent', 10000],
    ]);
    expect(result.skipped).toEqual([]);
    // The pre-existing assignment is untouched; the row apply created is now zero
    expect(budgeted('rent')).toBe(7000);
    expect(budgeted('food')).toBe(0);
    expect(db.select().from(paydayFundingEvents).all()).toEqual([]);
    expect(db.select().from(paydayFundingReceipts).all()).toEqual([]);
    expect(previewPayday('plan', request)).toEqual(before);
    // and it can be applied again
    expect(applyPayday('plan', request, JSON.stringify(before)).alreadyApplied).toBe(false);
  });

  it('keeps the undone funding in history', () => {
    plan();
    income();
    const { event } = apply();
    undoPayday('plan', event.id);
    const rows = db.select().from(paydayFundingUndos).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ planId: 'plan', scheduledDate: '2026-10-15' });
    expect(JSON.parse(rows[0].resultJson).reversed).toHaveLength(1);
  });

  it('never takes back more than the category is still assigned, and reports the rest', () => {
    plan(config([rule('rent', 'fixed', 10000), rule('food', 'fixed', 5000)]));
    income();
    const { event } = apply();
    // The person lowered rent to 4000 and zeroed food (row deleted) after applying
    db.update(budgetMonths)
      .set({ budgeted: 4000 })
      .where(eq(budgetMonths.categoryId, 'rent'))
      .run();
    db.delete(budgetMonths).where(eq(budgetMonths.categoryId, 'food')).run();
    const result = undoPayday('plan', event.id);
    expect(result.reversed).toEqual([{ categoryId: 'rent', name: 'rent', amount: 4000 }]);
    expect(result.skipped.map((s) => [s.categoryId, s.amount])).toEqual([
      ['rent', 6000],
      ['food', 5000],
    ]);
    expect(budgeted('rent')).toBe(0);
    expect(
      db
        .select()
        .from(budgetMonths)
        .all()
        .every((r) => r.budgeted >= 0),
    ).toBe(true);
  });

  it('leaves later manual increases alone', () => {
    plan();
    income();
    const { event } = apply();
    db.update(budgetMonths)
      .set({ budgeted: 25000 })
      .where(eq(budgetMonths.categoryId, 'rent'))
      .run();
    undoPayday('plan', event.id);
    expect(budgeted('rent')).toBe(15000);
  });

  it('refuses an unknown, foreign or already undone funding', () => {
    plan();
    income();
    const { event } = apply();
    expect(() => undoPayday('other', event.id)).toThrow(/not found/);
    undoPayday('plan', event.id);
    expect(() => undoPayday('plan', event.id)).toThrow(/already undone/);
  });
});
