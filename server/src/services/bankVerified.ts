import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, upAccountMappings } from '../db/schema.js';
import { accountTransactionSum } from './balances.js';

/**
 * Accounts the bank has just checked (audit F-17): an Up account whose register equals the
 * settled balance Up reported at the last complete sync, with no unexplained difference at a
 * cut-over. Review doesn't ask to reconcile these: the sync already compared them with the bank.
 *
 * Nothing is marked reconciled. Reconciling stays the owner's own step, and locks rows; this only
 * stops asking for it while the bank and the register agree. A row added or changed by hand, or a
 * transaction deleted here that Up still has, makes them differ and brings the request back.
 */
export function bankVerifiedAccountIds(): Set<string> {
  const verified = new Set<string>();
  const mapped = db
    .select({
      accountId: upAccountMappings.accountId,
      settledBalance: upAccountMappings.settledBalance,
      cutoverDifference: upAccountMappings.cutoverDifference,
      startingBalance: accounts.startingBalance,
    })
    .from(upAccountMappings)
    .innerJoin(accounts, eq(accounts.id, upAccountMappings.accountId))
    .where(and(eq(upAccountMappings.isEnabled, 1), isNotNull(upAccountMappings.settledBalance)))
    .all();
  for (const m of mapped) {
    if (!m.accountId || m.settledBalance === null) continue;
    if (m.cutoverDifference !== null && m.cutoverDifference !== 0) continue;
    if (m.startingBalance + accountTransactionSum(m.accountId) === m.settledBalance)
      verified.add(m.accountId);
  }
  return verified;
}
