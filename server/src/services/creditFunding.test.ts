import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  budgetMonths,
  transactions,
  creditCardPlans,
  creditFundingEvents,
  creditEventOrder,
  budgetSettings,
} from '../db/schema.js';
import { fundingState, budgetGroups } from './budgetService.js';
import { createBackup, parseBackup, restoreBackup } from './backupService.js';
import { ratesChanged } from './mainAmountService.js';
beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  for (const table of [
    creditFundingEvents,
    creditCardPlans,
    creditEventOrder,
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
    .values([
      {
        id: 'cash',
        name: 'Cash',
        type: 'checking',
        startingBalance: 100000,
        createdAt: '2026-09-01',
      },
      { id: 'card', name: 'Card', type: 'credit', createdAt: '2026-09-01' },
    ])
    .run();
  db.insert(categoryGroups).values({ id: 'expenses', name: 'Expenses' }).run();
  db.insert(categories)
    .values([
      { id: 'food', name: 'Groceries', groupId: 'expenses' },
      { id: 'fees', name: 'Fees', groupId: 'expenses' },
    ])
    .run();
});
function setup(accountId = 'card', enabledFrom = '2026-10-01') {
  db.insert(creditCardPlans)
    .values({ accountId, enabledFrom, createdAt: new Date().toISOString() })
    .run();
}
function assign(amount = 10000, categoryId = 'food', month = '2026-10') {
  db.insert(budgetMonths)
    .values({ id: `${month}:${categoryId}`, month, categoryId, budgeted: amount })
    .run();
}
function row(id: string, amount: number, extra = {}) {
  db.insert(transactions)
    .values({ id, accountId: 'card', categoryId: 'food', amount, date: '2026-10-15', ...extra })
    .run();
}
function payment(amount = 8000, date = '2026-10-16') {
  row('cash-pay', -amount, {
    accountId: 'cash',
    date,
    categoryId: null,
    transferTransactionId: 'card-pay',
  });
  row('card-pay', amount, { date, categoryId: null, transferTransactionId: 'cash-pay' });
}
function card() {
  return fundingState().cards[0];
}
function food(month = '2026-10') {
  return budgetGroups(month)
    .flatMap((g) => g.categories)
    .find((c) => c.id === 'food')!;
}
it('moves cash from a funded purpose to payment reserve; repayment is a transfer and leaves spending unchanged', () => {
  setup();
  assign();
  row('purchase', -8000);
  expect(food()).toMatchObject({ balance: 2000, activity: -8000 });
  expect(card()).toMatchObject({ debt: 8000, reserved: 8000, shortfall: 0 });
  expect(fundingState()).toMatchObject({ resources: 100000, reserved: 10000, unassigned: 90000 });
  payment();
  expect(food()).toMatchObject({ balance: 2000, activity: -8000 });
  expect(card()).toMatchObject({ debt: 0, reserved: 0, shortfall: 0, payments: 8000 });
  expect(fundingState()).toMatchObject({ resources: 92000, reserved: 2000, unassigned: 90000 });
});
it('exposes partial and unfunded purchases separately from cash overspending and carries coverage across months', () => {
  setup();
  assign(6000);
  row('purchase', -8000);
  row('cash-spend', -1000, { accountId: 'cash', date: '2026-10-16' });
  expect(fundingState()).toMatchObject({
    paymentReserved: 6000,
    paymentShortfall: 2000,
    creditOverspent: 2000,
    cashOverspent: 1000,
    resolved: false,
  });
  assign(2000, 'food', '2026-11');
  expect(fundingState('2026-11-01')).toMatchObject({
    paymentReserved: 8000,
    paymentShortfall: 0,
    creditOverspent: 0,
    cashOverspent: 1000,
  });
});
it('does not auto-enable existing cards or manufacture historical debt assignments', () => {
  db.update(accounts).set({ startingBalance: -50000 }).where(eq(accounts.id, 'card')).run();
  expect(fundingState()).toMatchObject({ resources: 50000, paymentReserved: 0 });
  setup('card', '2026-10-21');
  expect(fundingState('2026-10-20').resources).toBe(50000);
  expect(fundingState()).toMatchObject({
    resources: 100000,
    paymentShortfall: 50000,
    paymentReserved: 0,
    resolved: false,
  });
  expect(db.select().from(budgetMonths).all()).toEqual([]);
  db.insert(creditFundingEvents)
    .values({ id: 'paydown', accountId: 'card', date: '2026-10-21', amount: 10000, createdAt: '' })
    .run();
  expect(fundingState()).toMatchObject({
    paymentReserved: 10000,
    paymentShortfall: 40000,
    unassigned: 90000,
  });
});
it('restores funded refunds before payment without creating extra cash', () => {
  setup();
  assign();
  row('purchase', -8000);
  row('refund', 4000, { date: '2026-10-16' });
  expect(food()).toMatchObject({ balance: 6000, activity: -4000, cardCreditAdjustment: 0 });
  expect(fundingState()).toMatchObject({
    resources: 100000,
    paymentReserved: 4000,
    reserved: 10000,
    unassigned: 90000,
  });
});
it('a refund after repayment is noncash card credit, and spending it does not reserve cash twice', () => {
  setup();
  assign();
  row('purchase', -8000);
  payment();
  row('refund', 8000, { date: '2026-10-17' });
  expect(food()).toMatchObject({ balance: 2000, activity: 0, cardCreditAdjustment: -8000 });
  expect(card()).toMatchObject({ creditBalance: 8000, debt: 0, reserved: 0 });
  row('credit-purchase', -6000, { date: '2026-10-18' });
  expect(food()).toMatchObject({ balance: 2000, activity: -6000, cardCreditAdjustment: -2000 });
  expect(fundingState()).toMatchObject({ resources: 92000, reserved: 2000, unassigned: 90000 });
});
it('refunds cancel unfunded category debt before releasing funded cash', () => {
  setup();
  assign(6000);
  row('purchase', -10000);
  row('refund', 8000, { date: '2026-10-16' });
  expect(food().balance).toBe(4000);
  expect(card()).toMatchObject({ debt: 2000, reserved: 2000, shortfall: 0 });
  expect(fundingState().unassigned).toBe(94000);
});
it('refunds against other unfunded debt do not invent category cash', () => {
  setup();
  assign();
  row('purchase', -8000);
  payment();
  row('unfunded', -8000, { categoryId: 'fees', date: '2026-10-17' });
  row('refund', 4000, { date: '2026-10-18' });
  expect(food()).toMatchObject({ balance: 2000, cardCreditAdjustment: -4000 });
  expect(card()).toMatchObject({ debt: 4000, reserved: 0, shortfall: 4000 });
});
it('overpayments and positive opening card balances remain noncash credit', () => {
  db.update(accounts).set({ startingBalance: 10000 }).where(eq(accounts.id, 'card')).run();
  setup();
  row('purchase', -8000);
  expect(food()).toMatchObject({ balance: 0, activity: -8000, cardCreditAdjustment: 8000 });
  expect(fundingState()).toMatchObject({
    resources: 100000,
    paymentReserved: 0,
    unassigned: 100000,
  });
  payment(1000);
  expect(card()).toMatchObject({ creditBalance: 3000, reserved: 0 });
  expect(fundingState().resources).toBe(99000);
});
it('splits reserve once, and interest/fees remain category spending', () => {
  setup();
  assign();
  assign(1000, 'fees');
  row('parent', -9000, { categoryId: null, isParent: 1 });
  row('part-food', -8000, { parentTransactionId: 'parent' });
  row('part-fees', -1000, { categoryId: 'fees', parentTransactionId: 'parent' });
  expect(card()).toMatchObject({ debt: 9000, reserved: 9000 });
  expect(food().activity).toBe(-8000);
  expect(fundingState()).toMatchObject({ resources: 100000, reserved: 11000, unassigned: 89000 });
});
it('moves a funded payment reserve with a card-to-card balance transfer, without extra spending', () => {
  db.insert(accounts)
    .values({ id: 'second', name: 'Second', type: 'credit', createdAt: '2026-09-01' })
    .run();
  setup();
  setup('second');
  assign();
  row('purchase', -8000);
  row('balance-to', 8000, {
    categoryId: null,
    date: '2026-10-16',
    transferTransactionId: 'balance-from',
  });
  row('balance-from', -8000, {
    accountId: 'second',
    categoryId: null,
    date: '2026-10-16',
    transferTransactionId: 'balance-to',
  });
  expect(fundingState().cards).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ accountId: 'card', debt: 0, reserved: 0 }),
      expect.objectContaining({ accountId: 'second', debt: 8000, reserved: 8000 }),
    ]),
  );
  expect(food().activity).toBe(-8000);
  expect(fundingState().unassigned).toBe(90000);
});
it('withholds complete funding assessment for a future-dated transfer leg, then reconciles on arrival', () => {
  setup();
  assign();
  row('purchase', -8000);
  payment(8000, '2026-10-21');
  db.update(transactions).set({ date: '2026-10-22' }).where(eq(transactions.id, 'card-pay')).run();
  expect(fundingState()).toMatchObject({ complete: false, available: 0, resolved: false });
  expect(fundingState('2026-10-22')).toMatchObject({
    complete: true,
    paymentReserved: 0,
    resources: 92000,
  });
});
it('keeps missing rates incomplete and unlinked inflows under review', () => {
  setup();
  row('unlinked', 1000, { categoryId: null });
  expect(fundingState()).toMatchObject({ unlinkedCardInflows: 1, resolved: false });
  db.insert(budgetSettings).values({ id: 'budget', currency: 'AUD' }).run();
  db.update(accounts)
    .set({ currency: 'USD', startingBalance: -10000 })
    .where(eq(accounts.id, 'card'))
    .run();
  ratesChanged();
  expect(fundingState()).toMatchObject({ complete: false, available: 0 });
});
it('preserves plans, explicit funding, bank IDs and reconciled transfers through backup/restore', () => {
  setup();
  assign();
  row('purchase', -8000, { importedId: 'bank:purchase', reconciled: 1 });
  payment();
  const before = db.select().from(transactions).all();
  db.insert(creditFundingEvents)
    .values({ id: 'history', accountId: 'card', date: '2026-10-21', amount: 0, createdAt: '' })
    .run();
  const backup = createBackup();
  expect(backup.version).toBe(8);
  restoreBackup(parseBackup(backup));
  expect(db.select().from(transactions).all()).toEqual(before);
  expect(db.select().from(creditFundingEvents).all()).toHaveLength(1);
  expect(fundingState()).toMatchObject({ paymentReserved: 0, unassigned: 90000 });
});

