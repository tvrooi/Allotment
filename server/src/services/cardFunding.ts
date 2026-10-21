import { and, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, budgetMonths, cardFunding, transactions } from '../db/schema.js';
import { budgetActivity, personalBudgetAccount } from './balances.js';
import { convertAmount, currencyContext } from './mainAmountService.js';

type Category = { id: string; balance: number };
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

/** As-of cash-first funding. Replayed from reviewed cutovers, never written to the ledger.
 * See docs/CARD-PAYMENTS.md for funding order, refunds, repayments and transition rules.
 */
export function calculateCardFunding(asOf: string, expenseCategories: Category[]) {
  const mappings = db.select().from(cardFunding).where(lte(cardFunding.startDate, asOf)).all();
  const adjustments: FundingAdjustment[] = [];
  const positions: CardPosition[] = [];
  if (!mappings.length) return { adjustments, positions, complete: true };
  const ctx = currencyContext();
  const accountRows = db.select().from(accounts).where(personalBudgetAccount).all();
  const personalIds = new Set(accountRows.map((a) => a.id));
  const all = db
    .select()
    .from(transactions)
    .where(lte(transactions.date, asOf))
    .all()
    .filter((t) => !(t.amount > 0 && t.importedId?.startsWith('schedule:') && !t.reconciled));
  const byId = new Map(all.map((t) => [t.id, t]));
  const activityIds = new Set(
    db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(budgetActivity, lte(transactions.date, asOf)))
      .all()
      .map((t) => t.id),
  );
  const paymentIds = new Set(mappings.map((m) => m.categoryId));
  const expenseIds = new Set(
    expenseCategories.map((c) => c.id).filter((id) => !paymentIds.has(id)),
  );
  const assignments = db
    .select()
    .from(budgetMonths)
    .where(lte(budgetMonths.month, asOf.slice(0, 7)))
    .all();
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
  }));
  const stateByAccount = new Map(states.map((s) => [s.mapping.accountId, s]));
  const eligible = (t: typeof transactions.$inferSelect) => {
    const s = stateByAccount.get(t.accountId);
    const parent = t.parentTransactionId ? byId.get(t.parentTransactionId) : t;
    return s && parent && parent.date >= s.mapping.startDate && !s.baseline.has(parent.id);
  };
  // Assignments and cash activity take priority as of the requested date. Retrospective
  // funding changes how much of a purchase is cash-backed, without generating ledger rows.
  const pool = new Map(
    expenseCategories.filter((c) => !paymentIds.has(c.id)).map((c) => [c.id, c.balance]),
  );
  for (const t of all)
    if (activityIds.has(t.id) && t.categoryId && expenseIds.has(t.categoryId) && eligible(t))
      pool.set(t.categoryId, (pool.get(t.categoryId) ?? 0) - amount(t));
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
  const parents = all
    .filter((t) => !t.parentTransactionId)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt.replace(' ', 'T').localeCompare(b.createdAt.replace(' ', 'T')) ||
        a.id.localeCompare(b.id),
    );
  for (const t of parents) {
    const s = stateByAccount.get(t.accountId);
    if (!s) continue;
    if (!s.account) {
      complete = false;
      continue;
    }
    const before = s.native;
    s.native += t.amount;
    if (!eligible(t)) continue;
    const counterpart = t.transferTransactionId ? byId.get(t.transferTransactionId) : undefined;
    const value = amount(t);
    const debtBefore = Math.max(0, -money(before, s, t.date));
    const debtAfter = Math.max(0, -money(s.native, s, t.date));
    if (counterpart && personalIds.has(counterpart.accountId)) {
      if (value > 0) {
        const repaid = Math.min(value, Math.max(0, debtBefore - debtAfter));
        const otherCard = stateByAccount.get(counterpart.accountId);
        if (otherCard && eligible(counterpart)) {
          const shifted = Math.min(repaid, Math.max(0, s.reserve));
          reserve(s, t.date, -shifted);
          reserve(otherCard, t.date, shifted);
        } else {
          reserve(s, t.date, -repaid);
          let unfundedPayment = Math.max(0, repaid - Math.max(0, s.reserve + repaid));
          for (const [id, owed] of s.unfunded) {
            const paid = Math.min(unfundedPayment, owed);
            s.unfunded.set(id, owed - paid);
            unfundedPayment -= paid;
          }
        }
      }
      continue;
    }
    const leaves = t.isParent
      ? all.filter((c) => c.parentTransactionId === t.id).sort((a, b) => a.id.localeCompare(b.id))
      : [t];
    let prepaidSpent = Math.max(0, -value - Math.max(0, debtAfter - debtBefore));
    let refundDebt = Math.max(0, debtBefore - debtAfter);
    let refundPrepaid = Math.max(0, value - refundDebt);
    for (const leaf of leaves) {
      if (!activityIds.has(leaf.id)) continue;
      const value = amount(leaf),
        id = leaf.categoryId;
      if (value < 0) {
        const spending = -value;
        const prepaid = Math.min(spending, prepaidSpent);
        prepaidSpent -= prepaid;
        if (!id || !expenseIds.has(id)) continue;
        const backed = Math.min(spending, Math.max(0, pool.get(id) ?? 0));
        pool.set(id, (pool.get(id) ?? 0) - spending);
        const funded = Math.max(0, backed - prepaid);
        reserve(s, leaf.date, funded);
        s.funded += funded;
        s.unfunded.set(id, (s.unfunded.get(id) ?? 0) + Math.max(0, spending - prepaid - funded));
      } else if (value > 0) {
        const debtPart = Math.min(value, refundDebt);
        refundDebt -= debtPart;
        const prepaid = Math.min(value - debtPart, refundPrepaid);
        refundPrepaid -= prepaid;
        const deficitRecovery = Math.min(prepaid, Math.max(0, -s.reserve));
        reserve(s, leaf.date, deficitRecovery);
        const unfunded = id ? Math.min(debtPart, s.unfunded.get(id) ?? 0) : 0;
        if (id) s.unfunded.set(id, (s.unfunded.get(id) ?? 0) - unfunded);
        const released = Math.min(debtPart - unfunded, Math.max(0, s.reserve));
        reserve(s, leaf.date, -released);
        if (id && expenseIds.has(id)) {
          const backedRefund = unfunded + released + prepaid;
          add(id, leaf.date, backedRefund - value);
          pool.set(id, (pool.get(id) ?? 0) + backedRefund);
        }
      }
    }
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
  return { adjustments, positions, complete };
}
