import { apiFetch } from './client';

// Login for server mode (Docker / self-hosted). The desktop app and `npm run dev`
// report `enabled: false` and never show a login screen.

export interface AuthStatus {
  enabled: boolean;
  needsSetup: boolean;
  authenticated: boolean;
  /** Multi-user mode (the gateway, docs/MULTI-USER-PLAN.md): people sign in by name */
  multiUser?: boolean;
  /** Password codes can be sent as Home Assistant notifications (the server runs as the HA app) */
  canNotify?: boolean;
  /** Single-user server: a forgotten password can be reset with a code from the server log */
  canRecover?: boolean;
  /** Multi-user: who is signed in */
  person?: { id: string; name: string; isAdmin: boolean; notifyService: string | null };
}

export const getAuthStatus = () => apiFetch<AuthStatus>('/auth/status');

/** `name` only in multi-user mode, where the person setting up becomes the administrator */
export const setupPassword = (password: string, setupCode: string, name?: string) =>
  apiFetch<void>('/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ password, setupCode, ...(name !== undefined && { name }) }),
  });

/** `name` only in multi-user mode */
export const login = (password: string, name?: string) =>
  apiFetch<void>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password, ...(name !== undefined && { name }) }),
  });

// Multi-user mode only
export const acceptInvite = (name: string, code: string, password: string) =>
  apiFetch<void>('/auth/accept-invite', {
    method: 'POST',
    body: JSON.stringify({ name, code, password }),
  });

export const forgotPassword = (name: string) =>
  apiFetch<{ message: string }>('/auth/forgot', { method: 'POST', body: JSON.stringify({ name }) });

export const resetPassword = (name: string, code: string, password: string) =>
  apiFetch<void>('/auth/reset', { method: 'POST', body: JSON.stringify({ name, code, password }) });

// Single-user server: the code is written to the server log (and a Home Assistant notification)
export const requestResetCode = () =>
  apiFetch<{ canNotify: boolean }>('/auth/forgot', { method: 'POST', body: '{}' });

export const resetWithCode = (code: string, password: string) =>
  apiFetch<void>('/auth/reset', { method: 'POST', body: JSON.stringify({ code, password }) });

export const logout = () => apiFetch<void>('/auth/logout', { method: 'POST' });

export const changePassword = (currentPassword: string, newPassword: string) =>
  apiFetch<void>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
