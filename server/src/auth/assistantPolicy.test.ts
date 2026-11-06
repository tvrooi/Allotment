import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// The assistant policy table (docs/ASSISTANT-ENDPOINTS.md) and phase 3 (docs/ASSISTANT-PHASE-3.md):
// every row's allowed case and nearest refusal, and, for each row whose rule depends on the
// budget, that its check runs again inside the write. A middleware between requireSession and the
// routers changes the budget after the first check, as another request could if a route ever
// awaited; the write must then be refused, change nothing and be logged as refused.
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
  householdEvents,
  householdGroups,
  householdPeople,
  rules,
  taxClaims,
  transactions,
} = await import('../db/schema.js');
const { hostGuard, originGuard, errorHandler } = await import('../middleware/security.js');
const { authRouter, requireSession } = await import('../routes/auth.js');
const { createSession, setInitialPassword, SESSION_COOKIE } = await import('./sessions.js');
const { ASSISTANT_ACTIONS } = await import('./assistantPolicy.js');
const { CHANGED_BEFORE_SAVING } = await import('./assistantRefusal.js');
const { listAssistantActions } = await import('../services/assistantLog.js');
const { recordEvent, snapshot } = await import('../services/householdService.js');
const { setClaim } = await import('../services/taxService.js');
const { accessTokensRouter } = await import('../routes/accessTokens.js');
const { assistantDispatch, assistantRouter } = await import('../routes/assistant.js');
const { transactionsRouter } = await import('../routes/transactions.js');
const { rulesRouter } = await import('../routes/rules.js');
const { taxRouter } = await import('../routes/tax.js');
const { householdsRouter } = await import('../routes/households.js');

let server: Server;
let base: string;
let cookie: string;
/** Runs once, after requireSession's check and before the route: another request's change */
let meddle: (() => void) | undefined;

const PAST = '2026-01-10';
const FUTURE = '2999-01-01';

beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  await setInitialPassword('correct horse battery staple');
  cookie = `${SESSION_COOKIE}=${createSession('vitest').token}`;
  db.insert(accounts).values({ id: 'spend', name: 'Spending', type: 'checking' }).run();
  db.insert(accounts).values({ id: 'saver', name: 'Saver', type: 'savings' }).run();
  db.insert(accounts).values({ id: 'joint', name: 'Joint', type: 'checking' }).run();
  db.insert(categoryGroups).values({ id: 'g', name: 'Food', isIncome: 0 }).run();
  db.insert(categories).values({ id: 'groceries', groupId: 'g', name: 'Groceries' }).run();
  db.insert(categories).values({ id: 'coffee', groupId: 'g', name: 'Coffee' }).run();
  const tx = (id: string, accountId: string, amount: number, extra = {}) =>
    db
      .insert(transactions)
      .values({ id, accountId, date: PAST, amount, ...extra })
      .run();
  tx('cat', 'spend', -1000);
  tx('cat2', 'spend', -1100);
  tx('cafe1', 'spend', -450, { payeeName: 'Mock Cafe' });
  tx('cafe2', 'spend', -460, { payeeName: 'Mock Cafe' });
  tx('out', 'spend', -7700, { payeeName: 'To saver' });
  tx('in', 'saver', 7700, { payeeName: 'From spending' });
  tx('claim1', 'spend', -3000, { payeeName: 'Mock Software' });
  tx('claim2', 'spend', -3100, { payeeName: 'Mock Software' });
  // A two-person household paying a $20 bill from its joint account, $10 each
  db.insert(householdGroups)
    .values({ id: 'home', name: 'Home', currency: 'AUD', accountId: 'joint' })
    .run();
  db.insert(householdPeople).values({ id: 'me', groupId: 'home', name: 'Owner', isSelf: 1 }).run();
  db.insert(householdPeople).values({ id: 'ana', groupId: 'home', name: 'Ana', isSelf: 0 }).run();
  tx('bill', 'joint', -2000, { date: '2026-01-05', payeeName: 'Mock Power' });
  tx('ana-in', 'joint', 1000, { date: '2026-01-20', payeeName: 'Ana' });
  recordEvent('home', {
    kind: 'expense',
    date: '2026-01-05',
    description: 'Power',
    amount: 2000,
    transactionId: 'bill',
    mode: 'exact',
    shares: [
      { personId: 'me', value: 1000 },
      { personId: 'ana', value: 1000 },
    ],
  });

  const app = express();
  app.use(hostGuard, originGuard, express.json());
  app.use('/api/auth', authRouter);
  app.use(assistantDispatch);
  app.use('/api', requireSession);
  app.use('/api', (_req, _res, next) => {
    const change = meddle;
    meddle = undefined;
    change?.();
    next();
  });
  app.use('/api/assistant', assistantRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/rules', rulesRouter);
  app.use('/api/tax', taxRouter);
  app.use('/api/households', householdsRouter);
  app.use('/api/access-tokens', accessTokensRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  else headers.cookie = cookie;
  const res = await fetch(base + (token ? '/assistant/do' : '') + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

let organise: string;
async function token() {
  if (organise) return organise;
  const res = await call('POST', '/access-tokens', null, {
    name: 'Organiser',
    days: 7,
    scope: 'organise',
  });
  expect(res.status).toBe(201);
  organise = res.body.token;
  return organise;
}

const row = (id: string) => db.select().from(transactions).where(eq(transactions.id, id)).get()!;
const latest = () => listAssistantActions(1)[0];

/** The write was refused by the check inside it: 403, nothing changed, logged as refused */
function expectRefusedInside(res: { status: number; body: { error: string } }, action: string) {
  expect(res.status).toBe(403);
  expect(res.body.error.startsWith(CHANGED_BEFORE_SAVING)).toBe(true);
  expect(latest()).toMatchObject({ action, outcome: 'refused', status: 403 });
  expect(latest().reason).toBe(res.body.error);
}

// ─── Rows whose rule depends on the budget ─────────────────────────────────────

/** Each row with a check: its allowed case, early refusal and refusal inside the write */
const CHECKED: Record<string, () => Promise<void>> = {
  async categorise_transaction() {
    const t = await token();
    const put = (id: string) => call('PUT', `/transactions/${id}`, t, { categoryId: 'groceries' });
    expect((await put('cat')).status).toBe(200);
    expect(row('cat').categoryId).toBe('groceries');
    // Nearest refusals, at the first check: a reconciled row, a future one
    db.update(transactions).set({ reconciled: 1 }).where(eq(transactions.id, 'cat2')).run();
    const reconciled = await put('cat2');
    expect(reconciled).toMatchObject({
      status: 403,
      body: { error: 'Cannot modify a reconciled transaction' },
    });
    expect(latest()).toMatchObject({ action: 'categorise_transaction', outcome: 'refused' });
    db.update(transactions).set({ reconciled: 0 }).where(eq(transactions.id, 'cat2')).run();
    // Changed after the first check: reconciled, or moved into the future
    meddle = () =>
      db.update(transactions).set({ reconciled: 1 }).where(eq(transactions.id, 'cat2')).run();
    expectRefusedInside(await put('cat2'), 'categorise_transaction');
    db.update(transactions).set({ reconciled: 0 }).where(eq(transactions.id, 'cat2')).run();
    meddle = () =>
      db.update(transactions).set({ date: FUTURE }).where(eq(transactions.id, 'cat2')).run();
    expectRefusedInside(await put('cat2'), 'categorise_transaction');
    expect(row('cat2').categoryId).toBeNull();
  },

  async edit_proposed_rule() {
    const t = await token();
    const conditions = [{ field: 'payee_name', op: 'contains', value: 'Cafe' }];
    db.insert(rules)
      .values({
        id: 'proposed',
        conditions: JSON.stringify(conditions),
        actions: JSON.stringify([{ type: 'set_category', value: 'coffee' }]),
        enabled: 0,
      })
      .run();
    const edit = (value: string) =>
      call('PUT', '/rules/proposed', t, {
        conditions: [{ field: 'payee_name', op: 'contains', value }],
      });
    expect((await edit('Mock')).status).toBe(200);
    // The owner enables it (accepting it) after the first check
    meddle = () => db.update(rules).set({ enabled: 1 }).where(eq(rules.id, 'proposed')).run();
    expectRefusedInside(await edit('Changed'), 'edit_proposed_rule');
    const rule = db.select().from(rules).where(eq(rules.id, 'proposed')).get()!;
    expect(JSON.parse(rule.conditions)[0].value).toBe('Mock');
    // Nearest refusal at the first check: it is enabled now
    expect((await edit('Changed')).status).toBe(403);
  },

  async apply_rule() {
    const t = await token();
    db.insert(rules)
      .values({
        id: 'cafes',
        conditions: JSON.stringify([{ field: 'payee_name', op: 'contains', value: 'Cafe' }]),
        actions: JSON.stringify([{ type: 'set_category', value: 'coffee' }]),
        enabled: 0,
      })
      .run();
    const apply = (id: string) =>
      call('POST', '/rules/apply', t, {
        scope: 'uncategorized',
        ruleIds: ['cafes'],
        transactionIds: [id],
      });
    expect((await apply('cafe1')).body).toEqual({ updated: 1 });
    expect(row('cafe1').categoryId).toBe('coffee');
    // The rule gains a second action after the first check
    meddle = () =>
      db
        .update(rules)
        .set({
          actions: JSON.stringify([
            { type: 'set_category', value: 'coffee' },
            { type: 'set_notes', value: 'changed' },
          ]),
        })
        .where(eq(rules.id, 'cafes'))
        .run();
    expectRefusedInside(await apply('cafe2'), 'apply_rule');
    expect(row('cafe2')).toMatchObject({ categoryId: null, notes: null });
    // Nearest refusal at the first check: it now changes more than a category
    expect((await apply('cafe2')).status).toBe(403);
  },

  async link_transfer() {
    const t = await token();
    const link = () =>
      call('POST', '/transactions/transfers/link', t, {
        transactionId: 'out',
        otherTransactionId: 'in',
      });
    // Nearest refusal at the first check: a pair the server doesn't suggest
    expect(
      (
        await call('POST', '/transactions/transfers/link', t, {
          transactionId: 'cafe2',
          otherTransactionId: 'in',
        })
      ).status,
    ).toBe(403);
    // The amount changes after the first check, so the pair is no longer suggested
    meddle = () =>
      db.update(transactions).set({ amount: 7600 }).where(eq(transactions.id, 'in')).run();
    expectRefusedInside(await link(), 'link_transfer');
    expect(row('out').transferTransactionId).toBeNull();
    db.update(transactions).set({ amount: 7700 }).where(eq(transactions.id, 'in')).run();
    expect((await link()).status).toBe(200);
    expect(row('out').transferTransactionId).toBe('in');
  },

  async claim_tax_deduction() {
    const t = await token();
    const claim = (id: string) => call('PUT', `/tax/claims/${id}`, t, { label: 'D5' });
    expect((await claim('claim1')).status).toBe(200);
    // Nearest refusal at the first check: replacing a claim
    expect((await claim('claim1')).status).toBe(403);
    // The owner claims it after the first check; the owner's claim stays
    meddle = () => setClaim('claim2', { label: 'D2' });
    expectRefusedInside(await claim('claim2'), 'claim_tax_deduction');
    expect(db.select().from(taxClaims).where(eq(taxClaims.transactionId, 'claim2')).get()).toEqual(
      expect.objectContaining({ label: 'D2' }),
    );
    // The owner still replaces a claim
    expect((await call('PUT', '/tax/claims/claim1', null, { label: 'D3' })).status).toBe(200);
  },

  async household_contribution() {
    const t = await token();
    const contribute = () =>
      call('POST', '/households/home/events', t, {
        kind: 'contribution',
        date: '2026-01-20',
        description: 'Ana’s share',
        amount: 1000,
        payerId: 'ana',
        transactionId: 'ana-in',
      });
    const events = () => db.select().from(householdEvents).all().length;
    const before = events();
    // The deposit's amount changes after the first check
    meddle = () =>
      db.update(transactions).set({ amount: 900 }).where(eq(transactions.id, 'ana-in')).run();
    expectRefusedInside(await contribute(), 'household_contribution');
    expect(events()).toBe(before);
    // Nearest refusal at the first check: the amounts differ
    expect((await contribute()).status).toBe(403);
    db.update(transactions).set({ amount: 1000 }).where(eq(transactions.id, 'ana-in')).run();
    expect((await contribute()).status).toBe(201);
    expect(events()).toBe(before + 1);
  },

  async own_household_contribution() {
    const t = await token();
    const owes = () => 0 - (snapshot('home').toPool.me ?? 0);
    const contribute = (amount: number) =>
      call('POST', '/households/home/events', t, {
        kind: 'contribution',
        date: PAST,
        description: 'Power via saver',
        amount,
        payerId: 'me',
      });
    expect(owes()).toBe(1000);
    expect((await contribute(400)).status).toBe(201);
    expect(owes()).toBe(600);
    // Nearest refusal at the first check: more than you owe
    expect((await contribute(601)).status).toBe(403);
    // The owner records the rest after the first check, so you owe nothing
    meddle = () =>
      recordEvent('home', {
        kind: 'contribution',
        date: PAST,
        description: 'The rest',
        amount: 600,
        payerId: 'me',
      });
    expectRefusedInside(await contribute(600), 'own_household_contribution');
    expect(owes()).toBe(0);
  },
};

describe('rows that read the budget check again inside the write', () => {
  for (const [name, run] of Object.entries(CHECKED)) it(name, run);

  it('a write the owner makes is unchanged', async () => {
    // The owner's request carries no check: a reconciled row's category and a future row
    db.update(transactions).set({ reconciled: 1 }).where(eq(transactions.id, 'cat2')).run();
    expect(
      (await call('PUT', '/transactions/cat2', null, { categoryId: 'coffee' })).body.categoryId,
    ).toBe('coffee');
  });

  it('a token’s claim is only ever inserted, even if a check were wrong', () => {
    setClaim('claim1', { label: 'D5' });
    expect(() => setClaim('claim1', { label: 'D4' }, { guard: () => {} })).toThrow(
      /already claimed/,
    );
    expect(db.select().from(taxClaims).where(eq(taxClaims.transactionId, 'claim1')).get()).toEqual(
      expect.objectContaining({ label: 'D5' }),
    );
  });
});

// ─── Rows that decide from the request alone ───────────────────────────────────

/** Each row without a check: [method, path, body] allowed, then the nearest refusal */
type Case = [string, string, unknown];
const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
const REQUEST_ONLY: Record<string, [Case, Case]> = {
  manage_categories: [
    ['PUT', '/categories/c', { name: 'Renamed', hidden: true }],
    ['PUT', '/categories/reorder', { name: 'Renamed' }],
  ],
  undo_change_set: [
    ['POST', '/change-sets/s/undo', undefined],
    ['POST', '/change-sets/s/redo', undefined],
  ],
  rule_dry_run: [
    ['POST', '/rules/preview', { scope: 'all' }],
    ['POST', '/rules/apply', { scope: 'all' }],
  ],
  propose_rule: [
    ['POST', '/rules', { enabled: false, conditions: [], actions: [] }],
    ['POST', '/rules', { enabled: true, conditions: [], actions: [] }],
  ],
  payee_default_category: [
    ['PUT', '/payees/p', { defaultCategoryId: 'coffee' }],
    ['PUT', '/payees/p', { defaultCategoryId: 'coffee', name: 'Renamed' }],
  ],
  payee_logo: [
    ['PUT', '/payees/p', { logo: LOGO }],
    ['PUT', '/payees/p', { logo: null }],
  ],
  suggest_assignments: [
    ['POST', '/budget-proposals', { month: '2026-10', rows: [] }],
    ['POST', '/budget-proposals/b/apply', {}],
  ],
  propose_change: [
    ['POST', '/assistant/proposals', { kind: 'asset.create' }],
    ['POST', '/assistant/proposals/x/apply', {}],
  ],
};

describe('rows that decide from the request alone', () => {
  it('allow their case and refuse the nearest, reading nothing from the budget', () => {
    const read = vi.spyOn(db, 'select').mockImplementation(() => {
      throw new Error('A request-only row read the budget');
    });
    try {
      for (const [name, [allowed, refused]] of Object.entries(REQUEST_ONLY)) {
        const action = ASSISTANT_ACTIONS.find((a) => a.name === name)!;
        expect(action.check, name).toBeUndefined();
        expect(action.matches(...allowed), `${name} allows`).toBe(true);
        expect(action.matches(...refused), `${name} refuses`).toBe(false);
      }
    } finally {
      read.mockRestore();
    }
  });
});

describe('the table', () => {
  it('has a check exactly where a refusal-inside-the-write test exists', () => {
    for (const action of ASSISTANT_ACTIONS) {
      if (action.check) expect(Object.keys(CHECKED), action.name).toContain(action.name);
      else expect(Object.keys(REQUEST_ONLY), action.name).toContain(action.name);
    }
    expect(Object.keys(CHECKED).length + Object.keys(REQUEST_ONLY).length).toBe(
      ASSISTANT_ACTIONS.length,
    );
  });
});
