import { and, eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../db/index.js';
import { accounts, transactions, upAccountMappings, upConnections } from '../db/schema.js';
import { buildRuleContext, insertNewTransaction, loadRules } from './ruleService.js';
import { accountCurrency, currencyContext } from './mainAmountService.js';
import { accountTransactionSum } from './balances.js';
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
export const isUpSyncing = () => inFlight !== null;

/** Sharing the promise prevents startup and two Sync clicks from importing twice. */
export function syncUp(): Promise<UpSyncResult> {
  if (inFlight) return inFlight;
  inFlight = runSync().finally(() => {
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
        db.transaction(() => {
          let added = 0;
          let skipped = 0;
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
          }
          const startingBalance = target - accountTransactionSum(accountId);
          if (!Number.isSafeInteger(startingBalance))
            throw new UpError('Up returned amounts outside the supported range.');
          db.update(accounts).set({ startingBalance }).where(eq(accounts.id, accountId)).run();
          result.added += added;
          result.skipped += skipped;
        });
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
  return result;
}
