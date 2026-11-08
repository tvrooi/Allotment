import { inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { transactions } from '../db/schema.js';

// Up round-ups belong to their purchase, as in Up's own app (owner-requested 8 November 2026):
// the register lists the purchase once, at its total, and its details show the round-up. The
// round-up's own rows stay in the ledger, balances and reports; they are only left out of lists.

/** The importedId suffix of the spending-side debit made from a purchase's round-up */
export const ROUND_UP_SUFFIX = ':roundup';

// Qualified explicitly: drizzle leaves a single-table select's columns bare, and inside a
// subquery a bare name would resolve to the subquery's own table
const outer = (column: string) => sql.raw(`"transactions"."${column}"`);

/** The spending-side debit made from a purchase's round-up (upReviewService.roundUpDebit) */
export const isRoundUpDebit: SQL = sql`coalesce(${transactions.importedId}, '') like ${'%' + ROUND_UP_SUFFIX}`;

/**
 * The Saver's credit for a round-up: linked to a round-up debit, or an Up credit that Up itself
 * describes as a round-up and reports as coming from another Up account. The second case covers
 * a pending purchase (Up moves its round-up at once; the purchase is imported when it settles)
 * and round-ups from before the first sync. Bank-reported facts only, never a guess.
 */
export const isRoundUpCredit: SQL = sql`(${transactions.amount} > 0 and (
  exists (select 1 from transactions r where r.id = ${outer('transfer_transaction_id')}
    and r.imported_id like ${'%' + ROUND_UP_SUFFIX})
  or exists (select 1 from up_source_records s where s.imported_id = ${outer('imported_id')}
    and s.account_id = ${outer('account_id')}
    and lower(json_extract(s.source_json, '$.description')) = 'round up'
    and json_extract(s.source_json, '$.transferAccountId') is not null)
))`;

export interface RoundUpOnPurchase {
  /** The round-up debit, negative (boost included) */
  amount: number;
  /** The round-up debit's own row */
  transactionId: string;
  /** The Saver it went to, once linked */
  toAccountName: string | null;
  /** Up's boost within the amount, negative; null = none */
  boost: number | null;
}

/** For each purchase row (by id), its round-up: one query for the whole page. */
export function roundUpsOf(
  rows: { id: string; accountId: string; importedId: string | null }[],
): Map<string, RoundUpOnPurchase> {
  const byKey = new Map<string, string>();
  for (const r of rows)
    if (r.importedId?.startsWith('up:') && !r.importedId.endsWith(ROUND_UP_SUFFIX))
      byKey.set(`${r.accountId}\n${r.importedId}${ROUND_UP_SUFFIX}`, r.id);
  const out = new Map<string, RoundUpOnPurchase>();
  if (!byKey.size) return out;
  const ids = [...byKey.keys()].map((k) => k.split('\n')[1]);
  for (let i = 0; i < ids.length; i += 500) {
    const found = db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        importedId: transactions.importedId,
        amount: transactions.amount,
        toAccountName: sql<
          string | null
        >`(select a.name from transactions o join accounts a on a.id = o.account_id where o.id = ${outer('transfer_transaction_id')})`,
        boost: sql<
          number | null
        >`(select json_extract(s.source_json, '$.boostAmount') from up_source_records s where s.imported_id = substr(${outer('imported_id')}, 1, length(${outer('imported_id')}) - ${ROUND_UP_SUFFIX.length}))`,
      })
      .from(transactions)
      .where(inArray(transactions.importedId, ids.slice(i, i + 500)))
      .all();
    for (const f of found) {
      const purchaseId = byKey.get(`${f.accountId}\n${f.importedId}`);
      if (!purchaseId) continue;
      out.set(purchaseId, {
        amount: f.amount,
        transactionId: f.id,
        toAccountName: f.toAccountName,
        boost: f.boost ? Number(f.boost) : null,
      });
    }
  }
  return out;
}

/** For each round-up debit row (by id), the purchase it came from, when that is in the register */
export function purchasesOfRoundUps(
  rows: { id: string; accountId: string; importedId: string | null }[],
): Map<string, { transactionId: string; payeeName: string | null }> {
  const out = new Map<string, { transactionId: string; payeeName: string | null }>();
  const legs = rows.filter((r) => r.importedId?.endsWith(ROUND_UP_SUFFIX));
  for (let i = 0; i < legs.length; i += 500) {
    const chunk = legs.slice(i, i + 500);
    const want = new Map(
      chunk.map((r) => [
        `${r.accountId}\n${r.importedId!.slice(0, -ROUND_UP_SUFFIX.length)}`,
        r.id,
      ]),
    );
    const found = db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        importedId: transactions.importedId,
        payeeName: transactions.payeeName,
      })
      .from(transactions)
      .where(
        inArray(
          transactions.importedId,
          chunk.map((r) => r.importedId!.slice(0, -ROUND_UP_SUFFIX.length)),
        ),
      )
      .all();
    for (const f of found) {
      const legId = want.get(`${f.accountId}\n${f.importedId}`);
      if (legId) out.set(legId, { transactionId: f.id, payeeName: f.payeeName });
    }
  }
  return out;
}
