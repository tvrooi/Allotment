import { describe, expect, it } from 'vitest';
import { leftToSpend, monthProgress, savingsCategoryIds, spendingPace } from './leftToSpend';
import type { BudgetGroup } from '../types';

const group = (isIncome: number, cats: object[]) =>
  ({ id: 'g', name: 'g', isIncome, categories: cats }) as unknown as BudgetGroup;

describe('leftToSpend', () => {
  it('counts money carried over, as the envelope’s Available does', () => {
    // $50 carried over, $100 assigned, $120 spent: $30 available
    const g = group(0, [{ budgeted: 10_000, carryOver: 5_000, balance: 3_000, spent: -12_000 }]);
    expect(leftToSpend([g])).toEqual({ left: 3_000, setAside: 0, planned: true });
  });

  it('ignores income, and says when nothing is in the envelopes', () => {
    const income = group(1, [{ budgeted: 500_000, carryOver: 0, balance: 0 }]);
    const empty = group(0, [{ budgeted: 0, carryOver: 0, balance: 0 }]);
    expect(leftToSpend([income, empty])).toEqual({ left: 0, setAside: 0, planned: false });
  });

  it('leaves out savings envelopes: Savings categories and the ones goals save in', () => {
    const g = group(0, [
      { id: 'food', budgetType: 'flexible', budgeted: 40_000, carryOver: 0, balance: 25_000 },
      {
        id: 'emergency',
        budgetType: 'savings',
        budgeted: 0,
        carryOver: 5_000_000,
        balance: 5_000_000,
      },
      {
        id: 'trip',
        budgetType: 'non_monthly',
        budgeted: 25_000,
        carryOver: 100_000,
        balance: 125_000,
      },
      { id: 'old', budgetType: 'non_monthly', budgeted: 0, carryOver: 9_000, balance: 9_000 },
    ]);
    const goals = savingsCategoryIds([
      { categoryId: 'trip', status: 'active' },
      { categoryId: 'old', status: 'retired' },
      { categoryId: null, status: 'active' },
    ]);
    expect(leftToSpend([g], goals)).toEqual({
      left: 25_000 + 9_000,
      setAside: 5_000_000 + 125_000,
      planned: true,
    });
  });

  it('an overspent savings envelope does not lower what is left to spend', () => {
    const g = group(0, [
      { id: 'food', budgetType: 'flexible', budgeted: 10_000, carryOver: 0, balance: 10_000 },
      { id: 'save', budgetType: 'savings', budgeted: 0, carryOver: 0, balance: -2_000 },
    ]);
    expect(leftToSpend([g])).toMatchObject({ left: 10_000, setAside: -2_000 });
  });
});

describe('monthProgress', () => {
  it('is the share of the month’s days reached, today included', () => {
    expect(monthProgress('2026-11', '2026-11-15')).toBe(50);
    expect(monthProgress('2026-11', '2026-11-30')).toBe(100);
    expect(monthProgress('2026-02', '2026-02-07')).toBe(25);
  });

  it('counts the first day as started and a leap February as 29 days', () => {
    expect(monthProgress('2026-11', '2026-11-01')).toBe(3);
    expect(monthProgress('2028-02', '2028-02-29')).toBe(100);
    expect(monthProgress('2028-02', '2028-02-28')).toBe(97);
  });

  it('is 0 before the month starts and 100 once it is over, across a year end', () => {
    expect(monthProgress('2027-01', '2026-12-31')).toBe(0);
    expect(monthProgress('2026-12', '2027-01-01')).toBe(100);
  });

  it('refuses a date or month that is not real', () => {
    expect(() => monthProgress('2026-13', '2026-11-01')).toThrow();
    expect(() => monthProgress('2026-02', '2026-02-30')).toThrow();
  });
});

describe('spendingPace', () => {
  const food = (budgeted: number, spent: number, carryOver = 0) => ({
    id: 'food',
    budgetType: 'flexible',
    budgeted,
    carryOver,
    transferred: 0,
    balance: carryOver + budgeted - spent,
  });

  it('sets what has gone from the spending envelopes beside how far the month is', () => {
    // $400 assigned, $100 carried in, $250 spent: half the spending money, a third of the month
    const pace = spendingPace([group(0, [food(40_000, 25_000, 10_000)])], new Set(), {
      month: '2026-11',
      today: '2026-11-10',
    });
    expect(pace).toEqual({ usedPercent: 50, monthPercent: 33, overspent: false });
  });

  it('leaves out savings envelopes, as left to spend does', () => {
    const save = { id: 'save', budgetType: 'savings', budgeted: 90_000, carryOver: 0, balance: 0 };
    const pace = spendingPace([group(0, [food(10_000, 2_500), save])], new Set(), {
      month: '2026-11',
      today: '2026-11-30',
    });
    expect(pace).toMatchObject({ usedPercent: 25, monthPercent: 100 });
  });

  it('is overspent only when less than nothing is left', () => {
    const exact = spendingPace([group(0, [food(10_000, 10_000)])], new Set(), {
      month: '2026-11',
      today: '2026-11-02',
    });
    expect(exact).toMatchObject({ usedPercent: 100, overspent: false });
    const over = spendingPace([group(0, [food(10_000, 12_500)])], new Set(), {
      month: '2026-11',
      today: '2026-11-02',
    });
    expect(over).toMatchObject({ usedPercent: 125, overspent: true });
  });

  it('has no pace for a month with nothing in the envelopes', () => {
    expect(
      spendingPace([group(0, [food(0, 0)])], new Set(), { month: '2026-11', today: '2026-11-02' }),
    ).toBeNull();
    expect(spendingPace([], new Set(), { month: '2026-11', today: '2026-11-02' })).toBeNull();
  });

  it('counts refunds against spending, never below nothing used', () => {
    const refunded = spendingPace([group(0, [food(10_000, -3_000)])], new Set(), {
      month: '2026-11',
      today: '2026-11-02',
    });
    expect(refunded).toMatchObject({ usedPercent: 0, overspent: false });
  });
});
