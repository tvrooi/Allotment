/**
 * Recurring-transaction discovery — a port of Actual Budget's `find-schedules.ts`.
 *
 * For each open account, starting from its latest transaction, we try every candidate
 * start day for each pattern (weekly, every 2 weeks, monthly on day X, monthly on the
 * last day). For a candidate we take its 3 most recent occurrence dates and look for
 * transactions within ±2 days that share the same payee and an amount within 7.5%.
 * A candidate only counts if every occurrence matched; it's ranked by date closeness
 * (1 / (daysOff + 1) per occurrence). The best-ranked candidate per payee wins, and its
 * start date is walked backwards while earlier matching transactions keep existing.
 *
 * Transactions already linked to a schedule, transfers, and split children are ignored,
 * as are payees that already have a non-canceled schedule.
 *
 * Payees whose recent transactions look regular but don't qualify are returned as near
 * misses, with the reason, so "why wasn't my gym found?" has an answer.
 */
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { accounts, scheduleOccurrences, schedules, transactions } from '../db/schema.js';
import {
  computeOccurrenceDates,
  type RecurrenceRule,
  type RecurrenceType,
} from '../utils/recurrence.js';
import { ensureOccurrences } from './scheduleService.js';
import { linkOccurrenceToTransaction } from './matchingEngine.js';

const DATE_WINDOW = 2; // ±days, Actual's approx-date bound
const OCCURRENCES_TO_MATCH = 3;

type Tx = {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  payeeKey: string;
  payeeId: string | null;
  payeeName: string | null;
  categoryId: string | null;
};

type Pattern = { recurrenceType: RecurrenceType; rule: RecurrenceRule };

type Candidate = {
  rank: number;
  amount: number;
  accountId: string;
  payeeKey: string;
  pattern: Pattern;
  startDate: string;
  exactDate: boolean;
  exactAmount: boolean;
};

export interface DiscoveredSchedule {
  id: string;
  accountId: string;
  accountName: string;
  payeeId: string | null;
  payeeName: string;
  amount: number;
  amountType: 'exact' | 'approximate';
  recurrenceType: RecurrenceType;
  recurrenceRule: RecurrenceRule;
  startDate: string;
  exactDate: boolean;
  categoryId: string | null;
  transactionIds: string[];
}

export type NearMissReason = 'amounts_vary' | 'too_few' | 'dates_drift' | 'mixed_signs';

/** A payee that looks recurring but didn't qualify, and why */
export interface NearMiss {
  id: string;
  accountId: string;
  accountName: string;
  payeeId: string | null;
  payeeName: string;
  reason: NearMissReason;
  recurrenceType: 'weekly' | 'biweekly' | 'monthly';
  count: number;
  lastDate: string;
  /** The latest amount, and the range of the recent ones */
  amount: number;
  minAmount: number;
  maxAmount: number;
  categoryId: string | null;
}

/** Actual's getApproxNumberThreshold: 7.5% of the amount. */
const threshold = (amount: number) => Math.round(Math.abs(amount) * 0.075);
const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const dayDiff = (a: string, b: string) =>
  Math.abs(differenceInCalendarDays(parseISO(a), parseISO(b)));
const rankOf = (a: string, b: string) => 1 / (dayDiff(a, b) + 1);

function payeeKeyOf(t: { payeeId: string | null; payeeName: string | null }): string {
  if (t.payeeId) return `id:${t.payeeId}`;
  const name = t.payeeName?.trim().toLowerCase();
  return name ? `name:${name}` : '';
}

function patternFor(recurrenceType: RecurrenceType, start: Date, lastDay = false): Pattern {
  switch (recurrenceType) {
    case 'weekly':
      return { recurrenceType, rule: { type: 'weekly', interval: 1, anchorDay: start.getDay() } };
    case 'biweekly':
      return { recurrenceType, rule: { type: 'biweekly', anchorDay: start.getDay() } };
    default:
      // anchorDay 31 clamps to the last day of each month
      return {
        recurrenceType: 'monthly',
        rule: { type: 'monthly', interval: 1, anchorDay: lastDay ? 31 : start.getDate() },
      };
  }
}

