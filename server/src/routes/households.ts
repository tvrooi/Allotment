import { Router, type Response } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  categories,
  categoryGroups,
  accounts,
  budgetSettings,
  transactions,
  householdGroups as groups,
  householdPeople as people,
  householdEvents as events,
  householdShares as shares,
  householdBills as bills,
  schedules,
} from '../db/schema.js';
import { allocateShares, householdLedger } from '../services/householdLedger.js';
import { accountTransactionSum } from '../services/balances.js';

export const householdsRouter = Router();
const money = z.number().int().min(1).max(1e12);
const name = z.string().trim().min(1).max(200);
const date = z.iso.date();
const groupSchema = z.object({
  name,
  currency: z.literal('AUD'),
  accountId: z.string().nullable().default(null),
  people: z.array(name).min(2).max(50),
  selfIndex: z.number().int().min(0),
});
function snapshot(id: string) {
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
  const account = group.accountId
    ? db.select().from(accounts).where(eq(accounts.id, group.accountId)).get()
    : null;
  const cash = account ? account.startingBalance + accountTransactionSum(account.id) : 0;
  const allBills = db.select().from(bills).where(eq(bills.groupId, id)).all();
  const remaining = allBills.filter(
    (b) => !entries.some((e) => e.billId === b.id && e.kind === 'expense'),
  );
  const reserved = remaining.reduce((sum, b) => sum + b.reserved, 0);
  return {
    group,
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
function run(res: Response, fn: () => unknown, status = 200) {
  try {
    const result = db.transaction(fn);
    res.status(status).json(result);
  } catch (error) {
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Invalid household entry' });
  }
}
householdsRouter.get('/', (_req, res) => res.json(db.select().from(groups).all()));
householdsRouter.post('/', (req, res) =>
  run(
    res,
    () => {
      const input = groupSchema.parse(req.body);
      if (new Set(input.people.map((n) => n.toLocaleLowerCase())).size !== input.people.length)
        throw new Error('Use distinct participant names');
      if (input.selfIndex >= input.people.length) throw new Error('Choose your participant');
      if (input.accountId) {
        const account = db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();
        const currency = db.select().from(budgetSettings).get()?.currency ?? 'AUD';
        if (!account || account.closedAt || (account.currency ?? currency) !== input.currency)
          throw new Error('Choose an open account in the household currency');
        if (db.select().from(groups).where(eq(groups.accountId, input.accountId)).get())
          throw new Error('Account already belongs to a household');
      }
      // Pin the declared pool currency so later budget relabelling cannot reinterpret it.
      if (input.accountId)
        db.update(accounts)
          .set({ currency: input.currency })
          .where(eq(accounts.id, input.accountId))
          .run();
      const group = {
        id: nanoid(),
        name: input.name,
        currency: input.currency,
        accountId: input.accountId,
      };
      db.insert(groups).values(group).run();
      input.people.forEach((n, i) =>
        db
          .insert(people)
          .values({
            id: nanoid(),
            groupId: group.id,
            name: n,
            isSelf: i === input.selfIndex ? 1 : 0,
          })
          .run(),
      );
      return snapshot(group.id);
    },
    201,
  ),
);
householdsRouter.get('/:id', (req, res) => run(res, () => snapshot(req.params.id)));
const eventSchema = z.object({
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
householdsRouter.post('/:id/events', (req, res) =>
  run(
    res,
    () => {
      const state = snapshot(req.params.id);
      const input = eventSchema.parse(req.body);
      const member = (id: string | null) => id !== null && state.people.some((p) => p.id === id);
      if (
        (input.payerId && !member(input.payerId)) ||
        (input.recipientId && !member(input.recipientId))
      )
        throw new Error('Participant belongs to another household');
      let amount = input.amount ?? 0;
      let portions: { personId: string; amount: number }[] = [];
      if (input.kind === 'refund') {
        const original = state.events.find(
          (e) => e.id === input.reversesId && e.kind === 'expense',
        );
        if (!original) throw new Error('Choose the original expense');
        if (input.date < original.date)
          throw new Error('Refund cannot precede the original expense');
        const prior = state.events.filter((e) => e.reversesId === original.id);
        const remaining = original.amount + prior.reduce((n, e) => n + e.amount, 0);
        const refund = input.amount ?? remaining;
        if (refund <= 0 || refund > remaining)
          throw new Error('Refund exceeds the unrefunded expense');
        amount = -refund;
        input.payerId = original.payerId;
        input.billId = original.billId;
        const weights = original.shares.map(
          (s) =>
            s.amount +
            prior.reduce(
              (n, e) =>
                n +
                e.shares.filter((p) => p.personId === s.personId).reduce((n, s) => n + s.amount, 0),
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
          (!state.group.accountId ||
            state.pool -
              state.bills
                .filter((b) => b.id !== input.billId && b.status !== 'paid')
                .reduce((n, b) => n + b.reserved, 0) <
              amount)
        )
          throw new Error('Record received pool contributions before spending them');
      } else {
        if (input.kind === 'contribution' && !state.group.accountId)
          throw new Error('Contributions require a household pool account');
        if (!amount || !member(input.payerId))
          throw new Error('Choose a payer and positive amount');
        if (
          input.kind === 'settlement' &&
          (!member(input.recipientId) ||
            input.recipientId === input.payerId ||
            amount > -(state.balances[input.payerId!] ?? 0) ||
            amount > (state.balances[input.recipientId!] ?? 0))
        )
          throw new Error('Settlement exceeds the outstanding balance');
      }
      if (input.kind !== 'refund' && input.reversesId)
        throw new Error('Only refunds reverse expenses');
      if (input.billId && !state.bills.some((b) => b.id === input.billId))
        throw new Error('Bill belongs to another household');
      if (
        input.billId &&
        input.kind !== 'refund' &&
        (input.kind !== 'expense' || state.events.some((e) => e.billId === input.billId))
      )
        throw new Error('Bill is already matched or is not an expense');
      if (input.transactionId) {
        const tx = db
          .select()
          .from(transactions)
          .where(eq(transactions.id, input.transactionId))
          .get();
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
        const expectedAccount =
          input.payerId === null || input.kind === 'contribution' ? state.group.accountId : null;
        if (expectedAccount && tx.accountId !== expectedAccount)
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
          state.group.accountId === tx.accountId
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
      return snapshot(state.group.id);
    },
    201,
  ),
);
const billSchema = z.object({
  description: name,
  dueDate: date,
  amount: money,
  personalShare: z.number().int().min(0).max(1e12).default(0),
  reserved: z.number().int().min(0).max(1e12).default(0),
  scheduleId: z.string().nullable().default(null),
});
householdsRouter.post('/:id/bills', (req, res) =>
  run(
    res,
    () => {
      const state = snapshot(req.params.id);
      const input = billSchema.parse(req.body);
      if (input.personalShare > input.amount)
        throw new Error('Personal share exceeds the total bill');
      if (input.reserved > input.amount || input.reserved > state.unreserved)
        throw new Error('Reservation exceeds unallocated received pool funds');
      if (input.scheduleId) {
        const s = db.select().from(schedules).where(eq(schedules.id, input.scheduleId)).get();
        if (!s || s.autoCreate)
          throw new Error(
            'Choose a schedule with automatic creation disabled to avoid duplicate bill payments',
          );
      }
      db.insert(bills)
        .values({ id: nanoid(), groupId: state.group.id, ...input })
        .run();
      return snapshot(state.group.id);
    },
    201,
  ),
);
householdsRouter.put('/:id/bills/:billId/reservation', (req, res) =>
  run(res, () => {
    const state = snapshot(req.params.id);
    const bill = state.bills.find((b) => b.id === req.params.billId);
    const reserved = z.number().int().min(0).max(1e12).parse(req.body.reserved);
    if (
      !bill ||
      state.events.some((e) => e.billId === bill.id) ||
      reserved > bill.amount ||
      reserved > state.unreserved + bill.reserved
    )
      throw new Error('Reservation exceeds available funds or bill is already paid');
    db.update(bills).set({ reserved }).where(eq(bills.id, bill.id)).run();
    return snapshot(state.group.id);
  }),
);
householdsRouter.get('/:id/statement', (req, res) =>
  run(res, () => {
    const state = snapshot(req.params.id);
    const from = req.query.from ? date.parse(req.query.from) : '0000-01-01';
    const to = req.query.to ? date.parse(req.query.to) : '9999-12-31';
    if (from > to) throw new Error('Start date must precede end date');
    const entries = state.events.filter((e) => e.date >= from && e.date <= to);
    const self = state.people.find((p) => p.isSelf)!;
    const expenseEntries = entries.filter((e) => e.kind === 'expense' || e.kind === 'refund');
    return {
      title: 'Household and personal expense shares',
      currency: state.group.currency,
      from,
      to,
      householdSpending: expenseEntries.reduce((n, e) => n + e.amount, 0),
      personalSpending: expenseEntries.reduce(
        (n, e) =>
          n + e.shares.filter((s) => s.personId === self.id).reduce((n, s) => n + s.amount, 0),
        0,
      ),
      balances: state.balances,
      events: entries,
    };
  }),
);

householdsRouter.delete('/:id/events/:eventId', (req, res) =>
  run(res, () => {
    const state = snapshot(req.params.id);
    const event = state.events.find((e) => e.id === req.params.eventId);
    if (!event) throw new Error('Event not found');
    if (state.events.some((e) => e.reversesId === event.id))
      throw new Error('Remove its refund first');
    const retained = state.events.filter((e) => e.id !== event.id);
    const allocations = retained.flatMap((e) => e.shares);
    const ledger = householdLedger(state.people, retained, allocations);
    if (ledger.pool < 0) throw new Error('Contribution has already funded expenses');
    const reserved = state.bills
      .filter((b) => !retained.some((e) => e.billId === b.id && e.kind === 'expense'))
      .reduce((n, b) => n + b.reserved, 0);
    if (ledger.pool < reserved)
      throw new Error('Release bill reservations before removing this funding');
    db.delete(shares).where(eq(shares.eventId, event.id)).run();
    db.delete(events).where(eq(events.id, event.id)).run();
    return snapshot(state.group.id);
  }),
);
