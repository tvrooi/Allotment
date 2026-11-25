import { describe, expect, it } from 'vitest';
import { personalPayeeSelection } from './payeeSelection';
import {
  DEFAULT_FILTERS,
  filtersFromSearch,
  filtersToParams,
  transactionsLink,
} from './transactionFilters';

const accounts = [
  { id: 'personal', isOffBudget: 0 },
  { id: 'other-personal', isOffBudget: 0 },
  { id: 'outside', isOffBudget: 1 },
  { id: 'household', isOffBudget: 0, householdPool: 'Home' },
];

describe('grouped payee inspection', () => {
  it('round-trips the same personal selection used by categorisation through the register URL', () => {
    const selection = personalPayeeSelection({ payeeId: 'shop', payeeName: 'Shop' }, accounts);
    const link = transactionsLink({ ...selection, datePreset: 'all' });
    expect(filtersToParams(filtersFromSearch(new URLSearchParams(link.split('?')[1])))).toEqual(
      selection,
    );
    expect(selection.accountIds).toEqual(['personal', 'other-personal']);
  });

  it.each(['Shop & café / groceries', ''])(
    'keeps the exact fallback merchant name %j',
    (payeeName) => {
      const selection = personalPayeeSelection({ payeeId: null, payeeName }, accounts);
      const link = transactionsLink({ ...selection, datePreset: 'all' });
      expect(filtersFromSearch(new URLSearchParams(link.split('?')[1])).payeeName).toBe(payeeName);
      expect(filtersToParams({ ...DEFAULT_FILTERS, ...selection, datePreset: 'all' })).toEqual(
        selection,
      );
    },
  );

  it('refuses an empty personal scope instead of selecting every account', () => {
    expect(() =>
      personalPayeeSelection({ payeeId: 'shop', payeeName: 'Shop' }, accounts.slice(2)),
    ).toThrow('No personal budget accounts');
  });
});