/** First N occurrence dates of a pattern starting at `start` (Actual's takeDates). */
function takeDates(pattern: Pattern, start: string, n = OCCURRENCES_TO_MATCH): string[] {
  const def = {
    startDate: start,
    endDate: null,
    recurrenceType: pattern.recurrenceType,
    recurrenceRule: pattern.rule,
    weekendAdjust: 'none' as const,
  };
  return computeOccurrenceDates(def, start, fmt(addDays(parseISO(start), 150)))
    .slice(0, n)
    .map((p) => p.scheduledDate);
}

function txNear(txs: Tx[], date: string): Tx[] {
  return txs.filter((t) => dayDiff(t.date, date) <= DATE_WINDOW);
}

/** Actual's matchSchedules: every transaction on the latest date seeds a candidate. */
function matchCandidates(
  occurs: { date: string; txs: Tx[] }[],
  pattern: Pattern,
  startDate: string,
): Candidate[] {
  const [base, ...rest] = [...occurs].reverse();
  const found: Candidate[] = [];
  for (const trans of base.txs) {
    if (!trans.payeeKey) continue;
    const th = threshold(trans.amount);
    const matches = rest.map((occ) => {
      const m = occ.txs.find((t) => t.amount >= trans.amount - th && t.amount <= trans.amount + th);
      return m && m.payeeKey === trans.payeeKey ? { t: m, rank: rankOf(occ.date, m.date) } : null;
    });
    if (matches.some((m) => m === null)) continue;
    const rank = matches.reduce((sum, m) => sum + m!.rank, rankOf(base.date, trans.date));
    found.push({
      rank,
      amount: trans.amount,
      accountId: trans.accountId,
      payeeKey: trans.payeeKey,
      pattern,
      startDate,
      exactDate: rank === occurs.length,
      exactAmount: matches.every((m) => m!.t.amount === trans.amount),
    });
  }
  return found;
}

function scanPattern(
  txs: Tx[],
  baseStart: Date,
  numDays: number,
  make: (start: Date) => Pattern | false,
): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < numDays; i++) {
    const start = addDays(baseStart, i);
    const pattern = make(start);
    if (!pattern) continue;
    const startStr = fmt(start);
    const occurs = takeDates(pattern, startStr).map((date) => ({ date, txs: txNear(txs, date) }));
    if (occurs.length < OCCURRENCES_TO_MATCH) continue;
    out.push(...matchCandidates(occurs, pattern, startStr));
  }
  return out;
}

function candidatesForAccount(txs: Tx[], latest: string): Candidate[] {
  const l = parseISO(latest);
  return [
    ...scanPattern(txs, subWeeks(l, 4), 14, (s) => patternFor('weekly', s)),
    ...scanPattern(txs, subWeeks(l, 7), 14, (s) => patternFor('biweekly', s)),
    // Days > 28 aren't in every month; the last-day pattern covers month-end
    ...scanPattern(txs, subMonths(l, 4), 62, (s) =>
      s.getDate() > 28 ? false : patternFor('monthly', s),
    ),
    ...scanPattern(txs, subMonths(l, 3), 1, (s) => patternFor('monthly', s, true)),
    ...scanPattern(txs, subMonths(l, 4), 1, (s) => patternFor('monthly', s, true)),
  ];
}

function stepBack(pattern: Pattern, date: string): string {
  const d = parseISO(date);
  switch (pattern.rule.type) {
    case 'weekly':
      return fmt(subWeeks(d, pattern.rule.interval));
    case 'biweekly':
      return fmt(subWeeks(d, 2));
    default:
      return fmt(subMonths(d, 1));
  }
}

