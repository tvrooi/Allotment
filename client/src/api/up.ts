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
  accounts: (Omit<UpDiscoveredAccount, 'balance'> & { accountName: string | null })[];
}
export interface UpMappingChoice {
  upAccountId: string;
  action: 'create' | 'link' | 'skip';
  accountId?: string;
  accountName?: string;
}
export interface UpSyncResult {
  added: number;
  skipped: number;
  errors: string[];
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
