import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// Read-only access tokens and the MCP endpoint (docs/READ-ONLY-ACCESS.md), in server mode.
process.env.FLYBUDGET_SERVER_MODE = 'true';
process.env.FLYBUDGET_ALLOWED_HOSTS = 'budget.example.com';

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { db } = await import('../db/index.js');
const { accessTokens, accounts, categories, categoryGroups, transactions } =
  await import('../db/schema.js');
const { hostGuard, originGuard, errorHandler } = await import('../middleware/security.js');
const { authRouter, requireSession } = await import('./auth.js');
const { createSession, setInitialPassword, changePassword, SESSION_COOKIE } =
  await import('../auth/sessions.js');
const { createAccessToken } = await import('../auth/accessTokens.js');
const { BACKUP_TABLES } = await import('../services/backupService.js');
const { accessTokensRouter } = await import('./accessTokens.js');
const { mcpRouter } = await import('./mcp.js');
const { accountsRouter } = await import('./accounts.js');
const { transactionsRouter } = await import('./transactions.js');
const { exportRouter } = await import('./export.js');
const { reportsRouter } = await import('./reports.js');
const { dashboardsRouter } = await import('./dashboards.js');

let server: Server;
let base: string;
let cookie: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  await setInitialPassword('correct horse battery staple');
  cookie = `${SESSION_COOKIE}=${createSession('vitest').token}`;
  db.insert(accounts).values({ id: 'mock', name: 'Mock account', type: 'checking' }).run();
  const app = express();
  app.use(hostGuard, originGuard, express.json());
  app.use('/api/auth', authRouter);
  app.use('/api', requireSession);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/dashboards', dashboardsRouter);
  app.use('/api/access-tokens', accessTokensRouter);
  app.use('/api/mcp', mcpRouter);
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
  auth: { token?: string; session?: boolean } = {},
  body?: unknown,
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth.token) headers.authorization = `Bearer ${auth.token}`;
  if (auth.session) headers.cookie = cookie;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function newToken(days = 30) {
  const res = await call('POST', '/access-tokens', { session: true }, { name: 'Assistant', days });
  expect(res.status).toBe(201);
  return res.body as { token: string; id: string; expiresAt: string };
}

describe('managing tokens', () => {
  it('needs a signed-in session, shows the token once and stores only its hash', async () => {
    expect((await call('GET', '/access-tokens')).status).toBe(401);
    const created = await newToken();
    expect(created.token).toMatch(/^fbro_[A-Za-z0-9_-]{43}$/);
    const listed = (await call('GET', '/access-tokens', { session: true })).body;
    expect(listed[0]).toMatchObject({ id: created.id, name: 'Assistant', active: true });
    expect(JSON.stringify(listed)).not.toContain(created.token);
    const row = db.select().from(accessTokens).all()[0];
    expect(row.tokenHash).not.toBe(created.token);
    expect(JSON.stringify(row)).not.toContain(created.token);
    // A token can't manage tokens
    expect((await call('GET', '/access-tokens', { token: created.token })).status).toBe(403);
    expect(
      (await call('POST', '/access-tokens', { token: created.token }, { name: 'x', days: 1 }))
        .status,
    ).toBe(403);
  });

  it('rejects bad expiry and is never part of a backup', async () => {
    for (const days of [0, 91, 1.5]) {
      expect(
        (await call('POST', '/access-tokens', { session: true }, { name: 'x', days })).status,
      ).toBe(400);
    }
    expect(BACKUP_TABLES).not.toContain('accessTokens');
  });
});

