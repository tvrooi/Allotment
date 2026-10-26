import { apiFetch } from './client';

// Read-only access tokens (server: routes/accessTokens.ts, docs/READ-ONLY-ACCESS.md).
// 'categorise' tokens can also set the category of past transactions and edit categories;
// 'organise' tokens can also propose rules, set payee defaults and link suggested transfers.

export type AccessTokenScope = 'read' | 'categorise' | 'organise';

export interface AccessToken {
  id: string;
  name: string;
  scope: AccessTokenScope;
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
  scope: AccessTokenScope;
  expiresAt: string;
  token: string;
}

export const getAccessTokens = () => apiFetch<AccessToken[]>('/access-tokens');

export const createAccessToken = (data: { name: string; days: number; scope: AccessTokenScope }) =>
  apiFetch<CreatedAccessToken>('/access-tokens', { method: 'POST', body: JSON.stringify(data) });

export const revokeAccessToken = (id: string) =>
  apiFetch<void>(`/access-tokens/${id}`, { method: 'DELETE' });

/** Category changes a token made in one tool call (server: routes/changeSets.ts) */
export interface ChangeSet {
  id: string;
  tokenId: string | null;
  tokenName: string;
  tool: string;
  summary: string;
  createdAt: string;
  undoneAt: string | null;
  transactionCount: number;
}

export const getChangeSets = () => apiFetch<ChangeSet[]>('/change-sets');

export const undoChangeSet = (id: string) =>
  apiFetch<{ restored: number; skipped: string[] }>(`/change-sets/${id}/undo`, {
    method: 'POST',
  });
