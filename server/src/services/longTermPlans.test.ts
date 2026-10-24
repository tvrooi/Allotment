import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accountLoanDetails,
  accounts,
  categories,
  categoryGroups,
  longTermAccountAssumptions,
  longTermEvents,
  longTermPlans,
  longTermSplits,
  paydayPlans,
  transactions,
} from '../db/schema.js';
import { ForecastError } from './forecastService.js';
import { defaultSettings, MAX_PLANS, planSchema, type PlanInput } from './longTermConfig.js';
import { LongTermForecastError, mulDiv } from './longTermForecast.js';
import { buildEnginePlan, runPlan, simulatePlan, startingPoint } from './longTermInputs.js';
import {
  createPlan,
  deletePlan,
  duplicatePlan,
  getPlan,
  listPlans,
  PlanConflict,
  updatePlan,
} from './longTermPlans.js';
import { paydays } from './paydayService.js';
import { paydayConfigSchema } from './paydayConfig.js';

// Saved long-term plans and the figures they start from (docs/LONG-TERM-FORECAST.md).
// Mock data only.

const TODAY = '2026-10-24';
const plan = (over: Partial<PlanInput> = {}): PlanInput =>
  planSchema.parse({ name: 'Base', settings: defaultSettings(1985), ...over });
const retire = {
  id: 'ret',
  kind: 'retirement' as const,
  name: 'Retire',
  enabled: true,
  start: { age: 60 },
  spendingMultiplierBps: 7000,
  reductions: { salary: 10000 },
};

const payday = paydayConfigSchema.parse({
  name: 'Fortnightly pay',
  anchorDate: '2026-10-02',
  expectedIncome: 400_000,
  timeZone: 'Australia/Sydney',
  rules: [],
});

function reset() {
  db.delete(longTermPlans).run();
  db.delete(accountLoanDetails).run();
  db.delete(transactions).run();
  db.delete(paydayPlans).run();
  db.delete(categories).run();
  db.delete(categoryGroups).run();
  db.delete(accounts).run();
}

function seedLedger() {
  db.insert(accounts)
    .values([
      { id: 'cash', name: 'Everyday', type: 'checking', startingBalance: 1_000_000 },
      { id: 'inv', name: 'Shares', type: 'investment', startingBalance: 5_000_000, isOffBudget: 1 },
      { id: 'sup', name: 'Super', type: 'retirement', startingBalance: 20_000_000, isOffBudget: 1 },
      {
        id: 'house',
        name: 'House',
        type: 'real_estate',
        startingBalance: 50_000_000,
        isOffBudget: 1,
      },
      {
        id: 'mort',
        name: 'Mortgage',
        type: 'mortgage',
        startingBalance: -30_000_000,
        isOffBudget: 1,
      },
      { id: 'old', name: 'Closed', type: 'savings', startingBalance: 999, closedAt: '2026-01-01' },
    ])
    .run();
  db.insert(categoryGroups)
    .values([
      { id: 'g-in', name: 'Income', isIncome: 1 },
      { id: 'g-out', name: 'Bills', isIncome: 0 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'salary', groupId: 'g-in', name: 'Salary' },
      { id: 'food', groupId: 'g-out', name: 'Food' },
    ])
    .run();
  db.insert(transactions)
    .values([
      { id: 'pay', accountId: 'cash', date: '2026-08-01', amount: 300_000, categoryId: 'salary' },
      { id: 'f1', accountId: 'cash', date: '2026-09-01', amount: -50_000, categoryId: 'food' },
      { id: 'f2', accountId: 'cash', date: '2026-08-01', amount: -20_000, categoryId: 'food' },
      { id: 'f3', accountId: 'cash', date: '2026-08-02', amount: 5_000, categoryId: 'food' },
      // A loan repayment: a transfer, so not spending
      {
        id: 't1',
        accountId: 'cash',
        date: '2026-09-15',
        amount: -100_000,
        transferTransactionId: 't2',
      },
      {
        id: 't2',
        accountId: 'mort',
        date: '2026-09-15',
        amount: 100_000,
        transferTransactionId: 't1',
      },
    ])
    .run();
  db.insert(paydayPlans)
    .values({ id: 'p1', configJson: JSON.stringify(payday) })
    .run();
}

beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
});
beforeEach(reset);

