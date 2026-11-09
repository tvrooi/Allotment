import { and, desc, eq, gte, inArray, isNotNull, lt, lte, ne, sql } from 'drizzle-orm';
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
  householdActivity as activity,
  schedules,
  scheduleOccurrences,
} from '../db/schema.js';
import { allocateShares, householdLedger } from './householdLedger.js';
import { accountTransactionSum } from './balances.js';
import { addDaysIso, todayIso } from '../utils/date.js';
import { COVERAGE_DAYS, householdCoverage, type CoverageItem } from './householdCoverage.js';
import { billDrift } from './billDrift.js';
import { pendingOccurrences } from './scheduleService.js';

// Household groups (docs/HOUSEHOLDS.md): the state of one group, and recording an event with
// every check the ledger relies on. Shared by the households routes, quick sharing from the
// register and the "share with household" rule action.

const name = z.string().trim().min(1).max(200);
const date = z.iso.date();
const money = z.number().int().min(1).max(1e12);

/**
 * How a new shared expense splits by default: equal, or each person's percentage/weight. A
 * shared recurring bill can also give each person a fixed amount in cents (`exact`), such as
 * everyone's set part of the rent; a payment those amounts don't add up to stays unshared.
 */
export const splitSchema = z.object({
  mode: z.enum(['equal', 'percentage', 'weight', 'exact']),
  shares: z
    .array(z.object({ personId: z.string(), value: z.number().int().min(0).max(1e12) }))
    .max(50)
    .default([]),
});
export type DefaultSplit = z.infer<typeof splitSchema>;

