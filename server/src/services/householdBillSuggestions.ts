import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { householdBillDismissals, payees, transactions } from '../db/schema.js';
import { addDaysIso, daysBetweenIso, todayIso } from '../utils/date.js';
import {
  buildRecurrenceRule,
  type RecurrenceRule,
  type RecurrenceType,
} from '../utils/recurrence.js';
import {
  commonCategory,
  createDiscoveredSchedules,
  payeeKeyOf,
  scheduledPayeeKeys,
} from './scheduleDiscovery.js';
import { shareRecurringBills, snapshot } from './householdService.js';

// Bills a household account pays that aren't in Recurring yet, like a power bill every two
// months or water every quarter. Schedule discovery looks for weekly to monthly habits over four
// months; household bills are often slower, so this looks back a year, at money out of the
// household's own accounts only. A suggestion is never added by itself: the owner adds it as a
// household bill (a variable recurring item shared with the household) or says it isn't one.

/** How far back the household accounts are read */
export const LOOKBACK_DAYS = 400;

/** Gaps between payments (days) that read as each frequency, slowest last */
export const BILL_FREQUENCIES = [
  { label: 'monthly', recurrenceType: 'monthly', interval: 1, days: [22, 40] },
  { label: 'every 2 months', recurrenceType: 'monthly', interval: 2, days: [48, 75] },
  { label: 'quarterly', recurrenceType: 'quarterly', interval: 1, days: [76, 110] },
  { label: 'every 6 months', recurrenceType: 'semiannually', interval: 1, days: [160, 205] },
  { label: 'yearly', recurrenceType: 'yearly', interval: 1, days: [330, 400] },
] as const;

export type BillFrequency = (typeof BILL_FREQUENCIES)[number];

/** The frequency a median gap reads as, or null when it reads as none of them */
export function frequencyOf(medianGap: number): BillFrequency | null {
  return BILL_FREQUENCIES.find((f) => medianGap >= f.days[0] && medianGap <= f.days[1]) ?? null;
}

/** The days a frequency usually lasts, for "is it still going" and the next date */
export const typicalDays = (f: BillFrequency) => Math.round((f.days[0] + f.days[1]) / 2);

export interface BillSuggestion {
  /** `<payee key>|<account id>`: what the add and dismiss routes take */
  id: string;
  payeeKey: string;
  payeeId: string | null;
  payeeName: string;
  accountId: string;
  frequency: BillFrequency['label'];
  count: number;
  firstDate: string;
  lastDate: string;
  /** About when the next one is due: the last payment plus the frequency's typical gap */
  nextDate: string;
  /** Positive minor units: the median of the last three, and the range of all of them */
  amount: number;
  minAmount: number;
  maxAmount: number;
  transactionIds: string[];
  categoryId: string | null;
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  payeeId: string | null;
  payeeName: string | null;
  categoryId: string | null;
}

const median = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

/**
 * One payee's payments from one account (any order) as a bill, or null when they aren't
 * regular, number fewer than two, or stopped: the last one is more than one and a half usual
 * gaps before `today`.
 */
export function billFromPayments(
  payments: readonly Payment[],
  today: string,
): Omit<BillSuggestion, 'id' | 'payeeKey' | 'accountId'> | null {
  if (payments.length < 2) return null;
  const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date));
  const gaps = sorted.slice(1).map((p, i) => daysBetweenIso(sorted[i].date, p.date));
  const frequency = frequencyOf(median(gaps));
  if (!frequency) return null;
  // Every gap has to be the same kind, allowing one missed or doubled-up bill
  if (gaps.some((g) => g < frequency.days[0] / 2 || g > frequency.days[1] * 2)) return null;
  const last = sorted[sorted.length - 1];
  if (daysBetweenIso(last.date, today) > typicalDays(frequency) * 1.5) return null;
  const amounts = sorted.map((p) => -p.amount);
  return {
    payeeId: last.payeeId,
    payeeName: last.payeeName ?? 'Unknown payee',
    frequency: frequency.label,
    count: sorted.length,
    firstDate: sorted[0].date,
    lastDate: last.date,
    nextDate: addDaysIso(last.date, typicalDays(frequency)),
    amount: median(amounts.slice(-3)),
    minAmount: Math.min(...amounts),
    maxAmount: Math.max(...amounts),
    transactionIds: sorted.map((p) => p.id),
    categoryId: commonCategory(sorted),
  };
}

