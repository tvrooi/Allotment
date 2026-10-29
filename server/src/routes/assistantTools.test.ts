import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// Organise tokens, change sets and the assistant MCP tools (docs/READ-ONLY-ACCESS.md).
process.env.FLYBUDGET_SERVER_MODE = 'true';
process.env.FLYBUDGET_ALLOWED_HOSTS = 'budget.example.com';

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { eq } = await import('drizzle-orm');
const { db } = await import('../db/index.js');
const { accounts, categories, categoryGroups, payees, transactions } =
  await import('../db/schema.js');
const { hostGuard, originGuard, errorHandler } = await import('../middleware/security.js');
const { authRouter, requireSession } = await import('./auth.js');
const { createSession, setInitialPassword, SESSION_COOKIE } = await import('../auth/sessions.js');
const { accessTokensRouter } = await import('./accessTokens.js');
const { mcpRouter } = await import('./mcp.js');
const { accountsRouter } = await import('./accounts.js');
const { transactionsRouter } = await import('./transactions.js');
const { categoriesRouter } = await import('./categories.js');
const { reportsRouter } = await import('./reports.js');
const { rulesRouter } = await import('./rules.js');
const { payeesRouter } = await import('./payees.js');
const { changeSetsRouter } = await import('./changeSets.js');
const { budgetProposalsRouter } = await import('./budgetProposals.js');

let server: Server;
let base: string;
let cookie: string;

const PAST = '2026-01-10';
beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  await setInitialPassword('correct horse battery staple');
  cookie = `${SESSION_COOKIE}=${createSession('vitest').token}`;
  db.insert(accounts).values({ id: 'spend', name: 'Spending', type: 'checking' }).run();
  db.insert(accounts).values({ id: 'saver', name: 'Saver', type: 'savings' }).run();
  db.insert(categoryGroups).values({ id: 'g', name: 'Food', isIncome: 0 }).run();
  db.insert(categories).values({ id: 'groceries', groupId: 'g', name: 'Groceries' }).run();
  db.insert(categories).values({ id: 'coffee', groupId: 'g', name: 'Coffee' }).run();
  db.insert(payees).values({ id: 'shop', name: 'Mock Grocer' }).run();
  db.insert(payees).values({ id: 'cafe', name: 'Mock Cafe' }).run();
  const tx = (id: string, payeeId: string, payeeName: string, amount: number, extra = {}) =>
    db
      .insert(transactions)
      .values({ id, accountId: 'spend', date: PAST, amount, payeeId, payeeName, ...extra })
      .run();
  tx('g1', 'shop', 'Mock Grocer', -1000);
  tx('g2', 'shop', 'Mock Grocer', -2000, { notes: 'weekly shop' });
  tx('g3', 'shop', 'Mock Grocer', -500, { reconciled: 1 });
  tx('c1', 'cafe', 'Mock Cafe', -450);
  tx('c2', 'cafe', 'Mock Cafe', -500);
  // A transfer the server will suggest: out of Spending, into Saver
  tx('out', 'shop', 'To saver', -7700, { payeeId: null });
  db.insert(transactions)
    .values({ id: 'in', accountId: 'saver', date: PAST, amount: 7700, payeeName: 'From spending' })
    .run();
  const app = express();
  app.use(hostGuard, originGuard, express.json());
  app.use('/api/auth', authRouter);
  app.use('/api', requireSession);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/rules', rulesRouter);
  app.use('/api/payees', payeesRouter);
  app.use('/api/change-sets', changeSetsRouter);
  app.use('/api/budget-proposals', budgetProposalsRouter);
  app.use('/api/access-tokens', accessTokensRouter);
  app.use('/api/mcp', mcpRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

async function call(method: string, path: string, auth: { token?: string } = {}, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth.token) headers.authorization = `Bearer ${auth.token}`;
  else headers.cookie = cookie;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// At most 10 tokens may be active: tests share one per scope (and name)
const tokens = new Map<string, string>();
async function newToken(scope: 'read' | 'categorise' | 'organise', name = `Assistant ${scope}`) {
  const cached = tokens.get(name);
  if (cached) return cached;
  const res = await call('POST', '/access-tokens', {}, { name, days: 7, scope });
  expect(res.status).toBe(201);
  tokens.set(name, res.body.token);
  return res.body.token as string;
}

let rpcId = 0;
async function tool(token: string, name: string, args: Record<string, unknown> = {}) {
  const res = await call(
    'POST',
    '/mcp',
    { token },
    { jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } },
  );
  expect(res.status).toBe(200);
  const result = res.body.result;
  if (!result) return { error: res.body.error, isError: true };
  return { data: JSON.parse(result.content[0].text), isError: result.isError as boolean };
}
async function toolNames(token: string) {
  const res = await call(
    'POST',
    '/mcp',
    { token },
    { jsonrpc: '2.0', id: 1, method: 'tools/list' },
  );
  return (res.body.result.tools as { name: string }[]).map((t) => t.name);
}
const categoryOf = (id: string) =>
  db.select().from(transactions).where(eq(transactions.id, id)).get()!.categoryId;

