import { apiFetch } from './client';
import type { Category, CategoryGroup } from '../types';

export const getCategories = () => apiFetch<CategoryGroup[]>('/categories');

/** Categories with how much each is used (transactions, last date, ever assigned) */
export const getCategoriesWithUsage = () => apiFetch<CategoryGroup[]>('/categories?usage=1');

/** Hides a category from pickers and the budget while it holds no money, or shows it again */
export const setCategoryHidden = (id: string, hidden: boolean) =>
  apiFetch<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ hidden: hidden ? 1 : 0 }),
  });

export const createGroup = (data: { name: string; isIncome?: number }) =>
  apiFetch<CategoryGroup>('/categories/groups', { method: 'POST', body: JSON.stringify(data) });

export const updateGroup = (id: string, data: { name?: string }) =>
  apiFetch<CategoryGroup>(`/categories/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteGroup = (id: string) =>
  apiFetch<void>(`/categories/groups/${id}`, { method: 'DELETE' });

export const reorderGroups = (ids: string[]) =>
  apiFetch<{ ok: boolean }>('/categories/groups/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });

export const createCategory = (data: {
  groupId: string;
  name: string;
  icon?: string;
  budgetType?: string | null;
}) => apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify(data) });

export const updateCategory = (
  id: string,
  data: {
    name?: string;
    groupId?: string;
    icon?: string;
    budgetType?: string | null;
    linkedAccountId?: string | null;
  },
) => apiFetch<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteCategory = (id: string, reassignTo?: string) =>
  apiFetch<void>(`/categories/${id}${reassignTo ? `?reassignTo=${reassignTo}` : ''}`, {
    method: 'DELETE',
  });

export const reorderCategories = (ids: string[]) =>
  apiFetch<{ ok: boolean }>('/categories/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });

export const getCategoryTransactionCount = (id: string) =>
  apiFetch<{ count: number; hasAssignments: boolean }>(`/categories/${id}/transaction-count`);
