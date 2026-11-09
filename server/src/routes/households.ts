import { assistantGuard } from '../auth/assistantPolicy.js';
import { AssistantRefusal } from '../auth/assistantRefusal.js';
import { Router, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { repaymentCategoryOffers } from '../services/householdCategoryOffers.js';
import { db } from '../db/index.js';
import {
  accounts,
  budgetSettings,
  transactions,
  householdGroups as groups,
  householdPeople as people,
  householdBills as bills,
  householdPoolAccounts as poolAccountsTable,
  schedules,
} from '../db/schema.js';
import { householdBreakdown } from '../services/householdReport.js';
import { billReconciliation } from '../services/householdReconciliation.js';
import {
  addSuggestedBill,
  billSuggestions,
  dismissSuggestedBill,
} from '../services/householdBillSuggestions.js';
import {
  addPerson,
  checkSplit,
  deleteBill,
  editBill,
  poolAccountsOf,
  householdActivity,
  poolGroupOf,
  reconcileBalances,
  recordEvent,
  removeEvent,
  renamePerson,
  shareBillPayments,
  repaymentSuggestions,
  shareRecurringBills,
  sharePayments,
  sharedExport,
  snapshot,
  splitSchema,
  unshareRecurringBill,
  updateEvent,
  updateGroup,
  updateRecurringBill,
} from '../services/householdService.js';
import { todayIso } from '../services/mainAmountService.js';
import { logoSchema } from '../utils/logo.js';
import { payeeKeySchema } from '../utils/payeeKey.js';

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
    // Answered 403 by the error handler, with its reason
    if (error instanceof AssistantRefusal) throw error;
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Invalid household entry' });
  }
}
householdsRouter.get('/', (_req, res) => {
  const members = db.select().from(people).all();
  res.json(
    db
      .select()
      .from(groups)
      .all()
      .map(({ defaultSplitJson, ...g }) => ({
        ...g,
        poolAccountIds: poolAccountsOf(g),
        defaultSplit: defaultSplitJson ? (JSON.parse(defaultSplitJson) as unknown) : null,
        // Who is in it, for the register's "Paid ahead to" menu (names only, as GET /:id gives)
        people: members
          .filter((p) => p.groupId === g.id)
          .map((p) => ({ id: p.id, name: p.name, isSelf: p.isSelf === 1 })),
      })),
  );
});
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
// Audit decision I-8: repayments, to you or from you, that could be categorised back to what
// they settled
householdsRouter.get('/:id/category-offers', (req, res) =>
  run(res, () => {
    snapshot(req.params.id); // refuses an unknown household
    return repaymentCategoryOffers(req.params.id);
  }),
);
// For a combined household (gateway/sharing.ts): the record the other person sees, which the
// gateway asks for with its secret. Less than GET /:id, which the owner can already read.
householdsRouter.get('/:id/shared-export', (req, res) =>
  run(res, () => sharedExport(req.params.id)),
);
householdsRouter.post('/:id/events', (req, res) =>
  run(
    res,
    () => {
      // An access token's contribution check (auth/assistantPolicy.ts) runs again inside the
      // same transaction as the entry it allows
      assistantGuard(res.locals)?.();
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
// Balances agreed (reconcileBalances): GET previews everyone at 0, POST records it. Owner only
// for POST; an access token proposes it instead (MCP propose_household_reconciliation).
householdsRouter.get('/:id/reconcile', (req, res) =>
  run(res, () => {
    const r = reconcileBalances(req.params.id, { preview: true });
    return {
      date: r.date,
      people: r.people,
      pool: r.pool,
      poolShares: r.poolShares,
      directShares: r.directShares,
    };
  }),
);
householdsRouter.post('/:id/reconcile', (req, res) =>
  run(res, () => reconcileBalances(req.params.id, req.body).state),
);
// Rename a household or make it the one that opens first. Owner only: read-only access
// tokens never reach this route.
householdsRouter.put('/:id', (req, res) => run(res, () => updateGroup(req.params.id, req.body)));
householdsRouter.put('/:id/default-split', (req, res) =>
  run(res, () => {
    const state = snapshot(req.params.id);
    const split =
      req.body === null || req.body?.mode === undefined ? null : splitSchema.parse(req.body);
    if (split) checkSplit(state.people, split);
    db.update(groups)
      .set({ defaultSplitJson: split ? JSON.stringify(split) : null })
      .where(eq(groups.id, state.group.id))
      .run();
    return snapshot(state.group.id);
  }),
);
// The household's picture, shown next to its shared payments (null removes it). Owner only:
// read-only access tokens never reach this route.
householdsRouter.put('/:id/logo', (req, res) => {
  const parsed = z.object({ logo: logoSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const group = db.select({ id: groups.id }).from(groups).where(eq(groups.id, req.params.id)).get();
  if (!group) return res.status(404).json({ error: 'Household not found' });
  db.update(groups).set({ logo: parsed.data.logo }).where(eq(groups.id, group.id)).run();
  res.json({ id: group.id, logo: parsed.data.logo });
});
// Share bank payments with the household in one go, each with the default split (or `split`)
householdsRouter.post('/:id/share', (req, res) => {
  const parsed = z
    .object({
      transactionIds: z.array(z.string().min(1).max(64)).min(1).max(500),
      split: splitSchema.optional(),
      /** Check and show who would owe what, recording nothing */
      preview: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    snapshot(req.params.id);
  } catch (error) {
    return res.status(404).json({ error: error instanceof Error ? error.message : 'Not found' });
  }
  const results = sharePayments(req.params.id, parsed.data.transactionIds, {
    split: parsed.data.split,
    source: 'manual',
    preview: parsed.data.preview,
  });
  if (parsed.data.preview) return res.json({ results });
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
// Bills the household account pays that aren't in Recurring yet (owner only): suggestions,
// adding one as a household bill, and saying one isn't a bill
householdsRouter.get('/:id/bill-suggestions', (req, res) =>
  run(res, () => billSuggestions(req.params.id)),
);
householdsRouter.post('/:id/bill-suggestions/add', (req, res) => {
  const parsed = z.object({ id: z.string().min(3).max(600) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  run(res, () => addSuggestedBill(req.params.id, parsed.data.id));
});
householdsRouter.post('/:id/bill-suggestions/dismiss', (req, res) => {
  const parsed = z.object({ payeeKey: payeeKeySchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  run(res, () => {
    dismissSuggestedBill(req.params.id, parsed.data.payeeKey);
    return billSuggestions(req.params.id);
  });
});
// A bill's own split (null = the default) and whether new payments are shared as they arrive
householdsRouter.put('/:id/recurring-bills/:scheduleId', (req, res) => {
  const parsed = z
    .object({ split: splitSchema.nullable().optional(), autoShare: z.boolean().optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  run(res, () => updateRecurringBill(req.params.id, req.params.scheduleId, parsed.data));
});
// Shares a bill's payments with its own split
householdsRouter.post('/:id/recurring-bills/:scheduleId/share', (req, res) => {
  const parsed = z
    .object({ transactionIds: z.array(z.string().min(1).max(64)).min(1).max(500) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const results = shareBillPayments(
      req.params.id,
      req.params.scheduleId,
      parsed.data.transactionIds,
    );
    res.json({
      shared: results.filter((r) => r.ok).length,
      results,
      household: snapshot(req.params.id),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not share' });
  }
});
// People: add someone, or rename them
householdsRouter.post('/:id/people', (req, res) =>
  run(res, () => addPerson(req.params.id, req.body?.name), 201),
);
householdsRouter.put('/:id/people/:personId', (req, res) =>
  run(res, () => renamePerson(req.params.id, req.params.personId, req.body?.name)),
);
// Edit or delete a one-off bill
householdsRouter.put('/:id/bills/:billId', (req, res) =>
  run(res, () => editBill(req.params.id, req.params.billId, req.body)),
);
householdsRouter.delete('/:id/bills/:billId', (req, res) =>
  run(res, () => deleteBill(req.params.id, req.params.billId)),
);
// Money received that looks like someone repaying what they owe (the owner confirms each)
householdsRouter.get('/:id/repayment-suggestions', (req, res) =>
  run(res, () => repaymentSuggestions(req.params.id, todayIso())),
);
// One shared recurring bill, person by person: shares owed and the deposits that paid them
householdsRouter.get('/:id/recurring-bills/:scheduleId/reconciliation', (req, res) =>
  run(res, () =>
    billReconciliation(
      req.params.id,
      req.params.scheduleId,
      req.query.from ? date.parse(req.query.from) : undefined,
      req.query.to ? date.parse(req.query.to) : undefined,
    ),
  ),
);
householdsRouter.get('/:id/statement', (req, res) =>
  run(res, () => {
    const state = snapshot(req.params.id);
    const from = req.query.from ? date.parse(req.query.from) : '0000-01-01';
    const to = req.query.to ? date.parse(req.query.to) : '9999-12-31';
    if (from > to) throw new Error('Start date must precede end date');
    const entries = state.events.filter((e) => e.date >= from && e.date <= to);
    const breakdown = householdBreakdown(state, from, to);
    return {
      title: 'Household and personal expense shares',
      currency: state.group.currency,
      from,
      to,
      householdSpending: breakdown.total,
      personalSpending: breakdown.myShare,
      byMonth: breakdown.byMonth,
      byPerson: breakdown.byPerson,
      byCategory: breakdown.byCategory,
      balances: state.balances,
      events: entries,
    };
  }),
);

householdsRouter.put('/:id/events/:eventId', (req, res) =>
  run(res, () => updateEvent(req.params.id, req.params.eventId, req.body)),
);
householdsRouter.delete('/:id/events/:eventId', (req, res) =>
  run(res, () => removeEvent(req.params.id, req.params.eventId)),
);
// What was added, changed, removed or settled, newest first
householdsRouter.get('/:id/activity', (req, res) =>
  run(res, () => {
    snapshot(req.params.id);
    return householdActivity(req.params.id);
  }),
);