describe('tools by scope', () => {
  it('offers writing tools only to the scopes that allow them', async () => {
    const read = await toolNames(await newToken('read'));
    const categorise = await toolNames(await newToken('categorise'));
    const organise = await toolNames(await newToken('organise'));
    for (const name of ['uncategorised_payees', 'transfer_suggestions', 'bank_sync_status'])
      expect(read).toContain(name);
    expect(read).not.toContain('categorise_by_payee');
    expect(categorise).toContain('categorise_by_payee');
    expect(categorise).toContain('undo_change_set');
    expect(categorise).not.toContain('propose_rule');
    for (const name of [
      'propose_rule',
      'apply_rule',
      'link_transfer',
      'set_payee_default_category',
    ])
      expect(organise).toContain(name);
  });
});

describe('reading', () => {
  it('lists uncategorised payees, pages transactions and keeps only asked-for fields', async () => {
    const token = await newToken('read');
    const { data } = await tool(token, 'uncategorised_payees');
    const grocer = data.payees.find((p: { payeeId: string }) => p.payeeId === 'shop');
    expect(grocer).toMatchObject({ count: 3, moneyOut: -3500, sampleNotes: ['weekly shop'] });
    const page = await tool(token, 'find_transactions', {
      payee_ids: 'cafe',
      limit: 1,
      offset: 1,
      fields: 'id,amount',
    });
    expect(page.data).toHaveLength(1);
    expect(Object.keys(page.data[0]).sort()).toEqual(['amount', 'id']);
    expect((await tool(token, 'bank_sync_status')).data).toEqual([]);
  });
});

describe('categorising with change sets', () => {
  it('categorises a payee, records a change set and undoes it', async () => {
    const token = await newToken('categorise');
    const { data } = await tool(token, 'categorise_by_payee', {
      payee_id: 'shop',
      category_id: 'groceries',
      set_default: true,
    });
    // The reconciled row is refused; a categorise token can't set payee defaults
    expect(data).toMatchObject({ changed: 2, refused: 1 });
    expect(typeof data.defaultSet).toBe('string');
    expect(categoryOf('g1')).toBe('groceries');
    const sets = (await tool(token, 'list_change_sets')).data;
    expect(sets[0]).toMatchObject({ id: data.changeSetId, transactionCount: 2, undoneAt: null });
    // An edit since the change set wins over its undo
    await call('PUT', '/transactions/g2', {}, { categoryId: 'coffee' });
    const undo = await tool(token, 'undo_change_set', { change_set_id: data.changeSetId });
    expect(undo.data).toEqual({ restored: 1, skipped: ['g2'] });
    expect(categoryOf('g1')).toBeNull();
    expect(categoryOf('g2')).toBe('coffee');
    expect(
      (await tool(token, 'undo_change_set', { change_set_id: data.changeSetId })).isError,
    ).toBe(true);
  });

  it("can't undo another token's change set, though the owner can", async () => {
    const a = await newToken('categorise');
    const b = await newToken('categorise', 'Other assistant');
    const { data } = await tool(a, 'categorise_transactions', {
      transaction_ids: ['c1'],
      category_id: 'coffee',
    });
    expect((await tool(b, 'undo_change_set', { change_set_id: data.changeSetId })).isError).toBe(
      true,
    );
    expect((await call('GET', '/change-sets', { token: b })).body).toEqual([]);
    const owner = await call('POST', `/change-sets/${data.changeSetId}/undo`);
    expect(owner.body).toEqual({ restored: 1, skipped: [] });
    expect(
      (
        await call('POST', `/change-sets/${data.changeSetId}/undo`, {
          token: await newToken('read'),
        })
      ).status,
    ).toBe(403);
  });
});

