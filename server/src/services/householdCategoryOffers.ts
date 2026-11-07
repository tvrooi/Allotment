// Audit decision I-8: when someone repays you, your personal reports show the full expense you
// paid plus an uncategorised inflow. Categorising the repayment back to what it paid for makes
// them show your share. The same holds the other way: when you repay someone for things they
// paid, your payment is uncategorised spending until it is put in the categories of what you
// owed them for. This only offers it: the owner chooses and confirms in the app (a normal
// PUT /transactions/:id), and nothing here, or there, changes the household ledger.
import { and, count, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  categories,
  categoryGroups,
  householdEvents as events,
  householdPeople as people,
  householdShares as shares,
  payees,
  transactions,
} from '../db/schema.js';
import { addDaysIso } from '../utils/date.js';

/** How far back the other person's shares count when suggesting a category */
const LOOKBACK_DAYS = 365;
/** Categories offered per repayment */
const MAX_CANDIDATES = 5;

type Event = typeof events.$inferSelect;
type Category = { categoryId: string; name: string };

/** Spending categories (not income, not hidden), by id */
function spendingCategories() {
  return new Map(
    db
      .select({ categoryId: categories.id, name: categories.name })
      .from(categories)
      .innerJoin(categoryGroups, eq(categoryGroups.id, categories.groupId))
      .where(and(eq(categoryGroups.isIncome, 0), eq(categories.hidden, 0)))
      .all()
      .map((c) => [c.categoryId, c]),
  );
}

/** Each linked bank payment's spending category */
function paymentCategories(txIds: string[], spending: Map<string, Category>) {
  const result = new Map<string, Category>();
  if (!txIds.length) return result;
  for (const t of db
    .select({ id: transactions.id, categoryId: transactions.categoryId })
    .from(transactions)
    .where(and(inArray(transactions.id, txIds), isNotNull(transactions.categoryId)))
    .all()) {
    const c = spending.get(t.categoryId!);
    if (c) result.set(t.id, c);
  }
  return result;
}

/**
 * An expense someone else paid has no bank payment of yours, so its category comes from the
 * payee its description names exactly (ignoring case): that payee's default category, else the
 * spending category you use most for it. Learned from your own records, never guessed.
 */
function descriptionCategories(descriptions: string[], spending: Map<string, Category>) {
  const wanted = new Set(descriptions.map((d) => d.trim().toLowerCase()).filter(Boolean));
  const result = new Map<string, Category>();
  if (!wanted.size) return result;
  const matched = db
    .select({ id: payees.id, name: payees.name, defaultCategoryId: payees.defaultCategoryId })
    .from(payees)
    .all()
    .filter((p) => wanted.has(p.name.trim().toLowerCase()));
  if (!matched.length) return result;
  const usage = db
    .select({ payeeId: transactions.payeeId, categoryId: transactions.categoryId, n: count() })
    .from(transactions)
    .where(
      and(
        inArray(
          transactions.payeeId,
          matched.map((p) => p.id),
        ),
        isNotNull(transactions.categoryId),
      ),
    )
    .groupBy(transactions.payeeId, transactions.categoryId)
    .all()
    .filter((u) => spending.has(u.categoryId!))
    .sort((a, b) => b.n - a.n || a.categoryId!.localeCompare(b.categoryId!));
  for (const p of matched) {
    const key = p.name.trim().toLowerCase();
    if (result.has(key)) continue;
    const id =
      (p.defaultCategoryId && spending.has(p.defaultCategoryId) ? p.defaultCategoryId : null) ??
      usage.find((u) => u.payeeId === p.id)?.categoryId ??
      null;
    if (id) result.set(key, spending.get(id)!);
  }
  return result;
}

/**
 * Repayments linked to an uncategorised bank row, each with the categories of what it settled:
 * - to you (a deposit): the repayer's shares of shared expenses you paid;
 * - from you (a payment): your shares of shared expenses the person you repaid paid.
 * Largest first, from the year before the repayment. Pure apart from reads.
 */
export function repaymentCategoryOffers(groupId: string) {
  const self = db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.groupId, groupId), eq(people.isSelf, 1)))
    .get();
  if (!self) return [];
  const all = db.select().from(events).where(eq(events.groupId, groupId)).all();
  const reversed = new Set(all.map((e) => e.reversesId).filter(Boolean));
  const repayments = all.filter(
    (e) =>
      e.kind === 'settlement' &&
      e.payerId &&
      e.recipientId &&
      (e.recipientId === self.id || e.payerId === self.id) &&
      e.transactionId &&
      !e.reversesId &&
      !reversed.has(e.id),
  );
  if (!repayments.length) return [];
  const bankRows = new Map(
    db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        categoryId: transactions.categoryId,
      })
      .from(transactions)
      .where(
        inArray(
          transactions.id,
          repayments.map((e) => e.transactionId!),
        ),
      )
      .all()
      .map((t) => [t.id, t]),
  );
  const open = repayments.filter((r) => {
    const row = bankRows.get(r.transactionId!);
    if (!row || row.categoryId) return false;
    return r.recipientId === self.id ? row.amount > 0 : row.amount < 0;
  });
  if (!open.length) return [];

  const expenses = all.filter((e) => e.kind === 'expense' && e.payerId && !reversed.has(e.id));
  const spending = spendingCategories();
  const byPayment = paymentCategories(
    expenses.filter((e) => e.transactionId).map((e) => e.transactionId!),
    spending,
  );
  const byDescription = descriptionCategories(
    expenses.filter((e) => !e.transactionId).map((e) => e.description),
    spending,
  );
  const categoryOf = (e: Event) =>
    e.transactionId
      ? byPayment.get(e.transactionId)
      : byDescription.get(e.description.trim().toLowerCase());
  const shareRows = expenses.length
    ? db
        .select()
        .from(shares)
        .where(
          inArray(
            shares.eventId,
            expenses.map((e) => e.id),
          ),
        )
        .all()
    : [];

  return open.flatMap((r) => {
    const toYou = r.recipientId === self.id;
    // To you: what the repayer owed for things you paid. From you: what you owed for theirs.
    const paidBy = toYou ? self.id : r.recipientId!;
    const owedBy = toYou ? r.payerId! : self.id;
    const from = addDaysIso(r.date, -LOOKBACK_DAYS);
    const totals = new Map<string, Category & { amount: number }>();
    for (const e of expenses) {
      if (e.payerId !== paidBy || e.date > r.date || e.date < from) continue;
      // Only your own bank payments count for a repayment to you, as before
      if (toYou && !e.transactionId) continue;
      const cat = categoryOf(e);
      if (!cat) continue;
      const owed = shareRows
        .filter((s) => s.eventId === e.id && s.personId === owedBy)
        .reduce((sum, s) => sum + s.amount, 0);
      if (owed <= 0) continue;
      const t = totals.get(cat.categoryId) ?? { ...cat, amount: 0 };
      t.amount += owed;
      totals.set(cat.categoryId, t);
    }
    const candidates = [...totals.values()]
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
      .slice(0, MAX_CANDIDATES);
    if (!candidates.length) return [];
    return [
      {
        eventId: r.id,
        transactionId: r.transactionId!,
        date: r.date,
        amount: r.amount,
        description: r.description,
        /** to_you: someone repaid you; from_you: you repaid someone */
        direction: toYou ? ('to_you' as const) : ('from_you' as const),
        payerId: r.payerId!,
        /** The other person in the repayment */
        personId: toYou ? r.payerId! : r.recipientId!,
        /** What that repayment settled in the year before, by category */
        candidates,
      },
    ];
  });
}
