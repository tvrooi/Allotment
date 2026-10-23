import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { appVersion } from '../utils/version.js';

// A read-only MCP server (Model Context Protocol, Streamable HTTP with JSON responses) so an
// AI assistant can read the budget with a read-only access token (docs/READ-ONLY-ACCESS.md).
// Every tool is one GET of this server's own API, made over loopback with the caller's token,
// so a tool can never reach more than the token itself: the same allowlist, validation and
// accounting as the app. Nothing here writes.

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
    description: 'Category groups and categories, with ids for other tools.',
    path: () => '/categories',
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
    properties: { ...selection, limit: { type: 'integer', minimum: 1, maximum: 500 } },
    path: (a) =>
      `/transactions${query({ limit: 100, ...a }, [...Object.keys(selection), 'limit'])}`,
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
    name: 'financial_resilience',
    description: 'Cash after debts by purpose, the flexibility reserve and months of essentials.',
    path: () => '/review/resilience',
  },
];

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/** One GET of this server's API, as the caller (same token, same checks) */
async function callApi(req: Request, path: string) {
  const apiRoot = req.baseUrl.replace(/\/mcp$/, '');
  const res = await fetch(`http://127.0.0.1:${req.socket.localPort}${apiRoot}${path}`, {
    headers: { authorization: req.headers.authorization ?? '', accept: 'application/json' },
  });
  return { status: res.status, text: await res.text() };
}

async function handle(req: Request, message: Record<string, unknown>) {
  const { id, method, params } = message as { id?: unknown; method?: string; params?: Args };
  const isNotification = id === undefined;
  switch (method) {
    case 'initialize': {
      const asked = (params?.protocolVersion as string) ?? '';
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'flybudget', title: 'FlyBudget (read-only)', version: appVersion },
        instructions:
          'Read-only access to a FlyBudget budget. Amounts are integer minor units (cents); negative transaction amounts are money out. Use list_* tools for ids, then filter transactions and reports with them.',
      });
    }
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: {
            type: 'object',
            properties: t.properties ?? {},
            ...(t.required ? { required: t.required } : {}),
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, openWorldHint: false },
        })),
      });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${String(params?.name)}`);
      const args = (params?.arguments ?? {}) as Args;
      if (typeof args !== 'object' || Array.isArray(args)) {
        return rpcError(id, -32602, 'Arguments must be an object');
      }
      const unknown = Object.keys(args).filter((k) => !(k in (tool.properties ?? {})));
      if (unknown.length) return rpcError(id, -32602, `Unknown arguments: ${unknown.join(', ')}`);
      const missing = (tool.required ?? []).filter((k) => args[k] === undefined);
      if (missing.length) return rpcError(id, -32602, `Missing arguments: ${missing.join(', ')}`);
      const { status, text } = await callApi(req, tool.path(args));
      const body =
        text.length > MAX_RESULT_CHARS
          ? `${text.slice(0, MAX_RESULT_CHARS)}\n… cut at ${MAX_RESULT_CHARS} characters; narrow the request (dates, filters or limit).`
          : text;
      return rpcResult(id, {
        content: [{ type: 'text', text: body }],
        isError: status >= 400,
      });
    }
    default:
      if (isNotification) return null; // e.g. notifications/initialized: nothing to answer
      return rpcError(id, -32601, `Method not found: ${String(method)}`);
  }
}

/** Messages in one JSON-RPC batch: each tool call is a request to this server */
const MAX_BATCH = 20;

// An assistant may call tools in quick succession, but not without limit
mcpRouter.use(
  rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }),
);

mcpRouter.post('/', async (req, res, next) => {
  // Only for read-only access tokens: each tool call is made with the caller's token
  if (!res.locals.accessTokenId) {
    return void res
      .status(401)
      .json(rpcError(null, -32001, 'A read-only access token is required'));
  }
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
      await Promise.all(messages.map((m) => handle(req, m as Record<string, unknown>)))
    ).filter((r) => r !== null);
    if (!replies.length) return res.status(202).end();
    res.json(batch ? replies : replies[0]);
  } catch (error) {
    next(error);
  }
});

// Streamable HTTP's optional server-to-client stream isn't offered: this server only answers
mcpRouter.get('/', (_req, res) => res.status(405).set('Allow', 'POST').end());
