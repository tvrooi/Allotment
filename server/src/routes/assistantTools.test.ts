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
const {
  accounts,
  categories,
  categoryGroups,
  payees,
  transactions,
  householdGroups,
  householdPeople,
  householdPoolAccounts,
  householdRecurringBills,
  schedules,
} = await import('../db/schema.js');
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
const { taxRouter } = await import('./tax.js');
const { householdsRouter } = await import('./households.js');

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
  app.use('/api/tax', taxRouter);
  app.use('/api/households', householdsRouter);
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
/** A row of its own for one test, already categorised so other tests' worklists don't see it */
const ownRow = (id: string, amount: number, date = PAST) =>
  db
    .insert(transactions)
    .values({
      id,
      accountId: 'spend',
      date,
      amount,
      payeeName: 'Mock Software',
      categoryId: 'coffee',
    })
    .run();
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

  it('the owner redoes an undone change set, never a token', async () => {
    ownRow('r1', -100);
    ownRow('r2', -200);
    const token = await newToken('categorise');
    const { data } = await tool(token, 'categorise_transactions', {
      transaction_ids: ['r1', 'r2'],
      category_id: 'groceries',
    });
    await call('POST', `/change-sets/${data.changeSetId}/undo`);
    expect(categoryOf('r1')).toBe('coffee');
    // A token can't redo, and a row edited since the undo keeps the edit
    expect((await call('POST', `/change-sets/${data.changeSetId}/redo`, { token })).status).toBe(
      403,
    );
    db.update(transactions).set({ categoryId: null }).where(eq(transactions.id, 'r2')).run();
    const redo = await call('POST', `/change-sets/${data.changeSetId}/redo`);
    expect(redo.body).toEqual({ reapplied: 1, skipped: ['r2'] });
    expect(categoryOf('r1')).toBe('groceries');
    db.update(transactions).set({ categoryId: 'coffee' }).where(eq(transactions.id, 'r2')).run();
    const sets = (await call('GET', '/change-sets')).body as { id: string; undoneAt: unknown }[];
    expect(sets.find((x) => x.id === data.changeSetId)?.undoneAt).toBeNull();
    expect((await call('POST', `/change-sets/${data.changeSetId}/redo`)).status).toBe(409);
  });
});