/** Transactions that belong to this candidate across its full history. */
function matchingTxs(c: Candidate, txs: Tx[], occurrenceDates: string[]): Tx[] {
  const th = c.exactAmount ? 0 : threshold(c.amount);
  const window = c.exactDate ? 0 : DATE_WINDOW;
  const used = new Set<string>();
  const out: Tx[] = [];
  for (const date of occurrenceDates) {
    const m = txs.find(
      (t) =>
        !used.has(t.id) &&
        t.payeeKey === c.payeeKey &&
        Math.abs(t.amount - c.amount) <= th &&
        dayDiff(t.date, date) <= window,
    );
    if (m) {
      used.add(m.id);
      out.push(m);
    }
  }
  return out;
}

/** Actual's findStartDate: walk the start back while an earlier occurrence still has a match. */
function findStartDate(c: Candidate, txs: Tx[]): string {
  let start = c.startDate;
  for (let i = 0; i < 520; i++) {
    const prev = stepBack(c.pattern, start);
    const [firstDate] = takeDates(c.pattern, prev, 1);
    if (!firstDate || matchingTxs(c, txs, [firstDate]).length === 0) break;
    start = prev;
  }
  return start;
}

/** Transactions already claimed by any occurrence (even if scheduleId was cleared). */
function matchedTxIds(): Set<string> {
  return new Set(
    db
      .select({ id: scheduleOccurrences.matchedTransactionId })
      .from(scheduleOccurrences)
      .all()
      .map((r) => r.id)
      .filter((id): id is string => id != null),
  );
}

