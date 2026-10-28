import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  transactions,
  upAccountMappings,
  enableBankingAccountMappings,
} from '../db/schema.js';
import { format, parseISO } from 'date-fns';
import { inAccountBalance, personalBudgetAccount, LIQUID_ACCOUNT_TYPES } from './balances.js';
import { budgetCurrency, todayIso } from './mainAmountService.js';

export interface AccountIssue {
  accountId: string;
  accountName: string;
  currency: string | null;
  reason: 'closed-balance' | 'bank-mismatch' | 'bank-balance-unavailable';
  registerBalance: number;
  bankBalance: number | null;
  difference: number | null;
}

/** A bank feed supplies received income. Recurring expectations must not import it again. */
export function bankLinked(accountId: string) {
  return !!(
    db
      .select({ id: upAccountMappings.id })
      .from(upAccountMappings)
      .where(and(eq(upAccountMappings.accountId, accountId), eq(upAccountMappings.isEnabled, 1)))
      .get() ||
    db
      .select({ id: enableBankingAccountMappings.id })
      .from(enableBankingAccountMappings)
      .where(
        and(
          eq(enableBankingAccountMappings.accountId, accountId),
          eq(enableBankingAccountMappings.isEnabled, 1),
        ),
      )
      .get()
  );
}

/** Disclose discrepancies without rewriting either the bank's source or the owner's ledger.
 * Current bank snapshots cannot verify historical views. Closed balances remain in resources
 * (closing cannot make money disappear), but cannot silently unlock new assignments. */
export function accountIssues(asOf = todayIso()): AccountIssue[] {
  const totals = new Map(
    db
      .select({
        accountId: transactions.accountId,
        total: sql<number>`coalesce(sum(case when ${transactions.amount} > 0 and coalesce(${transactions.importedId}, '') like 'schedule:%' and ${transactions.reconciled} = 0 then 0 else ${transactions.amount} end), 0)`,
      })
      .from(transactions)
      .where(and(inAccountBalance, lte(transactions.date, asOf)))
      .groupBy(transactions.accountId)
      .all()
      .map((t) => [t.accountId, t.total]),
  );
  const mappings = new Map(
    db
      .select()
      .from(upAccountMappings)
      .where(eq(upAccountMappings.isEnabled, 1))
      .all()
      .map((m) => [m.accountId, m]),
  );
  const issues: AccountIssue[] = [];
  for (const a of db.select().from(accounts).where(personalBudgetAccount).all()) {
    if (a.createdAt.slice(0, 10) > asOf && !totals.has(a.id)) continue;
    const registerBalance = a.startingBalance + (totals.get(a.id) ?? 0);
    const base = {
      accountId: a.id,
      accountName: a.name,
      currency: a.currency ?? budgetCurrency(),
      registerBalance,
    };
    if (a.closedAt && format(parseISO(a.closedAt), 'yyyy-MM-dd') <= asOf) {
      if (registerBalance !== 0 && (LIQUID_ACCOUNT_TYPES.includes(a.type) || registerBalance < 0))
        issues.push({ ...base, reason: 'closed-balance', bankBalance: null, difference: null });
      continue;
    }
    if (asOf !== todayIso()) continue;
    const m = mappings.get(a.id);
    if (!m) continue;
    if (!m.initializedAt || m.settledBalance === null) {
      issues.push({
        ...base,
        reason: 'bank-balance-unavailable',
        bankBalance: null,
        difference: null,
      });
    } else if (m.settledBalance !== registerBalance) {
      issues.push({
        ...base,
        reason: 'bank-mismatch',
        bankBalance: m.settledBalance,
        difference: m.settledBalance - registerBalance,
      });
    }
  }
  return issues;
}
