import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// Categorise access tokens and the MCP write tools (docs/READ-ONLY-ACCESS.md), in server mode.
process.env.FLYBUDGET_SERVER_MODE = 'true';
process.env.FLYBUDGET_ALLOWED_HOSTS = 'budget.example.com';

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { db } = await import('../db/index.js');
const { accounts, categories, categoryGroups, transactions } = await import('../db/schema.js');
const { hostGuard, originGuard, errorHandler } = await import('../middleware/security.js');
const { authRouter, requireSession } = await import('./auth.js');
const { createSession, setInitialPassword, changePassword, SESSION_COOKIE } =
  await import('../auth/sessions.js');
const { accessTokensRouter } = await import('./accessTokens.js');
const { mcpRouter } = await import('./mcp.js');
const { accountsRouter } = await import('./accounts.js');
const { transactionsRouter } = await import('./transactions.js');
const { exportRouter } = await import('./export.js');
const { reportsRouter } = await import('./reports.js');
const { categoriesRouter } = await import('./categories.js');

let server: Server;
let base: string;
let cookie: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  await setInitialPassword('correct horse battery staple');
  cookie = `${SESSION_COOKIE}=${createSession('vitest').token}`;
  db.insert(accounts).values({ id: 'mock', name: 'Mock account', type: 'checking' }).run();
  db.insert(categoryGroups).values({ id: 'g1', name: 'Everyday', isIncome: 0 }).run();
  db.insert(categories).values({ id: 'groceries', groupId: 'g1', name: 'Groceries' }).run();
  db.insert(categories).values({ id: 'dining', groupId: 'g1', name: 'Dining' }).run();
  for (const [id, amount] of [
    ['t1', -1200],
    ['t2', -3400],
    ['t3', -560],
  ] as const) {
    db.insert(transactions)
      .values({ id, accountId: 'mock', date: '2026-09-01', amount, payeeName: `Shop ${id}` })
      .run();
  }
  const app = express();
  app.use(hostGuard, originGuard, express.json());
  app.use('/api/auth', authRouter);
  app.use('/api', requireSession);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/reports', reportsRouter);
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

async function newToken(scope: 'read' | 'categorise') {
  const res = await call(
    'POST',
    '/access-tokens',
    { session: true },
    { name: 'Claude', days: 7, scope },
  );
  expect(res.status).toBe(201);
  return res.body as { token: string; id: string; scope: string };
}

let rpcId = 0;
async function tool(token: string, name: string, args: Record<string, unknown> = {}) {
  const res = await call(
    'POST',
    '/mcp',
    { token },
    {
      jsonrpc: '2.0',
      id: ++rpcId,
      method: 'tools/call',
      params: { name, arguments: args },
    },
  );
  return res.body;
}
const categoryOf = (id: string) =>
  db.select().from(transactions).where(eq(transactions.id, id)).get()?.categoryId ?? null;

