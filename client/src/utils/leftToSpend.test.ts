import { describe, expect, it } from 'vitest';
import { leftToSpend, savingsCategoryIds } from './leftToSpend';
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
