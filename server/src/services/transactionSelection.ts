import { and, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { categories, transactions } from '../db/schema.js';
import { isRealDate } from '../utils/validation.js';
import {
  isBudgetBoundary,
  isIncomeOrSpending,
  mainAmount,
  reportedBudgetActivity,
} from './balances.js';

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
    reviewed: flag,
    hidden: flag,
    /** Has a receipt or any file in Files (1), or none (0) */
    has_files: flag,
    tag_ids: idList,
    transfers: z.enum(['include', 'exclude']),
    budget_report: flag,
    /**
     * Linked transfers between two listed accounts: fold (the default) lists the pair once, as
     * "Transfer from X to Y"; show lists both sides (transferPairCondition).
     */
    transfer_pairs: z.enum(['fold', 'show']),
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

/** Account and date: the same on a split's parts as on its parent */
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

/**
 * State that lives on the register row (reconciled, reviewed, hidden from reports, tags), as
 * conditions on either a register row itself or a leaf, which reads its parent's.
 */
function registerStateConditions(s: Selection, on: 'register' | 'leaf'): SQL[] {
  const own = (column: string) => sql.raw(`"transactions"."${column}"`);
  const state = (column: string) =>
    on === 'register'
      ? own(column)
      : sql.raw(
          `coalesce((select p.${column} from transactions p where p.id = "transactions"."parent_transaction_id"), "transactions"."${column}")`,
        );
  const rowId =
    on === 'register'
      ? own('id')
      : sql.raw(`coalesce("transactions"."parent_transaction_id", "transactions"."id")`);
  const c: SQL[] = [];
  if (s.reconciled) c.push(sql`${state('reconciled')} = ${Number(s.reconciled)}`);
  if (s.reviewed === '1') c.push(sql`${state('reviewed_at')} is not null`);
  if (s.reviewed === '0') c.push(sql`${state('reviewed_at')} is null`);
  if (s.hidden) c.push(sql`${state('hidden_from_reports')} = ${Number(s.hidden)}`);
  if (s.has_files) {
    const has = sql`(exists (select 1 from document_links dl where dl.transaction_id = ${rowId}) or exists (select 1 from receipts r where r.transaction_id = ${rowId}))`;
    c.push(s.has_files === '1' ? has : sql`not ${has}`);
  }
  if (s.tag_ids?.length) {
    c.push(
      sql`exists (select 1 from transaction_tags tt where tt.transaction_id = ${rowId} and tt.tag_id in (${sql.join(
        s.tag_ids.map((id) => sql`${id}`),
        sql`, `,
      )}))`,
    );
  }
  return c;
}

/** Conditions on a leaf row that only a leaf can answer (category, payee, amount…) */
function leafOnlyConditions(s: Selection): SQL[] {
  const c: SQL[] = [];
  // The cash-flow scope: what reports count, so a drill-down agrees with its chart (rows
  // hidden from reports are left out, phase 9)
  if (s.budget_report === '1') c.push(reportedBudgetActivity);
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
  const c = [
    eq(transactions.isParent, 0),
    ...rowConditions(s),
    ...registerStateConditions(s, 'leaf'),
    ...leafOnlyConditions(s),
  ];
  return and(...c)!;
}

/** Selection keys that keep both sides of a transfer in the same list, so a pair can be folded */
const PAIR_KEYS = new Set(['account_id', 'account_ids', 'month', 'from', 'to', 'transfer_pairs']);

/**
 * The side of a linked transfer whose other side is listed too: a view of more than one account
 * shows the pair once (owner-requested 8 November 2026). Folded only when the selection is
 * accounts and dates alone (any other filter could match one side and not the other) and never in
 * one account's own register. The listed side is the one with a category (the budget side across
 * the budget boundary), else the money out, so it reads "from" its own account. `side` and
 * `other` are SQL table names; null = nothing is folded for this selection.
 */
function transferPairCondition(s: Selection, side: string, other: string): SQL | null {
  if (s.transfer_pairs === 'show') return null;
  if (Object.entries(s).some(([k, v]) => v !== undefined && !PAIR_KEYS.has(k))) return null;
  const accountIds = [
    ...new Set([...(s.account_ids ?? []), ...(s.account_id ? [s.account_id] : [])]),
  ];
  if (accountIds.length === 1) return null;
  const col = (t: string, c: string) => sql.raw(`${t}."${c}"`);
  const c: SQL[] = [
    sql`${col(other, 'id')} = ${col(side, 'transfer_transaction_id')}`,
    sql`${col(other, 'parent_transaction_id')} is null`,
    sql`(
      (${col(side, 'category_id')} is null and ${col(other, 'category_id')} is not null)
      or ((${col(side, 'category_id')} is null) = (${col(other, 'category_id')} is null)
        and ${col(side, 'amount')} > 0)
    )`,
  ];
  // Both sides are in the view: the account and date filters hold for each
  for (const t of [side, other]) {
    if (accountIds.length)
      c.push(
        sql`${col(t, 'account_id')} in (${sql.join(
          accountIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    if (s.month) {
      c.push(sql`${col(t, 'date')} >= ${`${s.month}-01`}`);
      c.push(sql`${col(t, 'date')} <= ${monthEnd(s.month)}`);
    }
    if (s.from) c.push(sql`${col(t, 'date')} >= ${s.from}`);
    if (s.to) c.push(sql`${col(t, 'date')} <= ${s.to}`);
  }
  return and(...c)!;
}

/** The register row is the folded side of a listed transfer pair */
function foldedTransferSide(s: Selection): SQL | null {
  const c = transferPairCondition(s, '"transactions"', 'pair_other');
  return c ? sql`exists (select 1 from transactions pair_other where ${c})` : null;
}

/** The register row lists a transfer pair whose other side is folded into it */
export function listsTransferPair(s: Selection): SQL {
  const c = transferPairCondition(s, 'pair_other', '"transactions"');
  return c ? sql`exists (select 1 from transactions pair_other where ${c})` : sql`0`;
}

/** Register rows (unsplit transactions and split parents) the selection matches */
export function registerCondition(s: Selection): SQL {
  const c = [
    isNull(transactions.parentTransactionId),
    ...rowConditions(s),
    ...registerStateConditions(s, 'register'),
  ];
  const pair = foldedTransferSide(s);
  if (pair) c.push(sql`not ${pair}`);
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
  /** Register rows: a split counts once, a folded transfer pair once */
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
  // The count is of the rows the register lists (a folded transfer pair once); the money is all
  const pair = foldedTransferSide(s);
  const listedId = pair
    ? sql`case when not ${pair} then coalesce(${transactions.parentTransactionId}, ${transactions.id}) end`
    : sql`coalesce(${transactions.parentTransactionId}, ${transactions.id})`;
  const row = db
    .select({
      count: sql<number>`count(distinct ${listedId})`,
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
