import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// The long-term forecast API, backups and read-only access (docs/LONG-TERM-FORECAST.md §14),
// in server mode so tokens apply. Mock data only.
process.env.FLYBUDGET_SERVER_MODE = 'true';
process.env.FLYBUDGET_ALLOWED_HOSTS = 'budget.example.com';

const express = (await import('express')).default;
const { eq } = await import('drizzle-orm');
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { db } = await import('../db/index.js');
const {
  accountLoanDetails,
  accounts,
  longTermEvents,
  longTermPlans,
  transactions,
  goals,
  schedules,
  budgetMonths,
} = await import('../db/schema.js');
const { hostGuard, originGuard, errorHandler } = await import('../middleware/security.js');
const { authRouter, requireSession } = await import('./auth.js');
const { createSession, setInitialPassword, SESSION_COOKIE } = await import('../auth/sessions.js');
const { accessTokensRouter } = await import('./accessTokens.js');
const { exportRouter } = await import('./export.js');
const { forecastRouter } = await import('./forecast.js');
const { mcpRouter } = await import('./mcp.js');
const { transactionsRouter } = await import('./transactions.js');
const { BACKUP_TABLES } = await import('../services/backupService.js');

let server: Server;
let base: string;
let cookie: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  await setInitialPassword('correct horse battery staple');
  cookie = `${SESSION_COOKIE}=${createSession('vitest').token}`;
  const app = express();
  app.use(hostGuard, originGuard, (req, res, next) =>
    req.path === '/api/export/restore' ? next() : express.json()(req, res, next),
  );
  app.use('/api/auth', authRouter);
  app.use('/api', requireSession);
  app.use('/api/forecast', forecastRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/access-tokens', accessTokensRouter);
  app.use('/api/mcp', mcpRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

beforeEach(() => {
  db.delete(longTermPlans).run();
  db.delete(accountLoanDetails).run();
  db.delete(transactions).run();
  db.delete(accounts).run();
  db.insert(accounts)
    .values([
      { id: 'cash', name: 'Everyday', type: 'checking', startingBalance: 2_000_000 },
      { id: 'inv', name: 'Shares', type: 'investment', startingBalance: 8_000_000, isOffBudget: 1 },
      { id: 'sup', name: 'Super', type: 'retirement', startingBalance: 30_000_000, isOffBudget: 1 },
      {
        id: 'mort',
        name: 'Mortgage',
        type: 'mortgage',
        startingBalance: -20_000_000,
        isOffBudget: 1,
      },
    ])
    .run();
});

async function call(
  method: string,
  path: string,
  auth: { token?: string; session?: boolean } = { session: true },
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

const LT = '/forecast/long-term';
const newPlan = (name = 'Base', extra: Record<string, unknown> = {}) => ({
  name,
  settings: {
    birthYear: 1985,
    income: { takeHome: 9_000_000, grossForSuper: 11_000_000, escalation: { mode: 'inflation' } },
    spending: { annual: 6_000_000, escalation: { mode: 'inflation' } },
  },
  ...extra,
});
const retire = {
  id: 'ret',
  kind: 'retirement',
  name: 'Retire',
  start: { age: 60 },
  spendingMultiplierBps: 7000,
  reductions: { salary: 10000 },
};
async function save(name = 'Base', extra: Record<string, unknown> = {}) {
  const res = await call('POST', `${LT}/plans`, { session: true }, { plan: newPlan(name, extra) });
  expect(res.status).toBe(201);
  return res.body as { id: string; version: number; plan: { name: string } };
}
async function token(scope?: 'categorise') {
  const res = await call(
    'POST',
    '/access-tokens',
    { session: true },
    { name: 'Assistant', days: 7, ...(scope ? { scope } : {}) },
  );
  expect(res.status).toBe(201);
  return res.body.token as string;
}

describe('plans over the API', () => {
  it('saves, reads, edits and deletes with versions', async () => {
    const saved = await save('Base', { events: [retire] });
    expect(saved.version).toBe(1);
    expect((await call('GET', `${LT}/plans`)).body).toEqual([
      expect.objectContaining({ id: saved.id, name: 'Base', eventCount: 1 }),
    ]);
    const got = await call('GET', `${LT}/plans/${saved.id}`);
    expect(got.body.plan.settings).toMatchObject({
      endAge: 95,
      inflationBps: 250,
      preservationAge: 60,
    });

    const put = await call(
      'PUT',
      `${LT}/plans/${saved.id}`,
      { session: true },
      { plan: newPlan('Renamed'), expectedVersion: 1 },
    );
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ version: 2 });
    expect(put.body.plan.events).toEqual([]);

    const stale = await call(
      'PUT',
      `${LT}/plans/${saved.id}`,
      { session: true },
      { plan: newPlan('Mine'), expectedVersion: 1 },
    );
    expect(stale.status).toBe(409);
    expect(stale.body.current.plan.name).toBe('Renamed');
    expect((await call('DELETE', `${LT}/plans/${saved.id}?expectedVersion=1`)).status).toBe(409);
    expect((await call('DELETE', `${LT}/plans/${saved.id}?expectedVersion=2`)).status).toBe(204);
    expect((await call('GET', `${LT}/plans/${saved.id}`)).status).toBe(404);
    const gone = await call(
      'PUT',
      `${LT}/plans/${saved.id}`,
      { session: true },
      { plan: newPlan('Renamed'), expectedVersion: 2 },
    );
    expect(gone.status).toBe(409);
    expect(gone.body.current).toBeNull();
  });

  it('duplicates, and refuses duplicate names and bad input', async () => {
    const saved = await save();
    const copy = await call(
      'POST',
      `${LT}/plans/${saved.id}/duplicate`,
      { session: true },
      { name: 'Copy' },
    );
    expect(copy.status).toBe(201);
    expect(copy.body.id).not.toBe(saved.id);
    expect(
      (await call('POST', `${LT}/plans/${saved.id}/duplicate`, { session: true }, { name: 'base' }))
        .status,
    ).toBe(409);
    expect(
      (
        await call(
          'POST',
          `${LT}/plans`,
          { session: true },
          { plan: newPlan('x', { events: [{ ...retire, id: 'a:b' }] }) },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          'POST',
          `${LT}/plans`,
          { session: true },
          { plan: { ...newPlan('y'), extra: 1 } },
        )
      ).status,
    ).toBe(400);
    expect((await call('POST', `${LT}/plans`, { session: true }, {})).status).toBe(400);
  });

  it('serves defaults and the starting point', async () => {
    const defaults = await call('GET', `${LT}/defaults?birthYear=1990`);
    expect(defaults.body.settings).toMatchObject({ birthYear: 1990, superGuaranteeBps: 1200 });
    expect(defaults.body.classGrowthBps.vehicles).toBe(-1500);
    const point = await call('GET', `${LT}/starting-point`);
    expect(point.body.accounts.map((a: { id: string }) => a.id).sort()).toEqual([
      'cash',
      'inv',
      'sup',
    ]);
    expect(point.body.loans).toEqual([
      expect.objectContaining({ id: 'mort', balance: -20_000_000, details: null }),
    ]);
  });

  it('runs a plan and compares two, on one starting point', async () => {
    const a = await save('Base', { events: [retire] });
    const b = await save('No retirement');
    const result = await call('GET', `${LT}/plans/${a.id}/result`);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      name: 'Base',
      retirementAge: 60,
      inputs: { income: 9_000_000, spending: 6_000_000 },
    });
    expect(
      result.body.years.every((y: { bridgeDifference: number }) => y.bridgeDifference === 0),
    ).toBe(true);
    const cmp = await call('GET', `${LT}/plans/${a.id}/compare?reference=${b.id}`);
    expect(cmp.status).toBe(200);
    expect(cmp.body.active.name).toBe('Base');
    expect(cmp.body.reference.name).toBe('No retirement');
    expect(cmp.body.percentDefinition).toMatch(/reference plan/);
    expect(cmp.body.figures.map((f: { key: string }) => f.key)).toContain('endNetWorth');
    expect(cmp.body.series[0].difference).toBe(0);
    // The same comparison in today's dollars: smaller, with the dollars named
    const real = await call('GET', `${LT}/plans/${a.id}/compare?reference=${b.id}&dollars=today`);
    expect(real.body.dollars).toBe('today');
    const endOf = (c: any) => c.figures.find((f: any) => f.key === 'endNetWorth');
    expect(Math.abs(endOf(real.body).active)).toBeLessThan(Math.abs(endOf(cmp.body).active));
    expect(cmp.body.dollars).toBe('future');
    expect(
      (await call('GET', `${LT}/plans/${a.id}/compare?reference=${b.id}&dollars=x`)).status,
    ).toBe(400);
    expect((await call('GET', `${LT}/plans/${a.id}/compare`)).status).toBe(400);
    expect((await call('GET', `${LT}/plans/${a.id}/compare?reference=nope`)).status).toBe(404);
  });

  it('answers 422 when a plan cannot be run', async () => {
    const saved = await save('Old');
    const put = await call(
      'PUT',
      `${LT}/plans/${saved.id}`,
      { session: true },
      {
        plan: { ...newPlan('Old'), settings: { birthYear: 1900, endAge: 40 } },
        expectedVersion: 1,
      },
    );
    expect(put.status).toBe(200);
    const result = await call('GET', `${LT}/plans/${saved.id}/result`);
    expect(result.status).toBe(422);
    expect(result.body.error).toMatch(/end age/i);
  });
});

