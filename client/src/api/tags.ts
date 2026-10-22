import { apiFetch } from './client';
import type { SavedView, Tag } from '../types';

// Phase 9 tags and saved views (server: routes/tags.ts)

export const getTags = () => apiFetch<Tag[]>('/tags');

export const createTag = (data: { name: string; color?: string }) =>
  apiFetch<Tag>('/tags', { method: 'POST', body: JSON.stringify(data) });

export const updateTag = (id: string, data: { name?: string; color?: string }) =>
  apiFetch<Tag>(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTag = (id: string) => apiFetch<void>(`/tags/${id}`, { method: 'DELETE' });

export const getSavedViews = () => apiFetch<SavedView[]>('/saved-views');

export const createSavedView = (data: { name: string; query: string }) =>
  apiFetch<SavedView>('/saved-views', { method: 'POST', body: JSON.stringify(data) });

export const updateSavedView = (id: string, data: { name?: string; query?: string }) =>
  apiFetch<SavedView>(`/saved-views/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteSavedView = (id: string) =>
  apiFetch<void>(`/saved-views/${id}`, { method: 'DELETE' });
