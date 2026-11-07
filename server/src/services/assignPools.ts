import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, categories, categoryGroups, schedules } from '../db/schema.js';
import { personalBudgetAccount } from './balances.js';

/**
 * Separate Ready to Assign pools (owner-requested on 7 November 2026; docs/ENVELOPE-FUNDING.md).
 * An account with assignPool = 1 (say Up Essentials, which pays your own bills) has its own
 * Ready to Assign: its balance less the envelopes earmarked to it (categories.poolAccountId).
 * A transfer into it moves money from the main Ready to Assign to its own; its earmarked
 * envelopes are funded only from it. The main figure leaves both out, so the two always add up
 * to what the budget had before.
 */

/** Account types that can hold a pool: cash the budget counts, never card debt */
export const POOL_TYPES = ['checking', 'savings', 'cash'];

export class PoolError extends Error {}

export interface AssignPool {
  accountId: string;
  name: string;
}

/** Open budget accounts that are pools, in name order */
export function assignPools(): AssignPool[] {
  return db
    .select({ accountId: accounts.id, name: accounts.name })
    .from(accounts)
    .where(and(eq(accounts.assignPool, 1), isNull(accounts.closedAt), personalBudgetAccount))
    .orderBy(accounts.name)
    .all();
}

/** Each earmarked category's pool, for categories whose pool is still a pool */
export function earmarks(): Map<string, string> {
  const pools = new Set(assignPools().map((p) => p.accountId));
  return new Map(
    db
      .select({ id: categories.id, pool: categories.poolAccountId })
      .from(categories)
      .where(isNotNull(categories.poolAccountId))
      .all()
      .filter((c) => pools.has(c.pool!))
      .map((c) => [c.id, c.pool!]),
  );
}

/** Why an account can't be a pool, or null */
function poolAccountError(accountId: string): string | null {
  const account = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), personalBudgetAccount))
    .get();
  if (!account) return 'Only an account in the budget can have its own Ready to Assign';
  if (account.closedAt) return 'A closed account can’t have its own Ready to Assign';
  if (!POOL_TYPES.includes(account.type))
    return 'Only a bank or cash account can have its own Ready to Assign';
  return null;
}

/**
 * Turns an account's own Ready to Assign on or off. Turning it on earmarks the categories of
 * the active recurring bills paid from it (those not earmarked elsewhere); turning it off
 * returns its earmarked categories to the main Ready to Assign. Run inside the caller's
 * transaction with the account update.
 */
export function setAssignPool(accountId: string, on: boolean) {
  if (on) {
    const error = poolAccountError(accountId);
    if (error) throw new PoolError(error);
    db.update(accounts).set({ assignPool: 1 }).where(eq(accounts.id, accountId)).run();
    const billCategories = db
      .select({ id: schedules.categoryId })
      .from(schedules)
      .where(
        and(
          eq(schedules.accountId, accountId),
          eq(schedules.status, 'active'),
          isNotNull(schedules.categoryId),
        ),
      )
      .all()
      .map((s) => s.id!);
    const expense = db
      .select({ id: categories.id })
      .from(categories)
      .innerJoin(categoryGroups, eq(categoryGroups.id, categories.groupId))
      .where(
        and(
          inArray(categories.id, billCategories.length ? billCategories : ['']),
          eq(categoryGroups.isIncome, 0),
          isNull(categories.poolAccountId),
        ),
      )
      .all()
      .map((c) => c.id);
    if (expense.length)
      db.update(categories)
        .set({ poolAccountId: accountId })
        .where(inArray(categories.id, expense))
        .run();
  } else {
    db.update(accounts).set({ assignPool: 0 }).where(eq(accounts.id, accountId)).run();
    db.update(categories)
      .set({ poolAccountId: null })
      .where(eq(categories.poolAccountId, accountId))
      .run();
  }
}

/** Why a category can't be earmarked to this pool, or null */
export function earmarkError(categoryId: string, groupId: string, poolAccountId: string) {
  const pool = db
    .select({ assignPool: accounts.assignPool })
    .from(accounts)
    .where(eq(accounts.id, poolAccountId))
    .get();
  if (!pool?.assignPool) return 'That account doesn’t have its own Ready to Assign';
  const group = db.select().from(categoryGroups).where(eq(categoryGroups.id, groupId)).get();
  if (group?.isIncome) return 'Only an expense category can be funded from an account’s own pool';
  const linked = db
    .select({ linkedAccountId: categories.linkedAccountId })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .get();
  if (linked?.linkedAccountId)
    return 'A category that follows an account can’t also be funded from a pool';
  return null;
}