/** A stored split, or null when there is none or it no longer parses */
export function parseSplit(json: string | null): DefaultSplit | null {
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

/** Every household's pool accounts, across all households */
export function allPoolAccountIds(): Set<string> {
  return new Set([
    ...db
      .select({ accountId: groups.accountId })
      .from(groups)
      .all()
      .flatMap((g) => (g.accountId ? [g.accountId] : [])),
    ...db
      .select({ accountId: poolAccounts.accountId })
      .from(poolAccounts)
      .all()
      .map((r) => r.accountId),
  ]);
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
  const recurring = sharedRecurringBills(id, members, defaultSplit, poolAccountIds);
  const paidOf = (billId: string) =>
    entries.filter((e) => e.billId === billId).reduce((sum, e) => sum + e.amount, 0);
  const coverageFrom = todayIso();
  const coverageTo = addDaysIso(coverageFrom, COVERAGE_DAYS);
  // A one-off bill that belongs to a shared recurring item is already counted by its dates
  const sharedSchedules = new Set(recurring.map((b) => b.scheduleId));
  const due: CoverageItem[] = [
    ...recurring
      .filter((b) => b.paidFromPool)
      .flatMap((b) =>
        b.upcoming.map((o) => ({
          id: b.scheduleId,
          source: 'recurring' as const,
          name: b.name,
          ...o,
        })),
      ),
    ...remaining
      .filter((b) => !(b.scheduleId && sharedSchedules.has(b.scheduleId)))
      .map((b) => {
        const left = Math.max(0, b.amount - paidOf(b.id));
        return {
          id: b.id,
          source: 'bill' as const,
          name: b.description,
          date: b.dueDate,
          amount: left,
          shares: billShares(defaultSplit, members, left).shares,
        };
      }),
  ];
  const coverage = householdCoverage({
    from: coverageFrom,
    to: coverageTo,
    cash,
    due,
    members,
    contributions: entries.filter((e) => e.kind === 'contribution'),
  });
  return {
    recurringBills: recurring,
    coverage,
    group: { ...groupFields, poolAccountIds, defaultSplit },
    poolAccountIds,
    people: members,
    events: entries.map((e) => ({ ...e, shares: allocations.filter((s) => s.eventId === e.id) })),
    ...ledger,
    cash,
    reserved,
    unreserved: Math.max(0, Math.min(cash, ledger.pool) - reserved),
    bills: allBills.map((b) => {
      const paid = paidOf(b.id);
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
                    : b.dueDate <= todayIso()
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
  /** A repayment paid ahead: it may be more than is owed now, and then flips who owes whom */
  advance: z.boolean().default(false),
  mode: z.enum(['equal', 'percentage', 'weight', 'exact']).default('equal'),
  shares: z
    .array(z.object({ personId: z.string(), value: z.number().int().min(0).max(1e12) }))
    .max(50)
    .default([]),
});

/**
 * FNV-1a of a key: where equal remainders start taking the spare cent (SPL-06). The key is the
 * linked bank payment when there is one, so sharing it again after Undo gives the same split.
 */
function spareCentOffset(id: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** Who made a change, as the household's activity log records it */
export type ActivitySource = 'owner' | 'rule' | 'recurring_bill';

/**
 * Records one event (expense, contribution, settlement or refund) after every check; returns its
 * id. `id` is for an edit, which writes the event again under its own id so refunds and bank
 * links keep pointing at it, and then logs the edit itself (`log: false`).
 */
export function recordEvent(
  groupId: string,
  raw: unknown,
  options: { source?: ActivitySource; id?: string; log?: boolean } = {},
): string {
  const state = snapshot(groupId);
  const input = eventSchema.parse(raw);
  const id = options.id ?? nanoid();
  const member = (id: string | null) => id !== null && state.people.some((p) => p.id === id);
  if (
    (input.payerId && !member(input.payerId)) ||
    (input.recipientId && !member(input.recipientId))
  )
    throw new Error('Participant belongs to another household');
  let amount = input.amount ?? 0;
  let portions: { personId: string; amount: number }[] = [];
  let paidAhead = false;
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
    // The spare cent starts at a place taken from the new id, so it doesn't always land on the first person
    const amounts =
      input.mode === 'exact'
        ? values
        : allocateShares(amount, values, spareCentOffset(input.transactionId ?? id));
    portions = input.shares.map((s, i) => ({ personId: s.personId, amount: amounts[i] }));
    if (input.payerId === null) {
      if (!state.poolAccountIds.length)
        throw new Error('Add a household account before recording what it paid');
      // The household account can pay before everyone has put their part in: whatever is
      // missing is owed to it (toPool). It can't spend money set aside for other bills.
      const reservedElsewhere = state.bills
        .filter((b) => b.id !== input.billId && b.status !== 'paid')
        .reduce((n, b) => n + b.reserved, 0);
      if (reservedElsewhere > 0 && state.pool - reservedElsewhere < amount)
        throw new Error('That would spend money reserved for other bills');
    }
  } else {
    if (input.kind === 'contribution' && !state.poolAccountIds.length)
      throw new Error('Contributions require a household pool account');
    if (!amount || !member(input.payerId)) throw new Error('Choose a payer and positive amount');
    // A repayment settles what is owed for things people paid themselves (`direct`), whatever
    // either of them owes the household account; one within their overall balances, as before,
    // is fine too.
    const within = (balances: Record<string, number>) =>
      amount <= -(balances[input.payerId!] ?? 0) && amount <= (balances[input.recipientId!] ?? 0);
    // More than is owed: a repayment paid ahead (`advance`), e.g. towards a shared expense the
    // recipient hasn't recorded yet; their expense, once recorded, nets it off
    paidAhead = input.kind === 'settlement' && !(within(state.direct) || within(state.balances));
    if (
      input.kind === 'settlement' &&
      (!member(input.recipientId) ||
        input.recipientId === input.payerId ||
        (!input.advance && paidAhead))
    )
      throw new Error('Settlement exceeds the outstanding balance');
  }
  if (input.kind !== 'refund' && input.reversesId) throw new Error('Only refunds reverse expenses');
  if (input.advance && input.kind !== 'settlement')
    throw new Error('Only a repayment can be paid ahead');
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
          'Categorise repayments and refunds against the original expense, not salary',
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
    if (input.kind === 'settlement' && state.poolAccountIds.includes(tx.accountId))
      throw new Error('Money in or out of the household account is a contribution or an expense');
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
    id,
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
  if (options.log !== false) {
    const source = options.source ?? 'owner';
    const who = (personId: string | null) =>
      state.people.find((p) => p.id === personId)?.name ?? 'The household account';
    logActivity(
      state.group.id,
      row.kind === 'settlement' ? 'settled' : source === 'owner' ? 'created' : 'auto_shared',
      row.id,
      row.kind === 'settlement'
        ? paidAhead
          ? `${who(row.payerId)} paid ${who(row.recipientId)} ${dollars(row.amount)} ahead`
          : `${who(row.payerId)} repaid ${who(row.recipientId)} ${dollars(row.amount)}`
        : `${ADDED[row.kind] ?? 'Added'} “${row.description}” (${dollars(Math.abs(row.amount))})`,
      source,
    );
  }
  return row.id;
}

const ADDED: Record<string, string> = {
  expense: 'Shared',
  refund: 'Refunded',
  contribution: 'Put into the household account:',
};

/** Lines kept per household; older ones are dropped */
const ACTIVITY_KEPT = 500;

/** Adds a line to the household's activity log (SPL-04), inside the caller's transaction */
function logActivity(
  groupId: string,
  kind: 'created' | 'edited' | 'removed' | 'settled' | 'auto_shared',
  eventId: string | null,
  summary: string,
  source: ActivitySource,
) {
  db.insert(activity)
    .values({
      id: nanoid(),
      groupId,
      time: new Date().toISOString(),
      kind,
      eventId,
      summary: summary.slice(0, 500),
      source,
    })
    .run();
  const stale = db
    .select({ id: activity.id })
    .from(activity)
    .where(eq(activity.groupId, groupId))
    .orderBy(desc(activity.time), desc(sql`rowid`))
    .limit(100)
    .offset(ACTIVITY_KEPT)
    .all();
  if (stale.length)
    db.delete(activity)
      .where(
        inArray(
          activity.id,
          stale.map((r) => r.id),
        ),
      )
      .run();
}

/** The newest lines of a household's activity log */
export function householdActivity(groupId: string, limit = 100) {
  return db
    .select({
      id: activity.id,
      time: activity.time,
      kind: activity.kind,
      eventId: activity.eventId,
      summary: activity.summary,
      source: activity.source,
    })
    .from(activity)
    .where(eq(activity.groupId, groupId))
    .orderBy(desc(activity.time), desc(sql`rowid`))
    .limit(limit)
    .all();
}

/** Which repayments were within what was owed at their point in the ledger */
function validSettlements(state: ReturnType<typeof snapshot>) {
  const valid = new Set<string>();
  // Entries run in date order, and within a day what is owed comes before its repayment (ids are
  // random, so they say nothing about which was recorded first)
  const ordered = [...state.events].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(a.kind === 'settlement') - Number(b.kind === 'settlement') ||
      a.id.localeCompare(b.id),
  );
  ordered.forEach((e, i) => {
    if (e.kind !== 'settlement') return;
    const before = ordered.slice(0, i);
    const ledger = householdLedger(
      state.people,
      before,
      before.flatMap((x) => x.shares),
    );
    const within = (balances: Record<string, number>) =>
      e.amount <= -(balances[e.payerId!] ?? 0) && e.amount <= (balances[e.recipientId!] ?? 0);
    if (within(ledger.direct) || within(ledger.balances)) valid.add(e.id);
  });
  return valid;
}

/** Money set aside for bills must stay covered by what the household account holds */
function assertReservationsCovered(state: ReturnType<typeof snapshot>) {
  const reserved = state.bills
    .filter((b) => !state.events.some((e) => e.billId === b.id && e.kind === 'expense'))
    .reduce((n, b) => n + b.reserved, 0);
  if (reserved > 0 && state.pool < reserved)
    throw new Error('Release bill reservations before changing this funding');
}

/** Only the description of an entry that refunds depend on, or of a refund, can change */
const descriptionOnly = z.object({ description: name }).strict();

/**
 * Edits an entry in place (SPL-03), under its own id: description, and for one with no bank
 * payment its date, amount, payer and split too. It runs every check a new entry runs against
 * the ledger without it, then makes sure no repayment that was within what was owed now
 * exceeds it. An entry linked to a bank payment keeps its date and amount; a refund, or an
 * expense with refunds, changes its description only. Call inside a transaction: a refusal
 * throws, and the caller rolls the whole edit back.
 */
export function updateEvent(
  groupId: string,
  eventId: string,
  raw: unknown,
  source: ActivitySource = 'owner',
) {
  const before = snapshot(groupId);
  const old = before.events.find((e) => e.id === eventId);
  if (!old) throw new Error('Event not found');
  const who = (id: string | null) =>
    before.people.find((p) => p.id === id)?.name ?? 'the household account';
  const changes: string[] = [];
  if (old.kind === 'refund' || before.events.some((e) => e.reversesId === old.id)) {
    const parsed = descriptionOnly.safeParse(raw);
    if (!parsed.success)
      throw new Error('Only the description can change on a refund or an expense with refunds');
    if (parsed.data.description !== old.description) changes.push('description');
    db.update(events)
      .set({ description: parsed.data.description })
      .where(eq(events.id, old.id))
      .run();
  } else {
    const input = eventSchema.parse(raw);
    if (input.kind !== old.kind) throw new Error('The kind of an entry cannot change');
    if (input.transactionId !== old.transactionId)
      throw new Error('The bank payment of an entry cannot change here');
    if (old.transactionId && (input.date !== old.date || input.amount !== old.amount))
      throw new Error('The date and amount of an entry linked to a bank payment cannot change');
    if (input.description !== old.description) changes.push('description');
    if (input.date !== old.date) changes.push('date');
    if (input.amount !== old.amount)
      changes.push(`amount ${dollars(old.amount)} to ${dollars(input.amount ?? 0)}`);
    if (input.payerId !== old.payerId)
      changes.push(`payer ${who(old.payerId)} to ${who(input.payerId)}`);
    if (input.recipientId !== old.recipientId) changes.push('recipient');
    db.delete(shares).where(eq(shares.eventId, old.id)).run();
    db.delete(events).where(eq(events.id, old.id)).run();
    recordEvent(
      groupId,
      // The bill an entry was matched to stays with it
      // A repayment is checked at its place in the history below, not against today's balances
      { ...input, billId: old.billId, advance: input.advance || old.kind === 'settlement' },
      { id: old.id, log: false },
    );
    if (old.reviewReason)
      db.update(events).set({ reviewReason: old.reviewReason }).where(eq(events.id, old.id)).run();
    const after = snapshot(groupId);
    const next = after.events.find((e) => e.id === old.id)!;
    const was = JSON.stringify(old.shares.map((s) => [s.personId, s.amount]).sort());
    if (was !== JSON.stringify(next.shares.map((s) => [s.personId, s.amount]).sort()))
      changes.push('split');
    assertReservationsCovered(after);
    const stillValid = validSettlements(after);
    const moved =
      old.kind === 'settlement' &&
      (input.date !== old.date ||
        input.amount !== old.amount ||
        input.payerId !== old.payerId ||
        input.recipientId !== old.recipientId);
    if (moved && !stillValid.has(old.id))
      throw new Error('Settlement exceeds the outstanding balance');
    for (const id of validSettlements(before))
      if (!stillValid.has(id))
        throw new Error('That would leave a later repayment larger than what is owed');
  }
  if (!changes.length) return snapshot(groupId);
  const now = snapshot(groupId).events.find((e) => e.id === old.id)!;
  logActivity(
    groupId,
    'edited',
    old.id,
    `Changed “${now.description}” (${changes.join(', ')})`,
    source,
  );
  return snapshot(groupId);
}

/**
 * Removes an entry. A refund must go first, and removing funding the household account has
 * already spent leaves its payer owing the account again; only money set aside for bills has
 * to stay covered. Logged, so the line outlasts the entry (SPL-04).
 */
export function removeEvent(groupId: string, eventId: string, source: ActivitySource = 'owner') {
  const state = snapshot(groupId);
  const event = state.events.find((e) => e.id === eventId);
  if (!event) throw new Error('Event not found');
  if (state.events.some((e) => e.reversesId === event.id))
    throw new Error('Remove its refund first');
  const retained = state.events.filter((e) => e.id !== event.id);
  const ledger = householdLedger(
    state.people,
    retained,
    retained.flatMap((e) => e.shares),
  );
  const reserved = state.bills
    .filter((b) => !retained.some((e) => e.billId === b.id && e.kind === 'expense'))
    .reduce((n, b) => n + b.reserved, 0);
  if (reserved > 0 && ledger.pool < reserved)
    throw new Error('Release bill reservations before removing this funding');
  db.delete(shares).where(eq(shares.eventId, event.id)).run();
  db.delete(events).where(eq(events.id, event.id)).run();
  logActivity(
    groupId,
    'removed',
    event.id,
    `Removed “${event.description}” (${dollars(Math.abs(event.amount))})`,
    source,
  );
  return snapshot(groupId);
}

/**
 * Shares one bank payment with the household as an expense: paid by you from a personal
 * account, or by the pool from a pool account, split by `split`, the group's default split,
 * or equally between everyone. Returns the event id.
 */
export function shareTransaction(
  groupId: string,
  transactionId: string,
  split?: DefaultSplit,
  source: ActivitySource = 'owner',
) {
  const state = snapshot(groupId);
  const tx = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
  if (!tx) throw new Error('Transaction not found');
  if (tx.amount >= 0) throw new Error('Only a payment (money out) can be shared');
  const { mode, shares: shareList } = splitOrEqual(split ?? state.group.defaultSplit, state.people);
  const fixed = mode === 'exact' ? shareList.reduce((n, s) => n + s.value, 0) : 0;
  if (mode === 'exact' && fixed !== -tx.amount)
    throw new Error(
      `The fixed amounts add up to ${dollars(fixed)}, but this payment is ${dollars(-tx.amount)}`,
    );
  const fromPool = state.poolAccountIds.includes(tx.accountId);
  return recordEvent(
    groupId,
    {
      kind: 'expense',
      date: tx.date,
      description: tx.payeeName?.trim() || 'Shared expense',
      amount: -tx.amount,
      payerId: fromPool ? null : state.people.find((p) => p.isSelf)!.id,
      transactionId: tx.id,
      mode,
      shares: shareList,
    },
    { source },
  );
}

const dollars = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A split to use: the one given (or the default), else equal between everyone */
function splitOrEqual(split: DefaultSplit | null, members: { id: string }[]) {
  return split && split.shares.length
    ? { mode: split.mode, shares: split.shares }
    : { mode: 'equal' as const, shares: members.map((p) => ({ personId: p.id, value: 1 })) };
}

/**
 * What everyone's share of a bill of `amount` cents comes to with a split (the default when
 * null, else equal). Fixed amounts are each person's set part whatever the amount; `fixedTotal`
 * is what they add up to (null for other splits). Shared by the Household page's recurring
 * bills and by Recurring's "your share" (scheduleScope.ts).
 */
export function billShares(split: DefaultSplit | null, members: { id: string }[], amount: number) {
  const { mode, shares: weights } = splitOrEqual(split, members);
  const values = weights.map((w) => (mode === 'equal' ? 1 : w.value));
  const amounts =
    mode === 'exact'
      ? values
      : amount && values.some((v) => v > 0)
        ? allocateShares(amount, values)
        : [];
  return {
    shares: weights.map((w, i) => ({ personId: w.personId, amount: amounts[i] ?? 0 })),
    fixedTotal: mode === 'exact' ? values.reduce((n, v) => n + v, 0) : null,
  };
}

/** Days back a shared recurring bill looks for payments by its payee */
const BILL_PAYMENT_DAYS = 180;
/** Payments listed per shared recurring bill, newest first */
const BILL_PAYMENTS_SHOWN = 6;

/** A household's shared recurring items; a cancelled bill is over (its shared payments stay) */
function sharedSchedules(groupId: string) {
  return db
    .select()
    .from(recurringBills)
    .where(eq(recurringBills.groupId, groupId))
    .all()
    .flatMap((link) => {
      const schedule = db.select().from(schedules).where(eq(schedules.id, link.scheduleId)).get();
      return schedule && schedule.status !== 'canceled' ? [{ link, schedule }] : [];
    });
}

/** Every date a shared bill is still expected from `from` to `to`, with everyone's share */
function sharedOccurrences(
  schedule: typeof schedules.$inferSelect,
  split: DefaultSplit | null,
  members: { id: string }[],
  from: string,
  to: string,
) {
  return pendingOccurrences(schedule, from, to).map((o) => {
    const amount = Math.abs(o.expectedAmount);
    return {
      date: o.expectedDate,
      amount,
      shares: billShares(split, members, amount).shares,
    };
  });
}

/**
 * The active shared recurring bills of a household with their expected dates from `from` to
 * `to` and each person's share, from the household's own splits. The one source of what a
 * household's recurring bills will cost, read by the cash forecast (forecastService.ts); the
 * Household page's recurring bills and coverage read the same occurrences.
 */
export function sharedRecurringDue(groupId: string, from: string, to: string) {
  const group = db.select().from(groups).where(eq(groups.id, groupId)).get();
  if (!group) return [];
  const members = db.select().from(people).where(eq(people.groupId, groupId)).all();
  const defaultSplit = parseSplit(group.defaultSplitJson);
  const pools = poolAccountsOf(group);
  return sharedSchedules(groupId)
    .filter(({ schedule }) => schedule.status === 'active')
    .map(({ link, schedule }) => ({
      schedule,
      paidFromPool: !!schedule.accountId && pools.includes(schedule.accountId),
      selfId: members.find((m) => m.isSelf)?.id ?? null,
      occurrences: sharedOccurrences(
        schedule,
        parseSplit(link.splitJson) ?? defaultSplit,
        members,
        from,
        to,
      ),
    }));
}

/**
 * Recurring items shared with this household: each with its next date, what everyone's share
 * of the expected amount comes to with its split (its own, or the default), and its recent
 * payments (those matched to it in Recurring, or by its payee) with whether each is shared yet.
 * Past payments are shared with a click; new ones automatically only when the bill says so
 * (autoShareBillPayment).
 */
function sharedRecurringBills(
  groupId: string,
  members: { id: string }[],
  split: DefaultSplit | null,
  poolAccountIds: string[],
) {
  const shared = sharedSchedules(groupId);
  if (!shared.length) return [];
  const coverageFrom = todayIso();
  const coverageTo = addDaysIso(coverageFrom, COVERAGE_DAYS);
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
  return shared.flatMap(({ link, schedule }) => {
    const ownSplit = parseSplit(link.splitJson);
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
    const { shares: billShareRows, fixedTotal } = billShares(ownSplit ?? split, members, amount);
    // Every date it is still expected within the coverage gauge's window, with everyone's share
    const upcoming = sharedOccurrences(
      schedule,
      ownSplit ?? split,
      members,
      coverageFrom,
      coverageTo,
    );
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
        amountType: schedule.amountType,
        /** The schedule's own signed amount, for an edit that keeps its sign */
        scheduleAmount: schedule.amount,
        accountId: schedule.accountId,
        recurrenceType: schedule.recurrenceType,
        status: schedule.status,
        nextDate: next?.date ?? null,
        paidFromPool: !!schedule.accountId && poolAccountIds.includes(schedule.accountId),
        /** Its own split; null = the household's default split */
        split: ownSplit,
        autoShareFrom: link.autoShareFrom,
        shares: billShareRows,
        /** What fixed amounts add up to (null for other splits); payments must equal it */
        fixedTotal,
        payments,
        /** Expected dates in the coverage window (today to COVERAGE_DAYS ahead) */
        upcoming,
        /** Its newest payment since the owner set the amount, when outside tolerance (billDrift) */
        drift: billDrift(amount, schedule.amountType, payments, schedule.amountConfirmedAt),
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

/**
 * Checks a split against the household's people: each once, someone with a share, and
 * percentages (basis points) totalling 100%. Fixed amounts only suit a recurring bill, whose
 * payments are the same each time, so the household's default split can't use them.
 */
export function checkSplit(people: { id: string }[], split: DefaultSplit, allowFixed = false) {
  if (split.mode === 'exact' && !allowFixed)
    throw new Error('Fixed amounts are for a recurring bill, not the default split');
  const ids = split.shares.map((s) => s.personId);
  if (new Set(ids).size !== ids.length || ids.some((id) => !people.some((p) => p.id === id)))
    throw new Error('Choose participants once each');
  if (split.mode !== 'equal' && !split.shares.some((s) => s.value > 0))
    throw new Error('Give someone a share');
  if (split.mode === 'percentage' && split.shares.reduce((n, s) => n + s.value, 0) !== 10000)
    throw new Error('Percentage shares must total 10000 basis points');
}

function billLink(groupId: string, scheduleId: string) {
  const link = db
    .select()
    .from(recurringBills)
    .where(and(eq(recurringBills.groupId, groupId), eq(recurringBills.scheduleId, scheduleId)))
    .get();
  if (!link) throw new Error('This recurring item is not shared with this household');
  return link;
}

/**
 * Changes a shared recurring bill: its own split (null = the household's default) and whether
 * new payments are shared as they arrive (from today, so past ones stay a click).
 */
export function updateRecurringBill(
  groupId: string,
  scheduleId: string,
  changes: { split?: DefaultSplit | null; autoShare?: boolean },
  today = format(new Date(), 'yyyy-MM-dd'),
) {
  const state = snapshot(groupId);
  const link = billLink(groupId, scheduleId);
  const set: { splitJson?: string | null; autoShareFrom?: string | null } = {};
  if (changes.split !== undefined) {
    const split = changes.split && changes.split.mode !== 'equal' ? changes.split : null;
    if (split) checkSplit(state.people, split, true);
    set.splitJson = split ? JSON.stringify(split) : null;
  }
  if (changes.autoShare !== undefined)
    set.autoShareFrom = changes.autoShare ? (link.autoShareFrom ?? today) : null;
  if (Object.keys(set).length)
    db.update(recurringBills).set(set).where(eq(recurringBills.scheduleId, scheduleId)).run();
  return snapshot(groupId);
}

/** Shares a bill's payments with the bill's own split (or the default). Each is checked alone. */
/** Where a share came from: the Share action, a bill's payments, a bill shared as it arrives, a rule */
export type ShareSource = 'manual' | 'bill' | 'auto-bill' | 'rule';
export type ShareResult =
  | {
      transactionId: string;
      ok: true;
      /** The entry recorded; null for a preview, which records nothing */
      eventId: string | null;
      amount: number;
      shares: { personId: string; amount: number }[];
    }
  | { transactionId: string; ok: false; error: string };

class PreviewOnly extends Error {}

/**
 * Audit F-13: the one way to share bank payments with a household, whatever asked for it. Each
 * payment is recorded on its own (one refused never stops the rest) through shareTransaction,
 * so every path has the same checks and the same refusal messages, and the same result: who
 * owes what. `preview` runs exactly the same checks and records nothing.
 */
export function sharePayments(
  groupId: string,
  transactionIds: string[],
  options: { split?: DefaultSplit; source: ShareSource; preview?: boolean },
): ShareResult[] {
  return transactionIds.map((transactionId) => {
    let result: ShareResult | null = null;
    try {
      db.transaction(() => {
        const eventId = shareTransaction(
          groupId,
          transactionId,
          options.split,
          options.source === 'rule'
            ? 'rule'
            : options.source === 'auto-bill'
              ? 'recurring_bill'
              : 'owner',
        );
        const event = db.select().from(events).where(eq(events.id, eventId)).get()!;
        result = {
          transactionId,
          ok: true,
          eventId: options.preview ? null : eventId,
          amount: event.amount,
          shares: db
            .select({ personId: shares.personId, amount: shares.amount })
            .from(shares)
            .where(eq(shares.eventId, eventId))
            .all(),
        };
        if (options.preview) throw new PreviewOnly();
      });
      return result!;
    } catch (error) {
      if (error instanceof PreviewOnly) return result!;
      const message = error instanceof Error ? error.message : 'Could not share';
      // Shared without anyone watching: say why in the log, never fail the import
      if (options.source === 'auto-bill' || options.source === 'rule')
        console.warn(
          `Could not share a payment with the household (${options.source}): ${message}`,
        );
      return { transactionId, ok: false, error: message };
    }
  });
}

export function shareBillPayments(groupId: string, scheduleId: string, transactionIds: string[]) {
  const split = parseSplit(billLink(groupId, scheduleId).splitJson) ?? undefined;
  return sharePayments(groupId, transactionIds, { split, source: 'bill' });
}

/**
 * A new payment to the payee of a bill that shares automatically, dated on or after the day it
 * was turned on: shared with that bill's split. Money out only, never a transfer or a split
 * part. A payment the household refuses is left unshared, so an import never fails over it.
 * Returns whether it was shared.
 */
export function autoShareBillPayment(tx: {
  id: string;
  date: string;
  amount: number;
  payeeId: string | null;
  transferTransactionId?: string | null;
  parentTransactionId?: string | null;
}) {
  if (!tx.payeeId || tx.amount >= 0 || tx.transferTransactionId || tx.parentTransactionId)
    return false;
  const bill = db
    .select({
      groupId: recurringBills.groupId,
      splitJson: recurringBills.splitJson,
      from: recurringBills.autoShareFrom,
    })
    .from(recurringBills)
    .innerJoin(schedules, eq(schedules.id, recurringBills.scheduleId))
    .where(and(eq(schedules.payeeId, tx.payeeId), isNotNull(recurringBills.autoShareFrom)))
    .all()
    .find((b) => b.from! <= tx.date);
  if (!bill) return false;
  return sharePayments(bill.groupId, [tx.id], {
    split: parseSplit(bill.splitJson) ?? undefined,
    source: 'auto-bill',
  })[0].ok;
}

const personName = z.string().trim().min(1).max(200);

function checkName(people: { id: string; name: string }[], name: string, except?: string) {
  if (people.some((p) => p.id !== except && p.name.toLowerCase() === name.toLowerCase()))
    throw new Error(`${name} is already in this household`);
}

/**
 * Adds someone to a household. They start settled; an equal split includes them from now on,
 * and a percentage or weight split leaves them out until it is changed.
 */
export function addPerson(groupId: string, raw: unknown) {
  const state = snapshot(groupId);
  const name = personName.parse(raw);
  if (state.people.length >= 50) throw new Error('A household has at most 50 people');
  checkName(state.people, name);
  db.insert(people).values({ id: nanoid(), groupId, name, isSelf: 0 }).run();
  return snapshot(groupId);
}

/** Renames someone; their entries, shares and balance stay theirs */
export function renamePerson(groupId: string, personId: string, raw: unknown) {
  const state = snapshot(groupId);
  if (!state.people.some((p) => p.id === personId)) throw new Error('Person not found');
  const name = personName.parse(raw);
  checkName(state.people, name, personId);
  db.update(people).set({ name }).where(eq(people.id, personId)).run();
  return snapshot(groupId);
}

const reconcileInput = z
  .object({
    date: date.optional(),
    /**
     * Each person's agreed balance with the household account, in cents (positive = credit
     * held there, negative = owes it). Anyone left out is agreed at 0. What people owe each
     * other directly is always cleared: settle that first if it should be paid instead.
     */
    agreed: z
      .array(
        z.object({
          personId: z.string().min(1).max(64),
          amount: z.number().int().min(-1e12).max(1e12),
        }),
      )
      .max(100)
      .default([]),
    /** Show what would change, recording nothing */
    preview: z.boolean().optional(),
  })
  .strict();

/**
 * Reconciles a household: sets every balance to an agreed figure (0 unless given) from a date,
 * with up to two adjustment entries, so later activity starts from there. Earlier entries stay
 * as they were; removing the adjustments (Undo) brings the old balances back.
 */
export function reconcileBalances(groupId: string, raw: unknown, source: ActivitySource = 'owner') {
  const state = snapshot(groupId);
  const input = reconcileInput.parse(raw);
  const asOf = input.date ?? todayIso();
  const agreed = new Map<string, number>();
  for (const a of input.agreed) {
    if (!state.people.some((p) => p.id === a.personId)) throw new Error('Person not found');
    if (agreed.has(a.personId)) throw new Error('Give each person one agreed balance');
    agreed.set(a.personId, a.amount);
  }
  const poolShares = state.people
    .map((p) => ({ personId: p.id, amount: (agreed.get(p.id) ?? 0) - state.toPool[p.id] }))
    .filter((s) => s.amount !== 0);
  const directShares = state.people
    .map((p) => ({ personId: p.id, amount: -state.direct[p.id] }))
    .filter((s) => s.amount !== 0);
  const newPool = state.pool + poolShares.reduce((n, s) => n + s.amount, 0);
  const people = state.people.map((p) => ({
    personId: p.id,
    before: state.balances[p.id],
    after: agreed.get(p.id) ?? 0,
  }));
  const result = {
    date: asOf,
    people,
    poolShares,
    directShares,
    pool: { before: state.pool, after: newPool },
  };
  if (input.preview) return { ...result, recorded: [] as string[], state };
  if (!poolShares.length && !directShares.length)
    throw new Error('These balances are already agreed: nothing to change');
  if (state.reserved > 0 && newPool < state.reserved)
    throw new Error('Release bill reservations first: the agreed balances don’t cover them');
  const description = `Balances agreed on ${asOf}`;
  const recorded: string[] = [];
  db.transaction(() => {
    for (const [kind, list] of [
      ['pool_adjustment', poolShares],
      ['balance_adjustment', directShares],
    ] as const) {
      if (!list.length) continue;
      const id = nanoid();
      db.insert(events)
        .values({
          id,
          groupId,
          kind,
          date: asOf,
          description,
          // What the entry moves, for lists; the shares carry the signed amounts
          amount: list.reduce((n, s) => n + Math.abs(s.amount), 0),
        })
        .run();
      db.insert(shares)
        .values(list.map((s) => ({ id: nanoid(), eventId: id, ...s })))
        .run();
      recorded.push(id);
    }
    logActivity(groupId, 'settled', recorded[0], `${description}`, source);
  });
  return { ...result, recorded, state: snapshot(groupId) };
}

const groupEdit = z
  .object({
    name: name.optional(),
    /** Make this the household that opens first (there is only ever one) */
    isDefault: z.literal(true).optional(),
  })
  .strict();

/** Renames a household or makes it the one that opens first; its entries are unchanged */
export function updateGroup(groupId: string, raw: unknown) {
  const state = snapshot(groupId);
  const input = groupEdit.parse(raw);
  db.transaction((tx) => {
    if (input.name !== undefined)
      tx.update(groups).set({ name: input.name }).where(eq(groups.id, groupId)).run();
    if (input.isDefault) {
      tx.update(groups).set({ isDefault: 0 }).run();
      tx.update(groups).set({ isDefault: 1 }).where(eq(groups.id, groupId)).run();
    }
  });
  return snapshot(state.group.id);
}

const billEdit = z.object({
  description: name.optional(),
  dueDate: date.optional(),
  amount: money.optional(),
  personalShare: z.number().int().min(0).max(1e12).optional(),
});

/**
 * Edits a one-off bill. Its name and due date can always change; its amounts only while no
 * expense is matched to it, since its paid/needs-review status compares them with payments.
 */
export function editBill(groupId: string, billId: string, raw: unknown) {
  const state = snapshot(groupId);
  const bill = state.bills.find((b) => b.id === billId);
  if (!bill) throw new Error('Bill not found');
  const input = billEdit.parse(raw);
  const matched = state.events.some((e) => e.billId === billId);
  if (
    matched &&
    ((input.amount !== undefined && input.amount !== bill.amount) ||
      (input.personalShare !== undefined && input.personalShare !== bill.personalShare))
  )
    throw new Error('A payment is matched to this bill: remove that entry to change its amounts');
  const amount = input.amount ?? bill.amount;
  if ((input.personalShare ?? bill.personalShare) > amount)
    throw new Error('Personal share exceeds the total bill');
  if (bill.reserved > amount) throw new Error('Lower its reservation below the new total first');
  if (Object.values(input).some((v) => v !== undefined))
    db.update(bills).set(input).where(eq(bills.id, billId)).run();
  return snapshot(groupId);
}

/**
 * A recurring item's amount changed (PUT /api/schedules/:id): its household bills due from
 * `today` that no payment is matched to follow it, with my share recomputed by the bill's split
 * (its own, or the household's default). Past bills, matched ones, and ones with more set aside
 * than the new total keep what they were: a reservation is never changed here, so undoing the
 * schedule edit (which only resends the schedule's fields) can't leave money released, and a
 * lower amount needs its reservation lowered first, as editBill requires. Called inside the
 * schedule update's DB transaction.
 */
export function followScheduleAmount(scheduleId: string, amount: number, today = todayIso()) {
  const total = Math.abs(amount);
  const linked = db.select().from(bills).where(eq(bills.scheduleId, scheduleId)).all();
  for (const bill of linked) {
    if (bill.dueDate < today || bill.reserved > total) continue;
    if (db.select({ id: events.id }).from(events).where(eq(events.billId, bill.id)).get()) continue;
    const group = db.select().from(groups).where(eq(groups.id, bill.groupId)).get();
    if (!group) continue;
    const members = db.select().from(people).where(eq(people.groupId, group.id)).all();
    const link = db
      .select()
      .from(recurringBills)
      .where(and(eq(recurringBills.groupId, group.id), eq(recurringBills.scheduleId, scheduleId)))
      .get();
    const split = parseSplit(link?.splitJson ?? null) ?? parseSplit(group.defaultSplitJson);
    const self = members.find((m) => m.isSelf);
    const mine = billShares(split, members, total).shares.find((x) => x.personId === self?.id);
    db.update(bills)
      .set({ amount: total, personalShare: Math.min(mine?.amount ?? 0, total) })
      .where(eq(bills.id, bill.id))
      .run();
  }
}

/** Deletes a one-off bill no expense is matched to; its reservation is released */
export function deleteBill(groupId: string, billId: string) {
  const state = snapshot(groupId);
  if (!state.bills.some((b) => b.id === billId)) throw new Error('Bill not found');
  if (state.events.some((e) => e.billId === billId))
    throw new Error('A payment is matched to this bill: remove that entry first');
  db.delete(bills).where(eq(bills.id, billId)).run();
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

/** Days back that money received or paid is checked against what people owe */
const REPAYMENT_DAYS = 120;
export const words = (s: string) =>
  s
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);

/** The first of `among` with a word of their name in a payee's text (two letters or more) */
export function personNamedIn<P extends { name: string }>(text: string, among: P[]) {
  const payee = new Set(words(text));
  return among.find((p) => words(p.name).some((w) => payee.has(w)));
}

/**
 * Money received that looks like it settles something, for the owner to confirm one by one:
 * - `settlement`: money into your personal accounts whose payee has the name of someone who owes
 *   people (for things someone paid themselves), up to what they owe and what you're owed. What
 *   people owe the household account isn't owed to you, so it never counts here.
 * - `payment`: money out of your personal accounts whose payee has the name of someone you owe
 *   for things they paid themselves, up to what you owe and what they're owed.
 * - `contribution`: money into a household account, not linked yet, from someone in the
 *   household (their name in the payee), or a transfer from one of your own accounts.
 */
export function repaymentSuggestions(groupId: string, today: string) {
  const state = snapshot(groupId);
  const self = state.people.find((p) => p.isSelf)!;
  const owedToSelf = state.direct[self.id] ?? 0;
  const debtors = state.people.filter((p) => !p.isSelf && (state.direct[p.id] ?? 0) < 0);
  const creditors = state.people.filter((p) => !p.isSelf && (state.direct[p.id] ?? 0) > 0);
  const owedBySelf = -owedToSelf;
  const since = addDaysIso(today, -REPAYMENT_DAYS);
  const linked = new Set(
    db
      .select({ id: events.transactionId })
      .from(events)
      .where(isNotNull(events.transactionId))
      .all()
      .map((e) => e.id),
  );
  const recent = db
    .select()
    .from(transactions)
    // Money out is only looked at when you owe someone, to match your own repayment to them
    .where(
      and(
        gte(transactions.date, since),
        owedBySelf > 0 ? ne(transactions.amount, 0) : gte(transactions.amount, 1),
      ),
    )
    .all()
    .filter((t) => t.date <= today && !t.isParent && !t.parentTransactionId && !linked.has(t.id));
  const named = (t: (typeof recent)[number], among: typeof state.people) =>
    personNamedIn(`${t.payeeName ?? ''} ${t.importedPayee ?? ''}`, among);
  const base = (t: (typeof recent)[number]) => ({
    transactionId: t.id,
    date: t.date,
    amount: t.amount,
    payeeName: t.payeeName,
    notes: t.notes,
  });
  const settlements =
    debtors.length && owedToSelf > 0
      ? recent
          .filter(
            (t) =>
              t.amount > 0 &&
              !t.transferTransactionId &&
              !state.poolAccountIds.includes(t.accountId),
          )
          .flatMap((t) => {
            const person = named(t, debtors);
            if (!person) return [];
            const owes = -(state.direct[person.id] ?? 0);
            if (t.amount > owes || t.amount > owedToSelf) return [];
            return [
              {
                kind: 'settlement' as const,
                ...base(t),
                personId: person.id,
                personName: person.name,
                owes,
              },
            ];
          })
      : [];
  const ownLeg = (t: (typeof recent)[number]) => {
    if (!t.transferTransactionId) return false;
    const other = db
      .select({ accountId: transactions.accountId })
      .from(transactions)
      .where(eq(transactions.id, t.transferTransactionId))
      .get();
    // From one of your own accounts: not this household's, and not another household's either
    return !!other && !poolGroupOf(other.accountId) && !linked.has(t.transferTransactionId);
  };
  // The mirror case: money you paid out to a housemate you owe, from a personal account
  const payments =
    creditors.length && owedBySelf > 0
      ? recent
          .filter(
            (t) =>
              t.amount < 0 &&
              !t.transferTransactionId &&
              !state.poolAccountIds.includes(t.accountId),
          )
          .flatMap((t) => {
            const person = named(t, creditors);
            if (!person) return [];
            const owed = state.direct[person.id] ?? 0;
            if (-t.amount > owedBySelf || -t.amount > owed) return [];
            return [
              {
                kind: 'payment' as const,
                ...base(t),
                amount: -t.amount,
                personId: person.id,
                personName: person.name,
                owes: owedBySelf,
              },
            ];
          })
      : [];
  const contributions = recent
    .filter((t) => t.amount > 0 && state.poolAccountIds.includes(t.accountId))
    .flatMap((t) => {
      const person = ownLeg(t)
        ? self
        : t.transferTransactionId
          ? undefined
          : named(
              t,
              state.people.filter((p) => !p.isSelf),
            );
      if (!person) return [];
      return [
        {
          kind: 'contribution' as const,
          ...base(t),
          personId: person.id,
          personName: person.name,
          owes: Math.max(0, -(state.toPool[person.id] ?? 0)),
        },
      ];
    });
  return [...settlements, ...payments, ...contributions].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
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
    // What was added, changed, removed or settled (SPL-04): a combined partner sees it too
    activity: householdActivity(id, 50).map(({ time, kind, summary }) => ({ time, kind, summary })),
  };
}
export type SharedExport = ReturnType<typeof sharedExport>;
