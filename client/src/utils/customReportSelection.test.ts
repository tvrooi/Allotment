import { describe, it, expect } from 'vitest';
import type { CustomReportConfig } from '../types';
import { customReportRowLink } from './customReportSelection';

const config = (over: Partial<CustomReportConfig> = {}): CustomReportConfig => ({
  chartType: 'table',
  mode: 'total',
  groupBy: 'category',
  balanceType: 'expense',
  dateRange: { preset: 'custom', from: '2026-08', to: '2026-10' },
  filters: { accountIds: [], categoryIds: [], categoryGroupIds: [] },
  ...over,
});

/** The link's register filters, as the Transactions page reads them */
const params = (link: string | null) => {
  expect(link).not.toBeNull();
  const [path, query] = link!.split('?');
  expect(path).toBe('/transactions');
  return Object.fromEntries(new URLSearchParams(query));
};

describe('custom report row links', () => {
  it('opens a spending category over the report months in the budget scope', () => {
    expect(params(customReportRowLink(config(), { id: 'groceries' }))).toEqual({
      from: '2026-08-01',
      to: '2026-10-31',
      category_ids: 'groceries',
      direction: 'debit',
      budget_report: '1',
    });
  });

  it('opens uncategorised spending as uncategorised', () => {
    const p = params(customReportRowLink(config(), { id: null }));
    expect(p.uncategorized).toBe('1');
    expect(p.category_ids).toBeUndefined();
  });

  it('keeps the report filters for payee, account and month rows', () => {
    const filtered = config({
      balanceType: 'net',
      filters: { accountIds: [], categoryIds: ['a', 'b'], categoryGroupIds: ['food'] },
    });
    expect(params(customReportRowLink({ ...filtered, groupBy: 'payee' }, { id: 'p1' }))).toEqual({
      from: '2026-08-01',
      to: '2026-10-31',
      category_ids: 'a,b',
      payee_ids: 'p1',
      budget_report: '1',
      category_group_id: 'food',
    });
    expect(params(customReportRowLink({ ...filtered, groupBy: 'account' }, { id: 'acc' }))).toEqual(
      expect.objectContaining({ account_ids: 'acc' }),
    );
    expect(
      params(customReportRowLink({ ...filtered, groupBy: 'month' }, { id: '2026-09' })),
    ).toEqual(expect.objectContaining({ from: '2026-09-01', to: '2026-09-30' }));
  });

  it('opens an income category or group, without the spending direction', () => {
    const income = config({ balanceType: 'income', groupBy: 'categoryGroup' });
    const p = params(customReportRowLink(income, { id: 'salary-group' }));
    expect(p.category_group_id).toBe('salary-group');
    expect(p.direction).toBeUndefined();
  });

  it('has no link where the register could not select exactly the same rows', () => {
    // Picked accounts may be off budget, outside the register's budget scope
    const accounts = config({
      filters: { accountIds: ['super'], categoryIds: [], categoryGroupIds: [] },
    });
    expect(customReportRowLink(accounts, { id: 'groceries' })).toBeNull();
    // The register filters one category group
    const groups = config({
      filters: { accountIds: [], categoryIds: [], categoryGroupIds: ['a', 'b'] },
    });
    expect(customReportRowLink(groups, { id: 'groceries' })).toBeNull();
    // Income from any income group has no register filter
    expect(
      customReportRowLink(config({ balanceType: 'income', groupBy: 'payee' }), { id: 'p1' }),
    ).toBeNull();
    // Every transaction without a payee record is one row
    expect(customReportRowLink(config({ groupBy: 'payee' }), { id: null })).toBeNull();
  });
});
