import { and, desc, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm';
import { format, subDays } from 'date-fns';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  categories,
  categoryGroups,
  accounts,
  budgetSettings,
  transactions,
  payees,
  householdGroups as groups,
  householdPeople as people,
  householdEvents as events,
  householdShares as shares,
  householdBills as bills,
  householdPoolAccounts as poolAccounts,
  householdRecurringBills as recurringBills,
  schedules,
  scheduleOccurrences,
} from '../db/schema.js';
import { allocateShares, householdLedger } from './householdLedger.js';
import { accountTransactionSum } from './balances.js';

// Household groups (docs/HOUSEHOLDS.md): the state of one group, and recording an event with
// every check the ledger relies on. Shared by the households routes, quick sharing from the
// register and the "share with household" rule action.

const name = z.string().trim().min(1).max(200);
const date = z.iso.date();
const money = z.number().int().min(1).max(1e12);

/** How a new shared expense splits by default: equal, or each person's percentage/weight */
export const splitSchema = z.object({
  mode: z.enum(['equal', 'percentage', 'weight']),
  shares: z
    .array(z.object({ personId: z.string(), value: z.number().int().min(0).max(1e12) }))
    .max(50)
    .default([]),
});
export type DefaultSplit = z.infer<typeof splitSchema>;

function parseSplit(json: string | null): DefaultSplit | null {
  if (!json) return null;
  try {
    return splitSchema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}

/** A group's pool accounts: its first (household_groups.account_id), then any added since */
export function poolAccountsOf(group: { id: string; accountId: string | null }): string[] {
  const extra = db
    .select({ accountId: poolAccounts.accountId })
    .from(poolAccounts)
    .where(eq(poolAccounts.groupId, group.id))
    .all()
    .map((r) => r.accountId);
  return [...(group.accountId ? [group.accountId] : []), ...extra];
}

/** The household whose pool this account is, if any */
export function poolGroupOf(accountId: string) {
  const direct = db.select().from(groups).where(eq(groups.accountId, accountId)).get();
  if (direct) return direct;
  const extra = db
    .select({ groupId: poolAccounts.groupId })
    .from(poolAccounts)
    .where(eq(poolAccounts.accountId, accountId))
    .get();
  return extra ? db.select().from(groups).where(eq(groups.id, extra.groupId)).get() : undefined;
}

export function snapshot(id: string) {
  const group = db.select().from(groups).where(eq(groups.id, id)).get();
  if (!group) throw new Error('Household not found');
  const members = db.select().from(people).where(eq(people.groupId, id)).all();
  const entries = db
    .select()
    .from(events)
    .where(eq(events.groupId, id))
    .all()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const allocations = db
    .select()
    .from(shares)
    .where(
      inArray(
        shares.eventId,
        db.select({ id: events.id }).from(events).where(eq(events.groupId, id)),
      ),
    )
    .all();
  const ledger = householdLedger(members, entries, allocations);
  const poolAccountIds = poolAccountsOf(group);
  const cash = poolAccountIds.reduce((sum, accountId) => {
    const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    return account ? sum + account.startingBalance + accountTransactionSum(account.id) : sum;
  }, 0);
  const allBills = db.select().from(bills).where(eq(bills.groupId, id)).all();
  const remaining = allBills.filter(
    (b) => !entries.some((e) => e.billId === b.id && e.kind === 'expense'),
  );
  const reserved = remaining.reduce((sum, b) => sum + b.reserved, 0);
  const { defaultSplitJson, ...groupFields } = group;
  const defaultSplit = parseSplit(defaultSplitJson);
  return {
    recurringBills: sharedRecurringBills(id, members, defaultSplit, poolAccountIds),
    group: { ...groupFields, poolAccountIds, defaultSplit },
    poolAccountIds,
    people: members,
    events: entries.map((e) => ({ ...e, shares: allocations.filter((s) => s.eventId === e.id) })),
    ...ledger,
    cash,
    reserved,
    unreserved: Math.max(0, Math.min(cash, ledger.pool) - reserved),
    bills: allBills.map((b) => {
      const paid = entries.filter((e) => e.billId === b.id).reduce((sum, e) => sum + e.amount, 0);
      return {
        ...b,
        paid,
        status:
          !paid && b.reserved > 0 && Math.min(cash, ledger.pool) < reserved
            ? 'needs review'
            : paid === 0 && entries.some((e) => e.billId === b.id)
              ? 'needs review'
              : paid >= b.amount
                ? 'paid'
                : paid > 0
                  ? 'needs review'
                  : b.reserved >= b.amount
                    ? 'funded'
                    : b.dueDate <= new Date().toISOString().slice(0, 10)
                      ? 'due'
                      : 'shortfall',
      };
    }),
  };
}

export const eventSchema = z.object({
  kind: z.enum(['expense', 'contribution', 'settlement', 'refund']),
  date,
  description: name,
  amount: money.optional(),
  payerId: z.string().nullable().default(null),
  recipientId: z.string().nullable().default(null),
  transactionId: z.string().nullable().default(null),
  reversesId: z.string().nullable().default(null),
  billId: z.string().nullable().default(null),
  mode: z.enum(['equal', 'percentage', 'weight', 'exact']).default('equal'),
  shares: z
    .array(z.object({ personId: z.string(), value: z.number().int().min(0).max(1e12) }))
    .max(50)
    .default([]),
});

/** Records one event (expense, contribution, settlement or refund) after every check; returns its id */
export function recordEvent(groupId: string, raw: unknown): string {
  const state = snapshot(groupId);
  const input = eventSchema.parse(raw);
  const member = (id: string | null) => id !== null && state.people.some((p) => p.id === id);
  if (
    (input.payerId && !member(input.payerId)) ||
    (input.recipientId && !member(input.recipientId))
  )
    throw new Error('Participant belongs to another household');
  let amount = input.amount ?? 0;
  let portions: { personId: string; amount: number }[] = [];
  if (input.kind === 'refund') {
    const original = state.events.find((e) => e.id === input.reversesId && e.kind === 'expense');
    if (!original) throw new Error('Choose the original expense');
    if (input.date < original.date) throw new Error('Refund cannot precede the original expense');
    const prior = state.events.filter((e) => e.reversesId === original.id);
    const remaining = original.amount + prior.reduce((n, e) => n + e.amount, 0);
    const refund = input.amount ?? remaining;
    if (refund <= 0 || refund > remaining) throw new Error('Refund exceeds the unrefunded expense');
    amount = -refund;
    input.payerId = original.payerId;
    input.billId = original.billId;
    const weights = original.shares.map(
      (s) =>
        s.amount +
        prior.reduce(
          (n, e) =>
            n + e.shares.filter((p) => p.personId === s.personId).reduce((n, s) => n + s.amount, 0),
          0,
        ),
    );
    const allocated = allocateShares(refund, weights);
    portions = original.shares.map((s, i) => ({ personId: s.personId, amount: -allocated[i] }));
  } else if (input.kind === 'expense') {
    if (
      !amount ||
      !input.shares.length ||
      new Set(input.shares.map((s) => s.personId)).size !== input.shares.length ||
      input.shares.some((s) => !member(s.personId))
    )
      throw new Error('Choose participants once each and enter a positive total');
    const values = input.shares.map((s) => (input.mode === 'equal' ? 1 : s.value));
    if (input.mode === 'exact' && values.reduce((a, b) => a + b, 0) !== amount)
      throw new Error('Exact shares must equal the expense');
    if (input.mode === 'percentage' && values.reduce((a, b) => a + b, 0) !== 10000)
      throw new Error('Percentage shares must total 10000 basis points');
    const amounts = input.mode === 'exact' ? values : allocateShares(amount, values);
    portions = input.shares.map((s, i) => ({ personId: s.personId, amount: amounts[i] }));
    if (
      input.payerId === null &&
      (!state.poolAccountIds.length ||
        state.pool -
          state.bills
            .filter((b) => b.id !== input.billId && b.status !== 'paid')
            .reduce((n, b) => n + b.reserved, 0) <
          amount)
    )
      throw new Error('Record received pool contributions before spending them');
  } else {
    if (input.kind === 'contribution' && !state.poolAccountIds.length)
      throw new Error('Contributions require a household pool account');
    if (!amount || !member(input.payerId)) throw new Error('Choose a payer and positive amount');
    if (
      input.kind === 'settlement' &&
      (!member(input.recipientId) ||
        input.recipientId === input.payerId ||
        amount > -(state.balances[input.payerId!] ?? 0) ||
        amount > (state.balances[input.recipientId!] ?? 0))
    )
      throw new Error('Settlement exceeds the outstanding balance');
  }
  if (input.kind !== 'refund' && input.reversesId) throw new Error('Only refunds reverse expenses');
  if (input.billId && !state.bills.some((b) => b.id === input.billId))
    throw new Error('Bill belongs to another household');
  if (
    input.billId &&
    input.kind !== 'refund' &&
    (input.kind !== 'expense' || state.events.some((e) => e.billId === input.billId))
  )
    throw new Error('Bill is already matched or is not an expense');
  if (input.transactionId) {
    const tx = db.select().from(transactions).where(eq(transactions.id, input.transactionId)).get();
    if (
      !tx ||
      tx.isParent ||
      tx.parentTransactionId ||
      tx.isAdjustment ||
      (tx.transferTransactionId && input.kind !== 'contribution' && input.kind !== 'settlement')
    )
      throw new Error('Choose a single bank payment');
    const account = db.select().from(accounts).where(eq(accounts.id, tx.accountId)).get()!;
    const currency = db.select().from(budgetSettings).get()?.currency ?? 'AUD';
    if (
      (account.currency ?? currency) !== state.group.currency ||
      Math.abs(tx.amount) !== Math.abs(amount)
    )
      throw new Error('Bank amount and currency must match exactly');
    if ((input.kind === 'settlement' || input.kind === 'refund') && tx.categoryId) {
      const category = db
        .select({ income: categoryGroups.isIncome })
        .from(categories)
        .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
        .where(eq(categories.id, tx.categoryId))
        .get();
      if (category?.income)
        throw new Error(
          'Categorize repayments and refunds against the original expense, not salary',
        );
    }
    if (tx.date !== input.date) throw new Error('Event date must match the bank transaction');
    const self = state.people.find((p) => p.isSelf)!.id;
    if (
      (input.payerId === null || input.kind === 'contribution') &&
      !state.poolAccountIds.includes(tx.accountId)
    )
      throw new Error('Choose the household account transaction');
    if (
      (input.kind === 'expense' || input.kind === 'refund') &&
      input.payerId &&
      input.payerId !== self
    )
      throw new Error('Another person’s payment cannot be linked to your bank debit');
    if (
      (input.kind === 'expense' || input.kind === 'refund') &&
      input.payerId &&
      state.poolAccountIds.includes(tx.accountId)
    )
      throw new Error('A direct payment must use a personal account');
    if (input.kind === 'settlement' && input.payerId !== self && input.recipientId !== self)
      throw new Error('Other people’s repayments cannot be linked to your bank account');
    if (
      tx.transferTransactionId &&
      db.select().from(events).where(eq(events.transactionId, tx.transferTransactionId)).get()
    )
      throw new Error('The other transfer leg is already linked');
    const incoming =
      input.kind === 'refund' ||
      input.kind === 'contribution' ||
      (input.kind === 'settlement' && input.recipientId === self);
    if (tx.amount > 0 !== incoming)
      throw new Error('Bank payment direction does not match this event');
    if (db.select().from(events).where(eq(events.transactionId, tx.id)).get())
      throw new Error('Bank payment is already linked');
  }
  const row = {
    id: nanoid(),
    groupId: state.group.id,
    kind: input.kind,
    date: input.date,
    description: input.description,
    amount,
    payerId: input.payerId,
    recipientId: input.recipientId,
    transactionId: input.transactionId,
    reversesId: input.reversesId,
    billId: input.billId,
  };
  db.insert(events).values(row).run();
  portions.forEach((p) =>
    db
      .insert(shares)
      .values({ id: nanoid(), eventId: row.id, ...p })
      .run(),
  );
  return row.id;
}

/**
 * Shares one bank payment with the household as an expense: paid by you from a personal
 * account, or by the pool from a pool account, split by `split`, the group's default split,
 * or equally between everyone. Returns the event id.
 */
export function shareTransaction(groupId: string, transactionId: string, split?: DefaultSplit) {
  const state = snapshot(groupId);
  const tx = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
  if (!tx) throw new Error('Transaction not found');
  if (tx.amount >= 0) throw new Error('Only a payment (money out) can be shared');
  const { mode, shares: shareList } = splitOrEqual(split ?? state.group.defaultSplit, state.people);
  const fromPool = state.poolAccountIds.includes(tx.accountId);
  return recordEvent(groupId, {
    kind: 'expense',
    date: tx.date,
    description: tx.payeeName?.trim() || 'Shared expense',
    amount: -tx.amount,
    payerId: fromPool ? null : state.people.find((p) => p.isSelf)!.id,
    transactionId: tx.id,
    mode,
    shares: shareList,
  });
}

/** A split to use: the one given (or the default), else equal between everyone */
function splitOrEqual(split: DefaultSplit | null, members: { id: string }[]) {
  return split && split.shares.length
    ? { mode: split.mode, shares: split.shares }
    : { mode: 'equal' as const, shares: members.map((p) => ({ personId: p.id, value: 1 })) };
}

/** Days back a shared recurring bill looks for payments by its payee */
const BILL_PAYMENT_DAYS = 180;
/** Payments listed per shared recurring bill, newest first */
const BILL_PAYMENTS_SHOWN = 6;

/**
 * Recurring items shared with this household: each with its next date, what everyone's share
 * of the expected amount comes to with the default split, and its recent payments (those
 * matched to it in Recurring, or by its payee) with whether each is shared yet. Sharing one
 * stays a click (POST /share), so nothing is recorded on a guess.
 */
function sharedRecurringBills(
  groupId: string,
  members: { id: string }[],
  split: DefaultSplit | null,
  poolAccountIds: string[],
) {
  const links = db.select().from(recurringBills).where(eq(recurringBills.groupId, groupId)).all();
  if (!links.length) return [];
  const today = format(new Date(), 'yyyy-MM-dd');
  const since = format(subDays(new Date(), BILL_PAYMENT_DAYS), 'yyyy-MM-dd');
  const linked = new Set(
    db
      .select({ id: events.transactionId })
      .from(events)
      .where(isNotNull(events.transactionId))
      .all()
      .map((e) => e.id),
  );
  const { mode, shares: weights } = splitOrEqual(split, members);
  return links.flatMap((link) => {
    const schedule = db.select().from(schedules).where(eq(schedules.id, link.scheduleId)).get();
    if (!schedule) return [];
    const next = db
      .select({
        date: scheduleOccurrences.expectedDate,
        amount: scheduleOccurrences.expectedAmount,
      })
      .from(scheduleOccurrences)
      .where(
        and(
          eq(scheduleOccurrences.scheduleId, schedule.id),
          eq(scheduleOccurrences.status, 'pending'),
          gte(scheduleOccurrences.expectedDate, today),
        ),
      )
      .orderBy(scheduleOccurrences.expectedDate)
      .get();
    const amount = Math.abs(next?.amount ?? schedule.amount);
    const values = weights.map((w) => (mode === 'equal' ? 1 : w.value));
    const amounts = amount && values.some((v) => v > 0) ? allocateShares(amount, values) : [];
    const matchedIds = db
      .select({ id: scheduleOccurrences.matchedTransactionId })
      .from(scheduleOccurrences)
      .where(
        and(
          eq(scheduleOccurrences.scheduleId, schedule.id),
          isNotNull(scheduleOccurrences.matchedTransactionId),
          gte(scheduleOccurrences.expectedDate, since),
        ),
      )
      .all()
      .map((o) => o.id!);
    const candidates = [
      ...new Set([
        ...matchedIds,
        ...(schedule.payeeId ? payeeTransactionIds(schedule.payeeId, since) : []),
      ]),
    ];
    const payments = (
      candidates.length
        ? db
            .select()
            .from(transactions)
            .where(inArray(transactions.id, candidates))
            .orderBy(desc(transactions.date))
            .all()
        : []
    )
      .filter((t) => t.amount < 0 && !t.isParent && !t.transferTransactionId)
      .slice(0, BILL_PAYMENTS_SHOWN)
      .map((t) => ({
        transactionId: t.id,
        date: t.date,
        amount: -t.amount,
        shared: linked.has(t.id),
      }));
    return [
      {
        scheduleId: schedule.id,
        name: schedule.name,
        amount,
        recurrenceType: schedule.recurrenceType,
        status: schedule.status,
        nextDate: next?.date ?? null,
        paidFromPool: !!schedule.accountId && poolAccountIds.includes(schedule.accountId),
        shares: weights.map((w, i) => ({ personId: w.personId, amount: amounts[i] ?? 0 })),
        payments,
      },
    ];
  });
}

function payeeTransactionIds(payeeId: string, since: string) {
  return db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.payeeId, payeeId),
        gte(transactions.date, since),
        lt(transactions.amount, 0),
      ),
    )
    .all()
    .map((t) => t.id);
}

