import { apiFetch } from './client';
import type { Account } from '../types';

// Buy now, pay later (server: routes/paymentPlans.ts, docs/PAYMENT-PLANS.md). A provider such
// as Afterpay is a credit account; a plan ties a purchase on it to the instalments that pay it
// off from a bank account. Payments are linked only when you confirm them.

export type PlanProvider = 'afterpay' | 'zip' | 'klarna' | 'paypal' | 'humm' | 'other';
export type PlanFrequency = 'weekly' | 'fortnightly' | 'monthly';
export type InstalmentStatus = 'paid' | 'settled' | 'due' | 'overdue';

export const PROVIDER_NAMES: Record<PlanProvider, string> = {
  afterpay: 'Afterpay',
  zip: 'Zip',
  klarna: 'Klarna',
  paypal: 'PayPal Pay in 4',
  humm: 'Humm',
  other: 'Payment plan',
};

export interface PaymentPlan {
  id: string;
  accountId: string;
  accountName: string | null;
  fundingAccountId: string | null;
  fundingAccountName: string | null;
  provider: PlanProvider;
  providerName: string;
  merchant: string;
  total: number;
  instalmentCount: number;
  frequency: PlanFrequency;
  firstDueDate: string;
  purchase: {
    id: string;
    date: string;
    amount: number;
    categoryId: string | null;
    categoryName: string | null;
    split: boolean;
  } | null;
  purchaseChanged: boolean;
  instalments: {
    id: string;
    seq: number;
    dueDate: string;
    amount: number;
    status: InstalmentStatus;
    transactionId: string | null;
    paidAt: string | null;
  }[];
  paidCount: number;
  remaining: number;
  nextDue: { date: string; amount: number } | null;
  status: 'active' | 'paid';
  extraTransactionIds: string[];
}

export interface PaymentMatch {
  planId: string;
  merchant: string;
  providerName: string;
  instalmentIds: string[];
  seqs: number[];
  instalmentCount: number;
  dueDate: string;
  transaction: {
    id: string;
    accountId: string;
    date: string;
    amount: number;
    payeeName: string | null;
  };
}

export interface HistoryGroup {
  accountId: string;
  accountName: string;
  transactions: { id: string; date: string; amount: number; payeeName: string | null }[];
  suggested: {
    instalmentCount: number;
    total: number;
    firstDueDate: string;
    frequency: PlanFrequency;
  };
  inProgress: boolean;
}

export interface CreatePlanInput {
  accountId: string;
  fundingAccountId: string;
  provider: PlanProvider;
  merchant: string;
  purchaseDate: string;
  total: number;
  categoryId: string | null;
  notes?: string | null;
  instalmentCount: number;
  frequency: PlanFrequency;
  firstDueDate: string;
  linkTransactionIds?: string[];
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const getPlans = () => apiFetch<PaymentPlan[]>('/payment-plans');
export const getPaymentMatches = () => apiFetch<PaymentMatch[]>('/payment-plans/matches');
export const getHistory = (provider: PlanProvider, months: number) =>
  apiFetch<{ groups: HistoryGroup[]; lockedCount: number }>(
    `/payment-plans/history?provider=${provider}&months=${months}`,
  );
export const getPlanForTransaction = (id: string) =>
  apiFetch<PaymentPlan | null>(`/payment-plans/for-transaction/${encodeURIComponent(id)}`);

export const createPlanAccount = (provider: PlanProvider, name?: string) =>
  apiFetch<{ account: Account; paymentFunding: { ok: true } | { ok: false; reason: string } }>(
    '/payment-plans/account',
    json('POST', { provider, name }),
  );
export const createPlan = (input: CreatePlanInput) =>
  apiFetch<PaymentPlan>('/payment-plans', json('POST', input));
export const updatePlan = (
  id: string,
  change: { merchant?: string; instalments?: { id: string; dueDate?: string; amount?: number }[] },
) => apiFetch<PaymentPlan>(`/payment-plans/${id}`, json('PUT', change));
export const deletePlan = (id: string) =>
  apiFetch<void>(`/payment-plans/${id}`, { method: 'DELETE' });
export const linkPayment = (planId: string, transactionId: string, instalmentIds?: string[]) =>
  apiFetch<PaymentPlan>(
    `/payment-plans/${planId}/link`,
    json('POST', { transactionId, instalmentIds }),
  );
export const unlinkPayment = (planId: string, instalmentId: string) =>
  apiFetch<PaymentPlan>(`/payment-plans/${planId}/instalments/${instalmentId}/unlink`, {
    method: 'POST',
  });
export const dismissMatch = (instalmentId: string, transactionId: string) =>
  apiFetch<void>('/payment-plans/dismiss', json('POST', { instalmentId, transactionId }));
export const recordRefund = (
  planId: string,
  input: { date: string; amount: number; categoryId?: string | null },
) => apiFetch<PaymentPlan>(`/payment-plans/${planId}/refund`, json('POST', input));
export const recordFee = (
  planId: string,
  input: { date: string; amount: number; categoryId?: string | null },
) => apiFetch<PaymentPlan>(`/payment-plans/${planId}/fee`, json('POST', input));
