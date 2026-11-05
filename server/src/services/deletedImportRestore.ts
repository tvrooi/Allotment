// Audit F-14: restoring a bank-fed row the owner deleted (not Up's: Up review restores those and
// Up sends its whole history again). Plaid's sync cursor has moved past the row and Enable
// Banking fetches only recent days, so neither would send it again: the row is recreated from
// what was kept when it was deleted, through the same insert path as a sync (rules apply), and
// its import id keeps the next sync from adding it twice.
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { transactions, upDeletedImports } from '../db/schema.js';
import { currencyContext } from './mainAmountService.js';
import { buildRuleContext, insertNewTransaction, loadRules } from './ruleService.js';
import { isUpImport } from './transactionHelpers.js';

/**
 * Null when there was no such deletion. `recreated` false: an older deletion kept no details,
 * so it is only forgotten, and comes back if the bank sends it again.
 */
export function restoreDeletedImport(accountId: string, importedId: string) {
  if (isUpImport(importedId)) return null;
  return db.transaction(() => {
    const row = db
      .select()
      .from(upDeletedImports)
      .where(
        and(eq(upDeletedImports.accountId, accountId), eq(upDeletedImports.importedId, importedId)),
      )
      .get();
    if (!row) return null;
    db.delete(upDeletedImports)
      .where(
        and(eq(upDeletedImports.accountId, accountId), eq(upDeletedImports.importedId, importedId)),
      )
      .run();
    const here = db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), eq(transactions.importedId, importedId)))
      .get();
    if (here || !row.date || row.amount === null) return { recreated: false };
    insertNewTransaction(
      {
        accountId,
        date: row.date,
        amount: row.amount,
        payeeId: null,
        payeeName: row.description,
        importedPayee: row.importedPayee,
        notes: row.notes,
        categoryId: null,
        importedId,
      },
      { rules: loadRules(), ctx: buildRuleContext(), currencies: currencyContext() },
    );
    return { recreated: true };
  });
}
