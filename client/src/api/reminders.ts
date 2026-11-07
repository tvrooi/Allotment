import { apiFetch } from './client';

// Bill and payday reminders (FINX-02): which Home Assistant notify service gets them, or behind
// the multi-user gateway (D2b) just on or off: the gateway sends them to the person's own phone
// or email. Each schedule chooses its own lead (`reminderDays`). Server: routes/reminders.ts.

export interface ReminderSettings {
  /** Whether this install can send them: a single-budget Home Assistant app, or behind the gateway */
  available: boolean;
  /** A budget behind the multi-user gateway: on or off, sent to its person (no service to name) */
  viaGateway: boolean;
  /** Reminders are on */
  enabled: boolean;
  /** The notify service without "notify."; null = off (always null behind the gateway) */
  service: string | null;
  /** The message names the bill and amount (a lock screen shows it) */
  showDetails: boolean;
}

export const getReminderSettings = () => apiFetch<ReminderSettings>('/reminders');

export const saveReminderSettings = (
  data:
    { service: string | null; showDetails: boolean } | { enabled: boolean; showDetails: boolean },
) => apiFetch<ReminderSettings>('/reminders', { method: 'PUT', body: JSON.stringify(data) });

export const sendTestReminder = () =>
  apiFetch<{ sent: boolean }>('/reminders/test', { method: 'POST', body: '{}' });
