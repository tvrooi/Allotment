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

/** Sets an undone change set's categories again (the owner only) */
export const redoChangeSet = (id: string) =>
  apiFetch<{ reapplied: number; skipped: string[] }>(`/change-sets/${id}/redo`, {
    method: 'POST',
  });

/** Audit decision I-11: each write an access token made, newest first (owner only) */
export interface AssistantAction {
  id: string;
  tokenName: string;
  action: string;
  label: string;
  method: string;
  path: string;
  detail: string | null;
  status: number | null;
  createdAt: string;
}
export const getAssistantLog = () => apiFetch<AssistantAction[]>('/assistant/log?limit=100');

/** A change an assistant proposed that only the owner applies */
export interface AssistantProposal {
  id: string;
  tokenName: string;
  kind: 'asset.create' | 'asset.update';
  targetId: string | null;
  payload: Record<string, unknown>;
  note: string | null;
  status: 'pending' | 'applied' | 'declined';
  error: string | null;
  createdAt: string;
}
export const getAssistantProposals = () => apiFetch<AssistantProposal[]>('/assistant/proposals');
export const applyAssistantProposal = (id: string) =>
  apiFetch<AssistantProposal>(`/assistant/proposals/${id}/apply`, { method: 'POST' });
export const declineAssistantProposal = (id: string) =>
  apiFetch<AssistantProposal>(`/assistant/proposals/${id}/decline`, { method: 'POST' });
