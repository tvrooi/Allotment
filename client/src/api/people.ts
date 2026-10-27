import { apiFetch } from './client';

// Multi-user mode (docs/MULTI-USER-PLAN.md): the people who have a budget on this server.
// Listing and managing them is for the administrator; each person sets their own phone.

export interface PersonSummary {
  id: string;
  name: string;
  isAdmin: boolean;
  disabled: boolean;
  hasPassword: boolean;
  notifyService: string | null;
  running: boolean;
}

export const getPeople = () => apiFetch<PersonSummary[]>('/people');

export const addPerson = (name: string) =>
  apiFetch<{ person: PersonSummary; inviteCode: string }>('/people', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const newInvite = (id: string) =>
  apiFetch<{ inviteCode: string }>(`/people/${encodeURIComponent(id)}/invite`, { method: 'POST' });

/** The code goes to the app's Log, never to this page */
export const resetCodeToLog = (id: string) =>
  apiFetch<void>(`/people/${encodeURIComponent(id)}/reset-code`, { method: 'POST' });

export const setPersonDisabled = (id: string, disabled: boolean) =>
  apiFetch<PersonSummary>(`/people/${encodeURIComponent(id)}/${disabled ? 'disable' : 'enable'}`, {
    method: 'POST',
  });

export const setMyNotifyService = (service: string | null) =>
  apiFetch<{ notifyService: string | null }>('/people/me/notify', {
    method: 'PUT',
    body: JSON.stringify({ service }),
  });

export const testMyNotifyService = () =>
  apiFetch<void>('/people/me/notify/test', { method: 'POST' });