describe('simulation', () => {
  it('is a seeded read: the same seed gives the same answer, and nothing is written', async () => {
    const a = await save('Base', { events: [retire] });
    const url = `${LT}/plans/${a.id}/simulation`;
    const one = await call('GET', `${url}?paths=200&seed=5`);
    expect(one.status).toBe(200);
    expect(one.body).toMatchObject({ seed: 5, paths: 200, name: 'Base' });
    expect(one.body.successBps).toBeGreaterThanOrEqual(0);
    expect(one.body.successBps).toBeLessThanOrEqual(10_000);
    expect(one.body.percentiles).toEqual([5, 25, 50, 75, 95]);
    expect(one.body.volatilityBps).toMatchObject({ investments: 1600, property: 1000, cash: 0 });
    expect(one.body.bands.length).toBeGreaterThan(40);
    expect(one.body.bands[0].net).toHaveLength(5);
    expect(one.body.bands[1].inflationIndexPpb).toBeGreaterThan(1_000_000_000);
    const again = await call('GET', `${url}?paths=200&seed=5`);
    expect(again.body).toEqual(one.body);
    expect((await call('GET', `${url}?paths=200&seed=6`)).body.bands.at(-1).net).not.toEqual(
      one.body.bands.at(-1).net,
    );
    // Defaults, and refusals
    expect((await call('GET', url)).body).toMatchObject({ seed: 1, paths: 1000 });
    for (const q of ['paths=99', 'paths=2001', 'paths=x', 'seed=-1', 'seed=1.5'])
      expect((await call('GET', `${url}?${q}`)).status, q).toBe(400);
    expect((await call('GET', `${LT}/plans/nope/simulation`)).status).toBe(404);
    expect(db.select().from(longTermPlans).all()).toHaveLength(1);
  });

  it('is readable by a token and offered as a read-only MCP tool', async () => {
    const a = await save('Base', { events: [retire] });
    const t = await token();
    expect(
      (await call('GET', `${LT}/plans/${a.id}/simulation?paths=100`, { token: t })).status,
    ).toBe(200);
    const rpc = (body: unknown) => call('POST', '/mcp', { token: t }, body);
    const tools = (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).body.result.tools;
    expect(tools.map((x: { name: string }) => x.name)).toContain('long_term_simulation');
    const res = await rpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'long_term_simulation', arguments: { plan_id: a.id, paths: 100, seed: 9 } },
    });
    expect(res.body.result.isError).toBe(false);
    const out = JSON.parse(res.body.result.content[0].text);
    expect(out).toMatchObject({ seed: 9, paths: 100 });
    expect(res.body.result.content[0].text.length).toBeLessThan(60_000);
  });

  it('keeps volatility in the plan, with a default for older plans', async () => {
    const a = await save('Base');
    const got = await call('GET', `${LT}/plans/${a.id}`);
    expect(got.body.plan.settings.volatilityBps).toMatchObject({
      investments: 1600,
      super: 1600,
      property: 1000,
    });
    const changed = {
      ...got.body.plan,
      settings: {
        ...got.body.plan.settings,
        volatilityBps: { ...got.body.plan.settings.volatilityBps, investments: 2000 },
      },
    };
    const put = await call(
      'PUT',
      `${LT}/plans/${a.id}`,
      { session: true },
      { plan: changed, expectedVersion: 1 },
    );
    expect(put.body.plan.settings.volatilityBps.investments).toBe(2000);
    const sim = await call('GET', `${LT}/plans/${a.id}/simulation?paths=100`);
    expect(sim.body.volatilityBps.investments).toBe(2000);
  });
});

