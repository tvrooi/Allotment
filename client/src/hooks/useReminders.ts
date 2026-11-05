import { useQuery } from '@tanstack/react-query';
import { getReminderSettings } from '../api/reminders';

export const REMINDERS_QUERY_KEY = ['reminder-settings'];

/** Whether bill reminders can be sent from here, and to which notify service (FINX-02) */
export function useReminderSettings() {
  return useQuery({ queryKey: REMINDERS_QUERY_KEY, queryFn: getReminderSettings, retry: false });
}
