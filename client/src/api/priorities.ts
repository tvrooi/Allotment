import { apiFetch } from './client';

// The optional financial priorities profile (phase 7A). Labels and preferences only.
export type CategoryPurpose = 'essential' | 'enjoyment' | 'flexibility';
export type ReviewCadence = 'payday' | 'monthly' | 'quarterly' | 'off';
export interface Priorities {
  revision: number;
  purpose: string | null;
  essentialMonthlyAmount: number | null;
  reserveTarget: { type: 'amount'; amount: number } | { type: 'months'; months: number } | null;
  reserveMinimum: number | null;
  reviewCadence: ReviewCadence;
  reminderSnoozedUntil: string | null;
  updatedAt: string | null;
  purposes: { categoryId: string; purpose: CategoryPurpose }[];
}
export type PrioritiesInput = Omit<Priorities, 'reminderSnoozedUntil' | 'updatedAt'>;

export const getPriorities = () => apiFetch<Priorities>('/priorities');
export const savePriorities = (input: PrioritiesInput) =>
  apiFetch<Priorities>('/priorities', { method: 'PUT', body: JSON.stringify(input) });
