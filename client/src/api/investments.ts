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
  /** Units no sale has taken */
  remaining: number;
}

/** Why a sale's gain can't be counted: units with no purchase, a cost not known, no exchange rate */
export type UnknownReason = 'no_lot' | 'no_cost' | 'no_rate';

/** What a sale's gain is missing, in words */
export const UNKNOWN_TEXT: Record<UnknownReason, string> = {
  no_lot: 'Some units have no purchase recorded',
  no_cost: "A purchase's cost isn't known",
  no_rate: 'No exchange rate on a purchase or sale date',
};

/** One lot's part of a sale; amounts in the budget's currency */
export interface SaleParcel {
  /** null: units no purchase covers */
  lotId: string | null;
  acquiredOn: string | null;
  quantity: number;
  proceeds: number | null;
  cost: number | null;
  gain: number | null;
  /** Held 12 months or more, so the 50% discount applies to a gain */
  discountable: boolean;
  unknown: UnknownReason | null;
}

/** A recorded sale (D3a). Proceeds, cost and gain are in the budget's currency */
export interface Sale {
  id: string;
  holdingId: string;
  soldOn: string;
  quantity: number;
  /** As entered, in the security's currency */
  grossProceeds: number;
  fees: number;
  notes: string | null;
  parcels: SaleParcel[];
  /** After sale brokerage; null without an exchange rate */
  proceeds: number | null;
  cost: number | null;
  gain: number | null;
  discountableGain: number;
  discount: 'all' | 'some' | 'none';
  unknown: UnknownReason | null;
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
  /** Newest first */
  sales: Sale[];
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

// ─── Sales (D3a) ──────────────────────────────────────────────────────────────

export interface SaleInput {
  soldOn: string;
  quantity: number;
  /** Gross proceeds and sale brokerage, in the security's currency */
  proceeds: number;
  fees: number;
  /** The purchases it drew from; omitted: first in, first out */
  parcels?: { lotId: string; quantity: number }[];
  notes?: string | null;
}

export interface SalePreview {
  parcels: SaleParcel[];
  proceeds: number | null;
  cost: number | null;
  gain: number | null;
  discountableGain: number;
  discount: Sale['discount'];
  unknown: UnknownReason | null;
  budgetCurrency: string | null;
  /** The holding's purchases, with what's left of each for this sale */
  lots: TaxLot[];
}

export const previewSale = (holdingId: string, data: SaleInput & { saleId?: string }) =>
  apiFetch<SalePreview>(`/investments/holdings/${holdingId}/sales/preview`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const recordSale = (holdingId: string, data: SaleInput) =>
  apiFetch(`/investments/holdings/${holdingId}/sales`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateSale = (holdingId: string, saleId: string, data: SaleInput) =>
  apiFetch(`/investments/holdings/${holdingId}/sales/${saleId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteSale = (holdingId: string, saleId: string) =>
  apiFetch<void>(`/investments/holdings/${holdingId}/sales/${saleId}`, { method: 'DELETE' });

/** Net capital losses from before Allotment, carried into a financial year (null or 0 clears) */
export const setCarriedLosses = (data: { financialYear: number | null; amount: number }) =>
  apiFetch<void>('/investments/carried-losses', { method: 'PUT', body: JSON.stringify(data) });
