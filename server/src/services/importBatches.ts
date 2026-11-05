// What each file import added, and taking one back out (SEC-01).
//
// A confirmed import writes one `import_batches` row and stamps the transactions it adds with its
// id. That gives the person a history (which file, when, how many rows are still there) and an
// "undo this file" that removes exactly those rows, so a wrong statement or a wrong account is
// not an hour of selecting rows by hand.
//
// Undo does not delete what the person has since worked on. A row stays, and is reported with the
// reason, when it is reconciled, marked reviewed, linked as a transfer, split by hand, shared with
// a household or has a file attached. A row a rule categorised is not "worked on": rules ran at
// import, and importing the file again would categorise it the same way. The rows removed are
// returned in the shape the import takes, so the client's Undo can put them back through the same
// confirm route.
import { and, count, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accounts,
  documentLinks,
  householdEvents,
  importBatches,
  transactions,
} from '../db/schema.js';
import { deleteTransactionByOwner } from './transactionHelpers.js';

export interface ImportBatchSummary {
  id: string;
  accountId: string;
  accountName: string;
  fileName: string | null;
  createdAt: string;
  /** Rows the import added */
  rowCount: number;
  /** How many of them are still in the account */
  remaining: number;
}

/** Starts a batch for the rows about to be inserted; `finishImportBatch` settles it */
export function createImportBatch(accountId: string, fileName: string | null): string {
  const id = nanoid();
  db.insert(importBatches)
    .values({ id, accountId, fileName, rowCount: 0, createdAt: new Date().toISOString() })
    .run();
  return id;
}

/** Records how many rows the import added; a batch that added nothing is dropped */
export function finishImportBatch(id: string, rowCount: number, adjustedThrough: string | null) {
  if (rowCount === 0) {
    db.delete(importBatches).where(eq(importBatches.id, id)).run();
    return;
  }
  db.update(importBatches).set({ rowCount, adjustedThrough }).where(eq(importBatches.id, id)).run();
}

/** Imports that still have rows in their account, newest first */
export function listImportBatches(accountId?: string, limit = 100): ImportBatchSummary[] {
  const remaining = db
    .select({ batchId: transactions.importBatchId, n: count().as('n') })
    .from(transactions)
    // A rule's split parts carry the batch too; only the file's own rows count
    .where(
      and(isNotNull(transactions.importBatchId), sql`${transactions.parentTransactionId} IS NULL`),
    )
    .groupBy(transactions.importBatchId)
    .as('remaining');
  return db
    .select({
      id: importBatches.id,
      accountId: importBatches.accountId,
      accountName: accounts.name,
      fileName: importBatches.fileName,
      createdAt: importBatches.createdAt,
      rowCount: importBatches.rowCount,
      remaining: sql<number>`coalesce(${remaining.n}, 0)`,
    })
    .from(importBatches)
    .innerJoin(accounts, eq(accounts.id, importBatches.accountId))
    .leftJoin(remaining, eq(remaining.batchId, importBatches.id))
    .where(
      and(
        accountId ? eq(importBatches.accountId, accountId) : undefined,
        sql`coalesce(${remaining.n}, 0) > 0`,
      ),
    )
    .orderBy(desc(importBatches.createdAt))
    .limit(limit)
    .all();
}

export class ImportBatchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface KeptRow {
  id: string;
  date: string;
  amount: number;
  payeeName: string | null;
  reason: string;
}

/** A removed row in the shape `POST /transactions/import/confirm` takes */
export interface RemovedRow {
  importedId: string;
  date: string;
  amount: number;
  payeeName: string | null;
  notes: string | null;
  categoryId: string | null;
}

export interface UndoImportResult {
  removed: RemovedRow[];
  kept: KeptRow[];
  /** The starting balance moved back by what the import had moved it (see `adjustedThrough`) */
  balanceRestored: boolean;
}

/** Takes the rows of one file import back out, keeping anything the person has worked on */
export function undoImportBatch(id: string): UndoImportResult {
  const batch = db.select().from(importBatches).where(eq(importBatches.id, id)).get();
  if (!batch) throw new ImportBatchError('Import not found', 404);

  return db.transaction((): UndoImportResult => {
    // Children go with their parent; a split someone made by hand has children of its own
    const rows = db
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.importBatchId, id), sql`${transactions.parentTransactionId} IS NULL`),
      )
      .all();
    const rowIds = rows.map((r) => r.id);
    const linkedToHousehold = new Set(
      rowIds.length
        ? db
            .select({ id: householdEvents.transactionId })
            .from(householdEvents)
            .where(inArray(householdEvents.transactionId, rowIds))
            .all()
            .map((r) => r.id)
        : [],
    );
    const withFile = new Set(
      rowIds.length
        ? db
            .select({ id: documentLinks.transactionId })
            .from(documentLinks)
            .where(inArray(documentLinks.transactionId, rowIds))
            .all()
            .map((r) => r.id)
        : [],
    );
    const splitByHand = new Set(
      rowIds.length
        ? db
            .select({ id: transactions.parentTransactionId })
            .from(transactions)
            .where(
              and(
                inArray(transactions.parentTransactionId, rowIds),
                // Parts a rule made at import carry the batch; a person's own split does not
                sql`${transactions.importBatchId} IS NOT ${id}`,
              ),
            )
            .all()
            .map((r) => r.id)
        : [],
    );

    const removed: RemovedRow[] = [];
    const kept: KeptRow[] = [];
    let restore = 0;
    for (const row of rows) {
      const reason =
        row.reconciled === 1
          ? 'It is reconciled'
          : row.reviewedAt
            ? 'You marked it reviewed'
            : row.transferTransactionId
              ? 'It is linked as a transfer'
              : splitByHand.has(row.id)
                ? 'You split it'
                : linkedToHousehold.has(row.id)
                  ? 'It is shared with a household'
                  : withFile.has(row.id)
                    ? 'It has a file attached'
                    : null;
      if (reason) {
        kept.push({
          id: row.id,
          date: row.date,
          amount: row.amount,
          payeeName: row.payeeName,
          reason,
        });
        continue;
      }
      if (row.importedId)
        removed.push({
          importedId: row.importedId,
          date: row.date,
          amount: row.amount,
          payeeName: row.importedPayee ?? row.payeeName,
          notes: row.notes,
          categoryId: row.categoryId,
        });
      if (batch.adjustedThrough && row.date <= batch.adjustedThrough) restore += row.amount;
      deleteTransactionByOwner(row);
    }

    let balanceRestored = false;
    if (restore !== 0) {
      db.update(accounts)
        .set({ startingBalance: sql`${accounts.startingBalance} + ${restore}` })
        .where(eq(accounts.id, batch.accountId))
        .run();
      balanceRestored = true;
    }
    // A batch with nothing left is only history of a file that is gone
    if (!kept.length) db.delete(importBatches).where(eq(importBatches.id, id)).run();
    return { removed, kept, balanceRestored };
  });
}