it('consumes explicit reserves funded before a same-day repayment, and preserves funding added afterward', () => {
  db.update(accounts).set({ startingBalance: -100000 }).where(eq(accounts.id, 'card')).run();
  setup();
  db.insert(creditFundingEvents)
    .values({
      id: 'morning-funding',
      accountId: 'card',
      date: '2026-10-21',
      amount: 20000,
      createdAt: '',
    })
    .run();
  payment(20000, '2026-10-21');
  expect(fundingState()).toMatchObject({ paymentReserved: 0, resources: 80000, unassigned: 80000 });
  db.insert(creditFundingEvents)
    .values({
      id: 'later-funding',
      accountId: 'card',
      date: '2026-10-21',
      amount: 10000,
      createdAt: '',
    })
    .run();
  expect(fundingState()).toMatchObject({
    paymentReserved: 10000,
    resources: 80000,
    unassigned: 70000,
  });
  const sequence = db.select().from(creditEventOrder).all();
  restoreBackup(parseBackup(createBackup()));
  expect(db.select().from(creditEventOrder).all()).toEqual(sequence);
  expect(fundingState()).toMatchObject({
    paymentReserved: 10000,
    resources: 80000,
    unassigned: 70000,
  });
});
it('handles a same-day refund after a repayment using captured order rather than random IDs', () => {
  setup();
  assign();
  row('zz-purchase', -8000, { date: '2026-10-21' });
  payment(8000, '2026-10-21');
  row('aa-refund', 8000, { date: '2026-10-21' });
  expect(food()).toMatchObject({ balance: 2000, cardCreditAdjustment: -8000 });
  expect(fundingState()).toMatchObject({ resources: 92000, paymentReserved: 0, unassigned: 90000 });
});
it('carries the noncash credit adjustment consistently into future month views', () => {
  setup();
  assign();
  row('purchase', -8000);
  payment();
  row('refund', 8000, { date: '2026-10-17' });
  expect(food('2026-11')).toMatchObject({
    balance: 2000,
    carryOver: 2000,
    cardCreditAdjustment: 0,
    activity: 0,
  });
});

