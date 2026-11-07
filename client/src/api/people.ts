import type { CodeChannel, CodeDestinations, Destination } from './auth';
import { apiFetch } from './client';

// Multi-user mode (docs/MULTI-USER-PLAN.md): the people who have a budget on this server.
// Listing and managing them is for the administrator; each person sets where their own codes go.

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

/** Sends a code to a new phone (notify service) or email address; nothing is saved yet */
export const addDestination = (destination: Destination, value: string) =>
  apiFetch<CodeDestinations & { pending: boolean }>(`/people/me/${destination}`, {
    method: 'POST',
    body: JSON.stringify(destination === 'phone' ? { service: value } : { email: value }),
  });

/** Saves the phone or address once its code comes back */
export const confirmDestination = (destination: Destination, code: string) =>
  apiFetch<CodeDestinations>(`/people/me/${destination}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

export const removeDestination = (destination: Destination) =>
  apiFetch<CodeDestinations>(`/people/me/${destination}`, { method: 'DELETE' });

export const setCodeChannel = (channel: CodeChannel) =>
  apiFetch<CodeDestinations>('/people/me/code-channel', {
    method: 'PUT',
    body: JSON.stringify({ channel }),
  });
