import { apiFetch } from './client';
import type { BudgetGroup, BudgetSummary } from '../types';

export const getBudget = (month: string) => apiFetch<BudgetGroup[]>(`/budget/${month}`);

export const getBudgetSummary = (month: string) =>
  apiFetch<BudgetSummary>(`/budget/${month}/summary`);

export const setBudget = (month: string, categoryId: string, budgeted: number, revision?: string) =>
  apiFetch<{
    month: string;
    categoryId: string;
    budgeted: number;
    previousBudgeted: number;
    revision: string;
  }>(`/budget/${month}/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify({ budgeted, revision }),
  });

export interface CategoryHistory {
  categoryId: string;
  isIncome: boolean;
  lastMonth: number;
  average: number;
  history: { month: string; amount: number }[];
}

export const getCategoryHistory = (categoryId: string, currentMonth?: string, months?: number) => {
  const params = new URLSearchParams();
  if (currentMonth) params.set('currentMonth', currentMonth);
  if (months) params.set('months', String(months));
  const qs = params.toString();
  return apiFetch<CategoryHistory>(`/budget/category/${categoryId}/history${qs ? `?${qs}` : ''}`);
};

export interface BulkPreview {
  categoryId: string;
  budgeted: number;
  months: { month: string; current: number; next: number }[];
}
export const getBulkPreview = (categoryId: string, budgeted: number, fromMonth: string) =>
  apiFetch<BulkPreview>(
    `/budget/category/${categoryId}/bulk-preview?budgeted=${budgeted}&fromMonth=${fromMonth}`,
  );
/** `expected` is the reviewed preview: existing assignments change only as shown there. */
export const setBudgetBulk = (
  categoryId: string,
  budgeted: number,
  fromMonth: string,
  expected: Record<string, number>,
) =>
  apiFetch<{ categoryId: string; budgeted: number; months: string[] }>(
    `/budget/category/${categoryId}/bulk`,
    { method: 'PUT', body: JSON.stringify({ budgeted, fromMonth, expected }) },
  );

export type TargetInput =
  | { type: 'monthly' | 'refill'; amount: number }
  | { type: 'by-date'; amount: number; dueDate: string }
  | { type: 'recurring'; amount: number; dueDate: string; cycleMonths: number };
export const saveTarget = (categoryId: string, target: TargetInput) =>
  apiFetch(`/budget/category/${categoryId}/target`, {
    method: 'PUT',
    body: JSON.stringify(target),
  });
export const deleteTarget = (categoryId: string) =>
  apiFetch(`/budget/category/${categoryId}/target`, { method: 'DELETE' });

export interface TargetFundingPreview {
  month: string;
  complete: boolean;
  available: number;
  total: number;
  shortfall: number;
  revision: string;
  rows: {
    categoryId: string;
    name: string;
    underfunded: number;
    proposed: number;
    shortfall: number;
  }[];
}
export const previewTargetFunding = (month: string) =>
  apiFetch<TargetFundingPreview>(`/budget/${month}/targets/preview`, { method: 'POST' });
export const applyTargetFunding = (preview: TargetFundingPreview) =>
  apiFetch<{ applied: number }>(`/budget/${preview.month}/targets/apply`, {
    method: 'POST',
    body: JSON.stringify({
      revision: preview.revision,
      rows: preview.rows.map((r) => ({ categoryId: r.categoryId, proposed: r.proposed })),
    }),
  });

export interface CardPosition {
  accountId: string;
  categoryId: string;
  name: string;
  startDate: string;
  debt: number;
  prepaid: number;
  available: number;
  shortfall: number;
  uncoveredPayments: number;
  excessFunding: number;
  fundedPurchases: number;
}
export interface CardSetupPreview {
  accountId: string;
  initialFunding: number;
  revision: string;
  asOf: string;
  beforeUnassigned: number;
  unassigned: number;
  resources: number;
  card: CardPosition;
}
export const getCardFunding = () =>
  apiFetch<{
    asOf: string;
    accounts: { id: string; name: string; configured: boolean }[];
    cards: CardPosition[];
  }>('/budget/card-funding/accounts');
export const previewCardSetup = (accountId: string, initialFunding: number) =>
  apiFetch<CardSetupPreview>(`/budget/card-funding/${accountId}/preview`, {
    method: 'POST',
    body: JSON.stringify({ initialFunding }),
  });
export const applyCardSetup = (preview: CardSetupPreview) =>
  apiFetch(`/budget/card-funding/${preview.accountId}/apply`, {
    method: 'POST',
    body: JSON.stringify(preview),
  });

export interface CardFundingPreview {
  categoryId: string;
  budgeted: number;
  revision: string;
  available: number;
  shortfall: number;
  unassigned: number;
}
export const previewCardAssignment = (accountId: string, month: string, amount: number) =>
  apiFetch<CardFundingPreview>(`/budget/card-funding/${accountId}/funding-preview`, {
    method: 'POST',
    body: JSON.stringify({ month, amount }),
  });

/** The annual overview (server: services/annualOverview.ts). Balances are never summed. */
export interface AnnualOverview {
  year: number;
  asOf: string;
  /** The month whose closing balances are shown; null before the year starts */
  balanceMonth: string | null;
  months: { month: string; planned: boolean; assigned: number; activity: number; income: number }[];
  groups: {
    id: string;
    name: string;
    isIncome: boolean;
    categories: {
      id: string;
      name: string;
      months: { month: string; planned: boolean; assigned: number; activity: number }[];
      assigned: number;
      activity: number;
      available: number | null;
    }[];
  }[];
  totals: { assigned: number; activity: number; income: number; plannedAssigned: number };
  today: {
    complete: boolean;
    available: number;
    unassigned: number;
    futureAssigned: number;
    cards: { accountId: string; name: string; debt: number; reserve: number; shortfall: number }[];
    paymentShortfall: number;
  };
}

export const getAnnualOverview = (year: number) => apiFetch<AnnualOverview>(`/budget/year/${year}`);
