import { describe, expect, it } from 'vitest';
import { leftToSpend } from './leftToSpend';
import type { BudgetGroup } from '../types';

const group = (isIncome: number, cats: object[]) =>
  ({ id: 'g', name: 'g', isIncome, categories: cats }) as unknown as BudgetGroup;

describe('leftToSpend', () => {
  it('counts money carried over, as the envelope’s Available does', () => {
    // $50 carried over, $100 assigned, $120 spent: $30 available
    const g = group(0, [{ budgeted: 10_000, carryOver: 5_000, balance: 3_000, spent: -12_000 }]);
    expect(leftToSpend([g])).toEqual({ left: 3_000, planned: true });
  });

  it('ignores income, and says when nothing is in the envelopes', () => {
    const income = group(1, [{ budgeted: 500_000, carryOver: 0, balance: 0 }]);
    const empty = group(0, [{ budgeted: 0, carryOver: 0, balance: 0 }]);
    expect(leftToSpend([income, empty])).toEqual({ left: 0, planned: false });
  });
});
