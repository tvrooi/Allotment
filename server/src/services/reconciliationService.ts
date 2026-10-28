import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, transactions, upAccountMappings } from '../db/schema.js';
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
    } else if (amount !== 0) {
      throw new ReconciliationError(
        'The selected balance must match the statement before finishing.',
      );
    }
    if (ids.size)
      db.update(transactions)
        .set({ reconciled: 1 })
        .where(and(eq(transactions.accountId, accountId), inArray(transactions.id, [...ids])))
        .run();
    return { reconciled: ids.size, adjustment: request.createAdjustment ? amount : 0 };
  });
}