describe('study loans', () => {
  it('guesses the kind of a student loan account from its name', async () => {
    const { guessStudyKind } = await import('../services/longTermInputs.js');
    expect(
      [
        'HECS',
        'FEE-HELP',
        'Student Start-up Loan',
        'SSL',
        'ABSTUDY SSL',
        'Trade Support Loan',
        'VET Student Loan',
      ].map(guessStudyKind),
    ).toEqual(['help', 'help', 'ssl', 'ssl', 'abstudy_ssl', 'aasl', 'vsl']);
  });

  it('treats a student loan account as HECS-HELP unless the plan says otherwise', async () => {
    db.insert(accounts)
      .values({
        id: 'hecs',
        name: 'HECS',
        type: 'student_loan',
        startingBalance: -2_500_000,
        isOffBudget: 1,
      })
      .run();
    const plan = await save('Study');
    const run = await call('GET', `${LT}/plans/${plan.id}/result`);
    expect(run.status).toBe(200);
    expect(run.body.studyLoans).not.toBeNull();
    expect(run.body.years[1].studyCompulsory).toBeGreaterThan(0);
    expect(run.body.years[1].studyIndexation).toBeGreaterThan(0);
    expect(run.body.warnings.some((w: string) => w.startsWith('HECS has no repayment'))).toBe(
      false,
    );
    // Older plans read the defaults; 'other' makes it an ordinary loan with no repayment data
    const saved = await call('GET', `${LT}/plans/${plan.id}`);
    expect(saved.body.plan.settings.studyLoans).toMatchObject({ withheldFromPay: true, loans: [] });
    const other = await save('Private', {
      settings: {
        ...newPlan().settings,
        studyLoans: { loans: [{ accountId: 'hecs', kind: 'other' }] },
      },
    });
    const otherRun = await call('GET', `${LT}/plans/${other.id}/result`);
    expect(otherRun.body.studyLoans).toBeNull();
    expect(otherRun.body.warnings).toContain('HECS has no repayment data and stays flat');
  });
});

