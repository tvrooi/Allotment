import { apiFetch } from './client';

// Household sharing (server: routes/households.ts, docs/HOUSEHOLDS.md): pool accounts, the
// default split quick sharing uses, sharing payments in one step, and repayment suggestions.

export interface HouseholdSplit {
  mode: 'equal' | 'percentage' | 'weight';
  shares: { personId: string; value: number }[];
}

export interface HouseholdSummary {
  id: string;
  name: string;
  currency: string;
  accountId: string | null;
  poolAccountIds: string[];
  defaultSplit: HouseholdSplit | null;
}

export interface RepaymentSuggestion {
  transactionId: string;
  date: string;
  amount: number;
  payeeName: string | null;
  notes: string | null;
  personId: string;
  personName: string;
  owes: number;
}

export interface ShareResult {
  shared: number;
  results: { transactionId: string; ok: boolean; eventId?: string; error?: string }[];
}

export const getHouseholds = () => apiFetch<HouseholdSummary[]>('/households');

export const addPoolAccount = (groupId: string, accountId: string) =>
  apiFetch<unknown>(`/households/${groupId}/pool-accounts`, {
    method: 'POST',
    body: JSON.stringify({ accountId }),
  });
export const removePoolAccount = (groupId: string, accountId: string) =>
  apiFetch<unknown>(`/households/${groupId}/pool-accounts/${accountId}`, { method: 'DELETE' });

export const setDefaultSplit = (groupId: string, split: HouseholdSplit | null) =>
  apiFetch<unknown>(`/households/${groupId}/default-split`, {
    method: 'PUT',
    body: JSON.stringify(split ?? {}),
  });

export const shareTransactions = (groupId: string, transactionIds: string[]) =>
  apiFetch<ShareResult>(`/households/${groupId}/share`, {
    method: 'POST',
    body: JSON.stringify({ transactionIds }),
  });

export const getRepaymentSuggestions = (groupId: string) =>
  apiFetch<RepaymentSuggestion[]>(`/households/${groupId}/repayment-suggestions`);

export const recordRepayment = (groupId: string, s: RepaymentSuggestion, selfId: string) =>
  apiFetch<unknown>(`/households/${groupId}/events`, {
    method: 'POST',
    body: JSON.stringify({
      kind: 'settlement',
      date: s.date,
      description: `Repayment from ${s.personName}`,
      amount: s.amount,
      payerId: s.personId,
      recipientId: selfId,
      transactionId: s.transactionId,
    }),
  });

/** Removes one household entry (undoing a share) */
export const removeHouseholdEvent = (groupId: string, eventId: string) =>
  apiFetch<unknown>(`/households/${groupId}/events/${eventId}`, { method: 'DELETE' });