describe('what a token can reach', () => {
  it('reads the budget and nothing else', async () => {
    const { token } = await newToken();
    const list = await call('GET', '/accounts', { token });
    expect(list.status).toBe(200);
    expect(list.body[0]).not.toHaveProperty('importSettings');
    expect((await call('GET', '/transactions/summary', { token })).status).toBe(200);
    expect((await call('GET', '/reports/spending-by-category', { token })).status).toBe(200);
    // Never a write, never backups, settings, logins or layouts
    const denied: [string, string][] = [
      ['POST', '/transactions'],
      ['PUT', '/accounts/mock'],
      ['DELETE', '/accounts/mock'],
      ['PATCH', '/transactions/x/flags'],
      ['GET', '/export/backup'],
      ['POST', '/export/restore'],
      ['GET', '/server/info'],
      ['GET', '/up/status'],
      ['GET', '/accounts/mock/import-settings'],
      ['GET', '/dashboards'],
    ];
    for (const [method, path] of denied) {
      expect((await call(method, path, { token }, method === 'GET' ? undefined : {})).status).toBe(
        403,
      );
    }
    expect(db.select().from(accounts).all()).toHaveLength(1);
    // Login routes ignore tokens: a token is not a session
    expect((await call('GET', '/auth/sessions', { token })).status).toBe(401);
  });

  it('refuses unknown, expired and revoked tokens', async () => {
    expect((await call('GET', '/accounts', { token: 'fbro_nope' })).status).toBe(401);
    expect((await call('GET', '/accounts', { token: 'not-a-token' })).status).toBe(401);
    // Another bearer token (a sign-in proxy's JWT) doesn't stand in the way of a session
    expect(
      (await call('GET', '/accounts', { token: 'eyJhbGciOi.proxy.jwt', session: true })).status,
    ).toBe(200);
    const old = createAccessToken('Old', 1, new Date(Date.now() - 2 * 86_400_000));
    expect((await call('GET', '/accounts', { token: old.token })).status).toBe(401);
    const { token, id } = await newToken();
    expect((await call('DELETE', `/access-tokens/${id}`, { session: true })).status).toBe(204);
    expect((await call('GET', '/accounts', { token })).status).toBe(401);
  });
});

describe('MCP', () => {
  const rpc = (token: string | undefined, body: unknown) =>
    call('POST', '/mcp', token ? { token } : { session: true }, body);

  it('initialises, lists read-only tools and answers tool calls with the token', async () => {
    const { token } = await newToken();
    const init = await rpc(token, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test' } },
    });
    expect(init.body.result).toMatchObject({
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'flybudget' },
    });
    expect((await rpc(token, { jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(
      202,
    );

    const tools = (await rpc(token, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).body.result
      .tools;
    expect(tools.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(['list_accounts', 'find_transactions', 'budget_month']),
    );
    expect(tools.every((t: any) => t.annotations.readOnlyHint === true)).toBe(true);

    const accountsCall = await rpc(token, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'list_accounts', arguments: {} },
    });
    expect(accountsCall.body.result.isError).toBe(false);
    expect(JSON.parse(accountsCall.body.result.content[0].text)[0]).toMatchObject({
      id: 'mock',
      name: 'Mock account',
    });

    const summary = await rpc(token, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'transaction_summary', arguments: { direction: 'debit' } },
    });
    expect(JSON.parse(summary.body.result.content[0].text)).toMatchObject({ count: 0 });

    // The API's own validation still applies
    const bad = await rpc(token, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'budget_month', arguments: { month: '2026-13' } },
    });
    expect(bad.body.result.isError).toBe(true);
  });

  it('rejects unknown tools, arguments and methods, and requests without a token', async () => {
    const { token } = await newToken();
    const call1 = await rpc(token, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'delete_everything', arguments: {} },
    });
    expect(call1.body.error.code).toBe(-32602);
    const call2 = await rpc(token, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'list_accounts', arguments: { path: '/export/backup' } },
    });
    expect(call2.body.error.message).toContain('Unknown arguments');
    expect(
      (await rpc(token, { jsonrpc: '2.0', id: 3, method: 'resources/list' })).body.error.code,
    ).toBe(-32601);
    expect((await rpc(undefined, { jsonrpc: '2.0', id: 4, method: 'tools/list' })).status).toBe(
      401,
    );
    expect((await call('GET', '/mcp', { token })).status).toBe(405);
    const many = Array.from({ length: 21 }, (_, i) => ({
      jsonrpc: '2.0',
      id: i,
      method: 'tools/list',
    }));
    expect((await rpc(token, many)).status).toBe(400);
  });
});

