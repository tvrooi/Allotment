import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  categories,
  categoryGroups,
  transactions,
  creditCardPlans,
  creditFundingEvents,
  creditEventOrder,
} from '../db/schema.js';
import { budgetActivity, mainAmount, personalBudgetAccount } from './balances.js';
import { convertAmount, currencyContext } from './mainAmountService.js';
import { allocate } from '../utils/money.js';

export interface CardPlan {
  accountId: string;
  enabledFrom: string;
}
interface Row {
  order?: number;
  id: string;
  accountId: string;
  date: string;
  amount: number;
  value: number;
  categoryId: string | null;
  transferTransactionId: string | null;
  activity: boolean;
  missing: boolean;
}
interface Card {
  accountId: string;
  name: string;
  enabledFrom: string;
  balance: number;
  reserved: number;
  assigned: number;
  fundedPurchases: number;
  payments: number;
  refunds: number;
  creditUsed: number;
  unlinkedInflows: number;
  pendingTransfers: number;
  debt: number;
  creditBalance: number;
  shortfall: number;
}
export interface CreditInput {
  asOf: string;
  cards: { id: string; name: string; startingBalance: number }[];
  plans: CardPlan[];
  expenseIds: Set<string>;
  assignments: { month: string; categoryId: string; budgeted: number }[];
  rows: Row[];
  funding: { id: string; accountId: string; date: string; amount: number; order?: number }[];
  value: (accountId: string, raw: number, date: string) => number | null;
}

/** One deterministic replay for cash-backed category availability and card reserves.
 * Monthly assignments precede activity; a durable sequence orders within-day
 * ledger inserts and explicit funding. A linked payment follows both of its legs.
 * Positive card credit never becomes cash: spending it offsets category activity;
 * a refund restores cash availability only from unfunded category debt or a reserve.
 */
