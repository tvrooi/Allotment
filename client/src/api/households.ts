import { apiFetch } from './client';

// Household sharing (server: routes/households.ts, docs/HOUSEHOLDS.md): pool accounts, the
// default split quick sharing uses, sharing payments in one step, and repayment suggestions.

export interface HouseholdSplit {
  mode: 'equal' | 'percentage' | 'weight';
  shares: { personId: string; value: number }[];
}

export interface HouseholdSummary {
  id: string;
  name: string;
  currency: string;
  accountId: string | null;
  poolAccountIds: string[];
  defaultSplit: HouseholdSplit | null;
}

export interface RepaymentSuggestion {
  transactionId: string;
  date: string;
  amount: number;
  payeeName: string | null;
  notes: string | null;
  personId: string;
  personName: string;
  owes: number;
}

export interface ShareResult {
  shared: number;
  results: { transactionId: string; ok: boolean; eventId?: string; error?: string }[];
}

export const getHouseholds = () => apiFetch<HouseholdSummary[]>('/households');

export const addPoolAccount = (groupId: string, accountId: string) =>
  apiFetch<unknown>(`/households/${groupId}/pool-accounts`, {
    method: 'POST',
    body: JSON.stringify({ accountId }),
  });
export const removePoolAccount = (groupId: string, accountId: string) =>
  apiFetch<unknown>(`/households/${groupId}/pool-accounts/${accountId}`, { method: 'DELETE' });

export const setDefaultSplit = (groupId: string, split: HouseholdSplit | null) =>
  apiFetch<unknown>(`/households/${groupId}/default-split`, {
    method: 'PUT',
    body: JSON.stringify(split ?? {}),
  });

export const shareTransactions = (groupId: string, transactionIds: string[]) =>
  apiFetch<ShareResult>(`/households/${groupId}/share`, {
    method: 'POST',
    body: JSON.stringify({ transactionIds }),
  });

export const getRepaymentSuggestions = (groupId: string) =>
  apiFetch<RepaymentSuggestion[]>(`/households/${groupId}/repayment-suggestions`);

export const recordRepayment = (groupId: string, s: RepaymentSuggestion, selfId: string) =>
  apiFetch<unknown>(`/households/${groupId}/events`, {
    method: 'POST',
    body: JSON.stringify({
      kind: 'settlement',
      date: s.date,
      description: `Repayment from ${s.personName}`,
      amount: s.amount,
      payerId: s.personId,
      recipientId: selfId,
      transactionId: s.transactionId,
    }),
  });

/** Removes one household entry (undoing a share) */
export const removeHouseholdEvent = (groupId: string, eventId: string) =>
  apiFetch<unknown>(`/households/${groupId}/events/${eventId}`, { method: 'DELETE' });

/** A recurring item shared with the household, as GET /households/:id lists it */
export interface SharedRecurringBill {
  scheduleId: string;
  name: string;
  /** Expected amount of the next payment (positive) */
  amount: number;
  recurrenceType: string;
  status: string;
  nextDate: string | null;
  paidFromPool: boolean;
  /** Its own split; null = the household's default split */
  split: HouseholdSplit | null;
  /** New payments from this day are shared as they arrive; null = shared by hand */
  autoShareFrom: string | null;
  /** Each person's part of `amount` with the bill's split */
  shares: { personId: string; amount: number }[];
  /** Recent payments, newest first, and whether each is shared yet */
  payments: { transactionId: string; date: string; amount: number; shared: boolean }[];
}

export const shareRecurringBills = (groupId: string, scheduleIds: string[]) =>
  apiFetch<unknown>(`/households/${groupId}/recurring-bills`, {
    method: 'POST',
    body: JSON.stringify({ scheduleIds }),
  });
export const unshareRecurringBill = (groupId: string, scheduleId: string) =>
  apiFetch<unknown>(`/households/${groupId}/recurring-bills/${scheduleId}`, { method: 'DELETE' });

/** A bill's own split (null = the default) and/or whether new payments share themselves */
export const updateRecurringBill = (
  groupId: string,
  scheduleId: string,
  changes: { split?: HouseholdSplit | null; autoShare?: boolean },
) =>
  apiFetch<unknown>(`/households/${groupId}/recurring-bills/${scheduleId}`, {
    method: 'PUT',
    body: JSON.stringify(changes),
  });
/** Shares a bill's payments with the bill's own split */
export const shareBillPayments = (groupId: string, scheduleId: string, transactionIds: string[]) =>
  apiFetch<ShareResult>(`/households/${groupId}/recurring-bills/${scheduleId}/share`, {
    method: 'POST',
    body: JSON.stringify({ transactionIds }),
  });

export const addHouseholdPerson = (groupId: string, name: string) =>
  apiFetch<unknown>(`/households/${groupId}/people`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
export const renameHouseholdPerson = (groupId: string, personId: string, name: string) =>
  apiFetch<unknown>(`/households/${groupId}/people/${personId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });

export interface BillEdit {
  description?: string;
  dueDate?: string;
  amount?: number;
  personalShare?: number;
}
export const editHouseholdBill = (groupId: string, billId: string, changes: BillEdit) =>
  apiFetch<unknown>(`/households/${groupId}/bills/${billId}`, {
    method: 'PUT',
    body: JSON.stringify(changes),
  });
export const deleteHouseholdBill = (groupId: string, billId: string) =>
  apiFetch<unknown>(`/households/${groupId}/bills/${billId}`, { method: 'DELETE' });
