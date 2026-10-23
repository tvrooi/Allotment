import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import type { TransactionQueryParams } from '../types';

// The register's filters, and how they travel in the URL so reload, back and drill-down
// links keep them (docs/MONARCH-DEVELOPMENT-PHASE.md, "Scope and drill-down"). The URL uses
// the server's own query names, so a link is also exactly what the server is asked.

export type DatePreset = 'this-month' | 'last-3' | 'this-year' | 'all' | 'custom';
export type Direction = 'all' | 'debit' | 'credit';
/** A yes/no register-row state filter (phase 9): reviewed, hidden from reports */
export type Tristate = 'all' | 'yes' | 'no';

export interface FilterState {
  search: string;
  datePreset: DatePreset;
  /** Inclusive days, used when datePreset is 'custom' */
  from: string;
  to: string;
  accountIds: string[];
  categoryIds: string[];
  payeeIds: string[];
  direction: Direction;
  /** Magnitudes in minor units, both inclusive */
  minAmount: number | null;
  maxAmount: number | null;
  excludeTransfers: boolean;
  /** Phase 9: any of these tags; reviewed and hidden-from-reports state */
  tagIds: string[];
  reviewed: Tristate;
  hidden: Tristate;
  // Scope a drill-down brings with it (Cash Flow, reports, merchant breakdown)
  budgetReport: boolean;
  categoryGroupId: string | null;
  uncategorized: boolean;
  /** A merchant without a payee record ('' = no payee) */
  payeeName: string | null;
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  datePreset: 'this-month',
  from: '',
  to: '',
  accountIds: [],
  categoryIds: [],
  payeeIds: [],
  direction: 'all',
  minAmount: null,
  maxAmount: null,
  excludeTransfers: false,
  tagIds: [],
  reviewed: 'all',
  hidden: 'all',
  budgetReport: false,
  categoryGroupId: null,
  uncategorized: false,
  payeeName: null,
};

/** The URL keys the filters use */
export const FILTER_KEYS = new Set([
  'range',
  'from',
  'to',
  'search',
  'account_ids',
  'category_ids',
  'payee_ids',
  'payee_name',
  'direction',
  'min_amount',
  'max_amount',
  'transfers',
  'budget_report',
  'category_group_id',
  'uncategorized',
  'tag_ids',
  'reviewed',
  'hidden',
]);

const PRESETS: DatePreset[] = ['this-month', 'last-3', 'this-year', 'all', 'custom'];

export function dateRangeFor(
  f: Pick<FilterState, 'datePreset' | 'from' | 'to'>,
  today = new Date(),
) {
  const day = (d: Date) => format(d, 'yyyy-MM-dd');
  switch (f.datePreset) {
    case 'this-month':
      return { from: day(startOfMonth(today)), to: day(endOfMonth(today)) };
    case 'last-3':
      return { from: day(startOfMonth(subMonths(today, 2))), to: day(endOfMonth(today)) };
    case 'this-year':
      return { from: day(startOfYear(today)), to: day(endOfMonth(today)) };
    case 'custom':
      return { from: f.from || undefined, to: f.to || undefined };
    case 'all':
      return {};
  }
}

/** The filters as a server selection; a fixed account (an account's register) is added */
export function filtersToParams(
  f: FilterState,
  accountId?: string,
  today = new Date(),
): TransactionQueryParams {
  const range = dateRangeFor(f, today);
  const p: TransactionQueryParams = {};
  if (accountId) p.accountId = accountId;
  else if (f.accountIds.length) p.accountIds = f.accountIds;
  if (range.from) p.from = range.from;
  if (range.to) p.to = range.to;
  if (f.search) p.search = f.search;
  if (f.uncategorized) p.uncategorized = true;
  else if (f.categoryIds.length) p.categoryIds = f.categoryIds;
  if (f.categoryGroupId) p.categoryGroupId = f.categoryGroupId;
  if (f.payeeIds.length) p.payeeIds = f.payeeIds;
  if (f.payeeName !== null) p.payeeName = f.payeeName;
  if (f.direction !== 'all') p.direction = f.direction;
  if (f.minAmount !== null) p.minAmount = f.minAmount;
  if (f.maxAmount !== null) p.maxAmount = f.maxAmount;
  if (f.excludeTransfers) p.transfers = 'exclude';
  if (f.tagIds.length) p.tagIds = f.tagIds;
  if (f.reviewed !== 'all') p.reviewed = f.reviewed === 'yes' ? 1 : 0;
  if (f.hidden !== 'all') p.hidden = f.hidden === 'yes' ? 1 : 0;
  if (f.budgetReport) p.budgetReport = true;
  return p;
}

