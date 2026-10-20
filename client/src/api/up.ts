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
