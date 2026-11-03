import { and, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, transactions } from '../db/schema.js';

// A split is stored as a parent row holding the full amount plus child rows holding
// the parts, all in the same account. Account balances count the parent only;
// category totals count the children only (the parent has no category).

/** Account types whose balances can contribute spendable cash or budget debt. */
export const LIQUID_ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'credit', 'line_of_credit'];

/** Rows that make up an account's balance: everything except split children. */
export const inAccountBalance: SQL = isNull(transactions.parentTransactionId);

/**
 * Rows that are money earned or spent, for income and spending reports: everything except
 * balance corrections (reconciliation, "Update value") the user left without a category.
 * Balances and net worth still count those.
 */
export const isIncomeOrSpending: SQL = sql`not (${transactions.isAdjustment} = 1 and ${transactions.categoryId} is null)`;

/** Account scope shared by the envelope budget and default income/spending reports. */
export const personalBudgetAccount: SQL = and(
  eq(accounts.isOffBudget, 0),
  sql`not exists (select 1 from household_groups hg where hg.account_id = ${accounts.id})`,
  sql`not exists (select 1 from household_pool_accounts hp where hp.account_id = ${accounts.id})`,
)!;
export const onBudget: SQL = inArray(
  transactions.accountId,
  db.select({ id: accounts.id }).from(accounts).where(personalBudgetAccount),
);

/** Only the budget side of a confirmed transfer across the budget boundary counts.
 * The correlated outer reference is explicit SQL: Drizzle unqualifies Column objects in
 * single-table SELECT expressions, where it would otherwise bind to counterpart's column.
 */
export const isBudgetBoundary: SQL = sql`(${onBudget} and exists (
  select 1 from transactions counterpart
  inner join accounts other_account on other_account.id = counterpart.account_id
  where counterpart.id = "transactions"."transfer_transaction_id"
    and (other_account.is_off_budget = 1 or exists (select 1 from household_groups hg where hg.account_id = other_account.id) or exists (select 1 from household_pool_accounts hp where hp.account_id = other_account.id))
))`;

/** Leaf activity, excluding internal transfers and uncategorized balance corrections. */
export const reportActivity: SQL = and(
  eq(transactions.isParent, 0),
  isIncomeOrSpending,
  or(isNull(transactions.transferTransactionId), isBudgetBoundary),
)!;
export const budgetActivity: SQL = and(onBudget, reportActivity)!;

/** Day the envelope budget starts counting ('' = all history): Settings → Budget start */
const budgetStartDay = sql`coalesce((select min(bs.budget_start_month) from budget_settings bs) || '-01', '')`;
/** Rows on or after the budget start. Reports ignore it; envelopes and funding use it. */
export const sinceBudgetStart: SQL = sql`${transactions.date} >= ${budgetStartDay}`;
/** The budget start as YYYY-MM-01, or '' when every month counts */
export function budgetStartDate(): string {
  return db.get<{ day: string }>(sql`select ${budgetStartDay} as day`)?.day ?? '';
}

/**
 * Rows the user has not hidden from reports (phase 9). A split part follows its parent. Only
 * income/spending reports use this: balances, the envelope budget, forecasts and
 * reconciliation still count hidden rows, because they still moved money.
 */
export const shownInReports: SQL = sql`coalesce((select p.hidden_from_reports from transactions p where p.id = "transactions"."parent_transaction_id"), "transactions"."hidden_from_reports") = 0`;
/** budgetActivity for reports: what Cash Flow, categories, merchants and trends count */
export const reportedBudgetActivity: SQL = and(budgetActivity, shownInReports)!;
/** reportActivity for reports that choose their own accounts (custom reports) */
export const reportedActivity: SQL = and(reportActivity, shownInReports)!;

/** Sum of an account's transactions, as added to its starting balance. */
export function accountTransactionSum(accountId: string): number {
  const row = db
    .select({ sum: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), inAccountBalance))
    .get();
  return row?.sum ?? 0;
}

/**
 * What a row counts as in the budget and in reports that add up more than one account: its
 * value in the budget's currency (services/mainAmounts.ts). That's its amount in an account
 * with the budget's currency, the converted one in another, and nothing while its rate is
 * missing (shown as a warning instead of counting it at a made-up rate).
 * Per-account sums (balances, reconciling) use `amount`, in the account's own currency.
 */
export const mainAmount: SQL<number> = sql<number>`(case when ${transactions.mainAmountSource} = 'missing' then 0 else coalesce(${transactions.mainAmount}, ${transactions.amount}) end)`;
