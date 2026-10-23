import { apiFetch } from './client';

// P3 investments (server: routes/investments.ts). Quantities are millionths of a unit; amounts
// are minor units of the security's currency unless named otherwise.

export const SECURITY_KINDS = ['stock', 'etf', 'fund', 'bond', 'crypto', 'other'] as const;
export type SecurityKind = (typeof SECURITY_KINDS)[number];

export type BasisStatus = 'complete' | 'partial' | 'missing' | 'mismatch';

export interface Security {
  id: string;
  symbol: string;
  name: string;
  kind: SecurityKind;
  currency: string;
  createdAt: string;
}

export interface SecuritySummary extends Security {
  latestPrice: number | null;
  latestPriceDate: string | null;
  holdingCount: number;
}

export interface TaxLot {
  id: string;
  acquiredOn: string;
  quantity: number;
  /** Total cost of the lot; null = not known */
  costBasis: number | null;
}

export interface Holding {
  id: string;
  accountId: string;
  quantity: number;
  notes: string | null;
  updatedAt: string;
  security: Security;
  lots: TaxLot[];
  price: number | null;
  priceDate: string | null;
  priceStale: boolean;
  value: number | null;
  lotQuantity: number;
  knownBasisQuantity: number;
  knownBasis: number;
  basisStatus: BasisStatus;
  costBasis: number | null;
  unrealizedGain: number | null;
  gainPercent: number | null;
  /** The value in the account's currency */
  accountValue: number | null;
}

export interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  currency: string | null;
  recordedBalance: number;
  holdingsValue: number | null;
  difference: number | null;
  holdings: Holding[];
}

export interface InvestmentOverview {
  asOf: string;
  budgetCurrency: string | null;
  accounts: InvestmentAccount[];
  securities: SecuritySummary[];
  totals: {
    value: number;
    unvalued: number;
    costBasis: number;
    unrealizedGain: number;
    withoutBasis: number;
  };
}

export const getInvestments = () => apiFetch<InvestmentOverview>('/investments');

export interface SecurityInput {
  symbol: string;
  name: string;
  kind: SecurityKind;
  currency: string;
}

export const createSecurity = (data: SecurityInput) =>
  apiFetch<Security>('/investments/securities', { method: 'POST', body: JSON.stringify(data) });

export const updateSecurity = (id: string, data: Partial<SecurityInput>) =>
  apiFetch<Security>(`/investments/securities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteSecurity = (id: string) =>
  apiFetch<void>(`/investments/securities/${id}`, { method: 'DELETE' });

export const getPrices = (securityId: string) =>
  apiFetch<{ date: string; price: number }[]>(`/investments/securities/${securityId}/prices`);

export const setPrice = (securityId: string, data: { date: string; price: number }) =>
  apiFetch<{ date: string; price: number }>(`/investments/securities/${securityId}/prices`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deletePrice = (securityId: string, date: string) =>
  apiFetch<void>(`/investments/securities/${securityId}/prices/${date}`, { method: 'DELETE' });

export const createHolding = (data: {
  accountId: string;
  securityId: string;
  quantity: number;
  notes?: string | null;
}) => apiFetch('/investments/holdings', { method: 'POST', body: JSON.stringify(data) });

export const updateHolding = (id: string, data: { quantity?: number; notes?: string | null }) =>
  apiFetch(`/investments/holdings/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteHolding = (id: string) =>
  apiFetch<void>(`/investments/holdings/${id}`, { method: 'DELETE' });

export interface LotInput {
  acquiredOn: string;
  quantity: number;
  costBasis: number | null;
}

export const addLot = (holdingId: string, data: LotInput) =>
  apiFetch<TaxLot>(`/investments/holdings/${holdingId}/lots`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateLot = (id: string, data: Partial<LotInput>) =>
  apiFetch<TaxLot>(`/investments/lots/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteLot = (id: string) =>
  apiFetch<void>(`/investments/lots/${id}`, { method: 'DELETE' });