describe('categorise tokens', () => {
  const rpc = (token: string, body: unknown) => call('POST', '/mcp', { token }, body);
  const categoryOf = (id: string) =>
    db
      .select()
      .from(transactions)
      .all()
      .find((t) => t.id === id)?.categoryId ?? null;

  it('set the category of past transactions and change nothing else', async () => {
    db.insert(categoryGroups).values({ id: 'g', name: 'Expenses' }).run();
    db.insert(categories)
      .values([
        { id: 'rent', name: 'Rent', groupId: 'g' },
        { id: 'food', name: 'Food', groupId: 'g' },
      ])
      .run();
    const today = new Date().toISOString().slice(0, 10);
    db.insert(transactions)
      .values([
        { id: 'past', accountId: 'mock', date: '2025-01-05', amount: -478000 },
        { id: 'done', accountId: 'mock', date: '2025-01-06', amount: -100, reconciled: 1 },
        { id: 'later', accountId: 'mock', date: '2999-01-01', amount: -100 },
        { id: 'now', accountId: 'mock', date: today, amount: -100, categoryId: 'food' },
      ])
      .run();
    const created = await call(
      'POST',
      '/access-tokens',
      { session: true },
      { name: 'Categoriser', days: 7, scope: 'categorise' },
    );
    expect(created.status).toBe(201);
    expect(created.body.scope).toBe('categorise');
    const { token, id } = created.body as { token: string; id: string };
    const read = await newToken();

    // REST: exactly a category on a past transaction
    expect(
      (await call('PUT', '/transactions/past', { token }, { categoryId: 'rent' })).status,
    ).toBe(200);
    expect(categoryOf('past')).toBe('rent');
    const refused: [string, string, unknown][] = [
      ['PUT', '/transactions/past', { categoryId: 'rent', notes: 'x' }],
      ['PUT', '/transactions/past', { amount: 1 }],
      ['PUT', '/transactions/past', { categoryId: null }],
      ['PUT', '/transactions/later', { categoryId: 'rent' }],
      ['POST', '/transactions', { accountId: 'mock', date: today, amount: 1 }],
      ['POST', '/transactions/bulk', { selection: {}, changes: { categoryId: 'rent' } }],
      ['DELETE', '/transactions/past', undefined],
      ['PUT', '/accounts/mock', { name: 'x' }],
      ['PUT', '/transactions/%E0%A4%A', { categoryId: 'rent' }],
    ];
    for (const [method, path, body] of refused)
      expect((await call(method, path, { token }, body)).status).toBe(403);
    // A read token still can't categorise
    expect(
      (await call('PUT', '/transactions/past', { token: read.token }, { categoryId: 'food' }))
        .status,
    ).toBe(403);
    expect(categoryOf('past')).toBe('rent');

    // MCP: the tool is only listed for a categorise token
    const names = async (t: string) =>
      (await rpc(t, { jsonrpc: '2.0', id: 1, method: 'tools/list' })).body.result.tools.map(
        (tool: { name: string }) => tool.name,
      );
    expect(await names(read.token)).not.toContain('categorise_transactions');
    expect(await names(token)).toContain('categorise_transactions');
    const denied = await rpc(read.token, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'categorise_transactions',
        arguments: { transaction_ids: ['past'], category_id: 'food' },
      },
    });
    expect(denied.body.error.code).toBe(-32602);

    const result = await rpc(token, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'categorise_transactions',
        arguments: {
          transaction_ids: ['past', 'now', 'later', 'done', 'gone'],
          category_id: 'food',
        },
      },
    });
    const outcome = JSON.parse(result.body.result.content[0].text);
    expect(outcome).toMatchObject({ changed: 2, refused: 3 });
    expect(outcome.results).toEqual([
      { id: 'past', ok: true, previousCategoryId: 'rent' },
      { id: 'now', ok: true, previousCategoryId: 'food' },
      expect.objectContaining({ id: 'later', ok: false }),
      expect.objectContaining({
        id: 'done',
        ok: false,
        error: 'Cannot modify a reconciled transaction',
      }),
      { id: 'gone', ok: false, error: 'Not found' },
    ]);
    expect([categoryOf('past'), categoryOf('later'), categoryOf('done')]).toEqual([
      'food',
      null,
      null,
    ]);
    const bad = await rpc(token, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'categorise_transactions',
        arguments: { transaction_ids: [], category_id: 'food', notes: 'x' },
      },
    });
    expect(bad.body.error.message).toContain('Unknown arguments: notes');

    for (const t of [id, read.id]) await call('DELETE', `/access-tokens/${t}`, { session: true });
  });
});

describe('changing the password', () => {
  it('revokes every token', async () => {
    const { token } = await newToken();
    const list = await call('GET', '/accounts', { token });
    expect(list.status).toBe(200);
    expect(list.body[0]).not.toHaveProperty('importSettings');
    await changePassword('another long passphrase here');
    expect((await call('GET', '/accounts', { token })).status).toBe(401);
  });
});