export function calculateCredit(input: CreditInput) {
  const { asOf, expenseIds } = input;
  const cards = new Map<string, Card>();
  for (const plan of input.plans) {
    const account = input.cards.find((a) => a.id === plan.accountId);
    if (account && plan.enabledFrom <= asOf)
      cards.set(account.id, {
        accountId: account.id,
        name: account.name,
        enabledFrom: plan.enabledFrom,
        balance: account.startingBalance,
        reserved: 0,
        assigned: 0,
        fundedPurchases: 0,
        payments: 0,
        refunds: 0,
        creditUsed: 0,
        unlinkedInflows: 0,
        pendingTransfers: 0,
        debt: 0,
        creditBalance: 0,
        shortfall: 0,
      });
  }
  const balances = new Map<string, number>();
  const adjustments = new Map<string, number>();
  const priorAdjustments = new Map<string, number>();
  const unfunded = new Map<string, Map<string, number>>();
  let complete = true;
  const active = (id: string, date: string) => {
    const c = cards.get(id);
    return c && date >= c.enabledFrom ? c : undefined;
  };
  const counter = (id: string) => {
    let m = unfunded.get(id);
    if (!m) unfunded.set(id, (m = new Map()));
    return m;
  };
  const change = (id: string, amount: number) => balances.set(id, (balances.get(id) ?? 0) + amount);
  const adjust = (id: string, amount: number, date: string) => {
    adjustments.set(id, (adjustments.get(id) ?? 0) + amount);
    if (date.slice(0, 7) < asOf.slice(0, 7))
      priorAdjustments.set(id, (priorAdjustments.get(id) ?? 0) + amount);
    change(id, amount);
  };
  const addFunding = (categoryId: string, amount: number) => {
    let cover = Math.min(amount, Math.max(0, -(balances.get(categoryId) ?? 0)));
    for (const card of [...cards.values()].sort((a, b) => a.accountId.localeCompare(b.accountId))) {
      const map = counter(card.accountId),
        value = map.get(categoryId) ?? 0;
      const take = Math.min(cover, value);
      card.reserved += take;
      map.set(categoryId, value - take);
      cover -= take;
    }
    change(categoryId, amount);
  };
  const settleCounters = (card: Card, amount: number) => {
    for (const [categoryId, value] of counter(card.accountId)) {
      const take = Math.min(amount, value);
      counter(card.accountId).set(categoryId, value - take);
      amount -= take;
    }
  };
  const closeDay = (date: string) => {
    for (const card of cards.values()) {
      if (date < card.enabledFrom) continue;
      const debt = input.value(card.accountId, Math.max(0, -card.balance), date);
      if (debt === null) {
        complete = false;
        continue;
      }
      // Payment funding beyond debt is released, never claimed by two purposes.
      card.reserved = Math.min(debt, Math.max(0, card.reserved));
      const total = [...counter(card.accountId).values()].reduce((s, v) => s + v, 0);
      if (card.balance >= 0) settleCounters(card, total);
    }
  };
  type Event = { date: string; order: number; id: string; run: () => void };
  const events: Event[] = [];
  for (const a of input.assignments)
    if (expenseIds.has(a.categoryId) && `${a.month}-01` <= asOf)
      events.push({
        date: `${a.month}-01`,
        order: -1,
        id: a.categoryId,
        run: () =>
          a.budgeted > 0 ? addFunding(a.categoryId, a.budgeted) : change(a.categoryId, a.budgeted),
      });
  const byId = new Map(input.rows.map((r) => [r.id, r]));
  const borrowed = new Map<string, number>();
  const pairs = new Set<string>();
  for (const row of input.rows) {
    if (row.date > asOf) continue;
    const card = cards.get(row.accountId);
    const enabled = active(row.accountId, row.date);
    const category =
      row.categoryId && expenseIds.has(row.categoryId) && row.activity ? row.categoryId : null;
    const linked = row.transferTransactionId ? byId.get(row.transferTransactionId) : undefined;
    const pair = linked?.transferTransactionId === row.id ? linked : undefined;
    const pendingCard = enabled ?? (pair ? active(pair.accountId, asOf) : undefined);
    if (pendingCard && pair && pair.date > asOf) {
      pendingCard.pendingTransfers++;
      complete = false;
    }
    if (row.missing && (category || enabled)) complete = false;
    events.push({
      date: row.date,
      order: (row.order ?? 0) * 2,
      id: row.id,
      run: () => {
        if (!enabled) {
          if (category)
            row.value > 0 ? addFunding(category, row.value) : change(category, row.value);
          if (card) card.balance += row.amount;
          return;
        }
        if (row.amount < 0) {
          const rawCredit = Math.min(-row.amount, Math.max(0, enabled.balance));
          const [used, debt] = allocate(Math.abs(row.value), [rawCredit, -row.amount - rawCredit]);
          borrowed.set(row.id, debt);
          if (category) {
            const funded = Math.min(debt, Math.max(0, balances.get(category) ?? 0));
            enabled.reserved += funded;
            enabled.fundedPurchases += funded;
            const map = counter(enabled.accountId);
            map.set(category, (map.get(category) ?? 0) + debt - funded);
            change(category, row.value);
            adjust(category, used, row.date);
            enabled.creditUsed += used;
          }
        } else if (row.amount > 0 && category) {
          const creditRaw =
            Math.max(0, enabled.balance + row.amount) - Math.max(0, enabled.balance);
          const [, debtRefund] = allocate(row.value, [creditRaw, row.amount - creditRaw]);
          const map = counter(enabled.accountId);
          const recovered = Math.min(debtRefund, map.get(category) ?? 0);
          map.set(category, (map.get(category) ?? 0) - recovered);
          const released = Math.min(debtRefund - recovered, Math.max(0, enabled.reserved));
          enabled.reserved -= released;
          enabled.refunds += released;
          // Raw activity remains visible; only backed refunds restore cash availability.
          change(category, row.value);
          adjust(category, recovered + released - row.value, row.date);
          // Released cash can cover a different card's deficit in the same envelope.
          change(category, -released);
          addFunding(category, released);
        } else if (row.amount > 0 && !pair && row.categoryId === null && row.activity) {
          // Do not infer a repayment link from a bank description or amount.
          enabled.unlinkedInflows++;
        }
        enabled.balance += row.amount;
      },
    });
    if (pair && pair.date <= asOf) {
      const key = [row.id, pair.id].sort().join(':');
      if (pairs.has(key)) continue;
      pairs.add(key);
      const positive = row.amount > 0 ? row : pair,
        negative = row.amount < 0 ? row : pair;
      if (positive.amount <= 0 || negative.amount >= 0) continue;
      const date = row.date > pair.date ? row.date : pair.date;
      events.push({
        date,
        order: Math.max(row.order ?? 0, pair.order ?? 0) * 2 + 1,
        id: key,
        run: () => {
          const to = active(positive.accountId, date),
            from = active(negative.accountId, date);
          if (
            !to ||
            (positive.activity && positive.categoryId && expenseIds.has(positive.categoryId))
          )
            return;
          const amount = Math.max(0, positive.value);
          const consumed = Math.min(amount, Math.max(0, to.reserved));
          to.reserved -= consumed;
          to.payments += amount;
          settleCounters(to, amount - consumed);
          if (from)
            from.reserved += Math.min(
              consumed,
              borrowed.get(negative.id) ?? Math.abs(negative.value),
            );
        },
      });
    }
  }
  for (const e of input.funding)
    if (e.date <= asOf)
      events.push({
        date: e.date,
        order: (e.order ?? 0) * 2,
        id: e.id,
        run: () => {
          const c = active(e.accountId, e.date);
          if (c) {
            c.reserved += e.amount;
            c.assigned += e.amount;
          }
        },
      });
  events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.id.localeCompare(b.id),
  );
  let date = '';
  for (const event of events) {
    if (date && date !== event.date) closeDay(date);
    date = event.date;
    event.run();
  }
  if (date) closeDay(date);
  closeDay(asOf);
  const creditDeficits = new Map<string, number>();
  for (const card of cards.values()) {
    const debt = input.value(card.accountId, Math.max(0, -card.balance), asOf),
      credit = input.value(card.accountId, Math.max(0, card.balance), asOf);
    if (debt === null || credit === null) complete = false;
    card.debt = debt ?? 0;
    card.creditBalance = credit ?? 0;
    card.shortfall = Math.max(0, card.debt - card.reserved);
    for (const [id, value] of counter(card.accountId))
      creditDeficits.set(id, (creditDeficits.get(id) ?? 0) + value);
  }
  let creditOverspent = 0;
  for (const [id, value] of creditDeficits)
    creditOverspent += Math.min(value, Math.max(0, -(balances.get(id) ?? 0)));
  const cardRows = [...cards.values()];
  return {
    cards: cardRows,
    adjustments,
    priorAdjustments,
    creditOverspent,
    complete,
    paymentReserved: cardRows.reduce((s, c) => s + c.reserved, 0),
    paymentShortfall: cardRows.reduce((s, c) => s + c.shortfall, 0),
    unlinkedCardInflows: cardRows.reduce((s, c) => s + c.unlinkedInflows, 0),
  };
}

