import { and, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { db } from '../db/index.js';
import { categories, categoryGroups, payees, transactions } from '../db/schema.js';
import { mainAmount, reportedBudgetActivity } from './balances.js';
import { todayIso } from './mainAmountService.js';

// What is still uncategorised after an import, and where pay comes from. Read-only: the
// client changes categories through the payee and bulk-edit routes, which can be undone.

export interface UncategorisedSummary {
  /** All spending in the window, positive minor units, budget currency */
  spending: number;
  uncategorisedSpending: number;
  uncategorisedSpendingCount: number;
  /** Money in with no category (pay that has not been marked as income yet) */
  uncategorisedIncome: number;
  uncategorisedIncomeCount: number;
  /** Money in under an income category */
  categorisedIncome: number;
  /** uncategorisedSpending / spending, 0 to 1 */
  share: number;
}

/** Share of spending above which a forecast or report says it leaves spending out */
export const UNCATEGORISED_WARN_SHARE = 0.05;

/**
 * Spending and income that reports count, split by whether they have a category. Up's own
 * transfers between accounts that have not been linked yet are left out: they are not spending.
 */
export function uncategorisedSummary(from?: string, to?: string): UncategorisedSummary {
  const row = db
    .select({
      spending: sql<number>`coalesce(sum(case when ${mainAmount} < 0 then -${mainAmount} else 0 end), 0)`,
      uncatOut: sql<number>`coalesce(sum(case when ${transactions.categoryId} is null and ${mainAmount} < 0 then -${mainAmount} else 0 end), 0)`,
      uncatOutCount: sql<number>`coalesce(sum(case when ${transactions.categoryId} is null and ${mainAmount} < 0 then 1 else 0 end), 0)`,
      uncatIn: sql<number>`coalesce(sum(case when ${transactions.categoryId} is null and ${mainAmount} > 0 then ${mainAmount} else 0 end), 0)`,
      uncatInCount: sql<number>`coalesce(sum(case when ${transactions.categoryId} is null and ${mainAmount} > 0 then 1 else 0 end), 0)`,
      catIn: sql<number>`coalesce(sum(case when ${mainAmount} > 0 and ${transactions.categoryId} in (select c.id from categories c inner join category_groups g on g.id = c.group_id where g.is_income = 1) then ${mainAmount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        reportedBudgetActivity,
        // Up's own transfers between accounts that are not linked yet are not spending
        sql`coalesce(${transactions.notes}, '') not like '%Up internal transfer%'`,
        from ? gte(transactions.date, from) : undefined,
        to ? lte(transactions.date, to) : undefined,
      ),
    )
    .get()!;
  return {
    spending: row.spending,
    uncategorisedSpending: row.uncatOut,
    uncategorisedSpendingCount: row.uncatOutCount,
    uncategorisedIncome: row.uncatIn,
    uncategorisedIncomeCount: row.uncatInCount,
    categorisedIncome: row.catIn,
    share: row.spending > 0 ? row.uncatOut / row.spending : 0,
  };
}

/** The income category pay belongs in: Pay/Paychecks/Salary, else the first income category */
export function payCategory() {
  const rows = db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(and(eq(categoryGroups.isIncome, 1), eq(categories.hidden, 0)))
    .orderBy(categoryGroups.sortOrder, categories.sortOrder)
    .all();
  return (
    rows.find((c) => /^(pay|paychecks?|salary|wages?)$/i.test(c.name.trim())) ?? rows[0] ?? null
  );
}

export type SalarySchedule = 'weekly' | 'fortnightly' | 'monthly';
export interface SalaryGuess {
  payeeId: string;
  payeeName: string;
  schedule: SalarySchedule;
  /** 7 or 14; null for monthly pay */
  intervalDays: number | null;
  latestDate: string;
  latestAmount: number;
  occurrences: number;
  /** Deposits from this payee that still have no category */
  uncategorisedCount: number;
  /** Where to put it; null when the budget has no income category */
  categoryId: string | null;
  categoryName: string | null;
}

const CLASSES: { schedule: SalarySchedule; days: number | null; min: number; max: number }[] = [
  { schedule: 'weekly', days: 7, min: 6, max: 8 },
  { schedule: 'fortnightly', days: 14, min: 13, max: 15 },
  { schedule: 'monthly', days: null, min: 28, max: 31 },
];
/** A payee whose last deposit is older than this is not current pay */
const STALE_DAYS = 62;

/** Pure: which schedule a run of deposit dates (any order, YYYY-MM-DD) follows, if any */
export function payInterval(dates: string[]) {
  const days = [...new Set(dates)].sort();
  if (days.length < 3) return null;
  const gaps = days
    .slice(1)
    .map((d, i) => differenceInCalendarDays(parseISO(d), parseISO(days[i])));
  for (const c of CLASSES) {
    const fit = gaps.filter((g) => g >= c.min && g <= c.max).length;
    // Allow one missed or shifted deposit in a longer run
    if (fit === gaps.length || (gaps.length >= 4 && fit / gaps.length >= 0.75)) return c;
  }
  return null;
}

/**
 * The largest repeating credit on a fixed 7, 14 or 28-31 day interval from a stable payee. Only
 * a guess: the owner confirms it before anything is categorised. Transfers between accounts and
 * Up's unlinked internal transfers are not pay.
 */
export function detectSalary(today = todayIso()): SalaryGuess | null {
  const rows = db
    .select({
      payeeId: transactions.payeeId,
      date: transactions.date,
      amount: mainAmount,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(
      and(
        reportedBudgetActivity,
        isNotNull(transactions.payeeId),
        sql`${mainAmount} > 0`,
        sql`coalesce(${transactions.notes}, '') not like '%Up internal transfer%'`,
        gte(transactions.date, addIso(today, -400)),
      ),
    )
    .all();
  const byPayee = new Map<string, typeof rows>();
  for (const r of rows) byPayee.set(r.payeeId!, [...(byPayee.get(r.payeeId!) ?? []), r]);
  let best: {
    payeeId: string;
    median: number;
    rows: typeof rows;
    cls: (typeof CLASSES)[number];
  } | null = null;
  for (const [payeeId, list] of byPayee) {
    const recent = [...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    if (differenceInCalendarDays(parseISO(today), parseISO(recent[0].date)) > STALE_DAYS) continue;
    const cls = payInterval(recent.map((r) => r.date));
    if (!cls) continue;
    const amounts = recent.map((r) => r.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    if (!best || median > best.median) best = { payeeId, median, rows: list, cls };
  }
  if (!best) return null;
  const payee = db.select().from(payees).where(eq(payees.id, best.payeeId)).get();
  if (!payee) return null;
  const latest = [...best.rows].sort((a, b) => b.date.localeCompare(a.date))[0];
  const category = payCategory();
  return {
    payeeId: payee.id,
    payeeName: payee.name,
    schedule: best.cls.schedule,
    intervalDays: best.cls.days,
    latestDate: latest.date,
    latestAmount: latest.amount,
    occurrences: best.rows.length,
    uncategorisedCount: best.rows.filter((r) => !r.categoryId).length,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
  };
}

const addIso = (day: string, n: number) => addDays(parseISO(day), n).toISOString().slice(0, 10);