describe('organise tokens', () => {
  it('propose rules the owner enables, and apply category-only rules to uncategorised rows', async () => {
    const token = await newToken('organise');
    const conditions = [{ field: 'payee_name', op: 'contains', value: 'Cafe' }];
    const test = await tool(token, 'test_rule_conditions', { conditions });
    expect(test.data.matches.length).toBeGreaterThan(0);
    const proposed = await tool(token, 'propose_rule', {
      conditions,
      actions: [{ type: 'set_category', value: 'coffee' }],
    });
    const ruleId = proposed.data.rule.id;
    expect(proposed.data.rule).toMatchObject({ enabled: false, proposedBy: 'Assistant organise' });
    // A token can't enable, reorder or delete a rule
    expect((await call('PUT', `/rules/${ruleId}`, { token }, { enabled: true })).status).toBe(403);
    expect((await call('DELETE', `/rules/${ruleId}`, { token })).status).toBe(403);
    expect(
      (await call('POST', '/rules', { token }, { conditions, actions: proposed.data.rule.actions }))
        .status,
    ).toBe(403);
    const edited = await tool(token, 'update_proposed_rule', {
      rule_id: ruleId,
      conditions: [{ field: 'payee', op: 'is', value: 'cafe' }],
    });
    expect(edited.isError).toBe(false);
    const applied = await tool(token, 'apply_rule', { rule_id: ruleId });
    expect(applied.data.changed).toBe(2);
    expect(categoryOf('c2')).toBe('coffee');
    await tool(token, 'undo_change_set', { change_set_id: applied.data.changeSetId });
    expect(categoryOf('c2')).toBeNull();
    // The owner enabling it accepts it; then it is the owner's to change
    const enabled = await call('PUT', `/rules/${ruleId}`, {}, { enabled: true });
    expect(enabled.body).toMatchObject({ enabled: true, proposedBy: null });
    expect(
      (await tool(token, 'update_proposed_rule', { rule_id: ruleId, conditions })).isError,
    ).toBe(true);
  });

  it("won't apply a rule that changes more than a category", async () => {
    const token = await newToken('organise');
    const proposed = await tool(token, 'propose_rule', {
      conditions: [{ field: 'payee', op: 'is', value: 'cafe' }],
      actions: [
        { type: 'set_category', value: 'coffee' },
        { type: 'set_notes', value: 'changed' },
      ],
    });
    expect((await tool(token, 'apply_rule', { rule_id: proposed.data.rule.id })).isError).toBe(
      true,
    );
    expect(db.select().from(transactions).where(eq(transactions.id, 'c1')).get()!.notes).toBeNull();
  });

  it('set payee defaults, and nothing else about a payee', async () => {
    const token = await newToken('organise');
    const ok = await tool(token, 'set_payee_default_category', {
      payee_id: 'cafe',
      category_id: 'coffee',
    });
    expect(ok.data.payee.defaultCategoryId).toBe('coffee');
    expect((await call('PUT', '/payees/cafe', { token }, { name: 'Renamed' })).status).toBe(403);
    expect(db.select().from(payees).where(eq(payees.id, 'cafe')).get()!.name).toBe('Mock Cafe');
  });

  it('link only transfers the server suggests', async () => {
    const token = await newToken('organise');
    const suggestions = (await tool(token, 'transfer_suggestions')).data;
    expect(suggestions[0]).toMatchObject({ outflow: { id: 'out' }, inflow: { id: 'in' } });
    expect(
      (await tool(token, 'link_transfer', { transaction_id: 'c1', other_transaction_id: 'in' }))
        .isError,
    ).toBe(true);
    const linked = await tool(token, 'link_transfer', {
      transaction_id: 'out',
      other_transaction_id: 'in',
    });
    expect(linked.data).toEqual({ linked: true });
    expect(
      db.select().from(transactions).where(eq(transactions.id, 'out')).get()!.transferTransactionId,
    ).toBe('in');
  });

  it('suggest assignments that only the owner applies', async () => {
    const token = await newToken('organise');
    db.insert(transactions)
      .values({ id: 'pay', accountId: 'saver', date: PAST, amount: 100000, payeeName: 'Employer' })
      .run();
    const month = new Date().toISOString().slice(0, 7);
    const { data } = await tool(token, 'propose_assignments', {
      month,
      rows: [{ categoryId: 'groceries', amount: 2000, reason: 'Weekly shop' }],
    });
    expect(data.proposal).toMatchObject({
      status: 'open',
      total: 2000,
      tokenName: 'Assistant organise',
    });
    const id = data.proposal.id;
    expect((await call('POST', `/budget-proposals/${id}/apply`, { token })).status).toBe(403);
    expect((await call('POST', `/budget-proposals/${id}/dismiss`, { token })).status).toBe(403);
    expect((await tool(token, 'list_budget_proposals')).data[0].id).toBe(id);
    expect((await call('POST', `/budget-proposals/${id}/dismiss`)).body).toEqual({ ok: true });
  });

  it('a categorise token hides categories and lists their usage', async () => {
    const token = await newToken('categorise');
    expect((await tool(token, 'hide_category', { id: 'coffee', hidden: true })).isError).toBe(
      false,
    );
    const groups = (await tool(token, 'list_categories')).data;
    const coffee = groups
      .flatMap((g: { categories: unknown[] }) => g.categories)
      .find((c: { id: string }) => c.id === 'coffee');
    expect(coffee).toMatchObject({ hidden: 1, everAssigned: false });
    expect(typeof coffee.transactionCount).toBe('number');
    await tool(token, 'hide_category', { id: 'coffee', hidden: false });
    expect(
      (await call('POST', '/budget-proposals', { token }, { month: '2026-10', rows: [] })).status,
    ).toBe(403);
  });

  it('an organise token sets and replaces payee logos, and never removes one', async () => {
    const token = await newToken('organise');
    const logo = 'data:image/png;base64,iVBORw0KGgo=';
    const other = 'data:image/png;base64,AAAA';
    const saved = () => db.select().from(payees).where(eq(payees.id, 'shop')).get()?.logo;
    expect((await call('PUT', '/payees/shop', { token }, { logo })).status).toBe(200);
    expect(saved()).toBe(logo);
    expect((await call('PUT', '/payees/shop', { token }, { logo: other })).status).toBe(200);
    expect(saved()).toBe(other);
    expect((await call('PUT', '/payees/shop', { token }, { logo: null })).status).toBe(403);
    expect((await call('PUT', '/payees/shop', { token }, { logo, name: 'X' })).status).toBe(403);
    expect(
      (await call('PUT', '/payees/shop', { token }, { logo: 'data:image/svg+xml;base64,AAAA' }))
        .status,
    ).toBe(403);
    expect(saved()).toBe(other);
    db.update(payees).set({ logo: null }).where(eq(payees.id, 'shop')).run();
  });

  it('a categorise token reaches none of the organise writes', async () => {
    const token = await newToken('categorise');
    expect((await call('POST', '/rules/test', { token }, { conditions: [] })).status).toBe(403);
    expect(
      (await call('PUT', '/payees/cafe', { token }, { logo: 'data:image/png;base64,AAAA' })).status,
    ).toBe(403);
    expect((await call('PUT', '/payees/cafe', { token }, { defaultCategoryId: null })).status).toBe(
      403,
    );
  });
});
