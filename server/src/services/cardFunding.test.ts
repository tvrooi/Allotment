import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  cardFunding,
  categories,
  categoryGroups,
  transactions,
  budgetSettings,
  exchangeRates,
} from '../db/schema.js';
import { applyCardSetup, previewCardSetup } from './cardFundingSetup.js';
import { budgetGroups, fundingState } from './budgetService.js';
import { applyMove, previewMove } from './budgetMoves.js';
import { createBackup, parseBackup, restoreBackup } from './backupService.js';
import { ratesChanged } from './mainAmountService.js';

const date = '2026-10-21',
  month = '2026-10';
beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${date}T02:00:00Z`));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  for (const table of [
    cardFunding,
    transactions,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
    exchangeRates,
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
    .values(
      ['food', 'fees', 'other'].map((id) => ({
        id,
        name: id,
        groupId: 'expenses',
        budgetType: 'flexible',
      })),
    )
    .run();
});
const state = () => fundingState();
const position = (id = 'card') => state().cards.find((c) => c.accountId === id)!;
const cat = (id = 'food') =>
  budgetGroups(month)
    .flatMap((g) => g.categories)
    .find((c) => c.id === id)!;
function assign(id: string, budgeted: number, m = month) {
  db.insert(budgetMonths)
    .values({ id: `${id}:${m}`, categoryId: id, month: m, budgeted })
    .onConflictDoUpdate({
      target: [budgetMonths.categoryId, budgetMonths.month],
      set: { budgeted },
    })
    .run();
}
function entry(id: string, amount: number, categoryId: string | null = 'food', extra = {}) {
  db.insert(transactions)
    .values({ id, accountId: 'card', date, amount, categoryId, ...extra })
    .run();
}
function setup(initial = 0, id = 'card') {
  const p = previewCardSetup(id, initial);
  return applyCardSetup(id, initial, p.revision);
}
function pay(amount: number, id = 'payment') {
  entry(`${id}:cash`, -amount, null, { accountId: 'cash', transferTransactionId: `${id}:card` });
  entry(`${id}:card`, amount, null, { transferTransactionId: `${id}:cash` });
}

describe('reviewed card setup', () => {
  it('preserves all existing records, exposes opening debt, and previews without writes', () => {
    db.update(accounts).set({ startingBalance: -50000 }).where(eq(accounts.id, 'card')).run();
    entry('old', -5000);
    assign('food', 10000);
    const ledger = db.select().from(transactions).all(),
      allocations = db.select().from(budgetMonths).all();
    const before = state();
    const p = previewCardSetup('card', 20000);
    expect(p).toMatchObject({
      beforeUnassigned: 40000,
      unassigned: 75000,
      card: { debt: 55000, available: 20000, shortfall: 35000 },
    });
    expect(db.select().from(cardFunding).all()).toEqual([]);
    expect(db.select().from(budgetMonths).all()).toEqual(allocations);
    expect(state().revision).toBe(before.revision);
    applyCardSetup('card', 20000, p.revision);
    expect(db.select().from(transactions).all()).toEqual(ledger);
    expect(cat().balance).toBe(5000);
    expect(position()).toMatchObject({ available: 20000, fundedPurchases: 0, shortfall: 35000 });
  });
  it('rejects stale, duplicate, excessive and unbacked setup funding atomically', () => {
    db.update(accounts).set({ startingBalance: -50000 }).where(eq(accounts.id, 'card')).run();
    const p = previewCardSetup('card', 10000);
    assign('food', 10000);
    expect(() => applyCardSetup('card', 10000, p.revision)).toThrow(/changed/);
    expect(() => previewCardSetup('card', 50001)).toThrow(/exceed/);
    assign('food', 95000);
    expect(() => previewCardSetup('card', 10000)).toThrow(/Insufficient/);
    expect(db.select().from(cardFunding).all()).toEqual([]);
    assign('food', 0);
    setup();
    expect(() => previewCardSetup('card', 0)).toThrow(/already/);
  });
});

describe('card payment reserves', () => {
  it('reserves an $80 funded purchase from $100 groceries, and consumes it on repayment', () => {
    setup();
    assign('food', 10000);
    entry('purchase', -8000);
    expect(cat()).toMatchObject({ balance: 2000, activity: -8000 });
    expect(position()).toMatchObject({ debt: 8000, available: 8000, shortfall: 0 });
    expect(state()).toMatchObject({ resources: 100000, reserved: 10000, unassigned: 90000 });
    pay(8000);
    expect(position()).toMatchObject({ debt: 0, available: 0, shortfall: 0 });
    expect(cat().activity).toBe(-8000);
    expect(state()).toMatchObject({ resources: 92000, reserved: 2000, unassigned: 90000 });
  });
  it('exposes partial and unfunded purchases, and retroactively reserves a reviewed category assignment', () => {
    setup();
    assign('food', 5000);
    entry('purchase', -8000);
    expect(position()).toMatchObject({ available: 5000, shortfall: 3000 });
    expect(cat().balance).toBe(-3000);
    expect(state().resolved).toBe(false);
    assign('food', 8000);
    expect(position()).toMatchObject({ available: 8000, shortfall: 0 });
    expect(cat().balance).toBe(0);
  });
  it('funds opening debt explicitly and reports unreserved repayments separately', () => {
    db.update(accounts).set({ startingBalance: -50000 }).where(eq(accounts.id, 'card')).run();
    setup(20000);
    expect(state().unassigned).toBe(80000);
    pay(30000);
    expect(position()).toMatchObject({
      debt: 20000,
      available: -10000,
      shortfall: 20000,
      uncoveredPayments: 10000,
    });
    assign(position().categoryId, 30000);
    expect(position()).toMatchObject({ available: 0, uncoveredPayments: 0 });
  });
  it('releases funded refunds without duplicating spending or payment funding', () => {
    setup();
    assign('food', 10000);
    entry('1purchase', -8000);
    entry('2refund', 3000);
    expect(cat()).toMatchObject({ balance: 5000, activity: -5000 });
    expect(position()).toMatchObject({ debt: 5000, available: 5000 });
    expect(state().unassigned).toBe(90000);
  });
  it('handles refunds after payment as prepaid resources without a second payment reserve', () => {
    setup();
    assign('food', 10000);
    entry('1purchase', -8000);
    pay(8000, '2payment');
    entry('3refund', 8000);
    expect(cat()).toMatchObject({ balance: 10000, activity: 0 });
    expect(position()).toMatchObject({
      debt: 0,
      prepaid: 8000,
      available: 0,
      uncoveredPayments: 0,
    });
    expect(state()).toMatchObject({ resources: 100000, unassigned: 90000 });
  });
  it('reverses unfunded debt on refund and does not turn an opening-debt refund into fictitious cash', () => {
    setup();
    entry('1purchase', -8000);
    entry('2refund', 8000);
    expect(cat().balance).toBe(0);
    expect(position().shortfall).toBe(0);
    const oldPaymentId = position().categoryId;
    db.delete(cardFunding).run();
    db.delete(transactions).run();
    db.delete(budgetMonths).run();
    db.delete(categories).where(eq(categories.id, oldPaymentId)).run();
    db.update(accounts).set({ startingBalance: -50000 }).where(eq(accounts.id, 'card')).run();
    setup(20000);
    entry('refund', 30000);
    expect(position()).toMatchObject({ debt: 20000, available: 0 });
    expect(cat().balance).toBe(20000);
    expect(state().unassigned).toBe(80000);
  });
  it('returns an unreserved payment followed by refund to its original funding position', () => {
    setup();
    entry('1purchase', -8000);
    pay(8000, '2payment');
    entry('3refund', 8000);
    expect(position()).toMatchObject({ available: 0, prepaid: 8000, uncoveredPayments: 0 });
    expect(cat().balance).toBe(0);
    expect(state().unassigned).toBe(100000);
  });
  it('keeps overpayments as positive card resources, with no phantom payment deficit', () => {
    db.update(accounts).set({ startingBalance: -5000 }).where(eq(accounts.id, 'card')).run();
    setup(5000);
    pay(10000);
    expect(position()).toMatchObject({
      debt: 0,
      prepaid: 5000,
      available: 0,
      uncoveredPayments: 0,
    });
    expect(state()).toMatchObject({ resources: 95000, unassigned: 95000 });
  });
  it('spends a positive card balance before reserving cash for new debt', () => {
    db.update(accounts).set({ startingBalance: 8000 }).where(eq(accounts.id, 'card')).run();
    setup();
    assign('food', 10000);
    entry('purchase', -10000);
    expect(position()).toMatchObject({ debt: 2000, available: 2000, prepaid: 0 });
    expect(cat().balance).toBe(0);
    expect(state().unassigned).toBe(98000);
  });
  it('counts splits and interest once and moves funding with a balance transfer between configured cards', () => {
    db.insert(accounts)
      .values({ id: 'second', name: 'Second card', type: 'credit', createdAt: '2026-09-01' })
      .run();
    setup();
    setup(0, 'second');
    assign('food', 10000);
    assign('fees', 1000);
    entry('1parent', -9000, null, { isParent: 1 });
    entry('part1', -8000, 'food', { parentTransactionId: '1parent' });
    entry('part2', -1000, 'fees', { parentTransactionId: '1parent' });
    expect(position()).toMatchObject({ debt: 9000, available: 9000 });
    expect(cat('fees').activity).toBe(-1000);
    entry('2new-debt', -9000, null, { accountId: 'second', transferTransactionId: '2old-debt' });
    entry('2old-debt', 9000, null, { transferTransactionId: '2new-debt' });
    expect(position()).toMatchObject({ debt: 0, available: 0 });
    expect(position('second')).toMatchObject({ debt: 9000, available: 9000 });
    expect(cat().activity).toBe(-8000);
  });
  it('allows releasing a reserve only through a visible assignment change and then exposes the shortfall', () => {
    setup();
    assign('food', 10000);
    entry('purchase', -8000);
    const r = { sourceId: position().categoryId, destinationId: 'other', amount: 5000 };
    const p = previewMove(month, r);
    applyMove(month, r, p.revision);
    expect(position()).toMatchObject({ available: 3000, shortfall: 5000 });
    expect(cat('other').balance).toBe(5000);
    expect(state().unassigned).toBe(90000);
  });
  it('does not include future purchases, or late imported pre-cutover history, in automatic purchase funding', () => {
    setup();
    assign('food', 10000);
    entry('future', -8000, 'food', { date: '2026-11-01' });
    entry('late-history', -3000, 'food', { date: '2026-10-20' });
    expect(position()).toMatchObject({ debt: 3000, available: 0, shortfall: 3000 });
    expect(cat().balance).toBe(7000);
  });
  it('blocks reclassification and transaction use of payment categories at the database boundary', () => {
    setup();
    expect(() => entry('bad', -100, position().categoryId)).toThrow(/repayments as transfers/);
    expect(() =>
      db.update(accounts).set({ isOffBudget: 1 }).where(eq(accounts.id, 'card')).run(),
    ).toThrow(/on-budget credit/);
    expect(() =>
      db
        .update(categoryGroups)
        .set({ isIncome: 1 })
        .where(eq(categoryGroups.id, 'system:card-payments'))
        .run(),
    ).toThrow(/cannot become income/);
  });
  it('preserves setup, bank records and derived funding in portable backups; older backups have no setup', () => {
    setup();
    assign('food', 10000);
    entry('purchase', -8000, 'food', { importedId: 'bank:immutable', reconciled: 1 });
    const before = state(),
      backup = createBackup();
    expect(backup.version).toBe(8);
    restoreBackup(parseBackup(backup));
    expect(position()).toMatchObject(before.cards[0]);
    expect(db.select().from(transactions).all()[0]).toMatchObject({
      importedId: 'bank:immutable',
      reconciled: 1,
      amount: -8000,
    });
    const older: Record<string, unknown> = { ...backup, version: 7 };
    delete older.cardFunding;
    expect(parseBackup(older).cardFunding).toEqual([]);
  });
  it('uses the same month carry and funding position across month boundaries', () => {
    setup();
    assign('food', 10000);
    entry('purchase', -8000);
    vi.setSystemTime(new Date('2026-11-03T02:00:00Z'));
    try {
      expect(position()).toMatchObject({ debt: 8000, available: 8000 });
      const c = budgetGroups('2026-11')
        .flatMap((g) => g.categories)
        .find((c) => c.id === position().categoryId)!;
      expect(c).toMatchObject({ balance: 8000, carryOver: 8000, activity: 0 });
    } finally {
      vi.setSystemTime(new Date(`${date}T02:00:00Z`));
    }
  });
});

describe('currency, priorities and receipt boundaries', () => {
  it('uses cash-first category funding and never funds two cards with the same assignment', () => {
    db.insert(accounts)
      .values({ id: 'second', name: 'Second', type: 'credit', createdAt: '2026-09-01' })
      .run();
    setup();
    setup(0, 'second');
    assign('food', 10000);
    entry('1card', -8000);
    entry('2card', -5000, 'food', { accountId: 'second' });
    expect(position()).toMatchObject({ available: 8000, shortfall: 0 });
    expect(position('second')).toMatchObject({ available: 2000, shortfall: 3000 });
    entry('cash-spend', -3000, 'food', { accountId: 'cash' });
    expect(position()).toMatchObject({ available: 7000, shortfall: 1000 });
    expect(position('second')).toMatchObject({ available: 0, shortfall: 5000 });
  });
  it('keeps missing account or transaction rates visibly incomplete', () => {
    db.insert(budgetSettings).values({ id: 'budget', currency: 'AUD' }).run();
    db.update(accounts).set({ currency: 'USD' }).where(eq(accounts.id, 'card')).run();
    expect(() => previewCardSetup('card', 0)).toThrow(/exchange rates/);
    db.insert(exchangeRates)
      .values({
        id: 'rate',
        date: '2026-10-21',
        base: 'USD',
        quote: 'AUD',
        rate: '2',
        source: 'manual',
      })
      .run();
    ratesChanged();
    setup();
    assign('food', 20000);
    entry('missing', -8000, 'food', { mainAmountSource: 'missing' });
    expect(state()).toMatchObject({ complete: false, available: 0, resolved: false });
  });
  it('uses budget-currency funding for a foreign-card purchase and linked repayment', () => {
    db.insert(budgetSettings).values({ id: 'budget', currency: 'AUD' }).run();
    db.update(accounts).set({ currency: 'USD' }).where(eq(accounts.id, 'card')).run();
    db.insert(exchangeRates)
      .values({
        id: 'rate',
        date: '2026-10-21',
        base: 'USD',
        quote: 'AUD',
        rate: '2',
        source: 'manual',
      })
      .run();
    ratesChanged();
    setup();
    assign('food', 20000);
    entry('1purchase', -8000, 'food', { mainAmount: -16000, mainAmountSource: 'rate' });
    expect(position()).toMatchObject({ debt: 16000, available: 16000 });
    expect(cat().balance).toBe(4000);
    entry('2cash', -16000, null, { accountId: 'cash', transferTransactionId: '2card' });
    entry('2card', 8000, null, {
      transferTransactionId: '2cash',
      mainAmount: 16000,
      mainAmountSource: 'transfer',
    });
    expect(position()).toMatchObject({ debt: 0, available: 0 });
    expect(state()).toMatchObject({ resources: 84000, unassigned: 80000 });
  });
  it('does not clear actual debt or unlock reserves for generated expected receipts', () => {
    setup();
    assign('food', 10000);
    entry('1purchase', -8000);
    entry('2expectation', 8000, null, { importedId: 'schedule:income:today' });
    expect(position()).toMatchObject({ debt: 8000, available: 8000 });
    expect(state().unassigned).toBe(90000);
  });
  it('does not replay pre-setup historical balance transfers into a later-reviewed card', () => {
    db.insert(accounts)
      .values({ id: 'second', name: 'Second', type: 'credit', createdAt: '2026-09-01' })
      .run();
    setup();
    assign('food', 10000);
    entry('1purchase', -8000);
    entry('2new-debt', -8000, null, { accountId: 'second', transferTransactionId: '2old-debt' });
    entry('2old-debt', 8000, null, { transferTransactionId: '2new-debt' });
    setup(0, 'second');
    expect(position()).toMatchObject({ debt: 0, available: 0 });
    expect(position('second')).toMatchObject({ debt: 8000, available: 0, shortfall: 8000 });
  });
});

it('uses record creation time before random IDs for same-day purchases and payments', () => {
  setup();
  assign('food', 10000);
  entry('z-purchase', -8000, 'food', { createdAt: `${date}T01:00:00.000Z` });
  entry('a-cash-payment', -8000, null, {
    accountId: 'cash',
    transferTransactionId: 'a-payment',
    createdAt: `${date}T02:00:00.000Z`,
  });
  entry('a-payment', 8000, null, {
    transferTransactionId: 'a-cash-payment',
    createdAt: `${date}T02:00:00.000Z`,
  });
  entry('b-new-charge', -5000, null, { createdAt: `${date}T03:00:00.000Z` });
  expect(position()).toMatchObject({ debt: 5000, available: 0, shortfall: 5000 });
});

it('nets mixed purchase/refund split parts without inventing excess payment funding', () => {
  setup();
  assign('food', 15000);
  entry('parent', -10000, null, { isParent: 1 });
  entry('part-a', -15000, 'food', { parentTransactionId: 'parent' });
  entry('part-b', 5000, 'other', { parentTransactionId: 'parent' });
  expect(position()).toMatchObject({
    debt: 10000,
    available: 10000,
    shortfall: 0,
    excessFunding: 0,
  });
  expect(cat().balance).toBe(0);
  expect(cat('other').balance).toBe(5000);
  expect(state().unassigned).toBe(85000);
});

for (const creditFirst of [false, true])
  it(`consumes prepaid card resources before shifting balance-transfer funding (${creditFirst ? 'credit' : 'debit'} row first)`, () => {
    db.insert(accounts)
      .values({
        id: 'second',
        name: 'Second',
        type: 'credit',
        startingBalance: 5000,
        createdAt: '2026-09-01',
      })
      .run();
    setup();
    setup(0, 'second');
    assign('food', 8000);
    entry('1purchase', -10000);
    entry(creditFirst ? '2a' : '2b', 10000, null, {
      transferTransactionId: creditFirst ? '2b' : '2a',
    });
    entry(creditFirst ? '2b' : '2a', -10000, null, {
      accountId: 'second',
      transferTransactionId: creditFirst ? '2a' : '2b',
    });
    expect(position()).toMatchObject({ debt: 0, available: 0 });
    expect(position('second')).toMatchObject({ debt: 5000, available: 5000, excessFunding: 0 });
    expect(state()).toMatchObject({ resources: 100000, unassigned: 95000 });
  });

it('keeps payment envelopes managed in historical views before setup without replaying funding', () => {
  setup();
  assign('food', 10000);
  entry('purchase', -8000);
  const payment = budgetGroups('2026-09')
    .flatMap((g) => g.categories)
    .find((c) => c.id === position().categoryId)!;
  expect(payment).toMatchObject({ paymentAccountId: 'card', activity: 0, balance: 0 });
  expect(fundingState('2026-09-30').cards).toEqual([]);
});
