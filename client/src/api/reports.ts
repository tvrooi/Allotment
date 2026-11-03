import { apiFetch } from './client';
import type {
  NetWorthPoint,
  IncomeExpensesPoint,
  SpendingByCategory,
  IncomeByCategoryItem,
  SpendingTrendPoint,
  SpendingComparisonData,
  DailyFlowPoint,
} from '../types';

const toQueryString = (from: string, to: string) => `?from=${from}&to=${to}`;

export const getNetWorth = (from: string, to: string, granularity?: 'daily' | 'monthly') =>
  apiFetch<NetWorthPoint[]>(
    `/reports/net-worth${toQueryString(from, to)}${granularity ? `&granularity=${granularity}` : ''}`,
  );

export const getIncomeVsExpenses = (from: string, to: string) =>
  apiFetch<IncomeExpensesPoint[]>(`/reports/income-vs-expenses${toQueryString(from, to)}`);

export const getSpendingByCategory = (from: string, to: string) =>
  apiFetch<SpendingByCategory[]>(`/reports/spending-by-category${toQueryString(from, to)}`);

/** Spending by merchant (payee); `net` is negative for money spent, positive for net refunds */
export interface SpendingByPayee {
  payeeId: string | null;
  /** '' when the rows have no payee */
  payeeName: string;
  net: number;
  count: number;
}

export const getSpendingByPayee = (from: string, to: string) =>
  apiFetch<SpendingByPayee[]>(`/reports/spending-by-payee${toQueryString(from, to)}`);

export const getIncomeByCategory = (from: string, to: string) =>
  apiFetch<IncomeByCategoryItem[]>(`/reports/income-by-category${toQueryString(from, to)}`);

/** `daily` puts the date (yyyy-MM-dd) in each point's `month`. */
export const getSpendingTrends = (
  categoryIds: string[],
  from: string,
  to: string,
  granularity?: 'daily' | 'monthly',
) =>
  apiFetch<SpendingTrendPoint[]>(
    `/reports/spending-trends?category_ids=${categoryIds.join(',')}&from=${from}&to=${to}${granularity ? `&granularity=${granularity}` : ''}`,
  );

export const getSpendingComparison = (mode: string) =>
  apiFetch<SpendingComparisonData>(`/reports/spending-comparison?mode=${mode}`);

export const getDailyFlow = (from: string, to: string) =>
  apiFetch<DailyFlowPoint[]>(`/reports/daily-flow${toQueryString(from, to)}`);

/** Spending and money in over a window, split by whether it has a category */
export interface UncategorisedSummary {
  spending: number;
  uncategorisedSpending: number;
  uncategorisedSpendingCount: number;
  uncategorisedIncome: number;
  uncategorisedIncomeCount: number;
  categorisedIncome: number;
  /** uncategorisedSpending / spending, 0 to 1 */
  share: number;
}
export const getUncategorisedSummary = (from: string, to: string) =>
  apiFetch<UncategorisedSummary>(`/reports/uncategorised-summary${toQueryString(from, to)}`);

/** Uncategorised transactions grouped by payee, biggest groups first */
export interface UncategorisedPayee {
  payeeId: string | null;
  payeeName: string;
  count: number;
  moneyIn: number;
  moneyOut: number;
  net: number;
  firstDate: string;
  lastDate: string;
  sampleNotes: string[];
}
export const getUncategorisedPayees = (limit = 200) =>
  apiFetch<{ payeeCount: number; transactionCount: number; payees: UncategorisedPayee[] }>(
    `/reports/uncategorised-payees?limit=${limit}`,
  );

/** A repeating pay deposit found in the register, for the owner to confirm */
export interface SalaryGuess {
  payeeId: string;
  payeeName: string;
  schedule: 'weekly' | 'fortnightly' | 'monthly';
  /** 7 or 14; null for monthly pay */
  intervalDays: number | null;
  latestDate: string;
  latestAmount: number;
  occurrences: number;
  uncategorisedCount: number;
  categoryId: string | null;
  categoryName: string | null;
}
export const getSalaryGuess = () => apiFetch<SalaryGuess | null>('/reports/salary');