describe('loan details', () => {
  it('stores rate and repayment on a debt account, and only there', async () => {
    const put = await call(
      'PUT',
      `${LT}/loans/mort`,
      { session: true },
      { rateBps: 620, monthlyRepayment: 190_000, termMonths: 300 },
    );
    expect(put.status).toBe(200);
    expect((await call('GET', `${LT}/loans`)).body).toEqual([
      {
        accountId: 'mort',
        name: 'Mortgage',
        type: 'mortgage',
        details: { rateBps: 620, monthlyRepayment: 190_000, termMonths: 300 },
      },
    ]);
    const a = await save();
    const result = await call('GET', `${LT}/plans/${a.id}/result`);
    expect(result.body.years[1].loanInterest).toBeGreaterThan(0);
    expect(
      (
        await call(
          'PUT',
          `${LT}/loans/cash`,
          { session: true },
          { rateBps: 1, monthlyRepayment: 1, termMonths: null },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          'PUT',
          `${LT}/loans/nope`,
          { session: true },
          { rateBps: 1, monthlyRepayment: 1, termMonths: null },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await call(
          'PUT',
          `${LT}/loans/mort`,
          { session: true },
          { rateBps: -1, monthlyRepayment: 1, termMonths: null },
        )
      ).status,
    ).toBe(400);
    expect((await call('DELETE', `${LT}/loans/mort`)).status).toBe(204);
    expect((await call('GET', `${LT}/loans`)).body[0].details).toBeNull();
  });
});

describe('read-only access', () => {
  it('lets a token read plans and results, and refuses every write', async () => {
    const saved = await save('Base', { events: [retire] });
    const other = await save('Other');
    for (const scope of [undefined, 'categorise'] as const) {
      const t = await token(scope);
      const auth = { token: t };
      for (const path of [
        '/defaults',
        '/starting-point',
        '/plans',
        `/plans/${saved.id}`,
        `/plans/${saved.id}/result`,
        `/plans/${saved.id}/compare?reference=${other.id}`,
        '/loans',
      ])
        expect((await call('GET', LT + path, auth)).status, path).toBe(200);
      const writes: [string, string, unknown][] = [
        ['POST', '/plans', { plan: newPlan('Sneaky') }],
        ['PUT', `/plans/${saved.id}`, { plan: newPlan('Sneaky'), expectedVersion: 1 }],
        ['DELETE', `/plans/${saved.id}?expectedVersion=1`, undefined],
        ['POST', `/plans/${saved.id}/duplicate`, { name: 'Sneaky' }],
        ['PUT', '/loans/mort', { rateBps: 1, monthlyRepayment: 1, termMonths: null }],
        ['DELETE', '/loans/mort', undefined],
      ];
      for (const [method, path, body] of writes)
        expect((await call(method, LT + path, auth, body)).status, `${method} ${path}`).toBe(403);
      expect((await call('GET', '/export/backup', auth)).status).toBe(403);
    }
    expect(db.select().from(longTermPlans).all()).toHaveLength(2);
    expect(db.select().from(accountLoanDetails).all()).toEqual([]);
  });

  it('offers read-only MCP tools for plans and results', async () => {
    const a = await save('Base', { events: [retire] });
    const b = await save('Other');
    const t = await token();
    const rpc = (body: unknown) => call('POST', '/mcp', { token: t }, body);
    const tools = (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).body.result.tools;
    const names = tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'long_term_plans',
        'long_term_plan',
        'long_term_forecast',
        'long_term_compare',
      ]),
    );
    expect(
      tools.every(
        (tool: { annotations: { readOnlyHint: boolean } }) => tool.annotations.readOnlyHint,
      ),
    ).toBe(true);
    const run = async (name: string, args: Record<string, unknown>) => {
      const res = await rpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name, arguments: args },
      });
      return res.body.result;
    };
    const list = await run('long_term_plans', {});
    expect(list.isError).toBe(false);
    expect(JSON.parse(list.content[0].text).map((p: { id: string }) => p.id)).toEqual([a.id, b.id]);
    expect(
      JSON.parse((await run('long_term_plan', { plan_id: a.id })).content[0].text).plan.name,
    ).toBe('Base');
    const summary = (await run('long_term_forecast', { plan_id: a.id })).content[0].text;
    const forecast = JSON.parse(summary);
    expect(forecast.years.length).toBeGreaterThan(40);
    expect(forecast.years[1]).toHaveProperty('closingNetWorth');
    expect(forecast.years[1]).not.toHaveProperty('balances');
    expect(summary.length).toBeLessThan(40_000);
    const full = JSON.parse(
      (await run('long_term_forecast', { plan_id: a.id, detail: 'full' })).content[0].text,
    );
    expect(full.years[1]).toHaveProperty('balances');
    const cmp = JSON.parse(
      (await run('long_term_compare', { plan_id: a.id, reference_id: b.id })).content[0].text,
    );
    expect(cmp.reference.name).toBe('Other');
    // A path-looking id can't reach another route
    const sneaky = await run('long_term_plan', { plan_id: '../../accounts' });
    expect(sneaky.isError).toBe(true);
  });
});

