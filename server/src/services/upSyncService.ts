import { and, eq, like, max } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  transactions,
  upAccountMappings,
  upConnections,
  upDeletedImports,
  upSourceRecords,
} from '../db/schema.js';
import { upCategoryResolver } from './upCategoryMap.js';
import { buildRuleContext, insertNewTransaction, loadRules } from './ruleService.js';
import { accountCurrency, currencyContext } from './mainAmountService.js';
import { accountTransactionSum } from './balances.js';
import { findOverlaps, registerBalanceBefore } from './upCutover.js';
import {
  bankObservation,
  observeUpAccount,
  roundUpDebit,
  upTransactionId,
} from './upReviewService.js';
import {
  getUpAccounts,
  getUpTransactions,
  upErrorMessage,
  upImportRows,
  upSettledBalance,
  UpError,
} from './upService.js';

export const UP_CONNECTION_ID = 'default';

// Incremental sync (audit F-10). Between full sweeps a sync asks Up only for rows created in the
// last WINDOW_DAYS before the newest imported one, and for every open hold. A hold settles under
// its original creation date, so the window also reaches back to the oldest hold still open. A
// full sweep runs on an account's first sync, after FULL_SWEEP_MS, and on request.
export const WINDOW_DAYS = 14;
export const FULL_SWEEP_MS = 7 * 86_400_000;

const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** The first day an incremental sync covers for this account; null when it needs a full sweep */
export function incrementalStart(accountId: string, upAccountId: string): string | null {
  const newest = db
    .select({ day: max(transactions.date) })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        like(transactions.importedId, `up:${upAccountId}:%`),
      ),
    )
    .get()?.day;
  if (!newest) return null;
  let start = addDays(newest, -WINDOW_DAYS);
  for (const record of db
    .select({ sourceJson: upSourceRecords.sourceJson })
    .from(upSourceRecords)
    .where(and(eq(upSourceRecords.accountId, accountId), eq(upSourceRecords.seenInLatest, 1)))
    .all()) {
    try {
      const seen = JSON.parse(record.sourceJson) as { status?: string; createdAt?: string };
      const day = seen.createdAt?.slice(0, 10);
      if (seen.status === 'HELD' && day && day < start) start = day;
    } catch {
      return null;
    }
  }
  return start;
}
const dollars = (cents: number) =>
  `$${Math.floor(cents / 100).toLocaleString('en-AU')}.${String(cents % 100).padStart(2, '0')}`;
/** The day before a cut-over, as a person would say it */
const cutoverLabel = (cutover: string) =>
  new Date(Date.parse(cutover + 'T00:00:00Z') - 86_400_000).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
export interface UpSyncResult {
  added: number;
  skipped: number;
  /** Why the sync failed: the connection, an account or Up's data */
  errors: string[];
  /**
   * Things to review that didn't stop the import, as YNAB treats them: a register that differs
   * from Up's balance is reconciled by the owner, not a failed sync.
   */
  notices?: string[];
}
let inFlight: Promise<UpSyncResult> | null = null;
let connecting = false;
export const setUpConnecting = (value: boolean) => {
  connecting = value;
};
export const isUpSyncing = () => inFlight !== null;

