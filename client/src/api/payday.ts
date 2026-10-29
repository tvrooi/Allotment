import { apiFetch } from './client';

export type FundingMethod =
  'bills' | 'fixed' | 'due' | 'monthly' | 'percentage' | 'target' | 'remainder';
export interface FundingRule {
  categoryId: string;
  method: FundingMethod;
  amount: number;
  dueDate: string | null;
  percent: number;
}
export interface PaydayConfig {
  name: string;
  anchorDate: string;
  expectedIncome: number;
  weekendAdjust: 'none' | 'before' | 'after' | 'closest';
  timeZone: string;
  rules: FundingRule[];
}
export interface PaydayPlan extends PaydayConfig {
  id: string;
  archived: number;
}
export interface FundingEvent {
  id: string;
  scheduledDate: string;
  appliedDate: string;
  snapshotJson: string;
}
export interface PaydayContext {
  today: string;
  paydays: { scheduledDate: string; expectedDate: string }[];
  income: { id: string; date: string; name: string | null; amount: number }[];
  history: FundingEvent[];
  undone: UndoneFunding[];
}
export interface UndoResult {
  id: string;
  undone: true;
  reversed: { categoryId: string; name: string; amount: number }[];
  skipped: { categoryId: string; name: string; amount: number; reason: string }[];
}
export interface UndoneFunding {
  id: string;
  scheduledDate: string;
  appliedDate: string;
  snapshotJson: string;
  resultJson: string;
  undoneAt: string;
}
export interface PaydayRequest {
  scheduledDate: string;
  actualPayDate: string;
  incomeIds: string[];
}
export interface PaydayPreview {
  planId: string;
  scheduledDate: string;
  actualPayDate: string;
  nextPayday: string;
  today: string;
  month: string;
  expectedIncome: number;
  received: number;
  available: number;
  unallocated: number;
  totalAllocated: number;
  shortfall: number;
  future: boolean;
  existingEventId: string | null;
  previewKey: string;
  rows: {
    categoryId: string;
    name: string;
    method: FundingMethod;
    balance: number;
    billsDue: number;
    needed: number;
    allocated: number;
    shortfall: number;
    uncoveredBills: number;
    /** What the category's target still needs this month; null without a target rule. */
    targetUnderfunded: number | null;
    /** Its goal is paused, completed or retired (phase 7D): nothing is proposed */
    goalInactive?: boolean;
  }[];
  bills: {
    id: string;
    name: string;
    categoryId: string;
    date: string;
    amount: number;
    estimated: boolean;
  }[];
}
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });
export const getPlans = () => apiFetch<PaydayPlan[]>('/payday');
export const getFundingCategories = () =>
  apiFetch<{ id: string; name: string }[]>('/payday/categories');
export const savePlan = (config: PaydayConfig, id?: string) =>
  apiFetch<PaydayPlan>(`/payday${id ? `/${id}` : ''}`, json(id ? 'PUT' : 'POST', config));
export const archivePlan = (id: string) =>
  apiFetch<void>(`/payday/${id}/archive`, json('POST', {}));
export const getPaydayContext = (id: string) => apiFetch<PaydayContext>(`/payday/${id}/context`);
export const previewPayday = (id: string, request: PaydayRequest) =>
  apiFetch<PaydayPreview>(`/payday/${id}/preview`, json('POST', request));
export const applyPayday = (id: string, request: PaydayRequest, previewKey: string) =>
  apiFetch<FundingEvent & { alreadyApplied: boolean }>(
    `/payday/${id}/apply`,
    json('POST', { ...request, previewKey }),
  );
export const undoPayday = (id: string, eventId: string) =>
  apiFetch<UndoResult>(`/payday/${id}/events/${eventId}/undo`, json('POST', {}));
