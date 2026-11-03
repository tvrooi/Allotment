import { and, eq, gte, isNull, like, lt, notLike, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, transactions, upAccountMappings } from '../db/schema.js';
import { insertNewTransaction } from './ruleService.js';
import { inAccountBalance } from './balances.js';

// Linking Up to an account that already has history. Up rows before the cut-over are never
// imported; rows near it, or that look like a row already there, are imported and flagged for
// the owner. Nothing here merges, deletes or edits an existing row.

const DAY = 86_400_000;
/** Up rows this close to the cut-over (or closer to an old row than MATCH_DAYS) are compared. */
export const CUTOVER_WINDOW_DAYS = 3;
export const MATCH_DAYS = 2;

export const isValidDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;

const dayNumber = (day: string) => Math.round(Date.parse(day + 'T00:00:00Z') / DAY);

/**
 * For each new Up row, the older row it may duplicate: same amount, nearest date within
 * MATCH_DAYS (CUTOVER_WINDOW_DAYS for a row just after the cut-over, where a CSV most often
 * runs on). Each older row is offered to one Up row only. Rows already imported from Up are
 * never candidates. The result only flags; the caller imports every row regardless.
 */
export function findOverlaps(
  accountId: string,
  cutover: string,
  incoming: { importedId: string; date: string; amount: number }[],
): Map<string, string> {
  const older = db
    .select({ id: transactions.id, date: transactions.date, amount: transactions.amount })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        inAccountBalance,
        or(isNull(transactions.importedId), notLike(transactions.importedId, 'up:%')),
      ),
    )
    .all();
  const taken = new Set<string>();
  const found = new Map<string, string>();
  const sorted = [...incoming].sort(
    (a, b) => a.date.localeCompare(b.date) || a.importedId.localeCompare(b.importedId),
  );
  for (const row of sorted) {
    const reach =
      dayNumber(row.date) - dayNumber(cutover) <= CUTOVER_WINDOW_DAYS
        ? CUTOVER_WINDOW_DAYS
        : MATCH_DAYS;
    let best: { id: string; gap: number } | null = null;
    for (const old of older) {
      if (taken.has(old.id) || old.amount !== row.amount) continue;
      const gap = Math.abs(dayNumber(old.date) - dayNumber(row.date));
      if (gap <= reach && (!best || gap < best.gap)) best = { id: old.id, gap };
    }
    if (best) {
      taken.add(best.id);
      found.set(row.importedId, best.id);
    }
  }
  return found;
}

/** The register's balance on the last day before the cut-over (starting balance + older rows). */
export function registerBalanceBefore(
  accountId: string,
  startingBalance: number,
  cutover: string,
): number {
  const row = db
    .select({ sum: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(eq(transactions.accountId, accountId), inAccountBalance, lt(transactions.date, cutover)),
    )
    .get();
  return startingBalance + (row?.sum ?? 0);
}

/**
 * Recomputes the stored cut-over difference from the register as it is now (Up's balance at the
 * last sync, less what Up's rows from the cut-over on add, less the older history): deleting an
 * older row changes it between syncs.
 */
export function refreshCutoverDifference(accountId: string): number | null {
  const mapping = db
    .select()
    .from(upAccountMappings)
    .where(and(eq(upAccountMappings.accountId, accountId), eq(upAccountMappings.isEnabled, 1)))
    .get();
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!mapping?.cutoverDate || mapping.settledBalance === null || !account) return null;
  const up = db
    .select({ sum: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        inAccountBalance,
        like(transactions.importedId, 'up:%'),
        notLike(transactions.importedId, '%:roundup'),
        gte(transactions.date, mapping.cutoverDate),
      ),
    )
    .get()!.sum;
  const difference =
    mapping.settledBalance -
    up -
    registerBalanceBefore(accountId, account.startingBalance, mapping.cutoverDate);
  db.update(upAccountMappings)
    .set({ cutoverDifference: difference })
    .where(eq(upAccountMappings.id, mapping.id))
    .run();
  return difference;
}

export class CutoverError extends Error {}

/** The day before a cut-over: where the history ends and the opening balance belongs */
export const dayBefore = (cutover: string) =>
  new Date(Date.parse(cutover + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);

/**
 * Owner-confirmed: settle the difference between the register and Up's balance on the day
 * before the cut-over with one balance adjustment dated that day. It is a correction, not
 * income (no category, left out of income and spending reports), so it lands in the past and
 * today's net worth change stays honest. `expected` is the amount the owner saw.
 */
export function addCutoverOpeningBalance(accountId: string, expected: number) {
  return db.transaction(() => {
    refreshCutoverDifference(accountId);
    const mapping = db
      .select()
      .from(upAccountMappings)
      .where(and(eq(upAccountMappings.accountId, accountId), eq(upAccountMappings.isEnabled, 1)))
      .get();
    if (!mapping?.cutoverDate)
      throw new CutoverError('This account was not linked to Up from a cut-over date.');
    if (!mapping.cutoverDifference)
      throw new CutoverError('Nothing to settle: the history already matches Up.');
    if (mapping.cutoverDifference !== expected)
      throw new CutoverError('The difference changed. Refresh and check the amount again.');
    const date = dayBefore(mapping.cutoverDate);
    insertNewTransaction({
      accountId,
      date,
      amount: mapping.cutoverDifference,
      payeeId: null,
      payeeName: 'Opening balance',
      importedPayee: null,
      notes: `Balance Up reported on ${date}, added when linking from a cut-over date`,
      categoryId: null,
      importedId: null,
      isAdjustment: true,
    });
    db.update(upAccountMappings)
      .set({ cutoverDifference: 0 })
      .where(eq(upAccountMappings.id, mapping.id))
      .run();
    return { date, amount: mapping.cutoverDifference };
  });
}