export function assessCredit(
  asOf: string,
  proposedPlan?: CardPlan,
  proposedFunding?: { id: string; accountId: string; date: string; amount: number },
) {
  const eligible = db
    .select()
    .from(accounts)
    .where(personalBudgetAccount)
    .all()
    .filter((a) => ['credit', 'line_of_credit'].includes(a.type));
  const plans = db.select().from(creditCardPlans).all();
  if (proposedPlan) plans.push({ ...proposedPlan, createdAt: '' });
  const ids = new Set(eligible.map((a) => a.id));
  const activePlans = plans.filter((p) => ids.has(p.accountId) && p.enabledFrom <= asOf);
  const ctx = currencyContext();
  const value = (id: string, raw: number, date: string) =>
    convertAmount(raw, ctx.currencies.get(id) ?? ctx.budget, ctx.budget, date, ctx);
  const input: CreditInput = {
    asOf,
    cards: eligible,
    plans: activePlans,
    expenseIds: new Set(),
    assignments: [],
    rows: [],
    funding: [],
    value,
  };
  if (!activePlans.length) return calculateCredit(input);
  input.expenseIds = new Set(
    db
      .select({ id: categories.id })
      .from(categories)
      .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
      .where(eq(categoryGroups.isIncome, 0))
      .all()
      .map((c) => c.id),
  );
  input.assignments = db.select().from(budgetMonths).all();
  input.rows = db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      date: transactions.date,
      amount: transactions.amount,
      value: mainAmount,
      categoryId: transactions.categoryId,
      transferTransactionId: transactions.transferTransactionId,
      activity: sql<boolean>`case when ${budgetActivity} and not (${transactions.amount}>0 and coalesce(${transactions.importedId},'') like 'schedule:%' and ${transactions.reconciled}=0) then 1 else 0 end`,
      missing: sql<boolean>`case when ${transactions.mainAmountSource}='missing' then 1 else 0 end`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.isParent, 0),
        sql`not (${transactions.amount}>0 and coalesce(${transactions.importedId},'') like 'schedule:%' and ${transactions.reconciled}=0)`,
      ),
    )
    .all();
  const orderRows = db.select().from(creditEventOrder).all();
  const orderMap = new Map(orderRows.map((r) => [`${r.kind}:${r.entityId}`, r.sequence]));
  input.rows = input.rows.map((r) => ({ ...r, order: orderMap.get(`transaction:${r.id}`) ?? 0 }));
  input.funding = db
    .select()
    .from(creditFundingEvents)
    .all()
    .map((r) => ({ ...r, order: orderMap.get(`funding:${r.id}`) ?? 0 }));
  if (proposedFunding)
    input.funding.push({
      ...proposedFunding,
      order: orderRows.reduce((max, r) => Math.max(max, r.sequence), 0) + 1,
    });
  return calculateCredit(input);
}