/** How many filters narrow the register beyond its date range (for the badge and "Clear") */
export function activeFilterCount(f: FilterState): number {
  return [
    f.search !== '',
    f.accountIds.length > 0,
    f.categoryIds.length > 0 || f.uncategorized,
    f.categoryGroupId !== null,
    f.payeeIds.length > 0 || f.payeeName !== null,
    f.direction !== 'all',
    f.minAmount !== null || f.maxAmount !== null,
    f.excludeTransfers,
    f.tagIds.length > 0,
    f.reviewed !== 'all',
    f.hidden !== 'all',
    f.budgetReport,
  ].filter(Boolean).length;
}

const isDay = (s: string | null): s is string => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const ids = (s: string | null) => (s ? s.split(',').filter(Boolean).slice(0, 500) : []);
const tristate = (s: string | null): Tristate => (s === '1' ? 'yes' : s === '0' ? 'no' : 'all');
const amount = (s: string | null) => (s !== null && /^\d{1,13}$/.test(s) ? Number(s) : null);

/**
 * Filters from a URL. Anything malformed is dropped rather than sent on, so a bad link
 * shows a wider list instead of an error.
 */
export function filtersFromSearch(sp: URLSearchParams): FilterState {
  const from = sp.get('from');
  const to = sp.get('to');
  const range = sp.get('range') as DatePreset | null;
  const f: FilterState = {
    ...DEFAULT_FILTERS,
    search: sp.get('search') ?? '',
    accountIds: ids(sp.get('account_ids')),
    categoryIds: ids(sp.get('category_ids')),
    payeeIds: ids(sp.get('payee_ids')),
    direction:
      sp.get('direction') === 'debit' || sp.get('direction') === 'credit'
        ? (sp.get('direction') as Direction)
        : 'all',
    minAmount: amount(sp.get('min_amount')),
    maxAmount: amount(sp.get('max_amount')),
    excludeTransfers: sp.get('transfers') === 'exclude',
    tagIds: ids(sp.get('tag_ids')),
    reviewed: tristate(sp.get('reviewed')),
    hidden: tristate(sp.get('hidden')),
    budgetReport: sp.get('budget_report') === '1',
    categoryGroupId: sp.get('category_group_id') || null,
    uncategorized: sp.get('uncategorized') === '1',
    payeeName: sp.get('payee_name'),
  };
  if (f.minAmount !== null && f.maxAmount !== null && f.minAmount > f.maxAmount) {
    f.maxAmount = null;
  }
  if (range && PRESETS.includes(range) && range !== 'custom') {
    f.datePreset = range;
  } else if (isDay(from) || isDay(to)) {
    f.datePreset = 'custom';
    f.from = isDay(from) ? from : '';
    f.to = isDay(to) ? to : '';
    if (f.from && f.to && f.from > f.to) f.to = '';
  } else {
    // A drill-down to a category or merchant shows all of its history
    const scoped =
      f.categoryIds.length ||
      f.categoryGroupId ||
      f.uncategorized ||
      f.payeeIds.length ||
      f.tagIds.length;
    f.datePreset = scoped || f.payeeName !== null ? 'all' : DEFAULT_FILTERS.datePreset;
  }
  return f;
}

/** The URL form of the filters (the inverse of filtersFromSearch) */
export function filtersToSearch(f: FilterState): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.datePreset === 'custom') {
    if (f.from) sp.set('from', f.from);
    if (f.to) sp.set('to', f.to);
  } else {
    sp.set('range', f.datePreset);
  }
  if (f.search) sp.set('search', f.search);
  if (f.accountIds.length) sp.set('account_ids', f.accountIds.join(','));
  if (f.categoryIds.length) sp.set('category_ids', f.categoryIds.join(','));
  if (f.payeeIds.length) sp.set('payee_ids', f.payeeIds.join(','));
  if (f.payeeName !== null) sp.set('payee_name', f.payeeName);
  if (f.direction !== 'all') sp.set('direction', f.direction);
  if (f.minAmount !== null) sp.set('min_amount', String(f.minAmount));
  if (f.maxAmount !== null) sp.set('max_amount', String(f.maxAmount));
  if (f.excludeTransfers) sp.set('transfers', 'exclude');
  if (f.tagIds.length) sp.set('tag_ids', f.tagIds.join(','));
  if (f.reviewed !== 'all') sp.set('reviewed', f.reviewed === 'yes' ? '1' : '0');
  if (f.hidden !== 'all') sp.set('hidden', f.hidden === 'yes' ? '1' : '0');
  if (f.budgetReport) sp.set('budget_report', '1');
  if (f.categoryGroupId) sp.set('category_group_id', f.categoryGroupId);
  if (f.uncategorized) sp.set('uncategorized', '1');
  return sp;
}

/** A link to All Transactions showing exactly this selection */
export function transactionsLink(f: Partial<FilterState>): string {
  return `/transactions?${filtersToSearch({ ...DEFAULT_FILTERS, ...f }).toString()}`;
}