/** Suggested bills for a household, newest-due first; none for a household without an account */
export function billSuggestions(groupId: string, today = todayIso()): BillSuggestion[] {
  const accountIds = snapshot(groupId).group.poolAccountIds;
  if (!accountIds.length) return [];
  const covered = scheduledPayeeKeys();
  const dismissed = new Set(
    db
      .select({ key: householdBillDismissals.payeeKey })
      .from(householdBillDismissals)
      .where(eq(householdBillDismissals.groupId, groupId))
      .all()
      .map((d) => d.key),
  );
  const rows = db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      accountId: transactions.accountId,
      payeeId: transactions.payeeId,
      payeeName: payees.name,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .leftJoin(payees, eq(payees.id, transactions.payeeId))
    .where(
      and(
        inArray(transactions.accountId, accountIds),
        lt(transactions.amount, 0),
        isNull(transactions.transferTransactionId),
        eq(transactions.isParent, 0),
        gte(transactions.date, addDaysIso(today, -LOOKBACK_DAYS)),
      ),
    )
    .all();
  const byPayee = new Map<string, Payment[]>();
  for (const row of rows) {
    const payeeKey = payeeKeyOf(row);
    if (!payeeKey || covered.has(payeeKey) || dismissed.has(payeeKey)) continue;
    const key = `${payeeKey}|${row.accountId}`;
    byPayee.set(key, [...(byPayee.get(key) ?? []), row]);
  }
  const found: BillSuggestion[] = [];
  for (const [key, payments] of byPayee) {
    const bill = billFromPayments(payments, today);
    if (!bill) continue;
    const [payeeKey, accountId] = key.split('|');
    found.push({ id: key, payeeKey, accountId, ...bill });
  }
  return found.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

/** The recurrence rule for a suggestion's frequency, anchored on its last payment */
export function ruleFor(
  frequency: BillFrequency['label'],
  lastDate: string,
): { recurrenceType: RecurrenceType; recurrenceRule: RecurrenceRule } {
  const f = BILL_FREQUENCIES.find((x) => x.label === frequency)!;
  const rule = buildRecurrenceRule(f.recurrenceType, lastDate);
  return {
    recurrenceType: f.recurrenceType,
    recurrenceRule: rule.type === 'monthly' ? { ...rule, interval: f.interval } : rule,
  };
}

/**
 * Adds a suggestion as a household bill: a variable recurring item (its amount the median of
 * the last three payments) from the last payment on, linked to that payment, then shared with
 * the household. Refused when the suggestion no longer stands (added or dismissed since).
 */
export function addSuggestedBill(groupId: string, suggestionId: string, today = todayIso()) {
  const suggestion = billSuggestions(groupId, today).find((s) => s.id === suggestionId);
  if (!suggestion) throw new Error('That bill is no longer suggested');
  const { recurrenceType, recurrenceRule } = ruleFor(suggestion.frequency, suggestion.lastDate);
  return db.transaction(() => {
    const [scheduleId] = createDiscoveredSchedules([
      {
        id: suggestion.id,
        accountId: suggestion.accountId,
        accountName: '',
        payeeId: suggestion.payeeId,
        payeeName: suggestion.payeeName,
        amount: -suggestion.amount,
        amountType: 'variable',
        recurrenceType,
        recurrenceRule,
        startDate: suggestion.lastDate,
        exactDate: false,
        categoryId: suggestion.categoryId,
        transactionIds: [suggestion.transactionIds[suggestion.transactionIds.length - 1]],
      },
    ]);
    shareRecurringBills(groupId, [scheduleId]);
    return snapshot(groupId);
  });
}

/** Never suggests this payee for this household again */
export function dismissSuggestedBill(groupId: string, payeeKey: string) {
  snapshot(groupId); // refuses an unknown household
  db.insert(householdBillDismissals)
    .values({ groupId, payeeKey, dismissedAt: new Date().toISOString() })
    .onConflictDoNothing()
    .run();
}
