// Audit decision I-8: when someone repays you, your personal reports show the full expense you
// paid plus an uncategorised inflow. Categorising the repayment back to what it paid for makes
// them show your share. This only offers it: the owner chooses and confirms in the app (a normal
// PUT /transactions/:id), and nothing here, or there, changes the household ledger.
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  categories,
  categoryGroups,
  householdEvents as events,
  householdPeople as people,
  householdShares as shares,
  transactions,
} from '../db/schema.js';

/** How far back the repayer's shares count when suggesting a category */
const LOOKBACK_DAYS = 365;

/**
 * Repayments to you, linked to an uncategorised bank deposit, with the categories of the shared
 * expenses you paid that the repayer had a share in (largest share first). Pure apart from reads.
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
      e.recipientId === self.id &&
      e.payerId &&
      e.transactionId &&
      !e.reversesId &&
      !reversed.has(e.id),
  );
  if (!repayments.length) return [];
  const txIds = repayments.map((e) => e.transactionId!);
  const deposits = new Map(
    db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        categoryId: transactions.categoryId,
        date: transactions.date,
      })
      .from(transactions)
      .where(inArray(transactions.id, txIds))
      .all()
      .map((t) => [t.id, t]),
  );
  // Expenses you paid, with their bank payment's spending category
  const paid = all.filter(
    (e) => e.kind === 'expense' && e.payerId === self.id && e.transactionId && !reversed.has(e.id),
  );
  const paidTx = paid.length
    ? db
        .select({ id: transactions.id, categoryId: transactions.categoryId, name: categories.name })
        .from(transactions)
        .innerJoin(categories, eq(categories.id, transactions.categoryId))
        .innerJoin(categoryGroups, eq(categoryGroups.id, categories.groupId))
        .where(
          and(
            inArray(
              transactions.id,
              paid.map((e) => e.transactionId!),
            ),
            isNotNull(transactions.categoryId),
            eq(categoryGroups.isIncome, 0),
            eq(categories.hidden, 0),
          ),
        )
        .all()
    : [];
  const categoryOf = new Map(paidTx.map((t) => [t.id, t]));
  const shareRows = paid.length
    ? db
        .select()
        .from(shares)
        .where(
          inArray(
            shares.eventId,
            paid.map((e) => e.id),
          ),
        )
        .all()
    : [];

  return repayments.flatMap((r) => {
    const deposit = deposits.get(r.transactionId!);
    if (!deposit || deposit.categoryId || deposit.amount <= 0) return [];
    const from = new Date(Date.parse(`${r.date}T00:00:00Z`) - LOOKBACK_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const totals = new Map<string, { categoryId: string; name: string; amount: number }>();
    for (const e of paid) {
      if (e.date > r.date || e.date < from) continue;
      const cat = categoryOf.get(e.transactionId!);
      if (!cat) continue;
      const owed = shareRows
        .filter((s) => s.eventId === e.id && s.personId === r.payerId)
        .reduce((sum, s) => sum + s.amount, 0);
      if (owed <= 0) continue;
      const t = totals.get(cat.categoryId!) ?? {
        categoryId: cat.categoryId!,
        name: cat.name,
        amount: 0,
      };
      t.amount += owed;
      totals.set(cat.categoryId!, t);
    }
    const candidates = [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
    if (!candidates.length) return [];
    return [
      {
        eventId: r.id,
        transactionId: r.transactionId!,
        date: r.date,
        amount: r.amount,
        description: r.description,
        payerId: r.payerId!,
        /** The repayer's shares of what you paid in the year before, by category */
        candidates,
      },
    ];
  });
}
