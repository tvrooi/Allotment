import { apiFetch } from './client';

export interface UpDiscoveredAccount {
  upAccountId: string;
  name: string;
  accountType: 'SAVER' | 'TRANSACTIONAL' | 'HOME_LOAN';
  balance: number;
  accountId: string | null;
  isEnabled: number;
}
export interface UpConnection {
  id: string;
  syncStatus: 'good' | 'syncing' | 'error';
  syncError: string | null;
  lastSyncedAt: string | null;
  pollIntervalMinutes: number;
  lastAttemptAt: string | null;
  lastCompletedAt: string | null;
  nextSyncAt: string | null;
  accounts: (Omit<UpDiscoveredAccount, 'balance'> & {
    accountName: string | null;
    cutoverDate?: string | null;
    cutoverDifference?: number | null;
  })[];
}
export interface UpMappingChoice {
  upAccountId: string;
  action: 'create' | 'link' | 'skip';
  accountId?: string;
  accountName?: string;
  /** Linking an account that already has history: Up's transactions from this day on are imported */
  cutoverDate?: string;
}
export interface UpSyncResult {
  added: number;
  skipped: number;
  /** Why the sync failed */
  errors: string[];
  /** To review, though the import succeeded (a register that differs from Up's balance) */
  notices?: string[];
}
export const getUpConnection = () => apiFetch<UpConnection | null>('/up/connection');
export const setupUp = (accessToken: string) =>
  apiFetch<{ accounts: UpDiscoveredAccount[] }>('/up/setup', {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  });
export const mapUpAccounts = (mappings: UpMappingChoice[]) =>
  apiFetch<{ mapped: number }>('/up/map-accounts', {
    method: 'POST',
    body: JSON.stringify({ mappings }),
  });
export const syncUp = () => apiFetch<UpSyncResult>('/up/sync', { method: 'POST' });
export const disconnectUp = () => apiFetch<void>('/up/connection', { method: 'DELETE' });

export const setUpPolling = (pollIntervalMinutes: number) =>
  apiFetch('/up/settings', { method: 'PATCH', body: JSON.stringify({ pollIntervalMinutes }) });
interface UpObservation {
  status: 'HELD' | 'SETTLED';
  amount: number;
  createdAt: string;
  settledAt: string | null;
  description: string;
  notes: string;
  roundUpAmount: number | null;
  boostAmount: number | null;
  cashbackAmount: number | null;
  cashbackDescription: string | null;
  transferAccountId: string | null;
  transferAccountName: string | null;
}
export interface UpReviewItem {
  importedId: string;
  accountId: string;
  accountName: string;
  transactionId: string | null;
  reviewState: string;
  revision: number;
  current: UpObservation;
  previous: UpObservation | null;
  /** reviewState 'overlap': the older row this import may duplicate (null once it's gone) */
  overlap?: {
    id: string;
    date: string;
    amount: number;
    payee: string | null;
    reconciled: boolean;
  } | null;
}
export const getUpReview = (offset: number) =>
  apiFetch<{ total: number; pending: number; items: UpReviewItem[] }>(
    `/up/review?offset=${offset}`,
  );
export const acknowledgeUpReview = (importedId: string, revision: number) =>
  apiFetch('/up/review/acknowledge', {
    method: 'POST',
    body: JSON.stringify({ importedId, revision }),
  });
export const deleteUpOverlapOld = (importedId: string, revision: number) =>
  apiFetch('/up/review/overlap/delete-old', {
    method: 'POST',
    body: JSON.stringify({ importedId, revision }),
  });
export const getUpRoundUps = () =>
  apiFetch<{
    since: string;
    days: {
      date: string;
      accountId: string;
      accountName: string;
      amount: number;
      boost: number;
      purchases: {
        transactionId: string | null;
        description: string;
        amount: number;
        roundUpAmount: number;
      }[];
    }[];
  }>('/up/round-ups');
export interface UpRoundUpCheck {
  accountId: string;
  accountName: string;
  settledBalance: number | null;
  register: number;
  difference: number | null;
  missing: { count: number; total: number };
  verdict: 'unknown' | 'matches' | 'round-ups' | 'unexplained';
  enabledAt: string | null;
}
export const getUpRoundUpCheck = () => apiFetch<UpRoundUpCheck[]>('/up/round-up-check');
export const enableUpRoundUpDebits = (accountId: string, count: number, total: number) =>
  apiFetch<{ added: number; enabledAt: string }>('/up/round-up-debits', {
    method: 'POST',
    body: JSON.stringify({ accountId, count, total }),
  });
export const disableUpRoundUpDebits = (accountId: string) =>
  apiFetch(`/up/round-up-debits/${encodeURIComponent(accountId)}`, { method: 'DELETE' });
