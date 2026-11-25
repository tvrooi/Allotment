import { describe, expect, it } from 'vitest';
import { latestExpenses } from './latestExpenses';

const entry = (id: string, kind = 'expense') => ({ id, kind });

describe('latestExpenses', () => {
  it('returns the newest expenses first, up to the count', () => {
    const all = ['a', 'b', 'c', 'd'].map((id) => entry(id));
    expect(latestExpenses(all, 3).map((e) => e.id)).toEqual(['d', 'c', 'b']);
  });

  it('leaves out repayments, advances and adjustments', () => {
    const all = [entry('a'), entry('s', 'settlement'), entry('b'), entry('p', 'pool_adjustment')];
    expect(latestExpenses(all, 5).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('is empty when there is nothing', () => {
    expect(latestExpenses([], 3)).toEqual([]);
  });
});
