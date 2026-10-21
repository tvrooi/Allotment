import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
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
} from '../db/schema.js';
import {
  applyPayday,
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
    expect(backup.version).toBe(5);
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