describe('starting point', () => {
  beforeEach(seedLedger);

  it("reads today's real balances, classes and loans, leaving closed accounts out", () => {
    const point = startingPoint(TODAY);
    const byId = Object.fromEntries(point.accounts.map((a) => [a.id, a]));
    expect(byId.cash).toMatchObject({
      cls: 'cash',
      balance: 1_000_000 + 300_000 - 50_000 - 20_000 + 5_000 - 100_000,
    });
    expect(byId.inv).toMatchObject({ cls: 'investments', balance: 5_000_000 });
    expect(byId.sup).toMatchObject({ cls: 'super', balance: 20_000_000 });
    expect(byId.house).toMatchObject({ cls: 'property', balance: 50_000_000 });
    expect(byId.old).toBeUndefined();
    expect(point.loans).toEqual([
      { id: 'mort', name: 'Mortgage', type: 'mortgage', balance: -29_900_000, details: null },
    ]);
  });

  it('uses loan details when there are some', () => {
    db.insert(accountLoanDetails)
      .values({ accountId: 'mort', rateBps: 620, monthlyRepayment: 190_000, termMonths: 300 })
      .run();
    expect(startingPoint(TODAY).loans[0].details).toEqual({
      rateBps: 620,
      monthlyRepayment: 190_000,
      termMonths: 300,
    });
  });

  it('starts income from active payday plans and spending from the trailing year', () => {
    const point = startingPoint(TODAY);
    const count = paydays(payday, TODAY, '2027-10-23').length;
    expect(count).toBe(26);
    expect(point.income).toEqual({
      annualTakeHome: 400_000 * count,
      source: 'payday',
      paydayPlans: 1,
    });
    // Food net of the refund, annualised over the 85 days since the first activity; the
    // transfer and the salary are not spending
    expect(point.spending).toMatchObject({ days: 85, from: '2026-08-01' });
    expect(point.spending.annual).toBe(mulDiv(65_000, 365, 85));
  });

  it('counts exactly 26 paydays a year, whether or not today is a payday', () => {
    // 2026-10-30 is a payday on this plan (2026-10-02 plus two fortnights); the day after is not
    for (const today of ['2026-10-30', '2026-10-31', '2026-10-24']) {
      expect(startingPoint(today).income.annualTakeHome, today).toBe(400_000 * 26);
    }
  });

  it('leaves out rows dated after today, as spending does', () => {
    const before = startingPoint(TODAY).accounts.find((a) => a.id === 'cash')!.balance;
    db.insert(transactions)
      .values({
        id: 'future',
        accountId: 'cash',
        date: '2027-03-01',
        amount: -5_000,
        categoryId: 'food',
      })
      .run();
    expect(startingPoint(TODAY).accounts.find((a) => a.id === 'cash')!.balance).toBe(before);
  });

  it('leaves out a payday plan it cannot read, and says so', () => {
    db.insert(paydayPlans).values({ id: 'broken', configJson: '{"name":"x"}' }).run();
    const point = startingPoint(TODAY);
    expect(point.warnings.join(' ')).toMatch(/payday plan could not be read/);
    expect(point.income.paydayPlans).toBe(1);
  });

  it('says so when there is no payday plan or little history', () => {
    db.delete(paydayPlans).run();
    const point = startingPoint(TODAY);
    expect(point.income).toMatchObject({ annualTakeHome: 0, source: 'none' });
    expect(point.warnings.join(' ')).toMatch(/no payday plan/);
    expect(point.warnings.join(' ')).toMatch(/fewer than 90 days/);
  });
});

