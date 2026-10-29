import { and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { transactions } from '../db/schema.js';
import { budgetStartDate, mainAmount } from './balances.js';
import { receivedSpending } from './budgetLedger.js';
import { monthBounds } from '../utils/date.js';

interface Figures {
  id: string;
  budgeted: number;
  transferred: number;
  activity: number;
  spent: number;
  carryOver: number;
  balance: number;
}

/**
 * A month before the budget start has no envelopes, but its transactions are real. The budget
 * page shows them read-only as each category's Activity (nothing assigned, nothing carried)
 * instead of $0 everywhere. Months from the start on are returned as they are, and nothing is
 * written: the envelopes still count from the start (Settings → Budget start).
 */
export function withHistoricActivity<G extends { categories: Figures[] }>(
  groups: G[],
  month: string,
): G[] {
  const start = budgetStartDate().slice(0, 7);
  if (!start || month >= start) return groups;
  const { from, to } = monthBounds(month);
  const totals = new Map(
    db
      .select({
        categoryId: transactions.categoryId,
        total: sql<number>`coalesce(sum(${mainAmount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          receivedSpending,
          sql`${transactions.date} >= ${from}`,
          sql`${transactions.date} <= ${to}`,
        ),
      )
      .groupBy(transactions.categoryId)
      .all()
      .flatMap((r) => (r.categoryId ? [[r.categoryId, r.total] as const] : [])),
  );
  return groups.map((g) => ({
    ...g,
    categories: g.categories.map((c) => {
      const activity = totals.get(c.id) ?? 0;
      return {
        ...c,
        budgeted: 0,
        transferred: 0,
        carryOver: 0,
        activity,
        spent: Math.abs(Math.min(activity, 0)),
        balance: activity,
      };
    }),
  }));
}