/** Sharing the promise prevents startup and two Sync clicks from importing twice. */
/** `full`: sweep all of Up's history (restoring a deleted row, "Check all history") */
export function syncUp(options: { full?: boolean } = {}): Promise<UpSyncResult> {
  // A full sweep asked for while a quick sync runs follows it, rather than being skipped
  if (inFlight) return options.full ? inFlight.then(() => syncUp(options)) : inFlight;
  if (connecting)
    return Promise.resolve({
      added: 0,
      skipped: 0,
      errors: ['Wait for the Up connection to finish.'],
    });
  inFlight = runSync(!!options.full)
    .catch(() => {
      // A damaged encrypted token can fail before runSync reaches its request handler.
      // Persist backoff without selecting/decrypting that token again or exposing an error payload.
      const current = db
        .select({
          interval: upConnections.pollIntervalMinutes,
          failures: upConnections.failureCount,
        })
        .from(upConnections)
        .where(eq(upConnections.id, UP_CONNECTION_ID))
        .get();
      const errors = [
        'Could not read the Up connection. Check the saved connection and encryption key.',
      ];
      if (current) {
        const completedAt = new Date().toISOString(),
          failures = Math.min(current.failures + 1, 10);
        db.update(upConnections)
          .set({
            syncStatus: 'error',
            syncError: errors[0],
            lastAttemptAt: completedAt,
            lastCompletedAt: completedAt,
            failureCount: failures,
            nextSyncAt: nextUpSyncAt(current.interval, failures, Date.parse(completedAt)),
          })
          .where(eq(upConnections.id, UP_CONNECTION_ID))
          .run();
      }
      return { added: 0, skipped: 0, errors };
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function runSync(forceFull: boolean): Promise<UpSyncResult> {
  const result: UpSyncResult = { added: 0, skipped: 0, errors: [], notices: [] };
  const connection = db
    .select()
    .from(upConnections)
    .where(eq(upConnections.id, UP_CONNECTION_ID))
    .get();
  if (!connection) return result;
  const now = new Date().toISOString();
  db.update(upConnections)
    .set({ lastAttemptAt: now })
    .where(eq(upConnections.id, UP_CONNECTION_ID))
    .run();
  const setStatus = (syncStatus: string, syncError: string | null) =>
    db
      .update(upConnections)
      .set({ syncStatus, syncError })
      .where(eq(upConnections.id, UP_CONNECTION_ID))
      .run();
  setStatus('syncing', null);
  try {
    const bankAccounts = await getUpAccounts(connection.accessToken);
    const mappings = db.select().from(upAccountMappings).all();
    for (const mapping of mappings) {
      if (!mapping.accountId || !mapping.isEnabled) continue;
      const accountId = mapping.accountId;
      const local = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
      if (!local || local.closedAt) continue;
      try {
        const ctx = currencyContext();
        if (accountCurrency(accountId, ctx) !== 'AUD')
          throw new UpError('Up can only sync to an account using AUD.');
        const bank = bankAccounts.find((a) => a.id === mapping.upAccountId);
        if (!bank)
          throw new UpError(
            'An Up account is no longer available. Reconnect to refresh the account list.',
          );
        // Fetch and validate everything this sync covers before any writes or balance changes:
        // the whole account on a full sweep, else the recent window plus every open hold
        const coveredFrom =
          forceFull ||
          !mapping.initializedAt ||
          !mapping.fullSyncedAt ||
          Date.parse(now) - Date.parse(mapping.fullSyncedAt) > FULL_SWEEP_MS
            ? null
            : incrementalStart(accountId, mapping.upAccountId);
        const fullSweep = coveredFrom === null;
        const history = fullSweep
          ? await getUpTransactions(connection.accessToken, mapping.upAccountId)
          : [
              // A day early: Up's times carry +10:00 or +11:00, and a row's date is its own
              ...(await getUpTransactions(connection.accessToken, mapping.upAccountId, {
                since: `${addDays(coveredFrom, -1)}T00:00:00+10:00`,
              })),
              ...(await getUpTransactions(connection.accessToken, mapping.upAccountId, {
                status: 'HELD',
              })),
            ];
        const unique = [...new Map(history.map((t) => [t.id, t])).values()];
        const cutover = mapping.cutoverDate;
        // Linked to an account with history: Up's rows before the cut-over are never imported
        const allRows = unique.flatMap((t) => upImportRows(t, mapping.upAccountId));
        const rows = cutover ? allRows.filter((r) => r.date >= cutover) : allRows;
        const target = upSettledBalance(bank, unique);
        const upCategory = upCategoryResolver();
        const ruleOpts = { rules: loadRules(), ctx: buildRuleContext(), currencies: ctx };
        const hadHistory = !!db
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.accountId, accountId))
          .get();
        let balanceMismatch = false;
        let cutoverNotice: string | null = null;
        let deletedCount = 0;
        db.transaction(() => {
          let added = 0;
          let skipped = 0;
          const newIds = new Set<string>();
          // Deleted here by the owner: Up still returns it, but it stays deleted until restored
          const deletedHere = new Set(
            db
              .select({ importedId: upDeletedImports.importedId })
              .from(upDeletedImports)
              .where(eq(upDeletedImports.accountId, accountId))
              .all()
              .map((d) => d.importedId),
          );
          deletedCount = deletedHere.size;
          const alreadyHere = (importedId: string) =>
            deletedHere.has(importedId) ||
            !!db
              .select({ id: transactions.id })
              .from(transactions)
              .where(
                and(eq(transactions.accountId, accountId), eq(transactions.importedId, importedId)),
              )
              .get();
          // Looked at before anything is inserted, so only rows that were here already count
          const overlaps = cutover
            ? findOverlaps(
                accountId,
                cutover,
                rows.filter((r) => !alreadyHere(r.importedId)),
              )
            : new Map<string, string>();
          for (const { upCategory: slug, ...row } of rows) {
            // Preserve user edits, splits, links and reconciled rows on later syncs.
            if (alreadyHere(row.importedId)) {
              skipped++;
              continue;
            }
            insertNewTransaction(
              {
                ...row,
                id: upTransactionId(accountId, row.importedId),
                accountId,
                payeeId: null,
                importedPayee: row.payeeName,
                categoryId: null,
                // After rules and the payee's default; never for rows that already exist
                fallbackCategoryId: upCategory(slug),
              },
              ruleOpts,
            );
            added++;
            newIds.add(row.importedId);
          }
          // Only after the owner enabled it for a balance proven short by exactly these amounts.
          if (mapping.roundUpDebitsAt)
            for (const tx of unique) {
              const row = roundUpDebit(
                `up:${mapping.upAccountId}:${tx.id}`,
                bankObservation(tx),
                mapping.initializedAt,
              );
              if (
                !row ||
                (cutover && row.date < cutover) ||
                deletedHere.has(row.importedId) ||
                db
                  .select({ id: transactions.id })
                  .from(transactions)
                  .where(
                    and(
                      eq(transactions.accountId, accountId),
                      eq(transactions.importedId, row.importedId),
                    ),
                  )
                  .get()
              )
                continue;
              insertNewTransaction(
                {
                  ...row,
                  id: upTransactionId(accountId, row.importedId),
                  accountId,
                  payeeId: null,
                  importedPayee: row.payeeName,
                  categoryId: null,
                },
                ruleOpts,
              );
              added++;
            }
          const startingBalance = target - accountTransactionSum(accountId);
          if (!Number.isSafeInteger(startingBalance))
            throw new UpError('Up returned amounts outside the supported range.');
          // Establish an opening balance only for an empty register. Later discrepancies
          // need review, not an invisible historical adjustment that hides missing postings.
          let cutoverDifference: number | null = null;
          if (cutover && !fullSweep) {
            // The difference at the cut-over needs every row since it: the last full sweep's
            // stands until the next one
            if ((mapping.cutoverDifference ?? 0) === 0 && startingBalance !== local.startingBalance)
              balanceMismatch = true;
          } else if (cutover) {
            // Bank balance at the cut-over, from today's balance and Up's later rows, against the
            // register's. Shown, never adjusted: the owner reconciles or fixes the history.
            const after = rows.reduce((sum, r) => sum + r.amount, 0);
            cutoverDifference =
              target - after - registerBalanceBefore(accountId, local.startingBalance, cutover);
            if (!Number.isSafeInteger(cutoverDifference))
              throw new UpError('Up returned amounts outside the supported range.');
            if (cutoverDifference !== 0)
              cutoverNotice = `${local.name}'s history up to ${cutoverLabel(cutover)} is ${dollars(Math.abs(cutoverDifference))} ${cutoverDifference > 0 ? 'less' : 'more'} than Up's balance on that day. Nothing was adjusted: check the older transactions and reconcile.`;
            else if (startingBalance !== local.startingBalance) balanceMismatch = true;
          } else if (!hadHistory && !mapping.initializedAt) {
            db.update(accounts).set({ startingBalance }).where(eq(accounts.id, accountId)).run();
          } else {
            balanceMismatch = startingBalance !== local.startingBalance;
          }
          observeUpAccount(
            accountId,
            unique,
            now,
            newIds,
            mapping.upAccountId,
            overlaps,
            !mapping.initializedAt,
            coveredFrom,
          );
          db.update(upAccountMappings)
            .set({
              initializedAt: mapping.initializedAt ?? now,
              settledBalance: target,
              ...(cutover && fullSweep ? { cutoverDifference } : {}),
              ...(fullSweep ? { fullSyncedAt: now } : {}),
            })
            .where(eq(upAccountMappings.id, mapping.id))
            .run();
          result.added += added;
          result.skipped += skipped;
        });
        if (cutoverNotice) result.notices!.push(cutoverNotice);
        if (balanceMismatch)
          result.notices!.push(
            deletedCount
              ? `${local.name}'s register differs from Up's balance. ${deletedCount} transaction${deletedCount === 1 ? ' you deleted is' : 's you deleted are'} still at Up: restore ${deletedCount === 1 ? 'it' : 'them'} in Up review, or reconcile.`
              : `${local.name}'s register differs from Up's balance. Review transactions and reconcile; the opening balance was preserved.`,
          );
      } catch (err) {
        result.errors.push(syncErrorMessage(err, local.name));
      }
    }
    setStatus(result.errors.length ? 'error' : 'good', result.errors.join(' ') || null);
    if (!result.errors.length)
      db.update(upConnections)
        .set({ lastSyncedAt: new Date().toISOString() })
        .where(eq(upConnections.id, UP_CONNECTION_ID))
        .run();
  } catch (err) {
    result.errors.push(syncErrorMessage(err));
    setStatus('error', result.errors.join(' '));
  }
  const completedAt = new Date().toISOString();
  const failures = result.errors.length ? Math.min(connection.failureCount + 1, 10) : 0;
  db.update(upConnections)
    .set({
      lastCompletedAt: completedAt,
      failureCount: failures,
      nextSyncAt: nextUpSyncAt(connection.pollIntervalMinutes, failures, Date.parse(completedAt)),
    })
    .where(eq(upConnections.id, UP_CONNECTION_ID))
    .run();
  return result;
}

/**
 * What a failed sync tells the owner. Up's own failures (UpError) are already worded for them.
 * Anything else is a fault in Allotment, not the connection: say so, and log what it was
 * (the error's name and message only: never the request, which carries the token).
 */
export function syncErrorMessage(err: unknown, accountName?: string) {
  if (err instanceof UpError) return upErrorMessage(err);
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error('Up sync stopped by an error in Allotment:', JSON.stringify(detail.slice(0, 500)));
  return `${accountName ? `${accountName}: ` : ''}Allotment could not save Up's transactions because of an error in Allotment, not the connection. Nothing was imported${accountName ? ' for this account' : ''}. The app's log has the details.`;
}

export const UP_POLL_INTERVALS = [0, 15, 30, 60, 240] as const;
export function nextUpSyncAt(minutes: number, failures: number, now = Date.now()): string | null {
  if (!minutes) return null;
  const delay = Math.max(minutes, failures ? Math.min(24 * 60, 15 * 2 ** (failures - 1)) : 0);
  return new Date(now + delay * 60_000).toISOString();
}
export async function syncUpIfDue(now = Date.now()) {
  if (inFlight || connecting) return;
  const connection = db
    .select({ interval: upConnections.pollIntervalMinutes, next: upConnections.nextSyncAt })
    .from(upConnections)
    .where(eq(upConnections.id, UP_CONNECTION_ID))
    .get();
  if (connection?.interval && (!connection.next || Date.parse(connection.next) <= now))
    await syncUp();
}
export function startUpPolling() {
  const timer = setInterval(() => {
    void syncUpIfDue().catch(() => console.warn('Up background sync could not finish.'));
  }, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
