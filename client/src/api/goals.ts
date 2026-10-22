import { apiFetch } from './client';
import type { Goal, GoalStatus } from '../types';

export const getGoals = () => apiFetch<Goal[]>('/goals');

export const createGoal = (data: {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
  icon?: string;
  color?: string;
}) => apiFetch<Goal>('/goals', { method: 'POST', body: JSON.stringify(data) });

export const updateGoal = (
  id: string,
  data: Partial<{
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate: string | null;
    accountId: string | null;
    categoryId: string | null;
    icon: string;
    color: string;
  }>,
) => apiFetch<Goal>(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteGoal = (id: string) => apiFetch<void>(`/goals/${id}`, { method: 'DELETE' });

/** Changes a goal's status, optionally moving its money in the same action (phase 7D). */
export const changeGoalStatus = (
  id: string,
  data: {
    status: GoalStatus;
    reason: string | null;
    replacementGoalId: string | null;
    expectedUpdatedAt: string;
    move: { destinationId: string; amount: number; revision: string } | null;
  },
) =>
  apiFetch<{ goal: Goal; move: { id: string } | null }>(`/goals/${id}/status`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
