import { apiFetch } from './client';

// Household sharing (server: routes/households.ts, docs/HOUSEHOLDS.md): pool accounts, the
// default split quick sharing uses, sharing payments in one step, and repayment suggestions.

export interface HouseholdSplit {
  /** `exact`: each person's fixed amount in cents (a recurring bill's own split only) */
  mode: 'equal' | 'percentage' | 'weight' | 'exact';
  shares: { personId: string; value: number }[];
}

export interface HouseholdSummary {
  id: string;
  name: string;
  currency: string;
  accountId: string | null;
  poolAccountIds: string[];
  defaultSplit: HouseholdSplit | null;
  /** Its picture (small image data URL), shown on payments shared with it; null = initial */
  logo: string | null;
}

export interface RepaymentSuggestion {
  /** A repayment to you, your own payment to someone you owe, or money put into the household account */
  kind: 'settlement' | 'payment' | 'contribution';
  transactionId: string;
  date: string;
  amount: number;
  payeeName: string | null;
  notes: string | null;
  personId: string;
  personName: string;
  /** What they owe you (settlement), what you owe them (payment) or what they owe the household account (contribution) */
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

export const setHouseholdLogo = (groupId: string, logo: string | null) =>
  apiFetch<{ id: string; logo: string | null }>(`/households/${groupId}/logo`, {
    method: 'PUT',
    body: JSON.stringify({ logo }),
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
    body: JSON.stringify(
      s.kind === 'contribution'
        ? {
            kind: 'contribution',
            date: s.date,
            description: `Contribution from ${s.personName}`,
            amount: s.amount,
            payerId: s.personId,
            transactionId: s.transactionId,
          }
        : s.kind === 'payment'
          ? {
              kind: 'settlement',
              date: s.date,
              description: `Repayment to ${s.personName}`,
              amount: s.amount,
              payerId: selfId,
              recipientId: s.personId,
              transactionId: s.transactionId,
            }
          : {
              kind: 'settlement',
              date: s.date,
              description: `Repayment from ${s.personName}`,
              amount: s.amount,
              payerId: s.personId,
              recipientId: selfId,
              transactionId: s.transactionId,
            },
    ),
  });

/** A suggested transfer between two people (who pays whom), from the household's direct balances */
export interface SettleUpTransfer {
  fromId: string;
  toId: string;
  amount: number;
}

/** Records a suggested transfer as a repayment, with no bank payment linked */
export const recordSettleUp = (
  groupId: string,
  t: SettleUpTransfer,
  names: { from: string; to: string },
  date: string,
) =>
  apiFetch<unknown>(`/households/${groupId}/events`, {
    method: 'POST',
    body: JSON.stringify({
      kind: 'settlement',
      date,
      description: `Repayment from ${names.from} to ${names.to}`,
      amount: t.amount,
      payerId: t.fromId,
      recipientId: t.toId,
    }),
  });

/** Removes one household entry (undoing a share) */
/** An entry in a household, as GET /households/:id lists it */
export interface HouseholdEvent {
  id: string;
  kind: string;
  date: string;
  description: string;
  amount: number;
  payerId: string | null;
  recipientId: string | null;
  transactionId: string | null;
  reversesId: string | null;
  billId: string | null;
  shares: { personId: string; amount: number }[];
}

export const getHouseholdEvents = async (groupId: string) =>
  (await apiFetch<{ events: HouseholdEvent[] }>(`/households/${groupId}`)).events;

/** Records an entry again exactly as it was (each person's share as a fixed amount) */
export const restoreHouseholdEvent = async (groupId: string, e: HouseholdEvent) =>
  (
    await apiFetch<{ events: HouseholdEvent[] }>(`/households/${groupId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        kind: e.kind,
        date: e.date,
        description: e.description,
        amount: e.amount,
        payerId: e.payerId,
        recipientId: e.recipientId,
        transactionId: e.transactionId,
        reversesId: e.reversesId,
        billId: e.billId,
        // Putting back a repayment that was recorded is fine even if it was paid ahead
        advance: e.kind === 'settlement',
        mode: 'exact',
        shares: e.shares.map((s) => ({ personId: s.personId, value: s.amount })),
      }),
    })
  ).events.find((x) => x.transactionId === e.transactionId)!.id;

/**
 * Removes the shared-expense entries now linked to these payments in a household, whatever
 * their ids (an entry that Stop sharing removed and Undo recorded again has a new id). Payments
 * with no such entry are skipped.
 */
export async function removeSharedEntries(groupId: string, transactionIds: string[]) {
  const ids = new Set(transactionIds);
  const entries = (await getHouseholdEvents(groupId)).filter(
    (e) => e.kind === 'expense' && e.transactionId !== null && ids.has(e.transactionId),
  );
  for (const e of entries.reverse()) await removeHouseholdEvent(groupId, e.id);
}

export const removeHouseholdEvent = (groupId: string, eventId: string) =>
  apiFetch<unknown>(`/households/${groupId}/events/${eventId}`, { method: 'DELETE' });

/** A recurring item shared with the household, as GET /households/:id lists it */
export interface SharedRecurringBill {
  scheduleId: string;
  name: string;
  /** Expected amount of the next payment (positive) */
  amount: number;
  /** exact, approximate or variable: how far a payment may differ before it counts as drift */
  amountType: 'exact' | 'approximate' | 'variable';
  /** The schedule's own signed amount; an edit keeps its sign */
  scheduleAmount: number;
  accountId: string | null;
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
  /** What fixed amounts add up to (null for other splits); a payment must equal it */
  fixedTotal: number | null;
  /** Recent payments, newest first, and whether each is shared yet */
  payments: { transactionId: string; date: string; amount: number; shared: boolean }[];
  /** The newest payment against the expected amount, when outside tolerance (server billDrift) */
  drift: {
    lastPaid: number;
    lastDate: string;
    average: number;
    averageOf: number;
  } | null;
  /** Expected dates in the coverage window, with each person's share */
  upcoming: { date: string; amount: number; shares: { personId: string; amount: number }[] }[];
}

/** The Household page's gauge (server: householdCoverage.ts). Minor units */
export interface HouseholdCoverage {
  from: string;
  to: string;
  cash: number;
  due: {
    id: string;
    source: 'recurring' | 'bill';
    name: string;
    date: string;
    amount: number;
    shares: { personId: string; amount: number }[];
  }[];
  needed: number;
  covered: number;
  shortfall: number;
  people: { personId: string; shareDue: number; paidIn: number }[];
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

/** A line of a household's activity log (SPL-04), newest first */
export interface HouseholdActivityLine {
  id: string;
  time: string;
  kind: 'created' | 'edited' | 'removed' | 'settled' | 'auto_shared';
  eventId: string | null;
  summary: string;
  source: 'owner' | 'rule' | 'recurring_bill';
}

export const getHouseholdActivity = (groupId: string) =>
  apiFetch<HouseholdActivityLine[]>(`/households/${groupId}/activity`);

/** Spending in a household by month, person and category (SPL-05), as the statement lists it */
export interface HouseholdBreakdown {
  byMonth: { month: string; household: number; myShare: number }[];
  /** `paid` less `share` is `net`; spending the household account paid has no person (null) */
  byPerson: { personId: string | null; name: string; paid: number; share: number; net: number }[];
  byCategory: { categoryId: string | null; name: string; household: number; myShare: number }[];
}

export const getHouseholdStatement = (groupId: string, from: string, to: string) => {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const text = query.toString();
  return apiFetch<HouseholdBreakdown>(`/households/${groupId}/statement${text ? `?${text}` : ''}`);
};
