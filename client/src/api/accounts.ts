import { apiFetch } from './client';
import type { Account, AccountType } from '../types';
import type { ImportSettings } from '../utils/csv';

export const getAccounts = () => apiFetch<Account[]>('/accounts');
export const getAllAccounts = () => apiFetch<Account[]>('/accounts?include_closed=1');
export interface ReconciliationSnapshot {
  account: Account;
  transactions: import('../types').Transaction[];
  reconciledBase: number;
  revision: string;
  date: string;
}
export const getReconciliation = (id: string) =>
  apiFetch<ReconciliationSnapshot>(`/accounts/${id}/reconcile`);
export const saveReconciliation = (
  id: string,
  data: {
    transactionIds: string[];
    statementBalance: number;
    expectedBalance: number;
    revision: string;
    createAdjustment: boolean;
  },
) =>
  apiFetch<{ reconciled: number; adjustment: number }>(`/accounts/${id}/reconcile`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export interface LastReconciliation {
  id: string;
  createdAt: string;
  /** Rows it locked, not counting its adjustment */
  transactions: number;
  /** Amount of the adjustment it created (0 = none) */
  adjustment: number;
}
export interface ReconciliationUndo {
  unlocked: number;
  /** Rows it locked that were unlocked, moved or deleted since, so were left alone */
  alreadyChanged: number;
  adjustment: 'removed' | 'kept' | 'none';
  adjustmentAmount: number;
}
export const getLastReconciliation = (id: string) =>
  apiFetch<LastReconciliation | null>(`/accounts/${id}/reconcile/last`);
export const undoLastReconciliation = (id: string) =>
  apiFetch<ReconciliationUndo>(`/accounts/${id}/reconcile/undo`, { method: 'POST', body: '{}' });

export const createAccount = (data: {
  name: string;
  type: AccountType;
  startingBalance: number;
  isOffBudget?: number;
  /** ISO 4217; left out = the budget's */
  currency?: string | null;
  /** The day `startingBalance` is the account's balance ("as of today"): imports of older rows keep it */
  balanceAsOf?: string;
}) => apiFetch<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) });

export const updateAccount = (
  id: string,
  data: Partial<{
    name: string;
    type: AccountType;
    startingBalance: number;
    isOffBudget: number;
    logo: string | null;
    closedAt: null;
    currency: string | null;
  }>,
) => apiFetch<Account>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const closeAccount = (id: string) => apiFetch<void>(`/accounts/${id}`, { method: 'DELETE' });

export interface AccountDeletionPreview {
  name: string;
  transactions: number;
  reconciled: number;
  /** Why it can't be deleted yet, in words that say what to do */
  blockers: string[];
}
export const getAccountDeletion = (id: string) =>
  apiFetch<AccountDeletionPreview>(`/accounts/${id}/deletion`);
/** Deletes the account and all its transactions for good; `confirmName` must be its exact name */
export const deleteAccountPermanently = (id: string, confirmName: string) =>
  apiFetch<{ deleted: number; name: string }>(`/accounts/${id}/delete-permanently`, {
    method: 'POST',
    body: JSON.stringify({ confirmName }),
  });

export const reorderAccounts = (ids: string[]) =>
  apiFetch<{ ok: boolean }>('/accounts/reorder', { method: 'PUT', body: JSON.stringify({ ids }) });

export const getBalancesAgo = () => apiFetch<Record<string, number>>('/accounts/balances-ago');

/**
 * How this account's bank writes CSV files, from the last import, and the account number of the
 * last bank statement imported into it (null before the first)
 */
export const getImportSettings = (id: string) =>
  apiFetch<{ settings: ImportSettings | null; statementAccount: string | null }>(
    `/accounts/${id}/import-settings`,
  );

export const saveImportSettings = (id: string, settings: ImportSettings) =>
  apiFetch<{ settings: ImportSettings }>(`/accounts/${id}/import-settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

export const saveStatementAccount = (id: string, account: string) =>
  apiFetch<{ statementAccount: string }>(`/accounts/${id}/statement-account`, {
    method: 'PUT',
    body: JSON.stringify({ account }),
  });

/** Bank-synced accounts: the bank's settled balance against the register (server: GET /accounts/sync-status) */
export interface AccountSyncStatus {
  accountId: string;
  bankBalance: number | null;
  registerBalance: number;
  difference: number | null;
  verdict: 'unknown' | 'matches' | 'round-ups' | 'unexplained';
}
export const getAccountSyncStatus = () => apiFetch<AccountSyncStatus[]>('/accounts/sync-status');
