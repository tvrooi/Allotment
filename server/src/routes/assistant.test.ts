import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// The assistant endpoints and their audit log (audit decision I-11, docs/ASSISTANT-ENDPOINTS.md).
// Each policy row's allowed case and nearest refusal are in auth/assistantPolicy.test.ts (with
// the check run again inside the write), assistantTools.test.ts and accessTokens.test.ts; this
// file covers the endpoints themselves.
process.env.FLYBUDGET_SERVER_MODE = 'true';
process.env.FLYBUDGET_ALLOWED_HOSTS = 'budget.example.com';

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { eq } = await import('drizzle-orm');
const { db } = await import('../db/index.js');
const { accounts, assistantActions, categories, categoryGroups, transactions } =
  await import('../db/schema.js');
const { hostGuard, originGuard, errorHandler } = await import('../middleware/security.js');
const { authRouter, requireSession, ASSISTANT_TOOL_HEADER } = await import('./auth.js');
const { createSession, setInitialPassword, SESSION_COOKIE } = await import('../auth/sessions.js');
const { tokenAllows } = await import('../auth/accessTokens.js');
const { ASSISTANT_ACTIONS } = await import('../auth/assistantPolicy.js');
const { BACKUP_TABLES } = await import('../services/backupService.js');
const { MAX_LOG_ROWS, logAssistantAction, listAssistantActions } =
  await import('../services/assistantLog.js');
const { accessTokensRouter } = await import('./accessTokens.js');
const { assistantDispatch, assistantRouter } = await import('./assistant.js');
const { transactionsRouter } = await import('./transactions.js');
const { categoriesRouter } = await import('./categories.js');
const { payeesRouter } = await import('./payees.js');
const { rulesRouter } = await import('./rules.js');

let server: Server;
let base: string;
let cookie: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  await setInitialPassword('correct horse battery staple');
  cookie = `${SESSION_COOKIE}=${createSession('vitest').token}`;
  db.insert(accounts).values({ id: 'spend', name: 'Spending', type: 'checking' }).run();
  db.insert(categoryGroups).values({ id: 'g', name: 'Food', isIncome: 0 }).run();
  db.insert(categories).values({ id: 'groceries', groupId: 'g', name: 'Groceries' }).run();
  db.insert(transactions)
    .values([
      { id: 'past', accountId: 'spend', date: '2026-01-10', amount: -1000 },
      { id: 'done', accountId: 'spend', date: '2026-01-11', amount: -500, reconciled: 1 },
    ])
    .run();
  const app = express();
  app.use(hostGuard, originGuard, express.json());
  app.use('/api/auth', authRouter);
  app.use(assistantDispatch);
  app.use('/api', requireSession);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/payees', payeesRouter);
  app.use('/api/rules', rulesRouter);
  app.use('/api/access-tokens', accessTokensRouter);
  app.use('/api/assistant', assistantRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

async function call(
  method: string,
  path: string,
  auth: { token?: string; session?: boolean; tool?: string } = {},
  body?: unknown,
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth.token) headers.authorization = `Bearer ${auth.token}`;
  if (auth.session) headers.cookie = cookie;
  if (auth.tool) headers[ASSISTANT_TOOL_HEADER] = auth.tool;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed as Record<string, unknown> };
}

async function newToken(scope: 'read' | 'categorise' | 'organise', name = 'Assistant') {
  const res = await call('POST', '/access-tokens', { session: true }, { name, days: 7, scope });
  expect(res.status).toBe(201);
  return res.body as { token: string; id: string };
}

const categoryOf = (id: string) =>
  db.select().from(transactions).where(eq(transactions.id, id)).get()?.categoryId;
const latest = () => listAssistantActions(1)[0];

describe('the policy table', () => {
  it('names every exception once; adding or renaming one needs its tests (CLAUDE.md)', () => {
    const names = ASSISTANT_ACTIONS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      'categorise_transaction',
      'manage_categories',
      'undo_change_set',
      'rule_dry_run',
      'propose_rule',
      'edit_proposed_rule',
      'apply_rule',
      'payee_default_category',
      'payee_logo',
      'link_transfer',
      'suggest_assignments',
      'claim_tax_deduction',
      'household_contribution',
      'own_household_contribution',
      'propose_change',
    ]);
    expect(ASSISTANT_ACTIONS.filter((a) => a.scope === 'categorise').map((a) => a.name)).toEqual([
      'categorise_transaction',
      'manage_categories',
      'undo_change_set',
    ]);
  });

  it('no general route takes a token’s write; only the assistant endpoint does', async () => {
    const writes: [string, string, unknown][] = [
      ['PUT', '/transactions/past', { categoryId: 'groceries' }],
      ['POST', '/categories', { groupId: 'g', name: 'X' }],
      ['POST', '/change-sets/x/undo', undefined],
      ['POST', '/rules', { enabled: false, conditions: [], actions: [] }],
      ['POST', '/rules/test', { conditions: [] }],
      ['PUT', '/payees/p', { defaultCategoryId: null }],
      ['POST', '/transactions/transfers/link', { transactionId: 'a', otherTransactionId: 'b' }],
      ['POST', '/budget-proposals', { month: '2026-10', rows: [] }],
      ['PUT', '/tax/claims/past', { label: 'D5' }],
      ['POST', '/households/h/events', { kind: 'contribution' }],
    ];
    for (const scope of ['read', 'categorise', 'organise'] as const) {
      for (const [method, path, body] of writes) {
        // tokenAllows answers reads only: every write is the policy table's, through /do
        expect(tokenAllows(scope, method, path, body), `${scope} ${method} ${path}`).toBe(false);
      }
      // The log is the owner's
      expect(tokenAllows(scope, 'GET', '/assistant/activity', undefined)).toBe(false);
    }
    const { token } = await newToken('organise', 'Direct');
    for (const [method, path, body] of writes) {
      const res = await call(method, path, { token }, body);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(String(res.body.error)).toContain('/api/assistant/do');
    }
  });
});

