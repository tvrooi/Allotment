import { and, eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../db/index.js';
import { accounts, transactions, upAccountMappings, upConnections } from '../db/schema.js';
import { buildRuleContext, insertNewTransaction, loadRules } from './ruleService.js';
import { accountCurrency, currencyContext } from './mainAmountService.js';
import { accountTransactionSum } from './balances.js';
import { observeUpAccount } from './upReviewService.js';
import {
  getUpAccounts,
  getUpTransactions,
  upErrorMessage,
  upImportRows,
  upSettledBalance,
  UpError,
} from './upService.js';

export const UP_CONNECTION_ID = 'default';
export interface UpSyncResult {
  added: number;
  skipped: number;
  errors: string[];
}
let inFlight: Promise<UpSyncResult> | null = null;
let connecting = false;
export const setUpConnecting = (value: boolean) => {
  connecting = value;
};
export const isUpSyncing = () => inFlight !== null;

/** Sharing the promise prevents startup and two Sync clicks from importing twice. */
export function syncUp(): Promise<UpSyncResult> {
  if (inFlight) return inFlight;
  if (connecting)
    return Promise.resolve({
      added: 0,
      skipped: 0,
      errors: ['Wait for the Up connection to finish.'],
    });
  inFlight = runSync()
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

async function runSync(): Promise<UpSyncResult> {
  const result: UpSyncResult = { added: 0, skipped: 0, errors: [] };
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
        // Fetch and validate the WHOLE account before any writes or balance changes.
        const history = await getUpTransactions(connection.accessToken, mapping.upAccountId);
        const unique = [...new Map(history.map((t) => [t.id, t])).values()];
        const rows = unique.flatMap((t) => upImportRows(t, mapping.upAccountId));
        const target = upSettledBalance(bank, unique);
        const ruleOpts = { rules: loadRules(), ctx: buildRuleContext(), currencies: ctx };
        const hadHistory = !!db
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.accountId, accountId))
          .get();
        let balanceMismatch = false;
        db.transaction(() => {
          let added = 0;
          let skipped = 0;
          const newIds = new Set<string>();
          for (const row of rows) {
            const existing = db
              .select({ id: transactions.id })
              .from(transactions)
              .where(
                and(
                  eq(transactions.accountId, accountId),
                  eq(transactions.importedId, row.importedId),
                ),
              )
              .get();
            // Preserve user edits, splits, links and reconciled rows on later syncs.
            if (existing) {
              skipped++;
              continue;
            }
            insertNewTransaction(
              {
                ...row,
                id: createHash('sha256')
                  .update(`${accountId}:${row.importedId}`)
                  .digest('base64url'),
                accountId,
                payeeId: null,
                importedPayee: row.payeeName,
                categoryId: null,
              },
              ruleOpts,
            );
            added++;
            newIds.add(row.importedId);
          }
          const startingBalance = target - accountTransactionSum(accountId);
          if (!Number.isSafeInteger(startingBalance))
            throw new UpError('Up returned amounts outside the supported range.');
          // Establish an opening balance only for an empty register. Later discrepancies
          // need review, not an invisible historical adjustment that hides missing postings.
          if (!hadHistory && !mapping.initializedAt) {
            db.update(accounts).set({ startingBalance }).where(eq(accounts.id, accountId)).run();
          } else {
            balanceMismatch = startingBalance !== local.startingBalance;
          }
          observeUpAccount(accountId, unique, now, newIds, mapping.upAccountId);
          if (!mapping.initializedAt)
            db.update(upAccountMappings)
              .set({ initializedAt: now })
              .where(eq(upAccountMappings.id, mapping.id))
              .run();
          result.added += added;
          result.skipped += skipped;
        });
        if (balanceMismatch)
          result.errors.push(
            'An Up account balance differs from its imported register. Review transactions and reconcile; the opening balance was preserved.',
          );
      } catch (err) {
        result.errors.push(upErrorMessage(err));
      }
    }
    setStatus(result.errors.length ? 'error' : 'good', result.errors.join(' ') || null);
    if (!result.errors.length)
      db.update(upConnections)
        .set({ lastSyncedAt: new Date().toISOString() })
        .where(eq(upConnections.id, UP_CONNECTION_ID))
        .run();
  } catch (err) {
    result.errors.push(upErrorMessage(err));
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
