import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accountReconciliations,
  accounts,
  transactionTags,
  transactions,
  upAccountMappings,
} from '../db/schema.js';
import { deleteTransactionRow } from './transactionHelpers.js';
import { accountTransactionSum, inAccountBalance } from './balances.js';
import { bankLinked } from './accountIntegrity.js';
import { fundingRevision } from './budgetLedger.js';
import { todayIso, budgetCurrency } from './mainAmountService.js';
import { insertNewTransaction } from './ruleService.js';

export class ReconciliationError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export interface ReconciliationRequest {
  transactionIds: string[];
  statementBalance: number;
  expectedBalance: number;
  revision: string;
  createAdjustment: boolean;
}

/** One consistent snapshot, including every current row (no register pagination cap). */
export function reconciliationSnapshot(accountId: string) {
  return db.transaction(() => {
    const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    if (!account) throw new ReconciliationError('Account not found', 404);
    const rows = db
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), inAccountBalance))
      .all();
    const eligible = rows.filter((t) => t.date <= todayIso());
    return {
      account: {
        ...account,
        currency: account.currency ?? budgetCurrency(),
        balance: account.startingBalance + rows.reduce((sum, t) => sum + t.amount, 0),
      },
      transactions: eligible.filter((t) => !t.reconciled),
      reconciledBase:
        account.startingBalance +
        eligible.filter((t) => t.reconciled).reduce((sum, t) => sum + t.amount, 0),
      revision: fundingRevision(),
      date: todayIso(),
    };
  });
}

/** Compare and write in the same transaction. A partial selection may confirm matching
 * statement entries, but must never manufacture an adjustment for the unchecked entries. */
export function reconcile(accountId: string, request: ReconciliationRequest) {
  return db.transaction(() => {
    const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    if (!account) throw new ReconciliationError('Account not found', 404);
    const registerBalance = account.startingBalance + accountTransactionSum(accountId);
    if (request.revision !== fundingRevision() || request.expectedBalance !== registerBalance)
      throw new ReconciliationError('Your account changed. Reload reconciliation before saving.');
    const rows = db
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), inAccountBalance))
      .all();
    const eligible = rows.filter((t) => t.date <= todayIso());
    const pending = eligible.filter((t) => !t.reconciled);
    const ids = new Set(request.transactionIds);
    if (
      ids.size !== request.transactionIds.length ||
      pending.filter((t) => ids.has(t.id)).length !== ids.size
    )
      throw new ReconciliationError(
        'Choose current unreconciled transactions from this account.',
        400,
      );
    const selectedBalance =
      account.startingBalance +
      eligible.filter((t) => t.reconciled || ids.has(t.id)).reduce((sum, t) => sum + t.amount, 0);
    const amount = request.statementBalance - selectedBalance;
    if (account.closedAt && request.statementBalance !== 0)
      throw new ReconciliationError('A closed account must be reconciled to zero.');
    if (
      bankLinked(accountId) &&
      pending.some((t) => ids.has(t.id) && t.amount > 0 && t.importedId?.startsWith('schedule:'))
    )
      throw new ReconciliationError(
        'Review generated income against the imported bank receipt before reconciling this account.',
      );
    let adjustmentId: string | null = null;
    if (request.createAdjustment && amount !== 0) {
      if (ids.size !== pending.length)
        throw new ReconciliationError(
          'Check every current transaction before creating an adjustment. Unchecked transactions are not missing money.',
        );
      if (
        bankLinked(accountId) &&
        pending.some((t) => t.amount > 0 && t.importedId?.startsWith('schedule:'))
      )
        throw new ReconciliationError(
          'Review generated income against the imported bank receipt before adjusting this account.',
        );
      const bank = db
        .select()
        .from(upAccountMappings)
        .where(and(eq(upAccountMappings.accountId, accountId), eq(upAccountMappings.isEnabled, 1)))
        .get();
      if (
        bank &&
        !account.closedAt &&
        (!bank.initializedAt ||
          bank.settledBalance === null ||
          bank.settledBalance !== request.statementBalance)
      )
        throw new ReconciliationError(
          'Sync Up and use its settled balance before creating an adjustment.',
        );
      const created = insertNewTransaction({
        accountId,
        date: todayIso(),
        amount,
        payeeId: null,
        payeeName: null,
        importedPayee: null,
        categoryId: null,
        importedId: null,
        notes: 'Reconciliation adjustment',
        isAdjustment: true,
      }).transaction;
      ids.add(created.id);
      adjustmentId = created.id;
    } else if (amount !== 0) {
      throw new ReconciliationError(
        'The selected balance must match the statement before finishing.',
      );
    }
    if (ids.size) {
      db.update(transactions)
        .set({ reconciled: 1 })
        .where(and(eq(transactions.accountId, accountId), inArray(transactions.id, [...ids])))
        .run();
      recordReconciliation(
        accountId,
        [...ids],
        request.statementBalance,
        request.createAdjustment && amount !== 0 ? adjustmentId : null,
        request.createAdjustment ? amount : 0,
      );
    }
    return { reconciled: ids.size, adjustment: request.createAdjustment ? amount : 0 };
  });
}

