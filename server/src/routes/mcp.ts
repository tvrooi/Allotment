import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { inArray } from 'drizzle-orm';
import { appVersion } from '../utils/version.js';
import { db } from '../db/index.js';
import { transactions } from '../db/schema.js';
import { asScope, canCategorise, type TokenScope } from '../auth/accessTokens.js';
import { recordChangeSet, type ChangeEntry } from '../services/changeSets.js';
import { todayIso } from '../services/mainAmountService.js';

// An MCP server (Model Context Protocol, Streamable HTTP with JSON responses) so an AI
// assistant can read the budget with an access token (docs/READ-ONLY-ACCESS.md). Every read
// tool is one GET of this server's own API, made over loopback with the caller's token, so a
// tool can never reach more than the token itself: the same allowlist, validation and
// accounting as the app. Writing tools are listed only for a token whose scope allows them
// (categorise: categories; organise: also rules, payee defaults and suggested transfers) and
// make the same requests the app does. Category changes are saved as change sets that can be
// undone (services/changeSets.ts).

export const mcpRouter = Router();

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
/** Longest tool result sent back; longer ones are cut with a note to narrow the request */
const MAX_RESULT_CHARS = 200_000;

type Args = Record<string, unknown>;
interface Tool {
  name: string;
  description: string;
  properties?: Record<string, unknown>;
  required?: string[];
  /** The API path and query for these arguments */
  path: (args: Args) => string;
  /** Reshapes the API's answer (e.g. keeps only some fields) */
  transform?: (text: string, args: Args) => string;
}

const month = { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: 'YYYY-MM' };
const day = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD' };
const monthRange = {
  from: { ...month, description: 'First month, YYYY-MM' },
  to: { ...month, description: 'Last month, YYYY-MM' },
};

/** The phase 8/9 transaction selection, as tool arguments */
const selection = {
  from: { ...day, description: 'First day, inclusive' },
  to: { ...day, description: 'Last day, inclusive' },
  account_ids: { type: 'string', description: 'Comma-separated account ids' },
  category_ids: { type: 'string', description: 'Comma-separated category ids' },
  payee_ids: { type: 'string', description: 'Comma-separated payee ids' },
  tag_ids: { type: 'string', description: 'Comma-separated tag ids (any of them)' },
  search: { type: 'string', description: 'Text in the payee name or notes' },
  direction: { type: 'string', enum: ['debit', 'credit'] },
  min_amount: { type: 'integer', minimum: 0, description: 'Magnitude in minor units, inclusive' },
  max_amount: { type: 'integer', minimum: 0, description: 'Magnitude in minor units, inclusive' },
  uncategorized: { type: 'string', enum: ['1'] },
  budget_report: {
    type: 'string',
    enum: ['1'],
    description: 'Only what reports count: budget accounts, no internal transfers',
  },
  transfers: { type: 'string', enum: ['include', 'exclude'] },
  reviewed: { type: 'string', enum: ['0', '1'] },
  hidden: { type: 'string', enum: ['0', '1'], description: 'Hidden from reports' },
};

