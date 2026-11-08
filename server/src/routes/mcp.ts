import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { eq, inArray } from 'drizzle-orm';
import { appVersion } from '../utils/version.js';
import { db } from '../db/index.js';
import { taxClaims, transactions } from '../db/schema.js';
import { asScope, canCategorise, type TokenScope } from '../auth/accessTokens.js';
import { ASSISTANT_TOOL_HEADER } from './auth.js';
import { recordChangeSet, type ChangeEntry } from '../services/changeSets.js';
import { todayIso } from '../services/mainAmountService.js';
import { TAX_LABEL_KEYS, TAX_LABELS } from '../services/taxService.js';
import { MAX_PROPOSAL_ITEMS } from '../services/assistantActions.js';

// An MCP server (Model Context Protocol, Streamable HTTP with JSON responses) so an AI
// assistant can read the budget with an access token (docs/READ-ONLY-ACCESS.md). Every read
// tool is one GET of this server's own API, made over loopback with the caller's token, so a
// tool can never reach more than the token itself: the same allowlist, validation and
// accounting as the app. Writing tools are listed only for a token whose scope allows them
// (categorise: categories; organise: also rules, payee defaults, suggested transfers, tax
// deduction claims and household contributions linked to a deposit) and
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
      'Money available to assign, reserved, overspent, uncategorised and card payment position for a month. accountIssues lists known bank or closed-account discrepancies; available is zero until they are reconciled. Raw unassigned is unverified while issues remain.',
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
      "Uncategorised transactions grouped by payee (transfers and split parents aside): count, money in and out, net, first and last date, accounts and sample notes. Each group has a scope: personal (the owner's budget, listed first, most frequent first), household (rows in a household account, which never touch the personal budget; household names it) or off_budget. housemate is set when the owner already recorded that payee as a housemate's money (a contribution, or a repayment to the owner): that money is never the owner's income, so never give it an Income category; ask the owner. The worklist for categorising; then use categorise_by_payee or find_transactions.",
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
      'Pairs of existing transactions that look like one transfer between two of your accounts (the same amount out and in within a few days) but are not linked. Linked, they stop counting as spending and income. reported: true when Up named the other account (a row from Up pairs only with a row in that account).',
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
      "Setup problems that make the budget less useful: no budget start with years of history (suggestion = a month to start from), Up accounts missing round-up debits, uncategorised movements to or from savers that aren't in Allotment (grouped by saver, with ids), how many categories were never used, and active recurring bills with no category (uncategorisedRecurring), which no envelope expects and no payday plan funds: the owner sets their category in Recurring.",
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
      "A household's gross spending and your personal share for a date range, by month, person and category, with balances and events.",
    properties: {
      household_id: { type: 'string', description: 'From list_households' },
      from: { ...day, description: 'First day, inclusive' },
      to: { ...day, description: 'Last day, inclusive' },
    },
    required: ['household_id'],
    path: (a) => `/households/${seg(a.household_id)}/statement${query(a, ['from', 'to'])}`,
  },
  {
    name: 'household_reconciliation_preview',
    description:
      "Where each person's household balance comes from and what agreeing it at 0 would change: each person's balance now (before) and after, the adjustments to their part with the household account (poolShares) and to what people owe each other directly (directShares, adding up to 0), and the ledger's household-account total before and after. Read household_statement for the entries behind the figures. To agree the balances, use propose_household_reconciliation.",
    properties: { household_id: { type: 'string', description: 'From list_households' } },
    required: ['household_id'],
    path: (a) => `/households/${seg(a.household_id)}/reconcile`,
  },
  {
    name: 'household_contribution_suggestions',
    description:
      "Money received in the last 120 days that looks like someone paying the household: deposits into its accounts not linked yet (contribution: the person's name in the payee, or a transfer from one of your own accounts) and repayments into your accounts (settlement), each with what that person owes. A transfer back from a shared saver outside the household is offered as yours: check whose money it is.",
    properties: { household_id: { type: 'string', description: 'From list_households' } },
    required: ['household_id'],
    path: (a) => `/households/${seg(a.household_id)}/repayment-suggestions`,
  },
  {
    name: 'household_bill_reconciliation',
    description:
      "One shared recurring bill (such as rent) person by person: each person's share of its payments shared with the household, the deposit into a household account matched to each payment (by name, date and amount), the difference, deposits already recorded, and toRecord: matched deposits not recorded yet, ready for record_household_contributions. Payments funded another way show as unmatched; for your own share, record_own_household_contribution records it.",
    properties: {
      household_id: { type: 'string', description: 'From list_households' },
      schedule_id: { type: 'string', description: "From household's recurringBills" },
      from: { ...day, description: 'First payment day, inclusive' },
      to: { ...day, description: 'Last payment day, inclusive' },
    },
    required: ['household_id', 'schedule_id'],
    path: (a) =>
      `/households/${seg(a.household_id)}/recurring-bills/${seg(a.schedule_id)}/reconciliation${query(a, ['from', 'to'])}`,
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
/** Most transactions one claim_tax_deductions call claims */
const MAX_CLAIMS = 100;
const labelHelp = TAX_LABEL_KEYS.map((k) => `${k} ${TAX_LABELS[k].name}`).join('; ');
/** Most contributions one record_household_contributions call records */
const MAX_CONTRIBUTIONS = 50;
/** Most transactions categorise_by_payee or apply_rule changes in one call */
const MAX_BULK = 1000;

interface Context {
  req: Request;
  tokenId?: string;
  /** The tool being called, named in the assistant log */
  tool?: string;
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
  /** Changes nothing (a read only some scopes may make) */
  readOnly?: boolean;
  run: (ctx: Context, args: Args) => Promise<Record<string, unknown>>;
}

const idString = { type: 'string', minLength: 1, maxLength: 64 };
const isId = (v: unknown): v is string => typeof v === 'string' && !!v && v.length <= 64;

/** A JSON request to this server's API as the caller; `error` is the API's message */
async function api(ctx: Context, path: string, method = 'GET', body?: unknown) {
  const { status, text } = await callApi(ctx.req, path, method, body, ctx.tool);
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

/** Files a proposal for the owner (services/assistantActions.ts); nothing changes until applied */
async function propose(ctx: Context, body: Record<string, unknown>) {
  const r = await api(ctx, '/assistant/proposals', 'POST', body);
  return r.ok
    ? {
        proposed: r.data,
        next: 'Nothing has changed yet: the owner applies or declines it in Allotment (Settings → Server → Access tokens → Waiting for you).',
      }
    : { error: r.error };
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
  'Actions: [{type: "set_category", value: categoryId}], or set_payee (payee id), set_notes / prepend_notes / append_notes (text), add_tag (tag id), share_with_household (household id: shares money out with its default split), claim_tax_deduction (a tax return label D1–D10 or D15: claims money out as a deduction, never replacing a claim), split {type: "split", parts: [{kind: fixed|percent|remainder, value, categoryId, notes}]}. Only a rule whose actions all set a category can be applied with apply_rule.';
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
  {
    name: 'tax_deductions',
    scope: 'organise',
    readOnly: true,
    description:
      'The tax deductions claimed for one Australian financial year (1 July to 30 June), named by the year it starts (2025 = 2025–26): each claim with its label, work-use share, cost and claimed amount, totals per label, receipts still missing, and capital gains from investment sales (capitalGains: item 18, read only). Record keeping, not tax advice.',
    properties: {
      financial_year: {
        type: 'integer',
        minimum: 1990,
        maximum: 2200,
        description: '2025 = 1 July 2025 to 30 June 2026',
      },
    },
    required: ['financial_year'],
    run: async (ctx, a) => {
      if (!Number.isInteger(a.financial_year)) return { error: 'Give a financial year, e.g. 2025' };
      const r = await api(ctx, `/tax/years/${seg(a.financial_year)}`);
      return r.ok ? { year: r.data } : { error: r.error };
    },
  },
  {
    name: 'claim_tax_deductions',
    scope: 'organise',
    description: `Claims past transactions (money out, dated today or earlier) as tax deductions under one return label, with a work-use share, up to ${MAX_CLAIMS} at once. Claims never change a transaction or the budget. A transaction that already has a claim is skipped: only the owner replaces or removes claims. Split transactions are claimed by their parts; transfers can't be claimed. Labels: ${labelHelp}. What is deductible is the owner's call: confirm the list, label and share with the user first.`,
    properties: {
      transaction_ids: { type: 'array', items: idString, minItems: 1, maxItems: MAX_CLAIMS },
      label: { type: 'string', enum: TAX_LABEL_KEYS },
      work_use_percent: {
        type: 'number',
        minimum: 0.01,
        maximum: 100,
        description: 'Share of each cost used for work; default 100',
      },
      notes: {
        type: 'string',
        maxLength: 2000,
        description: 'Kept with each claim, e.g. how the share was worked out',
      },
    },
    required: ['transaction_ids', 'label'],
    run: async (ctx, a) => {
      const ids = a.transaction_ids;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > MAX_CLAIMS ||
        !ids.every(isId) ||
        new Set(ids).size !== ids.length
      ) {
        return { error: `Give 1 to ${MAX_CLAIMS} distinct transaction ids` };
      }
      if (!TAX_LABEL_KEYS.includes(a.label as (typeof TAX_LABEL_KEYS)[number]))
        return { error: `Unknown label; one of ${TAX_LABEL_KEYS.join(', ')}` };
      const percent = a.work_use_percent ?? 100;
      const workUseBps = typeof percent === 'number' ? Math.round(percent * 100) : NaN;
      if (!Number.isInteger(workUseBps) || workUseBps < 1 || workUseBps > 10_000)
        return { error: 'work_use_percent must be between 0.01 and 100' };
      if (a.notes !== undefined && typeof a.notes !== 'string')
        return { error: 'notes must be text' };
      const rows = new Map(
        db
          .select({ id: transactions.id, date: transactions.date, amount: transactions.amount })
          .from(transactions)
          .where(inArray(transactions.id, ids))
          .all()
          .map((t) => [t.id, t]),
      );
      const claimed = new Set(
        db
          .select({ id: taxClaims.transactionId })
          .from(taxClaims)
          .where(inArray(taxClaims.transactionId, ids))
          .all()
          .map((c) => c.id),
      );
      const today = todayIso();
      const results = [];
      for (const id of ids) {
        const row = rows.get(id);
        const refusal = !row
          ? 'Not found'
          : claimed.has(id)
            ? 'Already claimed; only the owner changes a claim'
            : row.date > today
              ? 'Dated in the future'
              : row.amount >= 0
                ? 'Not money out'
                : null;
        if (refusal) {
          results.push({ id, ok: false, error: refusal });
          continue;
        }
        const r = await api(ctx, `/tax/claims/${seg(id)}`, 'PUT', {
          label: a.label,
          workUseBps,
          ...(a.notes ? { notes: a.notes } : {}),
        });
        results.push({ id, ok: r.ok, error: r.ok ? undefined : r.error });
      }
      const done = results.filter((r) => r.ok).length;
      return { claimed: done, refused: results.length - done, results };
    },
  },
  {
    name: 'tax_years',
    scope: 'organise',
    readOnly: true,
    description:
      'Financial years that have tax deduction claims, and the current one, newest first (2025 = 2025–26), with the return labels claims can use.',
    properties: {},
    run: async (ctx) => {
      const [years, labels] = await Promise.all([api(ctx, '/tax/years'), api(ctx, '/tax/labels')]);
      if (!years.ok) return { error: years.error };
      return { years: years.data, labels: labels.ok ? labels.data : undefined };
    },
  },
  {
    name: 'tax_assets',
    scope: 'organise',
    readOnly: true,
    description:
      'Depreciating assets on Tax time: each with its method, cost, start date, effective life, taxable-use share and year-by-year decline in value, and the low-value pool (D6) year by year (amounts in cents; financial year 2025 = 2025–26). Read only: never creates, edits, pools or disposes of an asset.',
    properties: {},
    run: async (ctx) => {
      const r = await api(ctx, '/tax/assets');
      if (!r.ok) return { error: r.error };
      const pool = await api(ctx, '/tax/pool');
      return { assets: r.data, pool: pool.ok ? pool.data : [] };
    },
  },
  {
    name: 'investments',
    scope: 'organise',
    readOnly: true,
    description:
      "Investments: each investment account's holdings with their purchases (lots, with their units today after any splits and consolidations), sales (parcels, gain or loss, whether the 50% discount applies) and income (dividends, distributions, interest with franked, unfranked, franking credit and tax withheld), valued on as_of (default today). With financial_year, also that year's capital gains (item 18) and investment income (items 10 and 11). Amounts in cents, units in millionths; financial year 2025 = 2025–26. Read only: never records, changes or links a sale or payment. Record keeping, not tax advice.",
    properties: {
      as_of: day,
      financial_year: { type: 'integer', minimum: 1990, maximum: 2200 },
    },
    run: async (ctx, a) => {
      const overview = await api(
        ctx,
        a.as_of === undefined ? '/investments' : `/investments?asOf=${seg(a.as_of)}`,
      );
      if (!overview.ok) return { error: overview.error };
      if (a.financial_year === undefined) return { investments: overview.data };
      if (!Number.isInteger(a.financial_year)) return { error: 'Give a financial year, e.g. 2025' };
      const year = await api(ctx, `/tax/years/${seg(a.financial_year)}`);
      if (!year.ok) return { error: year.error };
      const { capitalGains, investmentIncome } = year.data as {
        capitalGains: unknown;
        investmentIncome: unknown;
      };
      return { investments: overview.data, capitalGains, investmentIncome };
    },
  },
  {
    name: 'propose_tax_asset',
    scope: 'organise',
    description:
      "Propose a new depreciating asset, or a change to one (give asset_id), for the owner to apply or decline in Settings → Server → Access tokens → Waiting for you. Nothing changes until the owner applies it. Fields as tax_assets returns them: name, label (D1–D5, D15), method (prime_cost or diminishing_value), cost and openingAdjustableValue in cents, startDate (YYYY-MM-DD), effectiveLifeHundredths (3 years = 300), workUseBps (100% = 10000), purchaseDate, transactionId, replaceClaim (true to replace that purchase's outright claim), notes. A new asset needs name, label, method, cost, startDate, effectiveLifeHundredths and workUseBps.",
    properties: {
      asset_id: idString,
      asset: { type: 'object' },
      note: { type: 'string', maxLength: 1000 },
    },
    required: ['asset'],
    run: async (ctx, a) => {
      const body =
        a.asset_id === undefined
          ? { kind: 'asset.create', asset: a.asset, note: a.note }
          : { kind: 'asset.update', assetId: a.asset_id, asset: a.asset, note: a.note };
      return propose(ctx, body);
    },
  },
  {
    name: 'tax_claim',
    scope: 'organise',
    readOnly: true,
    description:
      "One transaction's tax deduction claim (label, work-use share, notes), or null when it has none.",
    properties: { transaction_id: idString },
    required: ['transaction_id'],
    run: async (ctx, a) => {
      if (!isId(a.transaction_id)) return { error: 'Give a transaction id' };
      const r = await api(ctx, `/tax/claims/${seg(a.transaction_id)}`);
      return r.ok ? { claim: r.data } : { error: r.error };
    },
  },
  {
    name: 'tax_claim_candidates',
    scope: 'organise',
    readOnly: true,
    description:
      "Past money out in one financial year with no claim yet, from a payee (basis payee) or failing that a category (basis category) that already has a claim this year or last: likely missed repeats, such as a subscription's other months. Each has the suggested label and work-use share of the latest similar claim (likeClaim). Category matches are looser: check them. Confirm with the user, then claim with claim_tax_deductions grouped by label and share. Record keeping, not tax advice.",
    properties: {
      financial_year: {
        type: 'integer',
        minimum: 1990,
        maximum: 2200,
        description: '2025 = 1 July 2025 to 30 June 2026',
      },
    },
    required: ['financial_year'],
    run: async (ctx, a) => {
      if (!Number.isInteger(a.financial_year)) return { error: 'Give a financial year, e.g. 2025' };
      const r = await api(ctx, `/tax/years/${seg(a.financial_year)}/candidates`);
      return r.ok ? (r.data as Record<string, unknown>) : { error: r.error };
    },
  },
  {
    name: 'record_own_household_contribution',
    scope: 'organise',
    description:
      "Records money you (the household's own person) put towards the household some other way, with no bank deposit to link, such as rent paid through a shared saver that isn't one of the household's accounts. Up to what you owe the household account now (its toPool), so it can bring you to zero but never into credit; never for anyone else. Say in the description how it was paid. Confirm the amount with the user first; the owner removes an entry on the Household page.",
    properties: {
      household_id: { ...idString, description: 'From list_households' },
      amount: { type: 'integer', minimum: 1, description: 'Minor units (cents)' },
      date: { ...day, description: 'When it was paid (today or earlier)' },
      description: {
        type: 'string',
        minLength: 1,
        maxLength: 200,
        description: 'How it was paid, e.g. "Rent May–Oct via shared saver (12 × $825.50)"',
      },
    },
    required: ['household_id', 'amount', 'date', 'description'],
    run: async (ctx, a) => {
      if (!isId(a.household_id)) return { error: 'Give a household id' };
      if (!Number.isInteger(a.amount) || (a.amount as number) < 1)
        return { error: 'amount must be a positive whole number of cents' };
      if (typeof a.description !== 'string' || !a.description.trim())
        return { error: 'Say how it was paid' };
      const state = await api(ctx, `/households/${seg(a.household_id)}`);
      if (!state.ok) return { error: state.error };
      const household = state.data as {
        people: { id: string; name: string; isSelf: number }[];
        toPool: Record<string, number>;
      };
      const self = household.people.find((p) => p.isSelf);
      if (!self) return { error: 'This household has no "you" person' };
      const owes = -(household.toPool[self.id] ?? 0);
      if (owes <= 0) return { error: 'You owe the household account nothing' };
      if ((a.amount as number) > owes)
        return { error: `That is more than you owe the household account (${owes} cents)` };
      const r = await api(ctx, `/households/${seg(a.household_id)}/events`, 'POST', {
        kind: 'contribution',
        date: a.date,
        description: a.description.trim(),
        amount: a.amount,
        payerId: self.id,
      });
      if (!r.ok)
        return {
          error:
            r.status === 403
              ? 'Refused: only your own contribution, dated today or earlier, up to what you owe'
              : r.error,
        };
      const after = r.data as { toPool: Record<string, number> };
      return {
        recorded: true,
        personId: self.id,
        owesHouseholdAccountNow: -(after.toPool[self.id] ?? 0),
      };
    },
  },
  {
    name: 'record_household_contributions',
    scope: 'organise',
    description: `Records money someone put into a household account as their contribution, linked to that deposit: the entry takes the deposit's exact amount and date. Up to ${MAX_CONTRIBUTIONS} at once, e.g. the toRecord list of household_bill_reconciliation. Only past deposits into that household's own accounts, not linked yet; never expenses, settlements, unlinked amounts, edits or removals (the owner removes an entry on the Household page). Confirm the list with the user first.`,
    properties: {
      household_id: { ...idString, description: 'From list_households' },
      contributions: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_CONTRIBUTIONS,
        items: {
          type: 'object',
          properties: {
            transaction_id: { ...idString, description: 'The deposit' },
            person_id: { ...idString, description: 'Who paid it, from household people' },
            description: { type: 'string', minLength: 1, maxLength: 200 },
          },
          required: ['transaction_id', 'person_id'],
          additionalProperties: false,
        },
      },
    },
    required: ['household_id', 'contributions'],
    run: async (ctx, a) => {
      const rows = a.contributions;
      if (
        !isId(a.household_id) ||
        !Array.isArray(rows) ||
        !rows.length ||
        rows.length > MAX_CONTRIBUTIONS
      )
        return { error: `Give a household id and 1 to ${MAX_CONTRIBUTIONS} contributions` };
      const results = [];
      for (const row of rows as Args[]) {
        const id = row?.transaction_id;
        if (!isId(id) || !isId(row.person_id)) {
          results.push({ transactionId: id, ok: false, error: 'Give a transaction and person id' });
          continue;
        }
        if (row.description !== undefined && typeof row.description !== 'string') {
          results.push({ transactionId: id, ok: false, error: 'description must be text' });
          continue;
        }
        const tx = db
          .select({ date: transactions.date, amount: transactions.amount })
          .from(transactions)
          .where(eq(transactions.id, id))
          .get();
        if (!tx || tx.amount <= 0) {
          results.push({ transactionId: id, ok: false, error: tx ? 'Not money in' : 'Not found' });
          continue;
        }
        const r = await api(ctx, `/households/${seg(a.household_id)}/events`, 'POST', {
          kind: 'contribution',
          date: tx.date,
          description: (row.description as string | undefined)?.trim() || 'Contribution',
          amount: tx.amount,
          payerId: row.person_id,
          transactionId: id,
        });
        results.push({
          transactionId: id,
          ok: r.ok,
          error: r.ok
            ? undefined
            : r.status === 403
              ? 'Refused: only a past deposit into this household’s accounts can be recorded'
              : r.error,
        });
      }
      const done = results.filter((r) => r.ok).length;
      return { recorded: done, refused: results.length - done, results };
    },
  },
  // Household corrections the owner approves (owner-requested on 6 November 2026): each call
  // files one proposal (services/assistantActions.ts) that changes nothing until the owner
  // applies it in Settings → Server → Access tokens
  {
    name: 'remove_household_entries',
    scope: 'organise',
    description: `Proposes removing household entries by id (from household), up to ${MAX_PROPOSAL_ITEMS} in one proposal: for example a deposit credited to the wrong person (record it again with record_household_contributions once removed), money that wasn't anyone's contribution, or an expense that isn't shared with these people. Nothing changes until the owner applies it in Allotment (Settings → Server → Access tokens → Waiting for you), and then all of it or none. Remove a refund before its expense. Confirm the list with the user first.`,
    properties: {
      household_id: { ...idString, description: 'From list_households' },
      event_ids: { type: 'array', minItems: 1, maxItems: MAX_PROPOSAL_ITEMS, items: idString },
      note: { type: 'string', maxLength: 1000, description: 'Why, for the owner' },
    },
    required: ['household_id', 'event_ids'],
    run: async (ctx, a) =>
      propose(ctx, {
        kind: 'household.remove_entries',
        householdId: a.household_id,
        eventIds: a.event_ids,
        note: a.note,
      }),
  },
  {
    name: 'record_household_bill_expenses',
    scope: 'organise',
    description: `Proposes sharing past payments out of a household's own accounts (bills it paid) as expenses the household account paid, each linked to its payment with the payment's exact amount and date, up to ${MAX_PROPOSAL_ITEMS} in one proposal. Split equally between everyone unless you give each person's exact share in cents adding up to the payment. Never a transfer (unlink a wrong one first), a personal account, or a payment already shared. Nothing changes until the owner applies it in Allotment (Settings → Server → Access tokens → Waiting for you), and then all of it or none. Confirm the list with the user first.`,
    properties: {
      household_id: { ...idString, description: 'From list_households' },
      expenses: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_PROPOSAL_ITEMS,
        items: {
          type: 'object',
          properties: {
            transaction_id: { ...idString, description: 'The payment out of a household account' },
            description: { type: 'string', minLength: 1, maxLength: 200 },
            shares: {
              type: 'array',
              description: 'Optional: each person’s exact share in cents, adding up to the payment',
              items: {
                type: 'object',
                properties: { person_id: idString, amount: { type: 'integer', minimum: 0 } },
                required: ['person_id', 'amount'],
                additionalProperties: false,
              },
            },
          },
          required: ['transaction_id'],
          additionalProperties: false,
        },
      },
      note: { type: 'string', maxLength: 1000, description: 'Why, for the owner' },
    },
    required: ['household_id', 'expenses'],
    run: async (ctx, a) => {
      const rows = a.expenses;
      if (!Array.isArray(rows) || !rows.length || rows.length > MAX_PROPOSAL_ITEMS)
        return { error: `Give 1 to ${MAX_PROPOSAL_ITEMS} expenses` };
      const bills = [];
      for (const row of rows as Args[]) {
        // Equal only when no shares are given: malformed shares are refused, never split equally
        const given = row?.shares;
        const valid =
          Array.isArray(given) &&
          given.length > 0 &&
          (given as Args[]).every(
            (s) => isId(s?.person_id) && Number.isInteger(s?.amount) && (s.amount as number) >= 0,
          );
        if (given !== undefined && !valid)
          return {
            error: `${String(row?.transaction_id)}: shares must be a list of { person_id, amount } in whole cents`,
          };
        bills.push({
          transactionId: row?.transaction_id,
          description: row?.description,
          shares:
            given === undefined
              ? undefined
              : (given as Args[]).map((s) => ({ personId: s.person_id, amount: s.amount })),
        });
      }
      return propose(ctx, {
        kind: 'household.share_bills',
        householdId: a.household_id,
        bills,
        note: a.note,
      });
    },
  },
  {
    name: 'unlink_household_transfers',
    scope: 'organise',
    description: `Proposes unlinking past transfers that have a side in a household's account ("Not a transfer"), up to ${MAX_PROPOSAL_ITEMS} in one proposal, for a bill or someone's deposit the bank matched as the wrong transfer. Once applied the pair isn't suggested again; then link the right pair with transfer_suggestions and link_transfer. Nothing changes until the owner applies it in Allotment (Settings → Server → Access tokens → Waiting for you), and then all of it or none; a reconciled transfer, or one with a household entry on either side, is refused then. Confirm each with the user first.`,
    properties: {
      transaction_ids: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_PROPOSAL_ITEMS,
        items: { ...idString, description: 'Either side of the transfer' },
      },
      note: { type: 'string', maxLength: 1000, description: 'Why, for the owner' },
    },
    required: ['transaction_ids'],
    run: async (ctx, a) =>
      propose(ctx, {
        kind: 'household.unlink_transfers',
        transactionIds: a.transaction_ids,
        note: a.note,
      }),
  },
  {
    name: 'propose_household_reconciliation',
    scope: 'organise',
    description:
      "Proposes agreeing a household's balances from a date: each person's balance with the household account becomes the agreed figure (0 unless given, in cents; positive = credit held there) and what people owe each other directly is cleared, with adjustment entries that keep every earlier entry. Check household_reconciliation_preview with the user first. Nothing changes until the owner applies it in Allotment (Settings → Server → Access tokens → Waiting for you); applying is refused if any balance changed since. The owner can undo it by removing the adjustment entries.",
    properties: {
      household_id: { ...idString, description: 'From list_households' },
      date: {
        ...day,
        description: 'The day the balances are agreed (today or earlier); today when left out',
      },
      agreed: {
        type: 'array',
        maxItems: MAX_PROPOSAL_ITEMS,
        description: 'Anyone not listed is agreed at 0',
        items: {
          type: 'object',
          properties: {
            person_id: { ...idString, description: "From household's people" },
            amount: { type: 'integer', description: 'Agreed balance in cents' },
          },
          required: ['person_id', 'amount'],
        },
      },
      note: { type: 'string', maxLength: 1000, description: 'Why, for the owner' },
    },
    required: ['household_id'],
    run: async (ctx, a) =>
      propose(ctx, {
        kind: 'household.reconcile',
        householdId: a.household_id,
        date: a.date,
        agreed: ((a.agreed ?? []) as { person_id: string; amount: number }[]).map((x) => ({
          personId: x.person_id,
          amount: x.amount,
        })),
        note: a.note,
      }),
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
async function callApi(req: Request, path: string, method = 'GET', body?: unknown, tool?: string) {
  const apiRoot = req.baseUrl.replace(/\/mcp$/, '');
  // Writes go through the assistant endpoint, which names and logs them (audit decision I-11)
  const via = method === 'GET' ? '' : '/assistant/do';
  const res = await fetch(`http://127.0.0.1:${req.socket.localPort}${apiRoot}${via}${path}`, {
    method,
    headers: {
      authorization: req.headers.authorization ?? '',
      accept: 'application/json',
      ...(tool ? { [ASSISTANT_TOOL_HEADER]: tool } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

const TITLES: Record<TokenScope, string> = {
  read: 'Allotment (read-only)',
  categorise: 'Allotment (read and categorise)',
  organise: 'Allotment (read, categorise and organise)',
};
const BASICS =
  'Amounts are integer minor units (cents); a negative transaction amount is money out. Use list_* tools for ids, then filter transactions and reports with them. Money received in budget accounts is ready to assign to envelopes; income categories only label it for reports. Household pool accounts sit outside the personal budget. Envelopes count from budget_start; earlier history is only in reports. find_transactions pages with limit and offset, and fields keeps results short.';
const INSTRUCTIONS: Record<TokenScope, string> = {
  read: `Read-only access to an Allotment budget. ${BASICS}`,
  categorise: `Read access to an Allotment budget, plus setting the category of past transactions (categorise_transactions, categorise_by_payee) and creating and editing categories and groups; nothing else can change. ${BASICS} Start from uncategorised_payees. Every category change returns a changeSetId that undo_change_set reverses. Confirm a plan with the user before categorising.`,
  organise: `Read access to an Allotment budget, plus categorising, editing categories, proposing rules (saved disabled until the owner enables them), applying a category-only rule to uncategorised transactions, payee default categories, linking suggested transfers, suggesting assignments the owner applies, claiming past transactions as tax deductions (tax_years, tax_deductions, tax_claim_candidates, claim_tax_deductions; never replacing or removing a claim), reading depreciating assets (tax_assets) and proposing new ones or changes the owner applies (propose_tax_asset), reading investments with their sales, income and the year's capital gains and income items (investments, read only), recording household contributions linked to deposits into a household account (household_bill_reconciliation, record_household_contributions), and your own unlinked contribution up to what you owe the household account (record_own_household_contribution). Proposing household corrections that only the owner applies: removing entries, sharing bills a household account paid, and unlinking wrong transfers into household accounts (remove_household_entries, record_household_bill_expenses, unlink_household_transfers). ${BASICS} Start from uncategorised_payees; test rule conditions before proposing a rule. Every category change returns a changeSetId that undo_change_set reverses. Confirm a plan with the user before changing anything.`,
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
              readOnlyHint:
                !!t.readOnly || t.name.startsWith('test_') || t.name.startsWith('preview_'),
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
        const result = await tool.run({ ...ctx, tool: tool.name }, args);
        return rpcResult(id, {
          content: [{ type: 'text', text: cut(JSON.stringify(result)) }],
          isError: 'error' in result,
        });
      }
      const write =
        'write' in tool ? (tool.write as (typeof CATEGORY_TOOLS)[number]['write']) : null;
      const { status, text } = write
        ? await callApi(ctx.req, tool.path(args), write.method, write.body(args), tool.name)
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
