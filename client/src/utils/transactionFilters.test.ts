import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_FILTERS,
  FILTER_KEYS,
  activeFilterCount,
  filtersFromSearch,
  filtersToParams,
  filtersToSearch,
  transactionsLink,
  type FilterState,
} from './transactionFilters';
import { cashFlowTransactionsLink } from './cashFlowSelection';

const today = new Date(2026, 9, 22);

describe('transaction filters', () => {
  it('turns the phase 8 example into the server selection', () => {
    const f: FilterState = {
      ...DEFAULT_FILTERS,
      datePreset: 'all',
      accountIds: ['mock'],
      direction: 'debit',
      minAmount: 10001,
    };
    expect(filtersToParams(f, undefined, today)).toEqual({
      accountIds: ['mock'],
      direction: 'debit',
      minAmount: 10001,
    });
  });

  it('uses the fixed account of an account register instead of chosen accounts', () => {
    const f = { ...DEFAULT_FILTERS, datePreset: 'all' as const, accountIds: ['a', 'b'] };
    expect(filtersToParams(f, 'own', today)).toEqual({ accountId: 'own' });
  });

  it('resolves presets to inclusive days and custom ranges as typed', () => {
    expect(filtersToParams(DEFAULT_FILTERS, undefined, today)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(
      filtersToParams(
        { ...DEFAULT_FILTERS, datePreset: 'custom', from: '2026-09-07', to: '' },
        undefined,
        today,
      ),
    ).toEqual({ from: '2026-09-07' });
  });

  it('round-trips through the URL', () => {
    const arb = fc.record({
      search: fc.constantFrom('', 'grocer', 'a&b=c'),
      datePreset: fc.constantFrom(
        'this-month' as const,
        'last-3' as const,
        'this-year' as const,
        'all' as const,
      ),
      accountIds: fc.constantFrom([], ['a'], ['a', 'b']),
      categoryIds: fc.constantFrom([], ['c']),
      payeeIds: fc.constantFrom([], ['p', 'q']),
      direction: fc.constantFrom('all' as const, 'debit' as const, 'credit' as const),
      minAmount: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: null }),
      excludeTransfers: fc.boolean(),
      budgetReport: fc.boolean(),
      categoryGroupId: fc.constantFrom(null, 'g'),
      uncategorized: fc.boolean(),
      payeeName: fc.constantFrom(null, '', 'Mock cafe'),
    });
    fc.assert(
      fc.property(arb, (partial) => {
        const f: FilterState = {
          ...DEFAULT_FILTERS,
          ...partial,
          accountIds: [...partial.accountIds],
          categoryIds: [...partial.categoryIds],
          payeeIds: [...partial.payeeIds],
          maxAmount: null,
        };
        expect(filtersFromSearch(filtersToSearch(f))).toEqual(f);
      }),
    );
    const custom = {
      ...DEFAULT_FILTERS,
      datePreset: 'custom' as const,
      from: '2026-01-01',
      to: '2026-01-31',
    };
    expect(filtersFromSearch(filtersToSearch(custom))).toEqual(custom);
  });

  it('drops malformed URL values instead of sending them on', () => {
    const f = filtersFromSearch(
      new URLSearchParams(
        'from=2026-02-30&to=nope&min_amount=-5&max_amount=1.5&direction=up&range=decade',
      ),
    );
    expect(f).toEqual({ ...DEFAULT_FILTERS });
    const reversed = filtersFromSearch(new URLSearchParams('from=2026-10-31&to=2026-10-01'));
    expect(reversed).toMatchObject({ datePreset: 'custom', from: '2026-10-31', to: '' });
    expect(filtersFromSearch(new URLSearchParams('min_amount=500&max_amount=100'))).toMatchObject({
      minAmount: 500,
      maxAmount: null,
    });
  });

  it('shows all history for a category or merchant link without dates', () => {
    expect(filtersFromSearch(new URLSearchParams('payee_ids=p')).datePreset).toBe('all');
    expect(filtersFromSearch(new URLSearchParams('payee_name=')).datePreset).toBe('all');
    expect(filtersFromSearch(new URLSearchParams('')).datePreset).toBe('this-month');
  });

  it('counts active filters but not the date range', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, datePreset: 'all' })).toBe(0);
    expect(
      activeFilterCount({ ...DEFAULT_FILTERS, minAmount: 1, maxAmount: 2, direction: 'debit' }),
    ).toBe(2);
  });

  it('only writes keys it owns', () => {
    const everything: FilterState = {
      ...DEFAULT_FILTERS,
      search: 's',
      datePreset: 'custom',
      from: '2026-01-01',
      to: '2026-01-02',
      accountIds: ['a'],
      categoryIds: ['c'],
      payeeIds: ['p'],
      direction: 'credit',
      minAmount: 1,
      maxAmount: 2,
      excludeTransfers: true,
      budgetReport: true,
      categoryGroupId: 'g',
      uncategorized: true,
      payeeName: 'x',
    };
    for (const key of filtersToSearch(everything).keys()) expect(FILTER_KEYS.has(key)).toBe(true);
    expect(transactionsLink({ payeeIds: ['p'] })).toBe(
      '/transactions?range=this-month&payee_ids=p',
    );
  });

  it('carries the Cash Flow drill-down scope to All Transactions', () => {
    const link = cashFlowTransactionsLink(
      { nodeType: 'subcategory', categoryId: 'groceries' },
      '2026-10',
      '2026-10',
    );
    const f = filtersFromSearch(new URLSearchParams(link.split('?')[1]));
    expect(filtersToParams(f, undefined, today)).toEqual({
      budgetReport: true,
      categoryIds: ['groceries'],
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });
});