function query(args: Args, keys: string[]): string {
  const q = new URLSearchParams();
  for (const key of keys) {
    const v = args[key];
    if (v !== undefined && v !== null && v !== '') q.set(key, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
const seg = (v: unknown) => encodeURIComponent(String(v ?? ''));

const TOOLS: Tool[] = [
  {
    name: 'list_accounts',
    description: 'Accounts with their type, currency and current balance (minor units).',
    path: () => '/accounts',
  },
  {
    name: 'list_categories',
    description:
      'Category groups and categories, with ids for other tools, and how much each is used: transactionCount, lastUsedDate, everAssigned and hidden (1 = tucked away).',
    path: () => '/categories?usage=1',
  },
  {
    name: 'list_payees',
    description: 'Payees (merchants) with ids and transaction counts.',
    path: () => '/payees',
  },
  {
    name: 'list_tags',
    description: 'Transaction tags with ids and how many transactions carry each.',
    path: () => '/tags',
  },
  {
    name: 'list_rules',
    description: 'Categorisation rules: conditions and actions, in the order they run.',
    path: () => '/rules',
  },
  {
    name: 'list_goals',
    description: 'Savings goals with progress and their funding category where linked.',
    path: () => '/goals',
  },
  {
    name: 'budget_month',
    description:
      'The envelope budget for a month: per category assigned, activity, carry-over and available, with targets.',
    properties: { month },
    required: ['month'],
    path: (a) => `/budget/${seg(a.month)}`,
  },
  {
    name: 'budget_summary',
    description:
      'Money available to assign, reserved, overspent, uncategorised and card payment position for a month.',
    properties: { month },
    required: ['month'],
    path: (a) => `/budget/${seg(a.month)}/summary`,
  },
  {
    name: 'annual_overview',
    description:
      'A calendar year of the budget: monthly assigned and activity per category, year totals, and planned months.',
    properties: { year: { type: 'integer', minimum: 1900, maximum: 2200 } },
    required: ['year'],
    path: (a) => `/budget/year/${seg(a.year)}`,
  },
  {
    name: 'find_transactions',
    description:
      'Transactions matching filters, newest first (a split appears once with its parts). Amounts are minor units; negative is money out.',
    properties: {
      ...selection,
      limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Default 100' },
      offset: { type: 'integer', minimum: 0, description: 'Skip this many matches, to page' },
      fields: {
        type: 'string',
        description:
          'Comma-separated fields to return per transaction, to keep results short (e.g. id,date,amount,payeeName,categoryId,notes,accountId)',
      },
    },
    path: (a) =>
      `/transactions${query({ limit: 100, ...a }, [...Object.keys(selection), 'limit', 'offset'])}`,
    transform: (text, a) => {
      if (typeof a.fields !== 'string' || !a.fields.trim()) return text;
      const keep = a.fields
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);
      try {
        const rows = JSON.parse(text) as Record<string, unknown>[];
        if (!Array.isArray(rows)) return text;
        return JSON.stringify(rows.map((r) => Object.fromEntries(keep.map((k) => [k, r[k]]))));
      } catch {
        return text;
      }
    },
  },
  {
    name: 'uncategorised_payees',
    description:
      'Uncategorised transactions grouped by payee (transfers and split parents aside), most frequent first: count, money in and out, net, first and last date, accounts and sample notes. The worklist for categorising; then use categorise_by_payee or find_transactions.',
    properties: {
      from: { ...day, description: 'First day, inclusive' },
      to: { ...day, description: 'Last day, inclusive' },
      limit: { type: 'integer', minimum: 1, maximum: 1000, description: 'Payees, default 200' },
    },
    path: (a) => `/reports/uncategorised-payees${query(a, ['from', 'to', 'limit'])}`,
  },
  {
    name: 'transfer_suggestions',
    description:
      'Pairs of existing transactions that look like one transfer between two of your accounts (the same amount out and in within a few days) but are not linked. Linked, they stop counting as spending and income.',
    properties: { account_id: { type: 'string', description: 'Only pairs touching this account' } },
    path: (a) => `/transactions/transfers/suggestions${query(a, ['account_id'])}`,
  },
  {
    name: 'transaction_summary',
    description:
      'Count, money in, money out, net and date span of the transactions matching filters.',
    properties: selection,
    path: (a) => `/transactions/summary${query(a, Object.keys(selection))}`,
  },
  {
    name: 'income_vs_expenses',
    description: 'Monthly income and spending (net of refunds) under budget accounting.',
    properties: monthRange,
    required: ['from', 'to'],
    path: (a) => `/reports/income-vs-expenses${query(a, ['from', 'to'])}`,
  },
  {
    name: 'spending_by_category',
    description: 'Spending per category for a month range (all time if omitted).',
    properties: monthRange,
    path: (a) => `/reports/spending-by-category${query(a, ['from', 'to'])}`,
  },
  {
    name: 'spending_by_merchant',
    description: 'Spending per payee for a month range; positive net means net refunds.',
    properties: monthRange,
    path: (a) => `/reports/spending-by-payee${query(a, ['from', 'to'])}`,
  },
  {
    name: 'budget_review',
    description:
      'The budget review: uncategorised spending, overspending, underfunded targets, unreserved card debt and future assignments.',
    path: () => '/review',
  },
  {
    name: 'budget_housekeeping',
    description:
      "Setup problems that make the budget less useful: no budget start with years of history (suggestion = a month to start from), Up accounts missing round-up debits, uncategorised movements to or from savers that aren't in FlyBudget (grouped by saver, with ids), and how many categories were never used.",
    path: () => '/review/housekeeping',
  },
  {
    name: 'financial_resilience',
    description: 'Cash after debts by purpose, the flexibility reserve and months of essentials.',
    path: () => '/review/resilience',
  },
  {
    name: 'budget_start',
    description:
      'The first month the envelope budget counts (null = all history). Earlier transactions stay in reports but not in envelope balances.',
    path: () => '/budget/start',
  },
  {
    name: 'list_households',
    description:
      'Household groups (shared costs with other people) and the pool account each uses. A pool account sits outside the personal budget.',
    path: () => '/households',
  },
  {
    name: 'household',
    description:
      "One household group in full: people, agreed shares, events (expenses, advances, repayments, refunds), bills and each person's balance.",
    properties: { household_id: { type: 'string', description: 'From list_households' } },
    required: ['household_id'],
    path: (a) => `/households/${seg(a.household_id)}`,
  },
  {
    name: 'household_statement',
    description:
      "A household's gross spending and your personal share for a date range, with balances and events.",
    properties: {
      household_id: { type: 'string', description: 'From list_households' },
      from: { ...day, description: 'First day, inclusive' },
      to: { ...day, description: 'Last day, inclusive' },
    },
    required: ['household_id'],
    path: (a) => `/households/${seg(a.household_id)}/statement${query(a, ['from', 'to'])}`,
  },
  {
    name: 'bank_sync_status',
    description:
      "Each bank-synced account: when it last synced, the bank's settled balance against the register, the difference, and whether missing round-up debits explain it (verdict round-ups) or not (unexplained). No connection details.",
    path: () => '/accounts/sync-status',
  },
  {
    name: 'list_budget_proposals',
    description:
      'Assignment suggestions waiting for the owner (status=all also lists applied and dismissed ones).',
    properties: { status: { type: 'string', enum: ['open', 'all'] } },
    path: (a) => `/budget-proposals${query(a, ['status'])}`,
  },
  {
    name: 'list_change_sets',
    description:
      'Category changes this token made, one set per tool call, newest first, with whether each was undone.',
    path: () => '/change-sets',
  },
  {
    name: 'long_term_plans',
    description:
      'Saved long-term forecast plans (decades of net worth): each one with its name, version and number of life events.',
    path: () => '/forecast/long-term/plans',
  },
  {
    name: 'long_term_plan',
    description:
      'One long-term forecast plan in full: its settings (every rate and age is an assumption), life events, per-account choices and savings splits.',
    properties: { plan_id: { type: 'string', description: 'A plan id from long_term_plans' } },
    required: ['plan_id'],
    path: (a) => `/forecast/long-term/plans/${seg(a.plan_id)}`,
  },
  {
    name: 'long_term_forecast',
    description:
      "A long-term forecast plan's year-by-year result in future dollars (integer minor units): closing net worth, income, spending, net cash flow, loan payments, super (with its phase: preserved, accessible or pension), accessible wealth (cash, investments and released super) beside preserved super, growth and unfunded spending per year, plus the first year money runs out and the assumptions it rests on. A projection, not a promise. detail=full adds every account balance and each year's breakdown rows (long: may be cut).",
    properties: {
      plan_id: { type: 'string', description: 'A plan id from long_term_plans' },
      detail: { type: 'string', enum: ['summary', 'full'], description: 'Default summary' },
    },
    required: ['plan_id'],
    path: (a) =>
      `/forecast/long-term/plans/${seg(a.plan_id)}/result?view=${a.detail === 'full' ? 'full' : 'summary'}`,
  },
  {
    name: 'long_term_simulation',
    description:
      'A Monte Carlo run of a long-term plan: the chance of success (never running out of money and ending above zero) and, for each year, the 5th, 25th, 50th, 75th and 95th percentile of net worth in future dollars. Returns are random but seeded, so the same seed gives the same answer. Volatility is an assumption.',
    properties: {
      plan_id: { type: 'string', description: 'A plan id from long_term_plans' },
      paths: { type: 'integer', minimum: 100, maximum: 2000, description: 'Default 1000' },
      seed: { type: 'integer', minimum: 0, maximum: 2147483647, description: 'Default 1' },
    },
    required: ['plan_id'],
    path: (a) =>
      `/forecast/long-term/plans/${seg(a.plan_id)}/simulation${query(a, ['paths', 'seed'])}`,
  },
  {
    name: 'long_term_compare',
    description:
      'Two long-term plans side by side: paired key figures, the difference in money and as a percent of the reference plan, and a net worth line for each.',
    properties: {
      plan_id: { type: 'string', description: 'The active plan' },
      reference_id: { type: 'string', description: 'The plan compared against' },
    },
    required: ['plan_id', 'reference_id'],
    path: (a) =>
      `/forecast/long-term/plans/${seg(a.plan_id)}/compare?reference=${seg(a.reference_id)}`,
  },
];

const budgetType = {
  type: ['string', 'null'],
  enum: ['fixed', 'flexible', 'non_monthly', 'savings', null],
};
const noId = ({ id: _id, ...rest }: Args) => rest;
/** Tools that create and edit categories, offered only to a categorise token */
const CATEGORY_TOOLS: (Tool & { write: { method: 'POST' | 'PUT'; body: (a: Args) => unknown } })[] =
  [
    {
      name: 'create_category',
      description: 'Creates a category in a group (group ids from list_categories).',
      properties: {
        groupId: { type: 'string', minLength: 1, maxLength: 64 },
        name: { type: 'string', minLength: 1, maxLength: 200 },
        icon: { type: 'string', maxLength: 32 },
        budgetType,
      },
      required: ['groupId', 'name'],
      path: () => '/categories',
      write: { method: 'POST', body: (a) => a },
    },
    {
      name: 'update_category',
      description:
        "Renames a category, moves it to another group, or changes its icon or budget type. Its transactions keep it. Categories can't be deleted or reordered here.",
      properties: {
        id: { type: 'string', minLength: 1, maxLength: 64 },
        groupId: { type: 'string', minLength: 1, maxLength: 64 },
        name: { type: 'string', minLength: 1, maxLength: 200 },
        icon: { type: 'string', maxLength: 32 },
        budgetType,
      },
      required: ['id'],
      path: (a) => `/categories/${seg(a.id)}`,
      write: { method: 'PUT', body: noId },
    },
    {
      name: 'hide_category',
      description:
        "Hides a category (hidden true) from pickers and the budget while it holds no money, or shows it again. Its transactions and history stay; it isn't deleted.",
      properties: {
        id: { type: 'string', minLength: 1, maxLength: 64 },
        hidden: { type: 'boolean' },
      },
      required: ['id', 'hidden'],
      path: (a) => `/categories/${seg(a.id)}`,
      write: { method: 'PUT', body: (a) => ({ hidden: a.hidden ? 1 : 0 }) },
    },
    {
      name: 'create_category_group',
      description: 'Creates a category group; isIncome is 1 for an income group, otherwise 0.',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        isIncome: { type: 'integer', minimum: 0, maximum: 1 },
      },
      required: ['name', 'isIncome'],
      path: () => '/categories/groups',
      write: { method: 'POST', body: (a) => a },
    },
    {
      name: 'rename_category_group',
      description: 'Renames a category group.',
      properties: {
        id: { type: 'string', minLength: 1, maxLength: 64 },
        name: { type: 'string', minLength: 1, maxLength: 200 },
      },
      required: ['id', 'name'],
      path: (a) => `/categories/groups/${seg(a.id)}`,
      write: { method: 'PUT', body: noId },
    },
  ];

/** Most transactions one categorise call changes */
const MAX_CATEGORISE = 100;
/** Most transactions categorise_by_payee or apply_rule changes in one call */
const MAX_BULK = 1000;

interface Context {
  req: Request;
  tokenId?: string;
}
/** A tool that runs its own steps, each one a request made with the caller's token */
interface ActionTool {
  name: string;
  description: string;
  properties: Record<string, unknown>;
  required?: string[];
  /** The narrowest scope it is listed for: categorise (and organise), or organise only */
  scope: 'categorise' | 'organise';
  idempotent?: boolean;
  run: (ctx: Context, args: Args) => Promise<Record<string, unknown>>;
}

const idString = { type: 'string', minLength: 1, maxLength: 64 };
const isId = (v: unknown): v is string => typeof v === 'string' && !!v && v.length <= 64;

/** A JSON request to this server's API as the caller; `error` is the API's message */
async function api(ctx: Context, path: string, method = 'GET', body?: unknown) {
  const { status, text } = await callApi(ctx.req, path, method, body);
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (status < 400) return { ok: true as const, status, data };
  const message =
    data && typeof data === 'object' && 'error' in data
      ? typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : JSON.stringify((data as { error: unknown }).error)
      : `Refused (${status})`;
  return { ok: false as const, status, error: message };
}

/** Sets one category on each transaction in turn; each result says what it was before */
async function setCategories(ctx: Context, ids: string[], categoryId: string) {
  const before = new Map<string, string | null>();
  for (let i = 0; i < ids.length; i += 500) {
    for (const t of db
      .select({ id: transactions.id, categoryId: transactions.categoryId })
      .from(transactions)
      .where(inArray(transactions.id, ids.slice(i, i + 500)))
      .all())
      before.set(t.id, t.categoryId);
  }
  const results = [];
  for (const id of ids) {
    if (!before.has(id)) {
      results.push({ id, ok: false, error: 'Not found' });
      continue;
    }
    const r = await api(ctx, `/transactions/${seg(id)}`, 'PUT', { categoryId });
    results.push({
      id,
      ok: r.ok,
      previousCategoryId: before.get(id) ?? null,
      error: r.ok ? undefined : r.error,
    });
  }
  return results;
}

/** Saves the changed rows as one change set and answers with its id and counts */
function outcome(
  ctx: Context,
  tool: string,
  summary: string,
  categoryId: string,
  results: { id: string; ok: boolean; previousCategoryId?: string | null; error?: string }[],
) {
  const entries: ChangeEntry[] = results
    .filter((r) => r.ok)
    .map((r) => ({
      transactionId: r.id,
      previousCategoryId: r.previousCategoryId ?? null,
      newCategoryId: categoryId,
    }));
  const changeSetId = recordChangeSet(ctx.tokenId, tool, summary, entries);
  const changed = entries.length;
  return { changed, refused: results.length - changed, changeSetId, results };
}

const conditionsHelp =
  'Conditions: [{field, op, value}]. Text fields payee_name, imported_payee, notes with is, is_not, contains, not_contains, starts_with, ends_with, regex (or one_of / not_one_of with a list); id fields payee, account, category with is, is_not, one_of, not_one_of; is_empty / is_not_empty (no value); amount (positive minor units) with is, is_not, gt, gte, lt, lte, approx or between [min, max]; direction is inflow or outflow; date is, before, after or between.';
const actionsHelp =
  'Actions: [{type: "set_category", value: categoryId}], or set_payee (payee id), set_notes / prepend_notes / append_notes (text), add_tag (tag id), share_with_household (household id: shares money out with its default split), split {type: "split", parts: [{kind: fixed|percent|remainder, value, categoryId, notes}]}. Only a rule whose actions all set a category can be applied with apply_rule.';
const ruleProps = {
  conditionsOp: { type: 'string', enum: ['and', 'or'], description: 'and = all, or = any' },
  conditions: {
    type: 'array',
    items: { type: 'object' },
    maxItems: 50,
    description: conditionsHelp,
  },
  actions: {
    type: 'array',
    items: { type: 'object' },
    minItems: 1,
    maxItems: 50,
    description: actionsHelp,
  },
};

const ACTION_TOOLS: ActionTool[] = [
  {
    name: 'categorise_transactions',
    scope: 'categorise',
    idempotent: true,
    description: `Sets the category of past transactions (dated today or earlier), up to ${MAX_CATEGORISE} at once. Nothing else changes, and a category can't be cleared. The app's rules still apply: reconciled rows, split transactions (categorise their parts), transfers inside the budget and payment envelopes are refused. Returns each transaction's previous category and a changeSetId that undo_change_set puts back.`,
    properties: {
      transaction_ids: { type: 'array', items: idString, minItems: 1, maxItems: MAX_CATEGORISE },
      category_id: { ...idString, description: 'From list_categories' },
    },
    required: ['transaction_ids', 'category_id'],
    run: async (ctx, a) => {
      const ids = a.transaction_ids;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > MAX_CATEGORISE ||
        !ids.every(isId) ||
        new Set(ids).size !== ids.length ||
        !isId(a.category_id)
      ) {
        return {
          error: `Give 1 to ${MAX_CATEGORISE} distinct transaction ids and one category id`,
        };
      }
      const results = await setCategories(ctx, ids, a.category_id);
      return outcome(
        ctx,
        'categorise_transactions',
        `${ids.length} transactions`,
        a.category_id,
        results,
      );
    },
  },
  {
    name: 'categorise_by_payee',
    scope: 'categorise',
    idempotent: true,
    description: `Sets one category on a payee's uncategorised past transactions (transfers and split parents aside), up to ${MAX_BULK} per call, optionally within dates. With an organise token, set_default also makes it the payee's default category, so future imports get it. Returns a changeSetId for undo_change_set.`,
    properties: {
      payee_id: { ...idString, description: 'From list_payees or uncategorised_payees' },
      category_id: { ...idString, description: 'From list_categories' },
      from: { ...day, description: 'First day, inclusive' },
      to: { ...day, description: 'Last day, inclusive (at most today)' },
      direction: { type: 'string', enum: ['debit', 'credit'], description: 'Only money out or in' },
      set_default: { type: 'boolean', description: 'Organise tokens: also set the payee default' },
    },
    required: ['payee_id', 'category_id'],
    run: async (ctx, a) => {
      if (!isId(a.payee_id) || !isId(a.category_id))
        return { error: 'Give a payee id and a category id' };
      const today = todayIso();
      const to = typeof a.to === 'string' && a.to < today ? a.to : today;
      const found = await api(
        ctx,
        `/transactions${query(
          {
            payee_ids: a.payee_id,
            uncategorized: '1',
            transfers: 'exclude',
            from: a.from,
            to,
            direction: a.direction,
            limit: MAX_BULK,
          },
          ['payee_ids', 'uncategorized', 'transfers', 'from', 'to', 'direction', 'limit'],
        )}`,
      );
      if (!found.ok) return { error: found.error };
      const rows = (
        found.data as {
          id: string;
          isParent: number;
          transferTransactionId: string | null;
          categoryId: string | null;
        }[]
      ).filter((t) => !t.isParent && !t.transferTransactionId && !t.categoryId);
      let defaultSet: boolean | string | undefined;
      if (a.set_default === true) {
        const r = await api(ctx, `/payees/${seg(a.payee_id)}`, 'PUT', {
          defaultCategoryId: a.category_id,
        });
        defaultSet = r.ok ? true : r.error;
      }
      const results = await setCategories(
        ctx,
        rows.map((t) => t.id),
        a.category_id,
      );
      return {
        ...outcome(ctx, 'categorise_by_payee', `Payee ${a.payee_id}`, a.category_id, results),
        ...(defaultSet === undefined ? {} : { defaultSet }),
        more: rows.length === MAX_BULK ? 'More remain: call again' : undefined,
      };
    },
  },
  {
    name: 'undo_change_set',
    scope: 'categorise',
    description:
      "Puts back the categories a change set replaced (from list_change_sets or a tool's changeSetId). A transaction edited since, or reconciled, keeps its current category.",
    properties: { change_set_id: idString },
    required: ['change_set_id'],
    run: async (ctx, a) => {
      if (!isId(a.change_set_id)) return { error: 'Give a change set id' };
      const r = await api(ctx, `/change-sets/${seg(a.change_set_id)}/undo`, 'POST', {});
      return r.ok ? (r.data as Record<string, unknown>) : { error: r.error };
    },
  },
  {
    name: 'test_rule_conditions',
    scope: 'organise',
    description: `Dry run: how many existing transactions a set of rule conditions matches, and the latest 20. Changes nothing. ${conditionsHelp}`,
    properties: { conditionsOp: ruleProps.conditionsOp, conditions: ruleProps.conditions },
    required: ['conditions'],
    run: async (ctx, a) => {
      const r = await api(ctx, '/rules/test', 'POST', {
        conditionsOp: a.conditionsOp ?? 'and',
        conditions: a.conditions,
      });
      return r.ok ? (r.data as Record<string, unknown>) : { error: r.error };
    },
  },
  {
    name: 'propose_rule',
    scope: 'organise',
    description:
      'Proposes a categorisation rule. It is saved disabled, marked as proposed by this token, and runs only once the owner enables it in Rules. Test the conditions first.',
    properties: ruleProps,
    required: ['conditions', 'actions'],
    run: async (ctx, a) => {
      const r = await api(ctx, '/rules', 'POST', {
        conditionsOp: a.conditionsOp ?? 'and',
        conditions: a.conditions,
        actions: a.actions,
        enabled: false,
      });
      return r.ok ? { rule: r.data } : { error: r.error };
    },
  },
  {
    name: 'update_proposed_rule',
    scope: 'organise',
    description:
      "Edits a rule that is still disabled (not yet accepted by the owner): its conditions, any/all or actions. Enabled rules, enabling, reordering and deleting are the owner's.",
    properties: { rule_id: idString, ...ruleProps },
    required: ['rule_id'],
    run: async (ctx, a) => {
      if (!isId(a.rule_id)) return { error: 'Give a rule id' };
      const body = Object.fromEntries(
        (['conditionsOp', 'conditions', 'actions'] as const)
          .filter((k) => a[k] !== undefined)
          .map((k) => [k, a[k]]),
      );
      const r = await api(ctx, `/rules/${seg(a.rule_id)}`, 'PUT', body);
      return r.ok ? { rule: r.data } : { error: r.error };
    },
  },
  {
    name: 'preview_rule',
    scope: 'organise',
    description:
      'Dry run of one existing rule (enabled or not) over transactions: each change it would make. scope uncategorized (default) or all. Changes nothing.',
    properties: { rule_id: idString, scope: { type: 'string', enum: ['uncategorized', 'all'] } },
    required: ['rule_id'],
    run: async (ctx, a) => {
      if (!isId(a.rule_id)) return { error: 'Give a rule id' };
      const r = await api(ctx, '/rules/preview', 'POST', {
        ruleIds: [a.rule_id],
        scope: a.scope === 'all' ? 'all' : 'uncategorized',
      });
      return r.ok ? { changes: r.data } : { error: r.error };
    },
  },
  {
    name: 'apply_rule',
    scope: 'organise',
    description: `Runs one rule whose actions only set a category on uncategorised past transactions it matches (up to ${MAX_BULK}), even before the owner enables it. Returns a changeSetId for undo_change_set.`,
    properties: { rule_id: idString },
    required: ['rule_id'],
    run: async (ctx, a) => {
      if (!isId(a.rule_id)) return { error: 'Give a rule id' };
      const plan = await api(ctx, '/rules/preview', 'POST', {
        ruleIds: [a.rule_id],
        scope: 'uncategorized',
      });
      if (!plan.ok) return { error: plan.error };
      const today = todayIso();
      const changes = (
        plan.data as {
          transactionId: string;
          date: string;
          changes: { category?: { to: string | null }; split?: unknown };
        }[]
      )
        .filter((p) => p.date <= today && !p.changes.split && p.changes.category?.to)
        .slice(0, MAX_BULK);
      if (!changes.length) return { changed: 0, changeSetId: null };
      const applied = await api(ctx, '/rules/apply', 'POST', {
        ruleIds: [a.rule_id],
        scope: 'uncategorized',
        transactionIds: changes.map((c) => c.transactionId),
      });
      if (!applied.ok) return { error: applied.error };
      // A rule can give different matches different categories only through splits, excluded above
      const byCategory = new Map<string, string[]>();
      for (const c of changes) {
        const to = c.changes.category!.to!;
        byCategory.set(to, [...(byCategory.get(to) ?? []), c.transactionId]);
      }
      const entries: ChangeEntry[] = [...byCategory].flatMap(([cat, ids]) =>
        ids.map((id) => ({ transactionId: id, previousCategoryId: null, newCategoryId: cat })),
      );
      const changeSetId = recordChangeSet(ctx.tokenId, 'apply_rule', `Rule ${a.rule_id}`, entries);
      return { changed: (applied.data as { updated: number }).updated, changeSetId };
    },
  },
  {
    name: 'set_payee_default_category',
    scope: 'organise',
    description:
      "Sets (or with null clears) a payee's default category: new transactions from this payee get it when no rule sets one. Existing transactions don't change.",
    properties: { payee_id: idString, category_id: { type: ['string', 'null'], maxLength: 64 } },
    required: ['payee_id', 'category_id'],
    run: async (ctx, a) => {
      if (!isId(a.payee_id) || !(a.category_id === null || isId(a.category_id)))
        return { error: 'Give a payee id and a category id or null' };
      const r = await api(ctx, `/payees/${seg(a.payee_id)}`, 'PUT', {
        defaultCategoryId: a.category_id,
      });
      return r.ok ? { payee: r.data } : { error: r.error };
    },
  },
  {
    name: 'propose_assignments',
    scope: 'organise',
    description:
      'Suggests amounts to add to expense envelopes for this month or next, from money ready to assign today (budget_summary). Nothing is assigned: the owner reviews the suggestion on the Budget page and applies or dismisses it. Give a short reason per row.',
    properties: {
      month,
      note: { type: 'string', maxLength: 1000, description: 'Shown to the owner' },
      rows: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: {
          type: 'object',
          properties: {
            categoryId: idString,
            amount: { type: 'integer', minimum: 1, description: 'Minor units to add' },
            reason: { type: 'string', maxLength: 300 },
          },
          required: ['categoryId', 'amount'],
          additionalProperties: false,
        },
      },
    },
    required: ['month', 'rows'],
    run: async (ctx, a) => {
      const r = await api(ctx, '/budget-proposals', 'POST', {
        month: a.month,
        note: a.note,
        rows: a.rows,
      });
      return r.ok ? { proposal: r.data } : { error: r.error };
    },
  },
  {
    name: 'link_transfer',
    scope: 'organise',
    description:
      'Links a pair from transfer_suggestions as one transfer between your accounts. Only pairs the server suggests can be linked. Confirm each pair with the user first.',
    properties: { transaction_id: idString, other_transaction_id: idString },
    required: ['transaction_id', 'other_transaction_id'],
    run: async (ctx, a) => {
      if (!isId(a.transaction_id) || !isId(a.other_transaction_id))
        return { error: 'Give two transaction ids' };
      const r = await api(ctx, '/transactions/transfers/link', 'POST', {
        transactionId: a.transaction_id,
        otherTransactionId: a.other_transaction_id,
      });
      return r.ok ? { linked: true } : { error: r.error };
    },
  },
];