describe('the assistant endpoints', () => {
  it('apply an allowed write through its route, and log it with the tool that asked', async () => {
    const { token, id } = await newToken('categorise', 'Sorter');
    const res = await call(
      'PUT',
      '/assistant/do/transactions/past',
      { token, tool: 'categorise_transactions' },
      { categoryId: 'groceries' },
    );
    expect(res.status).toBe(200);
    expect(categoryOf('past')).toBe('groceries');
    expect(latest()).toMatchObject({
      tokenId: id,
      tokenName: 'Sorter',
      scope: 'categorise',
      action: 'categorise_transaction',
      tool: 'categorise_transactions',
      method: 'PUT',
      path: '/transactions/past',
      outcome: 'applied',
      status: 200,
      reason: null,
    });
  });

  it('refuse and log what the policy doesn’t allow, without reaching the route', async () => {
    const { token } = await newToken('categorise');
    const res = await call(
      'PUT',
      '/assistant/do/transactions/past',
      { token, tool: 'Not A Tool Name!' },
      { categoryId: 'groceries', notes: 'x' },
    );
    expect(res.status).toBe(403);
    expect(latest()).toMatchObject({
      action: null,
      tool: null,
      outcome: 'refused',
      status: 403,
      path: '/transactions/past',
    });
    expect(String(latest().reason)).toContain('can only read');
    // A read token reaches nothing, so nothing is logged for it
    const read = await newToken('read');
    const before = listAssistantActions(500).length;
    expect(
      (
        await call(
          'PUT',
          '/assistant/do/transactions/past',
          { token: read.token },
          { categoryId: 'g' },
        )
      ).status,
    ).toBe(403);
    expect(listAssistantActions(500).length).toBe(before);
  });

  it('log the route’s own refusal as failed, with its reason', async () => {
    const { token } = await newToken('categorise');
    // A reconciled row is the policy's refusal (assistantPolicy.test.ts); a missing one the route's
    const res = await call(
      'PUT',
      '/assistant/do/transactions/gone',
      { token },
      { categoryId: 'groceries' },
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(latest()).toMatchObject({
      action: 'categorise_transaction',
      outcome: 'failed',
      status: res.status,
    });
    expect(latest().reason).toBe(res.body.error);
  });

  it('grant exactly one route: a path can’t be stacked or swapped', async () => {
    const { token } = await newToken('organise');
    // Rewritten once: the policy sees /assistant/do/transactions/past, which matches no row
    expect(
      (
        await call(
          'PUT',
          '/assistant/do/assistant/do/transactions/past',
          { token },
          { categoryId: 'groceries' },
        )
      ).status,
    ).toBe(403);
    expect(latest()).toMatchObject({ outcome: 'refused', path: '/assistant/do/transactions/past' });
  });

  it('are for tokens: the owner uses the app, and only the owner reads the log', async () => {
    expect(
      (
        await call(
          'PUT',
          '/assistant/do/transactions/past',
          { session: true },
          { categoryId: 'groceries' },
        )
      ).status,
    ).toBe(403);
    const { token } = await newToken('organise');
    expect((await call('GET', '/assistant/activity', { token })).status).toBe(403);
    const owner = await call('GET', '/assistant/activity?limit=2', { session: true });
    expect(owner.status).toBe(200);
    expect((owner.body.actions as unknown[]).length).toBe(2);
    expect(owner.body.policy).toHaveLength(ASSISTANT_ACTIONS.length);
    expect((owner.body.policy as { name: string }[])[0]).toEqual({
      name: 'categorise_transaction',
      scope: 'categorise',
      summary: 'Set the category of a past transaction',
    });
  });
});

describe('the audit log', () => {
  it('keeps the newest rows and is never in a backup', () => {
    expect(BACKUP_TABLES).not.toContain('assistantActions');
    const start = Date.parse('2020-01-01T00:00:00Z');
    db.transaction(() => {
      for (let i = 0; i < MAX_LOG_ROWS + 5; i++)
        db.insert(assistantActions)
          .values({
            id: `old-${i}`,
            createdAt: new Date(start + i * 1000).toISOString(),
            tokenId: 'old',
            tokenName: 'Old',
            action: '',
            scope: 'organise',
            method: 'PUT',
            path: '/x',
            outcome: 'refused',
          })
          .run();
    });
    logAssistantAction({
      tokenId: 'gone',
      scope: 'organise',
      action: null,
      tool: null,
      method: 'PUT',
      path: '/y',
      outcome: 'refused',
    });
    const rows = db.select().from(assistantActions).all();
    expect(rows.length).toBeLessThanOrEqual(MAX_LOG_ROWS);
    expect(rows.some((r) => r.id === 'old-0')).toBe(false);
    expect(latest()).toMatchObject({ path: '/y', tokenName: 'Assistant' });
  });
});