/**
 * Shares recurring items with a household. Each must be an active, repeating payment (money
 * out, not a transfer) not already shared with another household.
 */
export function shareRecurringBills(groupId: string, scheduleIds: string[]) {
  snapshot(groupId);
  for (const scheduleId of new Set(scheduleIds)) {
    const schedule = db.select().from(schedules).where(eq(schedules.id, scheduleId)).get();
    if (!schedule) throw new Error('Recurring item not found');
    if (schedule.amount >= 0 || schedule.transferAccountId)
      throw new Error(`${schedule.name} isn't a bill: only payments can be shared`);
    if (schedule.status !== 'active') throw new Error(`${schedule.name} isn't active`);
    const existing = db
      .select()
      .from(recurringBills)
      .where(eq(recurringBills.scheduleId, scheduleId))
      .get();
    if (existing && existing.groupId !== groupId)
      throw new Error(`${schedule.name} is already shared with another household`);
    if (!existing) db.insert(recurringBills).values({ scheduleId, groupId }).run();
  }
  return snapshot(groupId);
}

/** Stops listing a recurring item; its payments already shared stay in the household */
export function unshareRecurringBill(groupId: string, scheduleId: string) {
  const result = db
    .delete(recurringBills)
    .where(and(eq(recurringBills.groupId, groupId), eq(recurringBills.scheduleId, scheduleId)))
    .run();
  if (!result.changes) throw new Error('This recurring item is not shared with this household');
  return snapshot(groupId);
}