describe('the engine plan', () => {
  beforeEach(seedLedger);

  it('applies class growth defaults, then per-account choices', () => {
    const point = startingPoint(TODAY);
    const { plan: built } = buildEnginePlan(
      plan({
        accounts: [
          { accountId: 'inv', included: true, cls: null, growthBps: 500 },
          { accountId: 'house', included: false, cls: null, growthBps: null },
          { accountId: 'mort', included: false, cls: null, growthBps: null },
        ],
      }),
      point,
    );
    const growth = Object.fromEntries(built.accounts.map((a) => [a.id, a.growthBps]));
    expect(growth).toEqual({ cash: 200, inv: 500, sup: 650 });
    expect(built.loans).toEqual([]);
    expect(built.startYear).toBe(2026);
    expect(built.startAge).toBe(2026 - 1985);
    expect(built.salary.takeHome).toBe(point.income.annualTakeHome);
    expect(built.spending.annual).toBe(point.spending.annual);
  });

  it('lets the plan override income and spending, and says where figures came from', () => {
    const result = runPlan(
      plan({
        settings: {
          ...defaultSettings(1985),
          income: {
            takeHome: 9_000_000,
            grossForSuper: 12_000_000,
            escalation: { mode: 'inflation' },
          },
          spending: { annual: 5_000_000, escalation: { mode: 'inflation' } },
        },
      }),
      startingPoint(TODAY),
    );
    expect(result.inputs).toEqual({
      income: 9_000_000,
      incomeSource: 'override',
      spending: 5_000_000,
      spendingSource: 'override',
    });
    expect(result.years.every((y) => y.bridgeDifference === 0)).toBe(true);
    expect(result.superAccountIds).toEqual(['sup']);
    expect(result.retirementAge).toBeNull();
  });

  it('skips splits and pay-offs whose accounts are gone, with a warning, and refuses a past end age', () => {
    const point = startingPoint(TODAY);
    const built = buildEnginePlan(
      plan({
        splits: [
          { accountId: 'house', mode: 'percent', bps: 5000 },
          { accountId: 'inv', mode: 'percent', bps: 5000 },
        ],
        accounts: [{ accountId: 'mort', included: false, cls: null, growthBps: null }],
        events: [
          {
            id: 'po',
            kind: 'payOff',
            name: 'Pay off',
            start: { year: 2030 },
            loanId: 'mort',
            amount: null,
            enabled: true,
          },
        ],
      }),
      point,
    );
    expect(built.plan.splits.map((s) => s.accountId)).toEqual(['inv']);
    expect(built.plan.events).toEqual([]);
    expect(built.warnings.filter((w) => /skipped/.test(w))).toHaveLength(2);
    expect(() =>
      buildEnginePlan(plan({ settings: { ...defaultSettings(1985), endAge: 40 } }), point),
    ).toThrow(LongTermForecastError);
  });

  it("runs a saved plan end to end, with retirement and today's mortgage", () => {
    db.insert(accountLoanDetails)
      .values({ accountId: 'mort', rateBps: 620, monthlyRepayment: 190_000, termMonths: null })
      .run();
    const saved = createPlan(plan({ events: [retire] }));
    const result = runPlan(getPlan(saved.id).plan, startingPoint(TODAY));
    expect(result.retirementAge).toBe(60);
    expect(result.years.length).toBe(95 - (2026 - 1985) + 1);
    expect(result.years.every((y) => y.bridgeDifference === 0)).toBe(true);
    expect(result.years[1].loanInterest).toBeGreaterThan(0);
  });
});

