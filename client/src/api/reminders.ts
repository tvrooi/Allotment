import { apiFetch } from './client';

// Bill and payday reminders (FINX-02): which Home Assistant notify service gets them. Each
// schedule chooses its own lead (`reminderDays`). Server: routes/reminders.ts.

export interface ReminderSettings {
  /** Whether this install can send them: Allotment running as a single-budget Home Assistant app */
  available: boolean;
  /** The notify service without "notify."; null = reminders are off */
  service: string | null;
  /** The message names the bill and amount (a lock screen shows it) */
  showDetails: boolean;
}

export const getReminderSettings = () => apiFetch<ReminderSettings>('/reminders');

export const saveReminderSettings = (data: { service: string | null; showDetails: boolean }) =>
  apiFetch<ReminderSettings>('/reminders', { method: 'PUT', body: JSON.stringify(data) });

export const sendTestReminder = () =>
  apiFetch<{ sent: boolean }>('/reminders/test', { method: 'POST', body: '{}' });