const offered = (scope: TokenScope, tool: ActionTool) =>
  tool.scope === 'organise' ? scope === 'organise' : canCategorise(scope);

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/** One request to this server's API, as the caller (same token, same checks) */
async function callApi(req: Request, path: string, method = 'GET', body?: unknown) {
  const apiRoot = req.baseUrl.replace(/\/mcp$/, '');
  const res = await fetch(`http://127.0.0.1:${req.socket.localPort}${apiRoot}${path}`, {
    method,
    headers: {
      authorization: req.headers.authorization ?? '',
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

const TITLES: Record<TokenScope, string> = {
  read: 'FlyBudget (read-only)',
  categorise: 'FlyBudget (read and categorise)',
  organise: 'FlyBudget (read, categorise and organise)',
};
const BASICS =
  'Amounts are integer minor units (cents); a negative transaction amount is money out. Use list_* tools for ids, then filter transactions and reports with them. Money received in budget accounts is ready to assign to envelopes; income categories only label it for reports. Household pool accounts sit outside the personal budget. Envelopes count from budget_start; earlier history is only in reports. find_transactions pages with limit and offset, and fields keeps results short.';
const INSTRUCTIONS: Record<TokenScope, string> = {
  read: `Read-only access to a FlyBudget budget. ${BASICS}`,
  categorise: `Read access to a FlyBudget budget, plus setting the category of past transactions (categorise_transactions, categorise_by_payee) and creating and editing categories and groups; nothing else can change. ${BASICS} Start from uncategorised_payees. Every category change returns a changeSetId that undo_change_set reverses. Confirm a plan with the user before categorising.`,
  organise: `Read access to a FlyBudget budget, plus categorising, editing categories, proposing rules (saved disabled until the owner enables them), applying a category-only rule to uncategorised transactions, payee default categories, linking suggested transfers and suggesting assignments the owner applies. ${BASICS} Start from uncategorised_payees; test rule conditions before proposing a rule. Every category change returns a changeSetId that undo_change_set reverses. Confirm a plan with the user before changing anything.`,
};

const schemaOf = (t: { properties?: Record<string, unknown>; required?: string[] }) => ({
  type: 'object',
  properties: t.properties ?? {},
  ...(t.required ? { required: t.required } : {}),
  additionalProperties: false,
});

async function handle(ctx: Context, scope: TokenScope, message: Record<string, unknown>) {
  const { id, method, params } = message as { id?: unknown; method?: string; params?: Args };
  const isNotification = id === undefined;
  const categoryTools = canCategorise(scope) ? CATEGORY_TOOLS : [];
  const actionTools = ACTION_TOOLS.filter((t) => offered(scope, t));
  switch (method) {
    case 'initialize': {
      const asked = (params?.protocolVersion as string) ?? '';
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'flybudget', title: TITLES[scope], version: appVersion },
        instructions: INSTRUCTIONS[scope],
      });
    }
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, {
        tools: [
          ...TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: schemaOf(t),
            annotations: { readOnlyHint: true, openWorldHint: false },
          })),
          ...categoryTools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: schemaOf(t),
            annotations: {
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: t.write.method === 'PUT',
              openWorldHint: false,
            },
          })),
          ...actionTools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: schemaOf(t),
            annotations: {
              readOnlyHint: t.name.startsWith('test_') || t.name.startsWith('preview_'),
              destructiveHint: false,
              idempotentHint: !!t.idempotent,
              openWorldHint: false,
            },
          })),
        ],
      });
    case 'tools/call': {
      const tool = [...TOOLS, ...categoryTools, ...actionTools].find(
        (t) => t.name === params?.name,
      );
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${String(params?.name)}`);
      const args = (params?.arguments ?? {}) as Args;
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        return rpcError(id, -32602, 'Arguments must be an object');
      }
      const unknown = Object.keys(args).filter((k) => !(k in (tool.properties ?? {})));
      if (unknown.length) return rpcError(id, -32602, `Unknown arguments: ${unknown.join(', ')}`);
      const missing = (tool.required ?? []).filter((k) => args[k] === undefined);
      if (missing.length) return rpcError(id, -32602, `Missing arguments: ${missing.join(', ')}`);
      if ('run' in tool) {
        const result = await tool.run(ctx, args);
        return rpcResult(id, {
          content: [{ type: 'text', text: cut(JSON.stringify(result)) }],
          isError: 'error' in result,
        });
      }
      const write =
        'write' in tool ? (tool.write as (typeof CATEGORY_TOOLS)[number]['write']) : null;
      const { status, text } = write
        ? await callApi(ctx.req, tool.path(args), write.method, write.body(args))
        : await callApi(ctx.req, tool.path(args));
      const shaped =
        status < 400 && 'transform' in tool && tool.transform ? tool.transform(text, args) : text;
      return rpcResult(id, {
        content: [{ type: 'text', text: cut(shaped) }],
        isError: status >= 400,
      });
    }
    default:
      if (isNotification) return null; // e.g. notifications/initialized: nothing to answer
      return rpcError(id, -32601, `Method not found: ${String(method)}`);
  }
}

/** A result cut to MAX_RESULT_CHARS, with a note to narrow the request */
const cut = (text: string) =>
  text.length > MAX_RESULT_CHARS
    ? `${text.slice(0, MAX_RESULT_CHARS)}\n… cut at ${MAX_RESULT_CHARS} characters; narrow the request (dates, filters, limit and offset, or fields).`
    : text;

/** Messages in one JSON-RPC batch: each tool call is a request to this server */
const MAX_BATCH = 20;

// An assistant may call tools in quick succession, but not without limit
mcpRouter.use(
  rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }),
);

mcpRouter.post('/', async (req, res, next) => {
  // Only for access tokens: each tool call is made with the caller's token
  if (!res.locals.accessTokenId) {
    return void res
      .status(401)
      .json(rpcError(null, -32001, 'A read-only access token is required'));
  }
  const scope = asScope(res.locals.accessTokenScope);
  const ctx: Context = { req, tokenId: res.locals.accessTokenId as string };
  try {
    const body = req.body as unknown;
    const batch = Array.isArray(body);
    const messages = (batch ? body : [body]) as unknown[];
    if (!messages.length || messages.some((m) => !m || typeof m !== 'object')) {
      return res.status(400).json(rpcError(null, -32600, 'Invalid request'));
    }
    if (messages.length > MAX_BATCH) {
      return res
        .status(400)
        .json(rpcError(null, -32600, `At most ${MAX_BATCH} messages in one batch`));
    }
    const replies = (
      await Promise.all(messages.map((m) => handle(ctx, scope, m as Record<string, unknown>)))
    ).filter((r) => r !== null);
    if (!replies.length) return res.status(202).end();
    res.json(batch ? replies : replies[0]);
  } catch (error) {
    next(error);
  }
});

// Streamable HTTP's optional server-to-client stream isn't offered: this server only answers
mcpRouter.get('/', (_req, res) => res.status(405).set('Allow', 'POST').end());