/** Days back that money received is checked against what people owe */
const REPAYMENT_DAYS = 120;
const words = (s: string) =>
  s
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);

/**
 * Money received in your personal accounts that looks like a repayment from someone who owes
 * the household: the payee name has their name in it, it isn't linked to the household yet,
 * and it is no more than they owe (or than is owed to you). The owner confirms each one.
 */
export function repaymentSuggestions(groupId: string, today: string) {
  const state = snapshot(groupId);
  const self = state.people.find((p) => p.isSelf)!;
  const owedToSelf = state.balances[self.id] ?? 0;
  const debtors = state.people.filter((p) => !p.isSelf && (state.balances[p.id] ?? 0) < 0);
  if (!debtors.length || owedToSelf <= 0) return [];
  const since = new Date(Date.parse(today) - REPAYMENT_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const linked = new Set(
    db
      .select({ id: events.transactionId })
      .from(events)
      .all()
      .map((e) => e.id),
  );
  const candidates = db
    .select()
    .from(transactions)
    .all()
    .filter(
      (t) =>
        t.amount > 0 &&
        t.date >= since &&
        t.date <= today &&
        !t.isParent &&
        !t.parentTransactionId &&
        !t.transferTransactionId &&
        !linked.has(t.id) &&
        !state.poolAccountIds.includes(t.accountId),
    );
  return candidates.flatMap((t) => {
    const payee = new Set(words(`${t.payeeName ?? ''} ${t.importedPayee ?? ''}`));
    const person = debtors.find((p) => words(p.name).some((w) => payee.has(w)));
    if (!person) return [];
    const owes = -(state.balances[person.id] ?? 0);
    if (t.amount > owes || t.amount > owedToSelf) return [];
    return [
      {
        transactionId: t.id,
        date: t.date,
        amount: t.amount,
        payeeName: t.payeeName,
        notes: t.notes,
        personId: person.id,
        personName: person.name,
        owes,
      },
    ];
  });
}

/**
 * What a combined household (gateway/sharing.ts) shows the other person: the group's entries,
 * their splits and each linked payment's merchant. Never an account, category, transaction
 * note, bank balance or pool cash: only the agreed household record.
 */
export function sharedExport(id: string) {
  const group = db.select().from(groups).where(eq(groups.id, id)).get();
  if (!group) throw new Error('Household not found');
  const members = db.select().from(people).where(eq(people.groupId, id)).all();
  const entries = db.select().from(events).where(eq(events.groupId, id)).all();
  const allocations = entries.length
    ? db
        .select()
        .from(shares)
        .where(
          inArray(
            shares.eventId,
            entries.map((e) => e.id),
          ),
        )
        .all()
    : [];
  const linked = entries.map((e) => e.transactionId).filter((t): t is string => !!t);
  const merchants = new Map(
    (linked.length
      ? db
          .select({ id: transactions.id, name: payees.name, logo: payees.logo })
          .from(transactions)
          .leftJoin(payees, eq(payees.id, transactions.payeeId))
          .where(inArray(transactions.id, linked))
          .all()
      : []
    ).map((r) => [r.id, r.name ? { name: r.name, logo: r.logo } : null]),
  );
  return {
    group: { id: group.id, name: group.name, currency: group.currency },
    people: members.map((p) => ({ id: p.id, name: p.name, isSelf: p.isSelf === 1 })),
    events: entries
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        date: e.date,
        description: e.description,
        amount: e.amount,
        payerId: e.payerId,
        recipientId: e.recipientId,
        reversesId: e.reversesId,
        reviewReason: e.reviewReason,
        fromBank: !!e.transactionId,
        merchant: (e.transactionId && merchants.get(e.transactionId)) || null,
        shares: allocations
          .filter((s) => s.eventId === e.id)
          .map((s) => ({ personId: s.personId, amount: s.amount })),
      })),
  };
}
export type SharedExport = ReturnType<typeof sharedExport>;