describe('categorise tokens', () => {
  it('have their own prefix and scope; read tokens stay read-only', async () => {
    const cat = await newToken('categorise');
    expect(cat.token).toMatch(/^fbcat_[A-Za-z0-9_-]{43}$/);
    expect(cat.scope).toBe('categorise');
    const read = await newToken('read');
    expect(read.token).toMatch(/^fbro_/);
    // A read token can't write categories or transactions, even directly
    expect(
      (await call('POST', '/categories', { token: read.token }, { groupId: 'g1', name: 'X' }))
        .status,
    ).toBe(403);
    expect(
      (
        await call(
          'POST',
          '/transactions/bulk',
          { token: read.token },
          { selection: {}, ids: ['t1'], changes: { categoryId: 'dining' }, preview: true },
        )
      ).status,
    ).toBe(403);
  });

  it('are offered the write tools; read tokens are not', async () => {
    const cat = await newToken('categorise');
    const read = await newToken('read');
    const list = async (token: string) =>
      (
        await call('POST', '/mcp', { token }, { jsonrpc: '2.0', id: 1, method: 'tools/list' })
      ).body.result.tools.map((t: { name: string }) => t.name);
    expect(await list(cat.token)).toEqual(
      expect.arrayContaining(['find_transactions', 'categorise_transactions', 'create_category']),
    );
    expect(await list(read.token)).not.toContain('categorise_transactions');
    const refused = await tool(read.token, 'categorise_transactions', {
      category_id: 'dining',
      expected_count: 0,
      transaction_ids: ['t1'],
    });
    expect(refused.error.message).toMatch(/Unknown tool/);
    expect(categoryOf('t1')).toBeNull();
  });

  it('creates, edits and categorises, with a preview and an undo', async () => {
    const { token } = await newToken('categorise');
    const created = await tool(token, 'create_category', { groupId: 'g1', name: 'Coffee' });
    expect(created.result.isError).toBe(false);
    const coffee = JSON.parse(created.result.content[0].text);
    expect(coffee.name).toBe('Coffee');
    const renamed = await tool(token, 'update_category', { id: coffee.id, name: 'Cafes' });
    expect(JSON.parse(renamed.result.content[0].text).name).toBe('Cafes');

    const ids = ['t1', 't2'];
    const preview = await tool(token, 'preview_categorise', {
      transaction_ids: ids,
      category_id: 'dining',
    });
    expect(JSON.parse(preview.result.content[0].text)).toMatchObject({ matched: 2, changing: 2 });
    expect(categoryOf('t1')).toBeNull(); // previews write nothing

    // A stale count writes nothing
    const stale = await tool(token, 'categorise_transactions', {
      transaction_ids: ids,
      category_id: 'dining',
      expected_count: 5,
    });
    expect(stale.result.isError).toBe(true);
    expect(categoryOf('t1')).toBeNull();

    const done = await tool(token, 'categorise_transactions', {
      transaction_ids: ids,
      category_id: 'dining',
      expected_count: 2,
    });
    const applied = JSON.parse(done.result.content[0].text);
    expect(applied).toMatchObject({ matched: 2, changed: 2 });
    expect(categoryOf('t1')).toBe('dining');
    expect(categoryOf('t3')).toBeNull();

    const undo = await tool(token, 'undo_categorise', { restore: applied.restore });
    expect(undo.result.isError).toBe(false);
    expect(categoryOf('t1')).toBeNull();
    expect(categoryOf('t2')).toBeNull();
  });

  it('never target every transaction, and cannot change anything else', async () => {
    const { token } = await newToken('categorise');
    const all = await tool(token, 'categorise_transactions', {
      category_id: 'dining',
      expected_count: 3,
    });
    expect(all.error.message).toMatch(/never targets every transaction/);
    expect(categoryOf('t3')).toBeNull();
    // Direct REST: only categories and category changes
    const bulk = (changes: unknown) =>
      call(
        'POST',
        '/transactions/bulk',
        { token },
        { selection: {}, ids: ['t1'], changes, preview: true },
      );
    expect((await bulk({ categoryId: 'dining' })).status).toBe(200);
    for (const changes of [
      { notes: 'x' },
      { payeeName: 'x' },
      { hiddenFromReports: true },
      { categoryId: 'dining', notes: 'x' },
    ]) {
      expect((await bulk(changes)).status).toBe(403);
    }
    expect(
      (await call('POST', '/transactions/bulk', { token }, { restore: [{ id: 't1', notes: 'x' }] }))
        .status,
    ).toBe(403);
    const denied: [string, string][] = [
      ['PUT', '/transactions/t1'],
      ['DELETE', '/transactions/t1'],
      ['POST', '/transactions'],
      ['DELETE', '/categories/dining'],
      ['PUT', '/categories/reorder'],
      ['PUT', '/categories/groups/reorder'],
      ['DELETE', '/categories/groups/g1'],
      ['GET', '/export/backup'],
      ['GET', '/access-tokens'],
      ['POST', '/access-tokens'],
    ];
    for (const [method, path] of denied) {
      expect((await call(method, path, { token }, method === 'GET' ? undefined : {})).status).toBe(
        403,
      );
    }
    expect(
      db
        .select()
        .from(categories)
        .all()
        .some((c) => c.id === 'dining'),
    ).toBe(true);
  });

  it('cannot smuggle other changes past the check', async () => {
    const { token } = await newToken('categorise');
    const post = (body: unknown) => call('POST', '/transactions/bulk', { token }, body);
    // An empty restore alongside an apply must not hide the apply's other changes
    expect(
      (
        await post({
          restore: [],
          selection: {},
          ids: ['t1'],
          changes: { notes: 'x' },
          expectedCount: 1,
        })
      ).status,
    ).toBe(403);
    // Non-preview applies, extra keys, empty changes and empty or oversized restores
    expect(
      (await post({ selection: {}, ids: ['t1'], changes: { notes: 'x' }, expectedCount: 1 }))
        .status,
    ).toBe(403);
    expect((await post({ selection: {}, ids: ['t1'], changes: {}, expectedCount: 1 })).status).toBe(
      403,
    );
    expect(
      (
        await post({
          selection: {},
          ids: ['t1'],
          changes: { categoryId: 'dining' },
          expectedCount: 1,
          extra: 1,
        })
      ).status,
    ).toBe(403);
    expect((await post({ restore: [] })).status).toBe(403);
    expect(
      (await post({ restore: [{ id: 't1', categoryId: null, reviewedAt: 'x' }] })).status,
    ).toBe(403);
    expect(
      (await post({ restore: [{ id: 't1', categoryId: null }], changes: { notes: 'x' } })).status,
    ).toBe(403);
    expect(
      db
        .select()
        .from(transactions)
        .all()
        .every((t) => t.notes == null),
    ).toBe(true);
  });

  it('ignores letter case in paths, so reorder and import settings stay out of reach', async () => {
    const { token } = await newToken('categorise');
    const read = await newToken('read');
    for (const path of ['/categories/REORDER', '/categories/Groups/Reorder']) {
      expect((await call('PUT', path, { token }, { ids: [] })).status).toBe(403);
    }
    for (const t of [token, read.token]) {
      expect((await call('GET', '/accounts/mock/Import-Settings', { token: t })).status).toBe(403);
    }
    // A group can be renamed but its income flag can't be flipped
    expect(
      (await call('PUT', '/categories/groups/g1', { token }, { name: 'Daily', isIncome: 1 }))
        .status,
    ).toBe(403);
    expect((await call('PUT', '/categories/groups/g1', { token }, { name: 'Daily' })).status).toBe(
      200,
    );
  });
});