function loadTransactions(accountId: string, claimed: Set<string>): Tx[] {
  return db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      date: transactions.date,
      amount: transactions.amount,
      payeeId: transactions.payeeId,
      payeeName: transactions.payeeName,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        isNull(transactions.scheduleId),
        isNull(transactions.transferTransactionId),
        isNull(transactions.parentTransactionId),
      ),
    )
    .all()
    .filter((t) => !claimed.has(t.id))
    .map((t) => ({ ...t, payeeKey: payeeKeyOf(t) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Gaps (in days) that read as this frequency: `loose` to recognise the intent, `strict` for
 * what the ±2-day occurrence match above can accept.
 */
const FREQUENCIES = [
  { type: 'weekly', loose: [4, 10], strict: [5, 9] },
  { type: 'biweekly', loose: [10, 18], strict: [12, 16] },
  { type: 'monthly', loose: [22, 40], strict: [26, 35] },
] as const;

/**
 * Why one payee's transactions in one account (oldest first) look regular yet weren't found,
 * or null when they don't look regular at all (or would qualify). Only the last few count, and
 * only while the series is still going at `asOf`.
 */
export function nearMissReason(
  txs: { date: string; amount: number }[],
  asOf: string,
): { reason: NearMissReason; recurrenceType: NearMiss['recurrenceType'] } | null {
  if (txs.length < 2 || txs.length > 24) return null;
  const latest = txs[txs.length - 1];
  const same = txs.filter((t) => Math.sign(t.amount) === Math.sign(latest.amount));
  // Money in and out mixed (a refund between payments) only explains a miss when one sign
  // alone isn't enough
  const series = same.length < OCCURRENCES_TO_MATCH && txs.length > same.length ? txs : same;
  const recent = series.slice(-(OCCURRENCES_TO_MATCH + 1));
  const gaps = recent.slice(1).map((t, i) => dayDiff(t.date, recent[i].date));
  if (!gaps.length) return null;
  const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  const freq = FREQUENCIES.find((f) => median >= f.loose[0] && median <= f.loose[1]);
  if (!freq || gaps.some((g) => g < freq.loose[0] || g > freq.loose[1])) return null;
  if (dayDiff(asOf, latest.date) > freq.loose[1] * 1.5) return null;
  const recurrenceType = freq.type;
  if (series !== same) return { reason: 'mixed_signs', recurrenceType };
  if (same.length < OCCURRENCES_TO_MATCH) return { reason: 'too_few', recurrenceType };
  if (gaps.some((g) => g < freq.strict[0] || g > freq.strict[1]))
    return { reason: 'dates_drift', recurrenceType };
  const th = threshold(latest.amount);
  if (recent.some((t) => Math.abs(t.amount - latest.amount) > th))
    return { reason: 'amounts_vary', recurrenceType };
  return null;
}

/** Most common category among some transactions */
function commonCategory(txs: Tx[]): string | null {
  const counts = new Map<string, number>();
  for (const t of txs)
    if (t.categoryId) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function discoverSchedules(): { found: DiscoveredSchedule[]; nearMisses: NearMiss[] } {
  const openAccounts = db.select().from(accounts).where(isNull(accounts.closedAt)).all();
  const accountName = new Map(openAccounts.map((a) => [a.id, a.name]));

  // Payees already covered by a live schedule are excluded
  const scheduledPayees = new Set(
    db
      .select({ payeeId: schedules.payeeId, name: schedules.name })
      .from(schedules)
      .where(ne(schedules.status, 'canceled'))
      .all()
      .flatMap((s) => [s.payeeId ? `id:${s.payeeId}` : '', `name:${s.name.trim().toLowerCase()}`]),
  );

  const claimed = matchedTxIds();
  const txsByAccount = new Map<string, Tx[]>();
  let all: Candidate[] = [];
  for (const acct of openAccounts) {
    const txs = loadTransactions(acct.id, claimed);
    if (!txs.length) continue;
    txsByAccount.set(acct.id, txs);
    all = all.concat(candidatesForAccount(txs, txs[txs.length - 1].date));
  }

  // Best candidate per payee
  const best = new Map<string, Candidate>();
  for (const c of all) {
    if (scheduledPayees.has(c.payeeKey)) continue;
    const cur = best.get(c.payeeKey);
    if (!cur || c.rank > cur.rank) best.set(c.payeeKey, c);
  }

  const today = fmt(new Date());
  const found: DiscoveredSchedule[] = [];
  for (const c of best.values()) {
    const txs = txsByAccount.get(c.accountId) ?? [];
    const startDate = findStartDate(c, txs);
    const def = {
      startDate,
      endDate: null,
      recurrenceType: c.pattern.recurrenceType,
      recurrenceRule: c.pattern.rule,
      weekendAdjust: 'none' as const,
    };
    const dates = computeOccurrenceDates(def, startDate, today).map((p) => p.scheduledDate);
    const matched = matchingTxs(c, txs, dates);
    const sample = matched[matched.length - 1] ?? txs.find((t) => t.payeeKey === c.payeeKey);

    found.push({
      id: `${c.payeeKey}|${c.accountId}`,
      accountId: c.accountId,
      accountName: accountName.get(c.accountId) ?? '',
      payeeId: sample?.payeeId ?? null,
      payeeName: sample?.payeeName ?? 'Unknown payee',
      amount: c.amount,
      amountType: c.exactAmount ? 'exact' : 'approximate',
      recurrenceType: c.pattern.recurrenceType,
      recurrenceRule: c.pattern.rule,
      startDate,
      exactDate: c.exactDate,
      categoryId: commonCategory(matched),
      transactionIds: matched.map((t) => t.id),
    });
  }

  // Same window as the scan: the last 4 months of each account
  const nearMisses: NearMiss[] = [];
  for (const [accountId, txs] of txsByAccount) {
    const asOf = txs[txs.length - 1].date;
    const from = fmt(subMonths(parseISO(asOf), 4));
    const byPayee = new Map<string, Tx[]>();
    for (const t of txs) {
      if (!t.payeeKey || t.date < from || best.has(t.payeeKey) || scheduledPayees.has(t.payeeKey))
        continue;
      const list = byPayee.get(t.payeeKey) ?? [];
      list.push(t);
      byPayee.set(t.payeeKey, list);
    }
    for (const [payeeKey, list] of byPayee) {
      const why = nearMissReason(list, asOf);
      if (!why) continue;
      const latest = list[list.length - 1];
      const amounts = list.slice(-(OCCURRENCES_TO_MATCH + 1)).map((t) => t.amount);
      nearMisses.push({
        id: `${payeeKey}|${accountId}`,
        accountId,
        accountName: accountName.get(accountId) ?? '',
        payeeId: latest.payeeId,
        payeeName: latest.payeeName ?? 'Unknown payee',
        ...why,
        count: list.length,
        lastDate: latest.date,
        amount: latest.amount,
        minAmount: Math.min(...amounts),
        maxAmount: Math.max(...amounts),
        categoryId: commonCategory(list),
      });
    }
  }

  return {
    found: found.sort((a, b) => a.payeeName.localeCompare(b.payeeName)),
    nearMisses: nearMisses.sort((a, b) => a.payeeName.localeCompare(b.payeeName)).slice(0, 30),
  };
}

export const findSchedules = (): DiscoveredSchedule[] => discoverSchedules().found;

/**
 * Create schedules from discovered items and link their existing transactions,
 * like Actual's DiscoverSchedules onCreate. Past occurrences with no matching
 * transaction are marked skipped so history doesn't show as "missed".
 */
export function createDiscoveredSchedules(items: DiscoveredSchedule[]): string[] {
  const now = new Date().toISOString();
  const today = fmt(new Date());
  const horizon = fmt(addDays(new Date(), 90));
  const created: string[] = [];
  const claimed = matchedTxIds();

  for (const item of items) {
    const id = nanoid();
    db.insert(schedules)
      .values({
        id,
        name: item.payeeName,
        amount: item.amount,
        amountType: item.amountType,
        recurrenceType: item.recurrenceType,
        recurrenceRule: JSON.stringify(item.recurrenceRule),
        startDate: item.startDate,
        endDate: null,
        weekendAdjust: 'none',
        dateFlexibility: item.exactDate ? 1 : 3,
        accountId: item.accountId,
        transferAccountId: null,
        categoryId: item.categoryId,
        payeeId: item.payeeId,
        notes: null,
        status: 'active',
        autoCreate: 0,
        autoCreateFrom: null,
        source: 'detected',
        occurrenceHorizon: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    ensureOccurrences(id, horizon);

    // Link each discovered transaction to the nearest unmatched occurrence
    const occs = db
      .select()
      .from(scheduleOccurrences)
      .where(eq(scheduleOccurrences.scheduleId, id))
      .all();
    const txs = item.transactionIds.length
      ? db
          .select({ id: transactions.id, date: transactions.date })
          .from(transactions)
          .where(
            and(inArray(transactions.id, item.transactionIds), isNull(transactions.scheduleId)),
          )
          .all()
          .filter((t) => !claimed.has(t.id))
      : [];
    const usedOcc = new Set<string>();
    for (const tx of txs) {
      let bestOcc: (typeof occs)[number] | null = null;
      for (const o of occs) {
        if (usedOcc.has(o.id) || o.status !== 'pending') continue;
        if (dayDiff(o.expectedDate, tx.date) > DATE_WINDOW + 1) continue;
        if (!bestOcc || dayDiff(o.expectedDate, tx.date) < dayDiff(bestOcc.expectedDate, tx.date))
          bestOcc = o;
      }
      if (bestOcc) {
        usedOcc.add(bestOcc.id);
        linkOccurrenceToTransaction(bestOcc.id, tx.id, 'automatic', 100);
        claimed.add(tx.id);
      }
    }

    // Past occurrences outside the flexibility window with no transaction → skipped
    const cutoff = fmt(subDays(parseISO(today), 3));
    for (const o of occs) {
      if (usedOcc.has(o.id) || o.status !== 'pending' || o.expectedDate >= cutoff) continue;
      db.update(scheduleOccurrences)
        .set({ status: 'skipped', skippedAt: today })
        .where(eq(scheduleOccurrences.id, o.id))
        .run();
    }
    created.push(id);
  }
  return created;
}
