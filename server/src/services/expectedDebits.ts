import { and, eq, gte, lte } from 'drizzle-orm';
import { addDays, format, parseISO } from 'date-fns';
import { db } from '../db/index.js';
import { accounts, scheduleOccurrences, schedules } from '../db/schema.js';
import {
  computeOccurrenceDates,
  type RecurrenceRule,
  type RecurrenceType,
  type WeekendAdjust,
} from '../utils/recurrence.js';
import { monthBounds } from '../utils/date.js';
import { accountCurrency, convertAmount, currencyContext, todayIso } from './mainAmountService.js';
import { expectedInstalments } from './paymentPlanService.js';

export interface ExpectedDebit {
  scheduleId: string;
  name: string;
  /** The day it is expected to leave the account (after weekend adjustment) */
  date: string;
  /** Positive minor units in the budget's currency */
  amount: number;
}

/**
 * Recurring debits still to come in a month, by category: what each envelope should expect to
 * be spent but hasn't been yet. Only active schedules with a category and a negative amount
 * count; transfers and off-budget or closed accounts don't touch envelopes. An occurrence
 * stops being expected once it is matched, paid or skipped. Past months expect nothing; the
 * current month still lists overdue ones until they arrive. A projection only: it never writes
 * occurrences or changes the ledger.
 */
export function expectedDebits(month: string, today = todayIso()): Map<string, ExpectedDebit[]> {
  const byCategory = new Map<string, ExpectedDebit[]>();
  if (month < today.slice(0, 7)) return byCategory;
  const { from } = monthBounds(month);
  const to = format(addDays(parseISO(from), 31), 'yyyy-MM-01');
  const lastDay = format(addDays(parseISO(to), -1), 'yyyy-MM-dd');
  // Weekend adjustment can move a date over the month boundary, so look a little wider
  const scanFrom = format(addDays(parseISO(from), -7), 'yyyy-MM-dd');
  const scanTo = format(addDays(parseISO(lastDay), 7), 'yyyy-MM-dd');

  const accountRows = new Map(
    db
      .select()
      .from(accounts)
      .all()
      .map((a) => [a.id, a]),
  );
  const ctx = currencyContext();
  const active = db.select().from(schedules).where(eq(schedules.status, 'active')).all();
  for (const s of active) {
    if (!s.categoryId || s.amount >= 0 || s.transferAccountId) continue;
    const account = s.accountId ? accountRows.get(s.accountId) : undefined;
    if (account && (account.closedAt || account.isOffBudget)) continue;

    let rule: RecurrenceRule;
    try {
      rule = JSON.parse(s.recurrenceRule);
    } catch {
      continue;
    }
    const pairs = computeOccurrenceDates(
      {
        startDate: s.startDate,
        endDate: s.endDate,
        recurrenceType: s.recurrenceType as RecurrenceType,
        recurrenceRule: rule,
        weekendAdjust: (s.weekendAdjust as WeekendAdjust) || 'none',
      },
      scanFrom,
      scanTo,
    ).filter((p) => p.expectedDate >= from && p.expectedDate <= lastDay);
    if (!pairs.length) continue;

    const settled = new Map(
      db
        .select()
        .from(scheduleOccurrences)
        .where(
          and(
            eq(scheduleOccurrences.scheduleId, s.id),
            gte(scheduleOccurrences.scheduledDate, scanFrom),
            lte(scheduleOccurrences.scheduledDate, scanTo),
          ),
        )
        .all()
        .map((o) => [o.scheduledDate, o]),
    );
    for (const p of pairs) {
      const occ = settled.get(p.scheduledDate);
      if (occ && (occ.status !== 'pending' || occ.matchedTransactionId)) continue;
      const raw = occ?.expectedAmount ?? s.amount;
      if (raw >= 0) continue;
      const currency = s.accountId ? accountCurrency(s.accountId, ctx) : ctx.budget;
      const value = convertAmount(-raw, currency, ctx.budget, p.expectedDate, ctx) ?? -raw;
      const list = byCategory.get(s.categoryId) ?? [];
      list.push({ scheduleId: s.id, name: s.name, date: p.expectedDate, amount: value });
      byCategory.set(s.categoryId, list);
    }
  }
  // Afterpay-style instalments still to pay, under the plan account's payment envelope
  for (const [categoryId, items] of expectedInstalments(month, today))
    byCategory.set(categoryId, [...(byCategory.get(categoryId) ?? []), ...items]);
  for (const list of byCategory.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return byCategory;
}

type WithExpected<C> = C & { expected: number; expectedItems: ExpectedDebit[] };

/** Budget groups with each expense category's expected debits for the month attached */
export function withExpectedDebits<
  G extends { isIncome: number | boolean; categories: { id: string }[] },
>(
  groups: G[],
  month: string,
  today = todayIso(),
): (Omit<G, 'categories'> & { categories: WithExpected<G['categories'][number]>[] })[] {
  const expected = expectedDebits(month, today);
  return groups.map((g) => ({
    ...g,
    categories: g.categories.map((c) => {
      const items = g.isIncome ? [] : (expected.get(c.id) ?? []);
      return { ...c, expected: items.reduce((s, i) => s + i.amount, 0), expectedItems: items };
    }),
  }));
}
