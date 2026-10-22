import { and, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { categories, transactions } from '../db/schema.js';
import { isRealDate } from '../utils/validation.js';
import { budgetActivity, isBudgetBoundary, isIncomeOrSpending, mainAmount } from './balances.js';

// One transaction selection for the register, its summary and the filtered CSV export
// (docs/MONARCH-DEVELOPMENT-PHASE.md, "One transaction selection"). Filters are evaluated
// on leaves: unsplit rows and split parts, which carry their parent's account, date and
// payee. The register shows a split parent when any of its parts matches; the summary and
// export count only the matching parts.

const MAX_IDS = 500;
const id = z.string().min(1).max(64);
/** Comma-separated ids, as the query string sends them */
const idList = z
  .string()
  .max(MAX_IDS * 65)
  .transform((s) => s.split(',').filter(Boolean))
  .pipe(z.array(id).max(MAX_IDS));
const date = z.string().refine(isRealDate, 'Expected a date as YYYY-MM-DD');
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected a month as YYYY-MM');
/** A magnitude in minor units: "over 100" is 10001 */
const bound = z.coerce.number().int().min(0).max(1e13);
const flag = z.enum(['0', '1']);

export const selectionSchema = z
  .object({
    account_id: id,
    account_ids: idList,
    month,
    from: date,
    to: date,
    category_id: id,
    category_ids: idList,
    category_group_id: id,
    uncategorized: flag,
    payee_ids: idList,
    payee_name: z.string().max(500),
    search: z.string().max(500),
    direction: z.enum(['debit', 'credit']),
    min_amount: bound,
    max_amount: bound,
    reconciled: flag,
    transfers: z.enum(['include', 'exclude']),
    budget_report: flag,
  })
  .partial()
  .refine((s) => !s.from || !s.to || s.from <= s.to, {
    message: '`from` must not be after `to`',
    path: ['from'],
  })
  .refine(
    (s) => s.min_amount === undefined || s.max_amount === undefined || s.min_amount <= s.max_amount,
    { message: '`min_amount` must not be above `max_amount`', path: ['min_amount'] },
  );

export type Selection = z.infer<typeof selectionSchema>;

/**
 * Only the selection's own keys, so paging and format options can share the query string.
 * An empty value means "not set", except `payee_name`, where it selects rows with no payee.
 */
export function parseSelection(query: Record<string, unknown>) {
  const own = Object.fromEntries(
    Object.entries(query).filter(
      ([key, value]) =>
        Object.hasOwn(selectionSchema.shape, key) && (value !== '' || key === 'payee_name'),
    ),
  );
  return selectionSchema.safeParse(own);
}

function monthEnd(m: string) {
  const [y, mm] = m.split('-').map(Number);
  return `${m}-${String(new Date(Date.UTC(y, mm, 0)).getUTCDate()).padStart(2, '0')}`;
}

/** Account, date and reconciled state: the same on a split's parts as on its parent */
function rowConditions(s: Selection): SQL[] {
  const c: SQL[] = [];
  const accountIds = [...(s.account_ids ?? []), ...(s.account_id ? [s.account_id] : [])];
  if (accountIds.length) c.push(inArray(transactions.accountId, accountIds));
  if (s.month) {
    c.push(gte(transactions.date, `${s.month}-01`), lte(transactions.date, monthEnd(s.month)));
  }
  if (s.from) c.push(gte(transactions.date, s.from));
  if (s.to) c.push(lte(transactions.date, s.to));
  return c;
}

/** The reconciled flag lives on the register row: a split part reads its parent's */
const registerReconciled = sql<number>`coalesce((select p.reconciled from transactions p where p.id = "transactions"."parent_transaction_id"), ${transactions.reconciled})`;

/** Conditions on a leaf row that only a leaf can answer (category, payee, amount…) */
function leafOnlyConditions(s: Selection): SQL[] {
  const c: SQL[] = [];
  if (s.budget_report === '1') c.push(budgetActivity);
  if (s.uncategorized === '1') {
    c.push(
      isNull(transactions.categoryId),
      or(isNull(transactions.transferTransactionId), isBudgetBoundary)!,
      isIncomeOrSpending,
    );
  } else {
    const ids = s.category_ids?.length ? s.category_ids : s.category_id ? [s.category_id] : [];
    if (ids.length) c.push(inArray(transactions.categoryId, ids));
  }
  if (s.category_group_id) {
    c.push(
      inArray(
        transactions.categoryId,
        db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.groupId, s.category_group_id)),
      ),
    );
  }
  const payeeIds = s.payee_ids ?? [];
  if (payeeIds.length && s.payee_name !== undefined) {
    c.push(
      or(
        inArray(transactions.payeeId, payeeIds),
        and(isNull(transactions.payeeId), eq(transactions.payeeName, s.payee_name))!,
      )!,
    );
  } else if (payeeIds.length) {
    c.push(inArray(transactions.payeeId, payeeIds));
  } else if (s.payee_name !== undefined) {
    // A merchant without a payee record; an empty name is "No payee"
    c.push(isNull(transactions.payeeId));
    c.push(
      s.payee_name
        ? eq(transactions.payeeName, s.payee_name)
        : sql`coalesce(${transactions.payeeName}, '') = ''`,
    );
  }
  if (s.search) {
    // LIKE is case-insensitive for ASCII in SQLite; % and _ in the search are literal
    const pattern = `%${s.search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    c.push(
      or(
        sql`${transactions.payeeName} like ${pattern} escape '\\'`,
        sql`${transactions.notes} like ${pattern} escape '\\'`,
      )!,
    );
  }
  if (s.direction === 'debit') c.push(sql`${transactions.amount} < 0`);
  if (s.direction === 'credit') c.push(sql`${transactions.amount} > 0`);
  if (s.min_amount !== undefined) c.push(sql`abs(${transactions.amount}) >= ${s.min_amount}`);
  if (s.max_amount !== undefined) c.push(sql`abs(${transactions.amount}) <= ${s.max_amount}`);
  if (s.transfers === 'exclude') c.push(isNull(transactions.transferTransactionId));
  return c;
}

/** Leaves (unsplit rows and split parts) the selection matches: what the summary and export count */
export function leafCondition(s: Selection): SQL {
  const c = [eq(transactions.isParent, 0), ...rowConditions(s), ...leafOnlyConditions(s)];
  if (s.reconciled) c.push(sql`${registerReconciled} = ${Number(s.reconciled)}`);
  return and(...c)!;
}

/** Register rows (unsplit transactions and split parents) the selection matches */
export function registerCondition(s: Selection): SQL {
  const c = [isNull(transactions.parentTransactionId), ...rowConditions(s)];
  if (s.reconciled) c.push(eq(transactions.reconciled, Number(s.reconciled)));
  const leaf = leafOnlyConditions(s);
  if (leaf.length) {
    const parentsWithMatch = db
      .select({ id: transactions.parentTransactionId })
      .from(transactions)
      .where(and(isNotNull(transactions.parentTransactionId), ...leaf));
    c.push(
      or(
        and(eq(transactions.isParent, 0), ...leaf)!,
        and(eq(transactions.isParent, 1), inArray(transactions.id, parentsWithMatch))!,
      )!,
    );
  }
  return and(...c)!;
}

export interface SelectionSummary {
  /** Register rows: a split counts once */
  count: number;
  /** Matching leaves (unsplit rows and split parts) */
  leafCount: number;
  /** Money in and out, in the budget's currency (positive numbers) */
  moneyIn: number;
  moneyOut: number;
  net: number;
  /** Matching rows left out of the totals because their exchange rate is missing */
  missingRateCount: number;
  firstDate: string | null;
  lastDate: string | null;
}

/** Totals of the matching leaves. Reads only. */
export function summarizeSelection(s: Selection): SelectionSummary {
  const row = db
    .select({
      count: sql<number>`count(distinct coalesce(${transactions.parentTransactionId}, ${transactions.id}))`,
      leafCount: sql<number>`count(*)`,
      moneyIn: sql<number>`coalesce(sum(case when ${mainAmount} > 0 then ${mainAmount} else 0 end), 0)`,
      moneyOut: sql<number>`coalesce(sum(case when ${mainAmount} < 0 then -${mainAmount} else 0 end), 0)`,
      missingRateCount: sql<number>`coalesce(sum(case when ${transactions.mainAmountSource} = 'missing' then 1 else 0 end), 0)`,
      firstDate: sql<string | null>`min(${transactions.date})`,
      lastDate: sql<string | null>`max(${transactions.date})`,
    })
    .from(transactions)
    .where(leafCondition(s))
    .get()!;
  return { ...row, net: row.moneyIn - row.moneyOut };
}