describe('tax deductions', () => {
  it('an organise token claims past money out, never replacing or removing a claim', async () => {
    ownRow('t1', -1000);
    ownRow('t2', -500);
    ownRow('later', -900, '2099-01-01');
    ownRow('refund', 300);
    const token = await newToken('organise');
    const { data } = await tool(token, 'claim_tax_deductions', {
      transaction_ids: ['t1', 'later', 'refund', 'missing'],
      label: 'D5',
      work_use_percent: 25,
      notes: 'Software subscription, 25% work use',
    });
    expect(data.claimed).toBe(1);
    expect(data.results.map((r: { error?: string }) => r.error)).toEqual([
      undefined,
      'Dated in the future',
      'Not money out',
      'Not found',
    ]);
    const again = await tool(token, 'claim_tax_deductions', {
      transaction_ids: ['t1'],
      label: 'D1',
    });
    expect(again.data.results[0].error).toMatch(/Already claimed/);
    // The API refuses the same directly: replacing, removing, future rows, CSV and receipts
    expect((await call('PUT', '/tax/claims/t1', { token }, { label: 'D1' })).status).toBe(403);
    expect((await call('DELETE', '/tax/claims/t1', { token })).status).toBe(403);
    expect((await call('PUT', '/tax/claims/later', { token }, { label: 'D5' })).status).toBe(403);
    expect(
      (await call('PUT', '/tax/claims/t2', { token }, { label: 'D5', receipt: 'x' })).status,
    ).toBe(403);
    expect((await call('GET', '/tax/years/2025/csv', { token })).status).toBe(403);
    expect((await call('GET', '/tax/years/2025/archive', { token })).status).toBe(403);
    const year = (await tool(token, 'tax_deductions', { financial_year: 2025 })).data.year;
    expect(year.claims).toHaveLength(1);
    expect(year.claims[0]).toMatchObject({
      transactionId: 't1',
      label: 'D5',
      workUseBps: 2500,
      cost: 1000,
      claim: 250,
      notes: 'Software subscription, 25% work use',
    });
    // The owner still changes and removes claims
    expect((await call('PUT', '/tax/claims/t1', {}, { label: 'D4' })).status).toBe(200);
    expect((await call('DELETE', '/tax/claims/t1')).status).toBe(204);
  });

  it('read and categorise tokens neither claim nor see claims', async () => {
    for (const scope of ['read', 'categorise'] as const) {
      const token = await newToken(scope);
      expect(await toolNames(token)).not.toContain('claim_tax_deductions');
      expect((await call('PUT', '/tax/claims/t2', { token }, { label: 'D5' })).status).toBe(403);
      expect((await call('GET', '/tax/years/2025', { token })).status).toBe(403);
    }
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

describe('household tools', () => {
  // A flat of three sharing rent of $30 (mock amounts) paid from a joint account, $10 each
  const R = (id: string, accountId: string, date: string, amount: number, extra = {}) =>
    db
      .insert(transactions)
      .values({ id, accountId, date, amount, categoryId: 'coffee', ...extra })
      .run();
  beforeAll(async () => {
    db.insert(accounts).values({ id: 'joint', name: 'Joint', type: 'checking' }).run();
    db.insert(accounts).values({ id: 'shared-saver', name: 'Saver', type: 'savings' }).run();
    db.insert(householdGroups)
      .values({ id: 'flat', name: 'Flat', currency: 'AUD', accountId: 'joint' })
      .run();
    for (const [id, name, isSelf] of [
      ['me', 'Owner', 1],
      ['ana', 'Ana', 0],
      ['ben', 'Ben', 0],
    ] as const)
      db.insert(householdPeople).values({ id, groupId: 'flat', name, isSelf }).run();
    db.insert(payees).values({ id: 'landlord', name: 'Mock Rentals' }).run();
    db.insert(schedules)
      .values({
        id: 'rent',
        name: 'Rent',
        amount: -3000,
        recurrenceType: 'monthly',
        startDate: '2026-02-01',
        accountId: 'joint',
        payeeId: 'landlord',
      })
      .run();
    const split = {
      mode: 'exact',
      shares: ['me', 'ana', 'ben'].map((p) => ({ personId: p, value: 1000 })),
    };
    db.insert(householdRecurringBills)
      .values({ scheduleId: 'rent', groupId: 'flat', splitJson: JSON.stringify(split) })
      .run();
    R('rent1', 'joint', '2026-02-01', -3000, { payeeId: 'landlord', payeeName: 'Mock Rentals' });
    R('rent2', 'joint', '2026-03-01', -3000, { payeeId: 'landlord', payeeName: 'Mock Rentals' });
    R('ana1', 'joint', '2026-01-29', 1000, { payeeName: 'Ana', importedPayee: 'ANA MOCKPERSON' });
    R('ana2', 'joint', '2026-02-27', 1000, { payeeName: 'Ana', importedPayee: 'Ana Mockperson' });
    R('ana-bills', 'joint', '2026-02-10', 50, { payeeName: 'Ana', notes: 'Internet' });
    R('ben1', 'joint', '2026-01-30', 1010, { payeeName: 'Ben Mock' });
    // The owner's own transfer in, and a shared saver covering the whole rent
    R('me-out', 'spend', '2026-01-28', -1000, { transferTransactionId: 'me-in' });
    R('me-in', 'joint', '2026-01-28', 1000, { transferTransactionId: 'me-out' });
    R('cover-out', 'shared-saver', '2026-02-26', -3000, { transferTransactionId: 'cover-in' });
    R('cover-in', 'joint', '2026-02-26', 3000, { transferTransactionId: 'cover-out' });
    R('personal-in', 'spend', '2026-01-29', 1000, { payeeName: 'Ana' });
    for (const [id, date] of [
      ['rent1', '2026-02-01'],
      ['rent2', '2026-03-01'],
    ])
      expect(
        (
          await call(
            'POST',
            '/households/flat/events',
            {},
            {
              kind: 'expense',
              date,
              description: 'Rent',
              amount: 3000,
              transactionId: id,
              mode: 'exact',
              shares: split.shares,
            },
          )
        ).status,
      ).toBe(201);
  });

  it('reconciles a shared bill person by person for any token', async () => {
    const token = await newToken('read');
    const { data, isError } = await tool(token, 'household_bill_reconciliation', {
      household_id: 'flat',
      schedule_id: 'rent',
    });
    expect(isError).toBe(false);
    expect(data).toMatchObject({ payments: 2, total: 6000 });
    const by = Object.fromEntries(
      (data.people as { personId: string }[]).map((p) => [p.personId, p]),
    ) as Record<string, Record<string, unknown>>;
    expect(by.ana).toMatchObject({ owed: 2000, paid: 2000, difference: 0, unmatchedPayments: 0 });
    expect(by.ana.toRecord).toEqual([
      { transactionId: 'ana1', personId: 'ana' },
      { transactionId: 'ana2', personId: 'ana' },
    ]);
    expect(by.ana.otherDeposits).toEqual([expect.objectContaining({ transactionId: 'ana-bills' })]);
    // Within 2% (or $1) of a share counts; the rest stays owing
    expect(by.ben).toMatchObject({
      owed: 2000,
      paid: 1010,
      difference: -990,
      unmatchedPayments: 1,
    });
    // Your own transfer in counts; a shared saver's whole-rent cover never matches a share
    expect(by.me).toMatchObject({ owed: 2000, paid: 1000, unmatchedPayments: 1 });
    const suggestions = await tool(token, 'household_contribution_suggestions', {
      household_id: 'flat',
    });
    expect(suggestions.isError).toBe(false);
    expect(await toolNames(token)).not.toContain('record_household_contributions');
    const body = {
      kind: 'contribution',
      date: '2026-01-29',
      description: 'Rent',
      amount: 1000,
      payerId: 'ana',
      transactionId: 'ana1',
    };
    expect((await call('POST', '/households/flat/events', { token }, body)).status).toBe(403);
  });

  it('an organise token records only contributions linked to a household deposit', async () => {
    const token = await newToken('organise');
    const { data } = await tool(token, 'record_household_contributions', {
      household_id: 'flat',
      contributions: [
        { transaction_id: 'ana1', person_id: 'ana', description: 'Rent' },
        { transaction_id: 'ana2', person_id: 'ana' },
        { transaction_id: 'rent1', person_id: 'ana' },
        { transaction_id: 'personal-in', person_id: 'ana' },
        { transaction_id: 'ben1', person_id: 'nobody' },
      ],
    });
    expect(data.recorded).toBe(2);
    expect(data.results.map((r: { error?: string }) => r.error)).toEqual([
      undefined,
      undefined,
      'Not money in',
      expect.stringMatching(/Refused/),
      expect.stringMatching(/another household|payer/i),
    ]);
    const again = await tool(token, 'record_household_contributions', {
      household_id: 'flat',
      contributions: [{ transaction_id: 'ana1', person_id: 'ana' }],
    });
    expect(again.data.results[0].error).toMatch(/already linked/);
    // The API refuses anything else a token might try
    const base = { date: '2026-01-30', description: 'x', payerId: 'ben', transactionId: 'ben1' };
    for (const body of [
      { ...base, kind: 'contribution', amount: 1000 }, // not the deposit's amount
      { ...base, kind: 'contribution', amount: 1010, date: '2026-01-31' }, // not its date
      { ...base, kind: 'settlement', amount: 1010, recipientId: 'me' },
      { ...base, kind: 'contribution', amount: 1010, billId: 'b' },
      { kind: 'contribution', date: '2026-01-30', description: 'x', amount: 1010, payerId: 'ben' },
      {
        kind: 'expense',
        date: '2026-02-01',
        description: 'x',
        amount: 3000,
        transactionId: 'rent1',
      },
    ])
      expect((await call('POST', '/households/flat/events', { token }, body)).status).toBe(403);
    const snapshot = (await call('GET', '/households/flat')).body;
    const recorded = snapshot.events.filter((e: { kind: string }) => e.kind === 'contribution');
    expect(recorded).toHaveLength(2);
    expect(
      (await call('DELETE', `/households/flat/events/${recorded[0].id}`, { token })).status,
    ).toBe(403);
    const after = await tool(token, 'household_bill_reconciliation', {
      household_id: 'flat',
      schedule_id: 'rent',
    });
    const ana = after.data.people.find((p: { personId: string }) => p.personId === 'ana');
    expect(ana.toRecord).toEqual([]);
    expect(
      ana.matches.every((m: { deposit: { recordedEventId: string } }) => m.deposit.recordedEventId),
    ).toBe(true);
  });
  it('ignores moves between household accounts and counts refunds as less owed', async () => {
    // A second household account, and a share-sized move into the first that names Ana
    db.insert(accounts).values({ id: 'joint2', name: 'Ana Saver', type: 'savings' }).run();
    db.insert(householdPoolAccounts).values({ groupId: 'flat', accountId: 'joint2' }).run();
    R('move-out', 'joint2', '2026-01-31', -1000, { transferTransactionId: 'move-in' });
    R('move-in', 'joint', '2026-01-31', 1000, {
      transferTransactionId: 'move-out',
      payeeName: 'Transfer: Ana Saver',
    });
    const token = await newToken('organise');
    const rec = async () =>
      (
        await tool(token, 'household_bill_reconciliation', {
          household_id: 'flat',
          schedule_id: 'rent',
        })
      ).data;
    const before = await rec();
    const ben = before.people.find((p: { personId: string }) => p.personId === 'ben');
    expect(JSON.stringify(before)).not.toContain('move-in');
    expect(ben.paid).toBe(1010);
    const { data } = await tool(token, 'record_household_contributions', {
      household_id: 'flat',
      contributions: [{ transaction_id: 'move-in', person_id: 'ana' }],
    });
    expect(data.recorded).toBe(0);
    expect(data.results[0].error).toMatch(/Refused/);
    // $3 of the second rent comes back: $1 less owed each, and $3 less in total
    const snapshot = (await call('GET', '/households/flat')).body;
    const rent2 = snapshot.events.find(
      (e: { transactionId: string }) => e.transactionId === 'rent2',
    );
    expect(
      (
        await call(
          'POST',
          '/households/flat/events',
          {},
          {
            kind: 'refund',
            date: '2026-03-05',
            description: 'Rent refund',
            amount: 300,
            reversesId: rent2.id,
          },
        )
      ).status,
    ).toBe(201);
    const after = await rec();
    expect(after.total).toBe(5700);
    expect(after.people.find((p: { personId: string }) => p.personId === 'ana')).toMatchObject({
      owed: 1900,
      paid: 2000,
      difference: 100,
    });
  });
  it('records your own unlinked contribution, only up to what you owe', async () => {
    const read = await newToken('read');
    expect(await toolNames(read)).not.toContain('record_own_household_contribution');
    const token = await newToken('organise');
    const owes = async () => -(await call('GET', '/households/flat')).body.toPool.me as number;
    expect(await owes()).toBe(1900);
    const body = { kind: 'contribution', date: '2026-03-01', description: 'Rent via saver' };
    // Never someone else's, never in the future, never more than you owe, never by a read token
    for (const [auth, extra] of [
      [token, { amount: 1000, payerId: 'ana' }],
      [token, { amount: 1000, payerId: 'me', date: '2099-01-01' }],
      [token, { amount: 1901, payerId: 'me' }],
      [token, { amount: 1000, payerId: 'me', billId: 'b' }],
      [read, { amount: 1000, payerId: 'me' }],
    ] as const)
      expect(
        (await call('POST', '/households/flat/events', { token: auth }, { ...body, ...extra }))
          .status,
      ).toBe(403);
    const over = await tool(token, 'record_own_household_contribution', {
      household_id: 'flat',
      amount: 2000,
      date: '2026-03-01',
      description: 'Rent via saver',
    });
    expect(over.data.error).toMatch(/more than you owe/);
    const { data } = await tool(token, 'record_own_household_contribution', {
      household_id: 'flat',
      amount: 1900,
      date: '2026-03-01',
      description: 'Rent via saver',
    });
    expect(data).toMatchObject({ recorded: true, personId: 'me', owesHouseholdAccountNow: 0 });
    const again = await tool(token, 'record_own_household_contribution', {
      household_id: 'flat',
      amount: 1,
      date: '2026-03-01',
      description: 'Rent via saver',
    });
    expect(again.data.error).toMatch(/owe the household account nothing/);
  });
});

describe('tax claim candidates', () => {
  it('finds unclaimed repeats of claimed payees for organise tokens only', async () => {
    db.insert(payees).values({ id: 'softco', name: 'Mock Software Co' }).run();
    const sub = (id: string, date: string) =>
      db
        .insert(transactions)
        .values({
          id,
          accountId: 'spend',
          date,
          amount: -2000,
          payeeId: 'softco',
          payeeName: 'Mock Software Co',
          categoryId: 'groceries',
        })
        .run();
    sub('sub1', '2025-08-01');
    sub('sub2', '2025-09-01');
    sub('sub3', '2025-10-01');
    expect(
      (await call('PUT', '/tax/claims/sub1', {}, { label: 'D5', workUseBps: 2500 })).status,
    ).toBe(200);
    expect(
      (await call('PUT', '/tax/claims/sub3', {}, { label: 'D5', workUseBps: 2500 })).status,
    ).toBe(200);
    const token = await newToken('organise');
    const { data } = await tool(token, 'tax_claim_candidates', { financial_year: 2025 });
    const ids = data.candidates.map((c: { transactionId: string }) => c.transactionId);
    expect(ids).toContain('sub2');
    expect(ids).not.toContain('sub1');
    expect(
      data.candidates.find((c: { transactionId: string }) => c.transactionId === 'sub2'),
    ).toMatchObject({
      basis: 'payee',
      suggestedLabel: 'D5',
      suggestedWorkUsePercent: 25,
      cost: 2000,
    });
    const years = await tool(token, 'tax_years');
    expect(years.data.years[0]).toHaveProperty('financialYear');
    expect(years.data.labels.map((l: { label: string }) => l.label)).toContain('D5');
    expect((await tool(token, 'tax_claim', { transaction_id: 'sub1' })).data.claim).toMatchObject({
      label: 'D5',
    });
    const read = await newToken('read');
    expect(await toolNames(read)).not.toContain('tax_claim_candidates');
    expect((await call('GET', '/tax/years/2025/candidates', { token: read })).status).toBe(403);
  });
});