/** Remembers what a reconciliation locked, so it can be undone without touching anything else */
export function recordReconciliation(
  accountId: string,
  transactionIds: string[],
  statementBalance: number,
  adjustmentTransactionId: string | null = null,
  adjustmentAmount = 0,
) {
  db.insert(accountReconciliations)
    .values({
      id: nanoid(),
      accountId,
      transactionIds: JSON.stringify(transactionIds),
      adjustmentTransactionId,
      adjustmentAmount,
      statementBalance,
    })
    .run();
}

const ADJUSTMENT_NOTE = 'Reconciliation adjustment';

/** The account's most recent reconciliation that has not been undone, for the Undo button */
export function lastReconciliation(accountId: string) {
  const row = db
    .select()
    .from(accountReconciliations)
    .where(
      and(eq(accountReconciliations.accountId, accountId), isNull(accountReconciliations.undoneAt)),
    )
    .orderBy(desc(sql`rowid`))
    .get();
  if (!row) return null;
  const ids = JSON.parse(row.transactionIds) as string[];
  return {
    id: row.id,
    createdAt: row.createdAt,
    transactions: ids.length - (row.adjustmentTransactionId ? 1 : 0),
    adjustment: row.adjustmentTransactionId ? row.adjustmentAmount : 0,
  };
}

/**
 * Takes back the account's last reconciliation: unlocks the rows it locked that are still
 * locked in this account and deletes the adjustment it created, but only if that adjustment is
 * exactly as created (same amount, no category, notes or tags added, not linked or split).
 * An edited adjustment is kept and unlocked, and said so. It never touches rows locked by an
 * earlier reconciliation, rows the person unlocked or moved since, or any other account.
 */
export function undoLastReconciliation(accountId: string) {
  return db.transaction(() => {
    const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    if (!account) throw new ReconciliationError('Account not found', 404);
    const record = db
      .select()
      .from(accountReconciliations)
      .where(
        and(
          eq(accountReconciliations.accountId, accountId),
          isNull(accountReconciliations.undoneAt),
        ),
      )
      .orderBy(desc(sql`rowid`))
      .get();
    if (!record) throw new ReconciliationError('There is no reconciliation to undo.', 404);
    const ids = (JSON.parse(record.transactionIds) as string[]).filter(
      (id) => id !== record.adjustmentTransactionId,
    );
    const rows = ids.length
      ? db
          .select({ id: transactions.id })
          .from(transactions)
          .where(
            and(
              eq(transactions.accountId, accountId),
              eq(transactions.reconciled, 1),
              inArray(transactions.id, ids),
            ),
          )
          .all()
      : [];
    if (rows.length)
      db.update(transactions)
        .set({ reconciled: 0 })
        .where(
          inArray(
            transactions.id,
            rows.map((r) => r.id),
          ),
        )
        .run();
    let adjustment: 'removed' | 'kept' | 'none' = 'none';
    if (record.adjustmentTransactionId) {
      const adj = db
        .select()
        .from(transactions)
        .where(eq(transactions.id, record.adjustmentTransactionId))
        .get();
      if (adj && adj.accountId === accountId) {
        const tagged = db
          .select()
          .from(transactionTags)
          .where(eq(transactionTags.transactionId, adj.id))
          .get();
        const untouched =
          adj.amount === record.adjustmentAmount &&
          adj.isAdjustment === 1 &&
          adj.notes === ADJUSTMENT_NOTE &&
          !adj.categoryId &&
          !adj.payeeName &&
          !adj.transferTransactionId &&
          !adj.parentTransactionId &&
          !adj.isParent &&
          !tagged;
        if (untouched) {
          deleteTransactionRow(adj);
          adjustment = 'removed';
        } else {
          db.update(transactions).set({ reconciled: 0 }).where(eq(transactions.id, adj.id)).run();
          adjustment = 'kept';
        }
      }
    }
    db.update(accountReconciliations)
      .set({ undoneAt: new Date().toISOString() })
      .where(eq(accountReconciliations.id, record.id))
      .run();
    return {
      unlocked: rows.length,
      alreadyChanged: ids.length - rows.length,
      adjustment,
      adjustmentAmount: record.adjustmentAmount,
    };
  });
}

/** Unlocks one reconciled transaction. Its amount, date and account were locked; now they can change. */
export function unlockTransaction(id: string) {
  const row = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!row) throw new ReconciliationError('Transaction not found', 404);
  if (row.parentTransactionId)
    throw new ReconciliationError('Unlock the whole split transaction, not one part', 400);
  if (row.reconciled !== 1) return row;
  db.transaction(() => {
    db.update(transactions).set({ reconciled: 0 }).where(eq(transactions.id, id)).run();
    if (row.isParent === 1)
      db.update(transactions)
        .set({ reconciled: 0 })
        .where(eq(transactions.parentTransactionId, id))
        .run();
  });
  return db.select().from(transactions).where(eq(transactions.id, id)).get()!;
}
