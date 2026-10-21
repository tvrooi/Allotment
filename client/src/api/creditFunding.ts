import { apiFetch } from './client';
export interface CardFunding {
  debt: number;
  reserved: number;
  shortfall: number;
  creditBalance: number;
  assigned: number;
  unlinkedInflows: number;
  pendingTransfers: number;
}
export interface CardContext {
  today: string;
  asOf: string;
  unassigned: number;
  complete: boolean;
  revision: string;
  cards: {
    accountId: string;
    name: string;
    closed: boolean;
    enabledFrom: string | null;
    funding: CardFunding | null;
  }[];
  history: { id: string; accountId: string; date: string; amount: number }[];
}
export interface SetupPreview {
  accountId: string;
  name: string;
  enabledFrom: string;
  revision: string;
  beforeUnassigned: number;
  afterUnassigned: number;
  debt: number;
  reserved: number;
  shortfall: number;
  creditBalance: number;
  note: string;
}
export interface FundingPreview {
  accountId: string;
  name: string;
  date: string;
  amount: number;
  revision: string;
  reservedBefore: number;
  reservedAfter: number;
  shortfallAfter: number;
  unassignedAfter: number;
}
export const getCards = (month: string) => apiFetch<CardContext>(`/budget/cards?month=${month}`);
export const previewSetup = (id: string) =>
  apiFetch<SetupPreview>(`/budget/cards/${id}/setup/preview`, { method: 'POST', body: '{}' });
export const applySetup = (id: string, revision: string) =>
  apiFetch(`/budget/cards/${id}/setup/apply`, {
    method: 'POST',
    body: JSON.stringify({ revision }),
  });
export const previewFunding = (id: string, amount: number) =>
  apiFetch<FundingPreview>(`/budget/cards/${id}/funding/preview`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
export const applyFunding = (id: string, amount: number, revision: string) =>
  apiFetch(`/budget/cards/${id}/funding/apply`, {
    method: 'POST',
    body: JSON.stringify({ amount, revision }),
  });
