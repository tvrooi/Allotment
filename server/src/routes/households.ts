import { Router, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  accounts,
  budgetSettings,
  transactions,
  householdGroups as groups,
  householdPeople as people,
  householdEvents as events,
  householdShares as shares,
  householdBills as bills,
  householdPoolAccounts as poolAccountsTable,
  schedules,
} from '../db/schema.js';
import { householdLedger } from '../services/householdLedger.js';
import {
  poolAccountsOf,
  poolGroupOf,
  recordEvent,
  repaymentSuggestions,
  shareRecurringBills,
  shareTransaction,
  sharedExport,
  snapshot,
  splitSchema,
  unshareRecurringBill,
} from '../services/householdService.js';
import { todayIso } from '../services/mainAmountService.js';

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
householdsRouter.get('/', (_req, res) =>
  res.json(
    db
      .select()
      .from(groups)
      .all()
      .map(({ defaultSplitJson, ...g }) => ({
        ...g,
        poolAccountIds: poolAccountsOf(g),
        defaultSplit: defaultSplitJson ? (JSON.parse(defaultSplitJson) as unknown) : null,
      })),
  ),
);
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
        if (poolGroupOf(input.accountId)) throw new Error('Account already belongs to a household');
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
// For a combined household (gateway/sharing.ts): the record the other person sees, which the
// gateway asks for with its secret. Less than GET /:id, which the owner can already read.
householdsRouter.get('/:id/shared-export', (req, res) =>
  run(res, () => sharedExport(req.params.id)),
);
householdsRouter.post('/:id/events', (req, res) =>
  run(
    res,
    () => {
      recordEvent(req.params.id, req.body);
      return snapshot(req.params.id);
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
// More pool accounts: each one leaves the personal budget, as the first one did
householdsRouter.post('/:id/pool-accounts', (req, res) =>
  run(
    res,
    () => {
      const state = snapshot(req.params.id);
      const accountId = z.string().min(1).max(64).parse(req.body?.accountId);
      const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
      const currency = db.select().from(budgetSettings).get()?.currency ?? 'AUD';
      if (!account || account.closedAt || (account.currency ?? currency) !== state.group.currency)
        throw new Error('Choose an open account in the household currency');
      if (poolGroupOf(accountId)) throw new Error('Account already belongs to a household');
      db.update(accounts)
        .set({ currency: state.group.currency })
        .where(eq(accounts.id, accountId))
        .run();
      if (!state.group.accountId)
        db.update(groups).set({ accountId }).where(eq(groups.id, state.group.id)).run();
      else db.insert(poolAccountsTable).values({ groupId: state.group.id, accountId }).run();
      return snapshot(state.group.id);
    },
    201,
  ),
);
householdsRouter.delete('/:id/pool-accounts/:accountId', (req, res) =>
  run(res, () => {
    const state = snapshot(req.params.id);
    const { accountId } = req.params;
    if (!state.poolAccountIds.includes(accountId))
      throw new Error('Not a pool account of this household');
    if (accountId === state.group.accountId)
      throw new Error("The household's first pool account stays; remove the others instead");
    const linked = state.events.some(
      (e) =>
        e.transactionId &&
        db
          .select({ a: transactions.accountId })
          .from(transactions)
          .where(eq(transactions.id, e.transactionId))
          .get()?.a === accountId,
    );
    if (linked) throw new Error('Household entries are linked to this account; remove them first');
    db.delete(poolAccountsTable).where(eq(poolAccountsTable.accountId, accountId)).run();
    return snapshot(state.group.id);
  }),
);
// The split a quick share uses (Share with… in the register, rules)
householdsRouter.put('/:id/default-split', (req, res) =>
  run(res, () => {
    const state = snapshot(req.params.id);
    const split =
      req.body === null || req.body?.mode === undefined ? null : splitSchema.parse(req.body);
    if (split) {
      const ids = split.shares.map((s) => s.personId);
      if (
        new Set(ids).size !== ids.length ||
        ids.some((id) => !state.people.some((p) => p.id === id))
      )
        throw new Error('Choose participants once each');
      if (split.mode !== 'equal' && !split.shares.some((s) => s.value > 0))
        throw new Error('Give someone a share');
      if (split.mode === 'percentage' && split.shares.reduce((n, s) => n + s.value, 0) !== 10000)
        throw new Error('Percentage shares must total 10000 basis points');
    }
    db.update(groups)
      .set({ defaultSplitJson: split ? JSON.stringify(split) : null })
      .where(eq(groups.id, state.group.id))
      .run();
    return snapshot(state.group.id);
  }),
);
// Share bank payments with the household in one go, each with the default split (or `split`)
householdsRouter.post('/:id/share', (req, res) => {
  const parsed = z
    .object({
      transactionIds: z.array(z.string().min(1).max(64)).min(1).max(500),
      split: splitSchema.optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    snapshot(req.params.id);
  } catch (error) {
    return res.status(404).json({ error: error instanceof Error ? error.message : 'Not found' });
  }
  const results = parsed.data.transactionIds.map((transactionId) => {
    try {
      const eventId = db.transaction(() =>
        shareTransaction(req.params.id, transactionId, parsed.data.split),
      );
      return { transactionId, ok: true, eventId };
    } catch (error) {
      return {
        transactionId,
        ok: false,
        error: error instanceof Error ? error.message : 'Could not share',
      };
    }
  });
  res.json({
    shared: results.filter((r) => r.ok).length,
    results,
    household: snapshot(req.params.id),
  });
});
// Recurring items (Recurring page) shared with the household: listed with everyone's share
householdsRouter.post('/:id/recurring-bills', (req, res) => {
  const parsed = z
    .object({ scheduleIds: z.array(z.string().min(1).max(64)).min(1).max(100) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  run(res, () => shareRecurringBills(req.params.id, parsed.data.scheduleIds));
});
householdsRouter.delete('/:id/recurring-bills/:scheduleId', (req, res) =>
  run(res, () => unshareRecurringBill(req.params.id, req.params.scheduleId)),
);
// Money received that looks like someone repaying what they owe (the owner confirms each)
householdsRouter.get('/:id/repayment-suggestions', (req, res) =>
  run(res, () => repaymentSuggestions(req.params.id, todayIso())),
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