describe('backups', () => {
  const backup = async () => (await call('GET', '/export/backup')).body;
  const restore = (data: unknown) => call('POST', '/export/restore', { session: true }, data);

  it('includes the long-term tables in format 16 and round-trips them', async () => {
    await call(
      'PUT',
      `${LT}/loans/mort`,
      { session: true },
      { rateBps: 620, monthlyRepayment: 190_000, termMonths: 300 },
    );
    const a = await save('Base', {
      events: [retire],
      accounts: [{ accountId: 'inv', included: true, cls: 'investments', growthBps: 500 }],
      splits: [{ accountId: 'cash', mode: 'percent', bps: 5000 }],
    });
    const data = await backup();
    expect(data.version).toBe(19);
    for (const table of [
      'accountLoanDetails',
      'longTermPlans',
      'longTermEvents',
      'longTermAccountAssumptions',
      'longTermSplits',
    ])
      expect(BACKUP_TABLES).toContain(table);
    expect(data.longTermPlans).toHaveLength(1);
    expect(data.longTermEvents).toHaveLength(1);
    expect(data.accountLoanDetails).toHaveLength(1);

    db.delete(longTermPlans).run();
    db.delete(accountLoanDetails).run();
    expect((await restore(data)).status).toBe(200);
    const again = await call('GET', `${LT}/plans/${a.id}`);
    expect(again.status).toBe(200);
    expect(again.body.plan).toMatchObject({
      name: 'Base',
      splits: [{ accountId: 'cash', mode: 'percent', bps: 5000 }],
    });
    expect(again.body.version).toBe(1);
    expect((await call('GET', `${LT}/loans`)).body[0].details.rateBps).toBe(620);
    expect(await backup()).toEqual({ ...data, exportedAt: expect.any(String) });
  });

  it('restores a format 15 backup unchanged, with no plans', async () => {
    await save('Doomed');
    const old = await backup();
    // What a format 15 file looks like: none of the new tables
    for (const table of [
      'accountLoanDetails',
      'longTermPlans',
      'longTermEvents',
      'longTermAccountAssumptions',
      'longTermSplits',
    ])
      delete old[table];
    old.version = 15;
    db.insert(transactions)
      .values({ id: 'extra', accountId: 'cash', date: '2026-01-01', amount: 5 })
      .run();
    expect((await restore(old)).status).toBe(200);
    expect(db.select().from(longTermPlans).all()).toEqual([]);
    expect(
      db
        .select()
        .from(accounts)
        .all()
        .map((a) => a.id)
        .sort(),
    ).toEqual(['cash', 'inv', 'mort', 'sup']);
    expect(db.select().from(transactions).all()).toEqual([]);
    expect(db.select().from(goals).all()).toEqual([]);
    expect(db.select().from(schedules).all()).toEqual([]);
    expect(db.select().from(budgetMonths).all()).toEqual([]);
  });

  it('rejects invalid long-term rows without changing anything', async () => {
    await save('Keep me', { events: [retire] });
    const good = await backup();
    const bad = (mutate: (d: any) => void) => {
      const copy = structuredClone(good);
      mutate(copy);
      return copy;
    };
    const cases = [
      bad((d) => (d.longTermPlans[0].settingsJson = '{"birthYear":"x"}')),
      bad((d) => (d.longTermEvents[0].paramsJson = '{"spendingMultiplierBps":-1,"reductions":{}}')),
      bad((d) => (d.longTermEvents[0].planId = 'ghost')),
      bad((d) =>
        d.longTermAccountAssumptions.push({
          planId: d.longTermPlans[0].id,
          accountId: 'ghost',
          included: 1,
        }),
      ),
      bad((d) =>
        d.longTermSplits.push({
          planId: d.longTermPlans[0].id,
          position: 0,
          accountId: 'ghost',
          mode: 'percent',
          bps: 1,
        }),
      ),
      bad((d) =>
        d.accountLoanDetails.push({ accountId: 'ghost', rateBps: 1, monthlyRepayment: 1 }),
      ),
      bad((d) =>
        d.accountLoanDetails.push({ accountId: 'mort', rateBps: 99999, monthlyRepayment: 1 }),
      ),
    ];
    // Each of these passes a row-by-row check but is not a plan the API would have saved or could read
    const ev = (d: any, over: Record<string, unknown>) => ({ ...d.longTermEvents[0], ...over });
    cases.push(
      bad(
        (d) =>
          (d.longTermEvents[0].paramsJson =
            '{"spendingMultiplierBps":7000,"reductions":{"ghost":5000},"start":{"age":60}}'),
      ),
      bad((d) => d.longTermEvents.push(ev(d, { id: 'ret2', position: 1 }))),
      bad((d) => d.longTermEvents.push(ev(d, { enabled: 1, position: 1 }))),
      bad((d) => (d.longTermEvents[0].enabled = 2)),
      bad((d) => (d.longTermEvents[0].position = -1)),
      bad((d) => (d.longTermEvents[0].name = 'Retire\t')),
      bad((d) => (d.longTermPlans[0].name = 'Keep me ')),
      bad((d) =>
        d.longTermAccountAssumptions.push({
          planId: d.longTermPlans[0].id,
          accountId: 'cash',
          included: 3,
        }),
      ),
      bad((d) => {
        const split = {
          planId: d.longTermPlans[0].id,
          position: 0,
          accountId: 'cash',
          mode: 'percent',
          bps: 1,
        };
        d.longTermSplits.push(split, { ...split });
      }),
      bad((d) => {
        for (let i = 0; i < 51; i++)
          d.longTermEvents.push(ev(d, { id: `x${i}`, enabled: 0, position: i + 1 }));
      }),
      bad((d) => {
        for (let i = 0; i < 21; i++)
          d.longTermPlans.push({ ...d.longTermPlans[0], id: `p${i}`, name: `Plan ${i}` });
      }),
    );
    for (const data of cases) expect((await restore(data)).status).toBe(400);
    expect(db.select().from(longTermPlans).all()).toHaveLength(1);
    expect(
      db.select().from(longTermEvents).where(eq(longTermEvents.kind, 'retirement')).all(),
    ).toHaveLength(1);
  });
});