describe('saved plans', () => {
  beforeEach(seedLedger);

  it('round-trips a whole plan: settings, events, account choices and splits', () => {
    const input = plan({
      events: [retire],
      accounts: [{ accountId: 'inv', included: true, cls: 'investments', growthBps: 600 }],
      splits: [
        { accountId: 'cash', mode: 'fixed', amount: 100_000 },
        { accountId: 'inv', mode: 'percent', bps: 5000 },
      ],
    });
    const saved = createPlan(input);
    expect(saved.version).toBe(1);
    expect(getPlan(saved.id).plan).toEqual(input);
    expect(listPlans()).toEqual([
      expect.objectContaining({ id: saved.id, name: 'Base', version: 1, eventCount: 1 }),
    ]);
  });

  it('versions saves: a stale save or delete is refused and writes nothing', () => {
    const saved = createPlan(plan());
    const next = updatePlan(saved.id, plan({ name: 'Renamed', events: [retire] }), 1);
    expect(next).toMatchObject({ version: 2 });
    expect(getPlan(saved.id).plan.events).toHaveLength(1);

    let conflict: unknown;
    try {
      updatePlan(saved.id, plan({ name: 'Mine' }), 1);
    } catch (e) {
      conflict = e;
    }
    expect(conflict).toBeInstanceOf(PlanConflict);
    expect((conflict as PlanConflict).current?.plan.name).toBe('Renamed');
    expect((conflict as PlanConflict).status).toBe(409);
    expect(getPlan(saved.id).plan.name).toBe('Renamed');
    expect(() => deletePlan(saved.id, 1)).toThrow(PlanConflict);
    expect(listPlans()).toHaveLength(1);

    deletePlan(saved.id, 2);
    expect(listPlans()).toEqual([]);
    expect(db.select().from(longTermEvents).all()).toEqual([]);
    // Updating something deleted elsewhere is a conflict with nothing to show
    let gone: unknown;
    try {
      updatePlan(saved.id, plan(), 2);
    } catch (e) {
      gone = e;
    }
    expect(gone).toBeInstanceOf(PlanConflict);
    expect((gone as PlanConflict).current).toBeNull();
    expect(listPlans()).toEqual([]);
  });

  it('keeps names unique ignoring case, caps the number of plans, and duplicates by copy', () => {
    const base = createPlan(plan());
    expect(() => createPlan(plan({ name: 'BASE' }))).toThrow(ForecastError);
    const copy = duplicatePlan(base.id, 'Base, retire later');
    expect(copy.id).not.toBe(base.id);
    expect(copy.plan).toEqual({ ...base.plan, name: 'Base, retire later' });
    expect(() => duplicatePlan(base.id, 'base')).toThrow(/already called/);
    for (let i = listPlans().length; i < MAX_PLANS; i++) createPlan(plan({ name: `Plan ${i}` }));
    expect(() => createPlan(plan({ name: 'One too many' }))).toThrow(/at most 20/);
  });

  it('refuses plans that name accounts that do not exist, or a pay-off of something that is not a debt', () => {
    expect(() =>
      createPlan(plan({ splits: [{ accountId: 'nope', mode: 'percent', bps: 100 }] })),
    ).toThrow(/does not exist/);
    const payOff = (loanId: string) =>
      plan({
        events: [
          {
            id: 'po',
            kind: 'payOff',
            name: 'Pay off',
            start: { year: 2030 },
            loanId,
            amount: null,
            enabled: true,
          },
        ],
      });
    expect(() => createPlan(payOff('cash'))).toThrow(/debt/);
    expect(() => createPlan(payOff('mort'))).not.toThrow();
  });

  it('never writes to the ledger: creating, editing, running and deleting leave it untouched', () => {
    const snapshot = () =>
      JSON.stringify({
        accounts: db.select().from(accounts).all(),
        transactions: db.select().from(transactions).all(),
        payday: db.select().from(paydayPlans).all(),
        loans: db.select().from(accountLoanDetails).all(),
      });
    const before = snapshot();
    const saved = createPlan(
      plan({ events: [retire], splits: [{ accountId: 'cash', mode: 'percent', bps: 5000 }] }),
    );
    updatePlan(saved.id, plan({ name: 'Edited', events: [retire] }), 1);
    runPlan(getPlan(saved.id).plan, startingPoint(TODAY));
    duplicatePlan(saved.id, 'Copy');
    deletePlan(saved.id, 2);
    expect(snapshot()).toBe(before);
  });

  it('deletes only the plan, and goes when its account goes', () => {
    const saved = createPlan(
      plan({
        accounts: [{ accountId: 'inv', included: false, cls: null, growthBps: null }],
        splits: [{ accountId: 'cash', mode: 'percent', bps: 100 }],
      }),
    );
    expect(db.select().from(longTermAccountAssumptions).all()).toHaveLength(1);
    expect(db.select().from(longTermSplits).all()).toHaveLength(1);
    db.delete(accounts).where(eq(accounts.id, 'inv')).run();
    db.delete(accounts).where(eq(accounts.id, 'cash')).run();
    expect(db.select().from(longTermAccountAssumptions).all()).toEqual([]);
    expect(db.select().from(longTermSplits).all()).toEqual([]);
    expect(listPlans()).toHaveLength(1);
    expect(getPlan(saved.id).plan.splits).toEqual([]);
  });
});

describe('stale references and stored data', () => {
  beforeEach(seedLedger);
  const payOff = (enabled: boolean) =>
    plan({
      events: [
        {
          id: 'po',
          kind: 'payOff',
          name: 'Pay off',
          start: { year: 2030 },
          loanId: 'mort',
          amount: null,
          enabled,
        },
      ],
    });

  it('tells a stale client what changed before checking its references', () => {
    const saved = createPlan(payOff(true));
    updatePlan(saved.id, plan({ name: 'Other' }), 1);
    db.update(accounts).set({ type: 'checking' }).where(eq(accounts.id, 'mort')).run();
    expect(() => updatePlan(saved.id, payOff(true), 1)).toThrow(PlanConflict);
  });

  it('lets a plan whose pay-off debt is gone be saved and copied when that event is off', () => {
    const saved = createPlan(payOff(true));
    db.update(accounts).set({ type: 'checking' }).where(eq(accounts.id, 'mort')).run();
    expect(() => updatePlan(saved.id, payOff(true), 1)).toThrow(/debt/);
    const off = updatePlan(saved.id, payOff(false), 1);
    expect(off.version).toBe(2);
    expect(() => duplicatePlan(saved.id, 'Copy')).not.toThrow();
    // Running skips it without a warning about a disabled event
    const result = runPlan(getPlan(saved.id).plan, startingPoint(TODAY));
    expect(result.warnings.filter((w) => /skipped/.test(w))).toEqual([]);
  });

  it('rejects reserved event ids and ids that match an account', () => {
    expect(planSchema.safeParse({ ...plan(), events: [{ ...retire, id: 'salary' }] }).success).toBe(
      false,
    );
    expect(
      planSchema.safeParse({ ...plan(), events: [{ ...retire, id: 'extra-savings' }] }).success,
    ).toBe(false);
    expect(() => createPlan(plan({ events: [{ ...retire, id: 'cash', reductions: {} }] }))).toThrow(
      /event id/,
    );
  });

  it('reports a saved plan that no longer parses as needing an update, not as a bad request', () => {
    const saved = createPlan(plan());
    db.update(longTermPlans)
      .set({ settingsJson: '{"birthYear":"x"}' })
      .where(eq(longTermPlans.id, saved.id))
      .run();
    let error: unknown;
    try {
      getPlan(saved.id);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ForecastError);
    expect((error as ForecastError).status).toBe(500);
    expect((error as ForecastError).message).toMatch(/needs updating/);
  });
});

