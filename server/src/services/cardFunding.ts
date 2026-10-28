import { and, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, budgetMonths, cardFunding, transactions } from '../db/schema.js';
import {
  budgetActivity,
  budgetStartDate,
  personalBudgetAccount,
  sinceBudgetStart,
} from './balances.js';
import { convertAmount, currencyContext, type CurrencyContext } from './mainAmountService.js';

/** An expense category's balance, and optionally its net change (assigned + activity) by month */
type Category = { id: string; balance: number; months?: Map<string, number> };
export interface CardPosition {
  accountId: string;
  categoryId: string;
  name: string;
  startDate: string;
  debt: number;
  prepaid: number;
  available: number;
  shortfall: number;
  uncoveredPayments: number;
  excessFunding: number;
  fundedPurchases: number;
}
export interface FundingAdjustment {
  categoryId: string;
  date: string;
  amount: number;
}

type Row = typeof transactions.$inferSelect;

/**
 * What the replay reads from the database, independent of the date it replays to: the card
 * accounts' rows (a split's parts included) and the rows they point at. Load it once and pass
 * it to every as-of date (see budgetLedger.ts) instead of reading all transactions each time.
 */
export interface CardData {
  mappings: (typeof cardFunding.$inferSelect)[];
  ctx: CurrencyContext;
  budgetStart: string;
  accounts: (typeof accounts.$inferSelect)[];
  assignments: (typeof budgetMonths.$inferSelect)[];
  /** The card accounts' rows, without generated income not yet received (nothing counts it) */
  rows: Row[];
  /** `rows`, and any row they refer to by transfer or parent */
  byId: Map<string, Row>;
  /** Top-level rows of the card accounts, in the order the replay takes them */
  parents: Row[];
  /** A split's parts by parent, ordered by id */
  children: Map<string, Row[]>;
  /** Rows the envelopes count as activity (card accounts only) */
  activityIds: Set<string>;
}

export function loadCardData(): CardData {
  const mappings = db.select().from(cardFunding).all();
  const budgetStart = budgetStartDate();
  const data: CardData = {
    mappings,
    ctx: currencyContext(),
    budgetStart,
    accounts: db.select().from(accounts).where(personalBudgetAccount).all(),
    assignments: db.select().from(budgetMonths).all(),
    rows: [],
    byId: new Map(),
    parents: [],
    children: new Map(),
    activityIds: new Set(),
  };
  if (!mappings.length) return data;
  const accountIds = mappings.map((m) => m.accountId);
  const ofCards = or(
    inArray(transactions.accountId, accountIds),
    sql`${transactions.parentTransactionId} in (select id from transactions where account_id in (${sql.join(
      accountIds.map((id) => sql`${id}`),
      sql`, `,
    )}))`,
  )!;
  // A generated income row counts only once reconciled
  const received = (t: Row) =>
    !(t.amount > 0 && t.importedId?.startsWith('schedule:') && !t.reconciled);
  data.rows = db.select().from(transactions).where(ofCards).all().filter(received);
  data.byId = new Map(data.rows.map((t) => [t.id, t]));
  const referred = [
    ...new Set(
      data.rows.flatMap((t) => [t.transferTransactionId, t.parentTransactionId]).filter((id) => id),
    ),
  ].filter((id): id is string => !!id && !data.byId.has(id));
  for (let i = 0; i < referred.length; i += 500)
    for (const t of db
      .select()
      .from(transactions)
      .where(inArray(transactions.id, referred.slice(i, i + 500)))
      .all()
      .filter(received))
      data.byId.set(t.id, t);
  data.parents = data.rows
    .filter((t) => !t.parentTransactionId)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt.replace(' ', 'T').localeCompare(b.createdAt.replace(' ', 'T')) ||
        a.id.localeCompare(b.id),
    );
  for (const t of [...data.rows].sort((a, b) => a.id.localeCompare(b.id)))
    if (t.parentTransactionId)
      data.children.set(t.parentTransactionId, [
        ...(data.children.get(t.parentTransactionId) ?? []),
        t,
      ]);
  data.activityIds = new Set(
    db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(budgetActivity, sinceBudgetStart, ofCards))
      .all()
      .map((t) => t.id),
  );
  return data;
}

/** As-of cash-first funding. Replayed from reviewed cutovers, never written to the ledger.
 * See docs/CARD-PAYMENTS.md for funding order, refunds, repayments and transition rules.
 */
