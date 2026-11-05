import { db } from '../db/index.js';
import { accounts, payees, transactions, householdEvents, upDeletedImports } from '../db/schema.js';
import { and, desc, eq, inArray, like, not } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { unlinkOccurrenceByTransactionId } from './matchingEngine.js';
import { refreshMainAmounts } from './mainAmountService.js';

export function resolvePayee(
  payeeName: string | null | undefined,
  payeeId: string | null | undefined,
) {
  let id = payeeId ?? null;
  let name = payeeName ?? null;
  if (!id && payeeName) {
    const existing = db.select().from(payees).where(eq(payees.name, payeeName)).get();
    if (existing) {
      id = existing.id;
    } else {
      id = nanoid();
      db.insert(payees)
        .values({
          id,
          name: payeeName,
          defaultCategoryId: null,
          createdAt: new Date().toISOString(),
        })
        .run();
    }
    name = payeeName;
  }
  return { payeeId: id, payeeName: name };
}

/**
 * The fields that make one side of a transfer an ordinary transaction again: named after the
 * bank's text when there is one (and that payee, if it exists: never creates one), otherwise
 * it keeps its name. Used by "Not a transfer", deleting the other side, and bank syncs.
 * A payee a rule gave it before it became a transfer isn't brought back (linking cleared it).
 */
export function restoreBankPayee(row: {
  payeeId: string | null;
  payeeName: string | null;
  importedPayee: string | null;
}) {
  const name = row.importedPayee;
  if (!name) {
    return { transferTransactionId: null, payeeId: row.payeeId, payeeName: row.payeeName };
  }
  const payee = db.select({ id: payees.id }).from(payees).where(eq(payees.name, name)).get();
  return { transferTransactionId: null, payeeId: payee?.id ?? null, payeeName: name };
}

/**
 * Deletes a transaction with everything that hangs off it: a split's parts, the link
 * from a transfer's other side (back to the bank's payee), and a schedule occurrence it paid (back to pending).
 */
export function deleteTransactionRow(row: { id: string; transferTransactionId: string | null }) {
  db.transaction((tx) => {
    const ids = [
      row.id,
      ...tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.parentTransactionId, row.id))
        .all()
        .map((c) => c.id),
    ];
    // Bank removals must not stall a sync or erase agreed household obligations.
    tx.update(householdEvents)
      .set({
        transactionId: null,
        reviewReason: 'Linked bank payment was removed; review this household entry',
      })
      .where(inArray(householdEvents.transactionId, ids))
      .run();
    for (const id of ids) unlinkOccurrenceByTransactionId(id);
    const other = row.transferTransactionId
      ? tx.select().from(transactions).where(eq(transactions.id, row.transferTransactionId)).get()
      : undefined;
    if (other) {
      tx.update(transactions)
        .set(restoreBankPayee(other))
        .where(eq(transactions.id, other.id))
        .run();
    }
    tx.delete(transactions).where(eq(transactions.parentTransactionId, row.id)).run();
    tx.delete(transactions).where(eq(transactions.id, row.id)).run();
    // The other side is an ordinary transaction again, worth its own amount
    if (other) refreshMainAmounts([other.id]);
  });
}

/** An Up import: the sync would bring it back after a delete unless it is remembered */
export const isUpImport = (importedId: string | null | undefined): importedId is string =>
  !!importedId && importedId.startsWith('up:');

/** Import ids of the bank feeds that sync on their own: Up, Enable Banking, SimpleFIN, Plaid */
const SYNCED_PREFIXES = ['up:', 'eb:', 'simplefin:', 'plaid:'];

/**
 * A row a bank sync brought in, which the next sync would bring back after a delete unless it
 * is remembered (audit F-14). File imports aren't: importing a file again is a deliberate act.
 */
export const isSyncedImport = (importedId: string | null | undefined): importedId is string =>
  !!importedId && SYNCED_PREFIXES.some((p) => importedId.startsWith(p));

/** The synced imports the owner deleted from this account, which its syncs must skip */
export function deletedImportIds(accountId: string) {
  return new Set(
    db
      .select({ importedId: upDeletedImports.importedId })
      .from(upDeletedImports)
      .where(eq(upDeletedImports.accountId, accountId))
      .all()
      .map((d) => d.importedId),
  );
}

/** Deleted synced imports other than Up's (Up review lists those), newest first */
export function deletedSyncedImports() {
  return db
    .select({
      accountId: upDeletedImports.accountId,
      accountName: accounts.name,
      importedId: upDeletedImports.importedId,
      deletedAt: upDeletedImports.deletedAt,
      date: upDeletedImports.date,
      amount: upDeletedImports.amount,
      description: upDeletedImports.description,
    })
    .from(upDeletedImports)
    .innerJoin(accounts, eq(accounts.id, upDeletedImports.accountId))
    .where(not(like(upDeletedImports.importedId, 'up:%')))
    .orderBy(desc(upDeletedImports.deletedAt))
    .limit(200)
    .all();
}

/** Forgets a deleted synced import (not Up's), so the next sync brings it back */
export function restoreDeletedImport(accountId: string, importedId: string) {
  if (isUpImport(importedId)) return false;
  return (
    db
      .delete(upDeletedImports)
      .where(
        and(eq(upDeletedImports.accountId, accountId), eq(upDeletedImports.importedId, importedId)),
      )
      .run().changes > 0
  );
}

/**
 * Deletes a transaction because its owner asked to (the register's Delete and bulk delete).
 * A synced bank import is remembered (`up_deleted_imports`, despite its name for every synced
 * provider since F-14), so the next sync doesn't import it again; Up review lists Up's to
 * restore, `GET /transactions/deleted-imports` the others. Syncs and other internal clean-ups
 * use deleteTransactionRow.
 */
export function deleteTransactionByOwner(row: {
  id: string;
  accountId: string;
  importedId: string | null;
  transferTransactionId: string | null;
  date?: string;
  amount?: number;
  payeeName?: string | null;
}) {
  db.transaction((tx) => {
    if (isSyncedImport(row.importedId))
      tx.insert(upDeletedImports)
        .values({
          accountId: row.accountId,
          importedId: row.importedId,
          deletedAt: new Date().toISOString(),
          date: row.date ?? null,
          amount: row.amount ?? null,
          description: row.payeeName ?? null,
        })
        .onConflictDoNothing()
        .run();
    deleteTransactionRow(row);
  });
}