describe('simulation runs', () => {
  beforeEach(seedLedger);

  it('are remembered for the same plan, figures and seed, and never reused when any of them change', () => {
    const input = plan({ events: [retire] });
    const point = startingPoint(TODAY);
    const first = simulatePlan(input, { seed: 1, paths: 100 }, point);
    expect(simulatePlan(input, { seed: 1, paths: 100 }, point)).toBe(first);
    expect(simulatePlan(input, { seed: 2, paths: 100 }, point)).not.toBe(first);
    expect(simulatePlan(input, { seed: 1, paths: 200 }, point)).not.toBe(first);
    const richer = {
      ...point,
      accounts: point.accounts.map((a) => ({ ...a, balance: a.balance + 1_000_000 })),
    };
    expect(simulatePlan(input, { seed: 1, paths: 100 }, richer)).not.toBe(first);
    const volatility = defaultSettings(1985).volatilityBps;
    const calmer = plan({
      events: [retire],
      settings: {
        ...defaultSettings(1985),
        volatilityBps: { ...volatility, investments: 0, super: 0, property: 0 },
      },
    });
    const flat = simulatePlan(calmer, { seed: 1, paths: 100 }, point);
    expect(flat).not.toBe(first);
    expect(flat.bands.at(-1)!.net[0]).toBe(flat.bands.at(-1)!.net[4]);
  });

  it('give a plan saved before volatility existed the default volatility', () => {
    const saved = createPlan(plan());
    const stored = JSON.parse(
      db.select().from(longTermPlans).where(eq(longTermPlans.id, saved.id)).get()!.settingsJson,
    );
    delete stored.volatilityBps;
    db.update(longTermPlans)
      .set({ settingsJson: JSON.stringify(stored) })
      .where(eq(longTermPlans.id, saved.id))
      .run();
    expect(getPlan(saved.id).plan.settings.volatilityBps).toEqual({
      cash: 0,
      investments: 1600,
      super: 1600,
      property: 1000,
      vehicles: 0,
      other: 0,
    });
  });
});

describe('plan validation', () => {
  it('fills defaults for older saves and rejects nonsense', () => {
    const fresh = plan();
    expect(fresh.settings).toMatchObject({
      endAge: 95,
      inflationBps: 250,
      superGuaranteeBps: 1200,
      contributionsTaxBps: 1500,
      preservationAge: 60,
      agePension: { enabled: false, annual: 0, startAge: 67 },
      classGrowthBps: {
        cash: 200,
        investments: 700,
        super: 650,
        property: 300,
        vehicles: -1500,
        other: 0,
      },
    });
    const bad = (over: Record<string, unknown>) =>
      planSchema.safeParse({ name: 'X', settings: defaultSettings(1985), ...over });
    expect(bad({ name: '  ' }).success).toBe(false);
    expect(bad({ events: [{ ...retire, id: 'a:b' }] }).success).toBe(false);
    expect(bad({ events: [retire, { ...retire, id: 'ret2' }] }).success).toBe(false);
    expect(bad({ events: [retire, retire] }).success).toBe(false);
    expect(bad({ events: [{ ...retire, reductions: { ghost: 5000 } }] }).success).toBe(false);
    expect(bad({ events: [{ ...retire, start: { year: 2030, age: 60 } }] }).success).toBe(false);
    expect(bad({ splits: [{ accountId: 'extra-savings', mode: 'percent', bps: 1 }] }).success).toBe(
      false,
    );
    expect(
      bad({ settings: { ...defaultSettings(1985), withdrawalOrder: ['a', 'a'] } }).success,
    ).toBe(false);
    expect(bad({ settings: { ...defaultSettings(1985), inflationBps: 5000 } }).success).toBe(false);
  });
});