it('conserves unassigned cash across funded purchases, partial repayments and refunds over many amounts', async () => {
  const { default: fc } = await import('fast-check');
  const { calculateCredit } = await import('./creditAccounting.js');
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 1000000 }),
      fc.integer({ min: 0, max: 100 }),
      fc.integer({ min: 0, max: 100 }),
      fc.integer({ min: 0, max: 100 }),
      fc.integer({ min: 0, max: 100 }),
      (cash, budgetRatio, purchaseRatio, paymentRatio, refundRatio) => {
        const assigned = Math.floor((cash * budgetRatio) / 100),
          purchase = Math.floor((assigned * purchaseRatio) / 100),
          paid = Math.floor((purchase * paymentRatio) / 100),
          refund = Math.floor((purchase * refundRatio) / 100);
        const base = {
          date: '2026-10-21',
          categoryId: null,
          transferTransactionId: null,
          activity: false,
          missing: false,
        };
        const result = calculateCredit({
          asOf: '2026-10-21',
          cards: [{ id: 'card', name: 'Card', startingBalance: 0 }],
          plans: [{ accountId: 'card', enabledFrom: '2026-10-01' }],
          expenseIds: new Set(['food']),
          assignments: [{ categoryId: 'food', month: '2026-10', budgeted: assigned }],
          funding: [],
          value: (_id, amount) => amount,
          rows: [
            {
              ...base,
              id: 'purchase',
              accountId: 'card',
              amount: -purchase,
              value: -purchase,
              categoryId: 'food',
              activity: true,
              order: 1,
            },
            {
              ...base,
              id: 'out',
              accountId: 'cash',
              amount: -paid,
              value: -paid,
              transferTransactionId: 'in',
              order: 2,
            },
            {
              ...base,
              id: 'in',
              accountId: 'card',
              amount: paid,
              value: paid,
              transferTransactionId: 'out',
              order: 3,
            },
            {
              ...base,
              id: 'refund',
              accountId: 'card',
              amount: refund,
              value: refund,
              categoryId: 'food',
              activity: true,
              order: 4,
            },
          ],
        });
        const available = assigned - purchase + refund + (result.adjustments.get('food') ?? 0);
        expect(cash - paid - Math.max(0, available) - result.paymentReserved).toBe(cash - assigned);
        expect(result.paymentReserved).toBeGreaterThanOrEqual(0);
        expect(result.paymentReserved).toBeLessThanOrEqual(result.cards[0].debt);
        expect(result.paymentShortfall).toBe(0);
      },
    ),
    { numRuns: 300 },
  );
});
it('uses exact converted values when a purchase partly uses positive foreign-card credit', async () => {
  const { calculateCredit } = await import('./creditAccounting.js');
  const result = calculateCredit({
    asOf: '2026-10-21',
    cards: [{ id: 'card', name: 'Foreign card', startingBalance: 10000 }],
    plans: [{ accountId: 'card', enabledFrom: '2026-10-01' }],
    expenseIds: new Set(['food']),
    assignments: [{ categoryId: 'food', month: '2026-10', budgeted: 5000 }],
    funding: [],
    value: (_id, raw) => (raw * 3) / 2,
    rows: [
      {
        id: 'purchase',
        accountId: 'card',
        date: '2026-10-21',
        amount: -12000,
        value: -18000,
        categoryId: 'food',
        activity: true,
        transferTransactionId: null,
        missing: false,
        order: 1,
      },
    ],
  });
  expect(result.cards[0]).toMatchObject({ debt: 3000, reserved: 3000, shortfall: 0 });
  expect(result.adjustments.get('food')).toBe(15000);
});
