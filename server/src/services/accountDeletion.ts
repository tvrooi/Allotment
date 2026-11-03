import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  cardFunding,
  enableBankingAccountMappings,
  householdGroups,
  householdPoolAccounts,
  plaidAccountMappings,
  schedules,
  simplefinAccountMappings,
  transactions,
  upAccountMappings,
} from '../db/schema.js';
import { deleteTransactionRow } from './transactionHelpers.js';

export class AccountDeletionError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}

/** The bank feed (if any) that supplies this account's transactions */
function bankFeed(accountId: string) {
  const feeds: [string, { id: string } | undefined][] = [
    [
      'Up',
      db
        .select({ id: upAccountMappings.id })
        .from(upAccountMappings)
        .where(and(eq(upAccountMappings.accountId, accountId), eq(upAccountMappings.isEnabled, 1)))
        .get(),
    ],
    [
      'Enable Banking',
      db
        .select({ id: enableBankingAccountMappings.id })
        .from(enableBankingAccountMappings)
        .where(
          and(
            eq(enableBankingAccountMappings.accountId, accountId),
            eq(enableBankingAccountMappings.isEnabled, 1),
          ),
        )
        .get(),
    ],
    [
      'SimpleFIN',
      db
        .select({ id: simplefinAccountMappings.id })
        .from(simplefinAccountMappings)
        .where(
          and(
            eq(simplefinAccountMappings.accountId, accountId),
            eq(simplefinAccountMappings.isEnabled, 1),
          ),
        )
        .get(),
    ],
    [
      'Plaid',
      db
        .select({ id: plaidAccountMappings.id })
        .from(plaidAccountMappings)
        .where(
          and(eq(plaidAccountMappings.accountId, accountId), eq(plaidAccountMappings.isEnabled, 1)),
        )
        .get(),
    ],
  ];
  return feeds.find(([, mapping]) => mapping)?.[0] ?? null;
}

/** Everything that stops this account being deleted, in words the person can act on */
function blockers(accountId: string, name: string) {
  const reasons: string[] = [];
  const feed = bankFeed(accountId);
  if (feed)
    reasons.push(
      `${name} is linked to ${feed}. Unlink it first: Settings → Connections → ${feed}, then disconnect ${feed} (its transactions stay) and try again.`,
    );
  if (
    db.select().from(householdGroups).where(eq(householdGroups.accountId, accountId)).get() ||
    db
      .select()
      .from(householdPoolAccounts)
      .where(eq(householdPoolAccounts.accountId, accountId))
      .get()
  )
    reasons.push(`${name} holds a household pool. Remove it from the household first.`);
  if (db.select().from(cardFunding).where(eq(cardFunding.accountId, accountId)).get())
    reasons.push(`${name} has card payment funding. Turn that off first.`);
  const recurring = db
    .select({ name: schedules.name })
    .from(schedules)
    .where(or(eq(schedules.accountId, accountId), eq(schedules.transferAccountId, accountId)))
    .all();
  if (recurring.length)
    reasons.push(
      `Recurring items use ${name}: ${recurring
        .slice(0, 3)
        .map((r) => r.name)
        .join(
          ', ',
        )}${recurring.length > 3 ? ` and ${recurring.length - 3} more` : ''}. Move or delete them first.`,
    );
  return reasons;
}

/** Transfers from this account whose other side is reconciled in another account */
function lockedPartners(accountId: string) {
  const own = db
    .select({ partner: transactions.transferTransactionId })
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .all()
    .map((t) => t.partner)
    .filter((id): id is string => !!id);
  return own.length
    ? db
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(inArray(transactions.id, own), eq(transactions.reconciled, 1)))
        .all().length
    : 0;
}

/** What deleting the account would remove, and what stands in the way */
export function previewAccountDeletion(accountId: string) {
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!account) throw new AccountDeletionError('Account not found', 404);
  const rows = db
    .select({ id: transactions.id, reconciled: transactions.reconciled })
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .all();
  const reasons = blockers(accountId, account.name);
  const partners = lockedPartners(accountId);
  if (partners)
    reasons.push(
      `${partners} transfer${partners === 1 ? '' : 's'} from ${account.name} ${partners === 1 ? 'has its other side' : 'have their other sides'} reconciled in another account. Unlock ${partners === 1 ? 'it' : 'them'} first.`,
    );
  return {
    name: account.name,
    transactions: rows.length,
    reconciled: rows.filter((r) => r.reconciled === 1).length,
    blockers: reasons,
  };
}

/**
 * Permanently deletes an account and every transaction in it, after the person types its exact
 * name. Refused while a bank feed supplies it, and when something else depends on it. A transfer's
 * other side in another account stays as an ordinary transaction. There is no undo.
 */
export function deleteAccountWithTransactions(accountId: string, confirmName: string) {
  return db.transaction(() => {
    const preview = previewAccountDeletion(accountId);
    if (preview.blockers.length) throw new AccountDeletionError(preview.blockers.join(' '));
    if (confirmName !== preview.name)
      throw new AccountDeletionError('Type the account name exactly to delete it', 400);
    const rows = db.select().from(transactions).where(eq(transactions.accountId, accountId)).all();
    // Parts go with their parent; delete parents and single rows first
    for (const row of rows.filter((r) => !r.parentTransactionId)) deleteTransactionRow(row);
    // Anything left (orphaned parts) goes too
    db.delete(transactions).where(eq(transactions.accountId, accountId)).run();
    db.delete(accounts).where(eq(accounts.id, accountId)).run();
    return { deleted: preview.transactions, name: preview.name };
  });
}