export function calculateCardFunding(
  asOf: string,
  expenseCategories: Category[],
  data: CardData = loadCardData(),
) {
  const mappings = data.mappings.filter((m) => m.startDate <= asOf);
  const adjustments: FundingAdjustment[] = [];
  const positions: CardPosition[] = [];
  // Per expense category: card purchases no envelope money backed and no reset has yet
  // written off as card debt. The part of a current deficit they explain is credit overspending.
  const unfunded = new Map<string, number>();
  if (!mappings.length) return { adjustments, positions, unfunded, complete: true };
  const ctx = data.ctx;
  // Nothing before the budget start funds or reserves anything (Settings → Budget start)
  const budgetStart = data.budgetStart;
  const accountRows = data.accounts;
  const personalIds = new Set(accountRows.map((a) => a.id));
  // Rows up to the date being replayed
  const known = (t: Row | undefined) => (t && t.date <= asOf ? t : undefined);
  const byId = { get: (id: string) => known(data.byId.get(id)) };
  const activityIds = data.activityIds;
  const paymentIds = new Set(mappings.map((m) => m.categoryId));
  const expenseIds = new Set(
    expenseCategories.map((c) => c.id).filter((id) => !paymentIds.has(id)),
  );
  const assignments = data.assignments.filter(
    (a) => a.month <= asOf.slice(0, 7) && a.month >= budgetStart.slice(0, 7),
  );
  let complete = true;
  const amount = (t: typeof transactions.$inferSelect) => {
    if (t.mainAmountSource === 'missing') {
      complete = false;
      return 0;
    }
    return t.mainAmount ?? t.amount;
  };
  const states = mappings.map((m) => ({
    mapping: m,
    account: accountRows.find((a) => a.id === m.accountId)!,
    baseline: new Set<string>(JSON.parse(m.baselineIds)),
    native: 0,
    reserve: assignments
      .filter((a) => a.categoryId === m.categoryId)
      .reduce((s, a) => s + a.budgeted, 0),
    funded: 0,
    unfunded: new Map<string, number>(),
    // The part of `unfunded` whose envelope deficit a month-end reset dropped: card debt only
    discarded: new Map<string, number>(),
  }));
  const stateByAccount = new Map(states.map((s) => [s.mapping.accountId, s]));
  const eligible = (t: typeof transactions.$inferSelect) => {
    const s = stateByAccount.get(t.accountId);
    const parent = t.parentTransactionId ? byId.get(t.parentTransactionId) : t;
    return (
      s &&
      parent &&
      parent.date >= s.mapping.startDate &&
      parent.date >= budgetStart &&
      !s.baseline.has(parent.id)
    );
  };
  // Assignments and cash activity take priority as of the requested date. Retrospective
  // funding changes how much of a purchase is cash-backed, without generating ledger rows.
  // Within a month, all of its assignments and cash activity back its card purchases. Like the
  // envelopes, a category that ends a month overspent starts the next at zero, so an old cash
  // deficit doesn't block new purchases and a later assignment doesn't fund an earlier month's.
  const base = new Map(
    expenseCategories
      .filter((c) => !paymentIds.has(c.id))
      .map((c) => [c.id, new Map(c.months ?? [[asOf.slice(0, 7), c.balance]])]),
  );
  for (const t of data.rows)
    if (
      t.date <= asOf &&
      activityIds.has(t.id) &&
      t.categoryId &&
      expenseIds.has(t.categoryId) &&
      eligible(t)
    ) {
      const months = base.get(t.categoryId)!;
      const m = t.date.slice(0, 7);
      months.set(m, (months.get(m) ?? 0) - amount(t));
    }
  const pool = new Map<string, { month: string; value: number }>();
  // A dropped deficit first comes from the category's unfunded card purchases. A later refund
  // of those reduces the debt (and its shortfall) but must not refill the envelope as well.
  const discard = (id: string, deficit: number) => {
    for (const st of states) {
      const open = (st.unfunded.get(id) ?? 0) - (st.discarded.get(id) ?? 0);
      const dropped = Math.min(deficit, Math.max(0, open));
      if (dropped) st.discarded.set(id, (st.discarded.get(id) ?? 0) + dropped);
      deficit -= dropped;
    }
  };
  const poolAt = (id: string, month: string) => {
    const p = pool.get(id) ?? { month: '', value: 0 };
    pool.set(id, p);
    const reset = () => {
      if (p.value < 0) discard(id, -p.value);
      p.value = Math.max(0, p.value);
    };
    const months = base.get(id) ?? new Map<string, number>();
    const due = [...months.keys()].filter((m) => m > p.month && m <= month).sort();
    for (const m of due) {
      reset();
      p.value += months.get(m)!;
      p.month = m;
    }
    if (p.month < month) {
      reset();
      p.month = month;
    }
    return p;
  };
  for (const s of states) s.native = s.account?.startingBalance ?? 0;
  const add = (categoryId: string, date: string, value: number) => {
    if (value) adjustments.push({ categoryId, date, amount: value });
  };
  const reserve = (s: (typeof states)[number], date: string, value: number) => {
    s.reserve += value;
    add(s.mapping.categoryId, date, value);
  };
  const money = (native: number, s: (typeof states)[number], date: string) => {
    const value = convertAmount(native, s.account?.currency ?? ctx.budget, ctx.budget, date, ctx);
    if (value === null) {
      complete = false;
      return 0;
    }
    return value;
  };
  const parents = data.parents.filter((t) => t.date <= asOf);
  const processed = new Set<string>();
  for (const t of parents) {
    const s = stateByAccount.get(t.accountId);
    if (!s) continue;
    if (!s.account) {
      complete = false;
      continue;
    }
    const before = s.native;
    s.native += t.amount;
    processed.add(t.id);
    if (!eligible(t)) continue;
    const counterpart = t.transferTransactionId ? byId.get(t.transferTransactionId) : undefined;
    const value = amount(t);
    const debtBefore = Math.max(0, -money(before, s, t.date));
    const debtAfter = Math.max(0, -money(s.native, s, t.date));
    if (counterpart && personalIds.has(counterpart.accountId)) {
      if (value > 0) {
        const repaid = Math.min(value, Math.max(0, debtBefore - debtAfter));
        const otherCard = stateByAccount.get(counterpart.accountId);
        const fundedPayment = Math.min(repaid, Math.max(0, s.reserve));
        if (otherCard && eligible(counterpart)) {
          const otherBefore = processed.has(counterpart.id)
            ? otherCard.native - counterpart.amount
            : otherCard.native;
          const newDebt =
            Math.max(0, -money(otherBefore + counterpart.amount, otherCard, t.date)) -
            Math.max(0, -money(otherBefore, otherCard, t.date));
          const shifted = Math.min(fundedPayment, Math.max(0, newDebt));
          reserve(s, t.date, -fundedPayment);
          reserve(otherCard, t.date, shifted);
        } else reserve(s, t.date, -repaid);
        let unfundedPayment = repaid - fundedPayment;
        for (const [id, owed] of s.unfunded) {
          const paid = Math.min(unfundedPayment, owed);
          s.unfunded.set(id, owed - paid);
          s.discarded.set(id, Math.min(s.discarded.get(id) ?? 0, owed - paid));
          unfundedPayment -= paid;
        }
      }
      continue;
    }
    const leaves = t.isParent ? (data.children.get(t.id) ?? []).filter((c) => c.date <= asOf) : [t];
    // Follow each split leaf through the card balance. Mixed debit/refund splits
    // must not reserve the gross debit while discarding their offsetting credit.
    let leafBalance = money(before, s, t.date);
    for (const leaf of leaves) {
      const value = amount(leaf),
        id = leaf.categoryId;
      const leafBefore = leafBalance;
      leafBalance += value;
      if (!activityIds.has(leaf.id)) continue;
      if (value < 0) {
        const spending = -value;
        const prepaid = Math.min(spending, Math.max(0, leafBefore));
        if (!id || !expenseIds.has(id)) continue;
        const available = poolAt(id, leaf.date.slice(0, 7));
        const backed = Math.min(spending, Math.max(0, available.value));
        available.value -= spending;
        const funded = Math.max(0, backed - prepaid);
        reserve(s, leaf.date, funded);
        s.funded += funded;
        s.unfunded.set(id, (s.unfunded.get(id) ?? 0) + Math.max(0, spending - prepaid - funded));
      } else if (value > 0) {
        // Settle earlier months' resets before deciding what this refund reverses
        if (id && expenseIds.has(id)) poolAt(id, leaf.date.slice(0, 7));
        const debtPart = Math.min(value, Math.max(0, -leafBefore));
        const prepaid = value - debtPart;
        const deficitRecovery = Math.min(prepaid, Math.max(0, -s.reserve));
        reserve(s, leaf.date, deficitRecovery);
        const unfunded = id ? Math.min(debtPart, s.unfunded.get(id) ?? 0) : 0;
        if (id) s.unfunded.set(id, (s.unfunded.get(id) ?? 0) - unfunded);
        const dropped = id ? Math.min(unfunded, s.discarded.get(id) ?? 0) : 0;
        if (id && dropped) s.discarded.set(id, (s.discarded.get(id) ?? 0) - dropped);
        const released = Math.min(debtPart - unfunded, Math.max(0, s.reserve));
        reserve(s, leaf.date, -released);
        if (id && expenseIds.has(id)) {
          const backedRefund = unfunded - dropped + released + prepaid;
          add(id, leaf.date, backedRefund - value);
          poolAt(id, leaf.date.slice(0, 7)).value += backedRefund;
        }
      }
    }
  }
  // Settle every earlier month's reset, so only this month's unfunded purchases stay open
  for (const id of expenseIds) poolAt(id, asOf.slice(0, 7));
  for (const s of states)
    for (const [id, owed] of s.unfunded) {
      const open = Math.max(0, owed - (s.discarded.get(id) ?? 0));
      if (open) unfunded.set(id, (unfunded.get(id) ?? 0) + open);
    }
  for (const s of states) {
    const balance = money(s.native, s, asOf),
      debt = Math.max(0, -balance);
    positions.push({
      accountId: s.mapping.accountId,
      categoryId: s.mapping.categoryId,
      name: s.account?.name ?? 'Missing account',
      startDate: s.mapping.startDate,
      debt,
      prepaid: Math.max(0, balance),
      available: s.reserve,
      shortfall: Math.max(0, debt - Math.max(0, s.reserve)),
      uncoveredPayments: Math.max(0, -s.reserve),
      excessFunding: Math.max(0, s.reserve - debt),
      fundedPurchases: s.funded,
    });
  }
  return { adjustments, positions, unfunded, complete };
}
