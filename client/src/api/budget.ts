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

export const setBudgetBulk = (categoryId: string, budgeted: number, fromMonth: string) =>
  apiFetch<{ categoryId: string; budgeted: number; months: string[] }>(
    `/budget/category/${categoryId}/bulk`,
    { method: 'PUT', body: JSON.stringify({ budgeted, fromMonth }) },
  );

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
