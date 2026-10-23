import { apiFetch } from './client';

// Read-only access tokens (server: routes/accessTokens.ts, docs/READ-ONLY-ACCESS.md)

export interface AccessToken {
  id: string;
  name: string;
  scope: 'read';
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  active: boolean;
}

/** A new token: the only time `token` is ever shown */
export interface CreatedAccessToken {
  id: string;
  name: string;
  expiresAt: string;
  token: string;
}

export const getAccessTokens = () => apiFetch<AccessToken[]>('/access-tokens');

export const createAccessToken = (data: { name: string; days: number }) =>
  apiFetch<CreatedAccessToken>('/access-tokens', { method: 'POST', body: JSON.stringify(data) });

export const revokeAccessToken = (id: string) =>
  apiFetch<void>(`/access-tokens/${id}`, { method: 'DELETE' });
