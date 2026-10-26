import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyCappedReductions,
  EXTRA_SAVINGS_ID,
  forecastLongTerm,
  compulsoryStudyRepayment,
  LongTermForecastError,
  minimumDrawdownBps,
  STUDY_REPAYMENT_BANDS,
  mulDiv,
  standardLoanPayment,
  type ForecastPlan,
  type LifeEvent,
  type PlanAccount,
  type PlanLoan,
  type StudyLoanKind,
} from './longTermForecast.js';

// Long-term forecast engine (docs/LONG-TERM-FORECAST.md). Mock numbers only.

const acct = (
  id: string,
  cls: PlanAccount['cls'],
  balance: number,
  growthBps = 0,
): PlanAccount => ({
  id,
  name: id,
  cls,
  balance,
  growthBps,
});

/** Zero growth, zero inflation, no super: the plain-sum baseline */
function basePlan(over: Partial<ForecastPlan> = {}): ForecastPlan {
  return {
    startYear: 2027,
    startAge: 40,
    endAge: 50,
    inflationBps: 0,
    accounts: [acct('cash', 'cash', 1_000_000)],
    loans: [],
    salary: { takeHome: 8_000_000, grossForSuper: 0, escalation: { mode: 'none' } },
    spending: { annual: 6_000_000, escalation: { mode: 'none' } },
    super: { guaranteeBps: 1200, contributionsTaxBps: 1500, preservationAge: 60 },
    agePension: { enabled: false, annual: 0, startAge: 67 },
    extraSavingsGrowthBps: 0,
    splits: [],
    withdrawalOrder: [],
    events: [],
    ...over,
  };
}

let position = 0;
type Draft<E = LifeEvent> = E extends LifeEvent
  ? Omit<E, 'position' | 'enabled'> & { enabled?: boolean }
  : never;
const ev = <D extends Draft>(e: D) =>
  ({ enabled: true, position: position++, ...e }) as unknown as Extract<
    LifeEvent,
    { kind: D['kind'] }
  >;

const closing = (plan: ForecastPlan) => forecastLongTerm(plan).years.at(-1)!;

describe('mulDiv', () => {
  it('rounds half away from zero, exactly', () => {
    expect(mulDiv(5, 1, 2)).toBe(3);
    expect(mulDiv(-5, 1, 2)).toBe(-3);
    expect(mulDiv(4, 1, 3)).toBe(1);
    expect(mulDiv(-4, 1, 3)).toBe(-1);
    expect(mulDiv(2, -1, 3)).toBe(-1);
  });
  it('does not lose precision beyond floating point', () => {
    expect(mulDiv(9_000_000_000_000, 1_000_000_007, 1_000_000_000)).toBe(9_000_000_063_000);
  });
  it('rejects non-integers and zero denominators', () => {
    expect(() => mulDiv(1.5, 1, 1)).toThrow(RangeError);
    expect(() => mulDiv(1, 1, 0)).toThrow(RangeError);
  });
});

describe('standardLoanPayment', () => {
  it("matches Monarch's sample: 320,000 at 6.5% over 360 months", () => {
    expect(standardLoanPayment(32_000_000, 650, 360)).toBe(202_262);
  });
  it('matches a floating-point evaluation of the formula within a cent', () => {
    for (const [principal, bps, months] of [
      [50_000_000, 600, 360],
      [1_234_567, 899, 60],
      [90_000_000, 1, 300],
      [2_500_000, 2500, 12],
    ]) {
      const r = bps / 120000;
      const expected = (principal * r) / (1 - Math.pow(1 + r, -months));
      expect(Math.abs(standardLoanPayment(principal, bps, months) - expected)).toBeLessThanOrEqual(
        1,
      );
    }
  });
  it('divides evenly at zero interest', () => {
    expect(standardLoanPayment(120_000, 0, 12)).toBe(10_000);
  });
});

describe('amortisation inside the engine', () => {
  const loanPlan = (balance: number, rateBps: number, months: number) =>
    basePlan({
      endAge: 40 + Math.ceil(months / 12) + 1,
      salary: { takeHome: 30_000_000, grossForSuper: 0, escalation: { mode: 'none' } },
      loans: [
        {
          id: 'loan',
          name: 'Loan',
          balance: -balance,
          rateBps,
          monthlyRepayment: standardLoanPayment(balance, rateBps, months),
          termMonths: months,
        },
      ],
    });

  it('clears at the end of the term, with a final payment close to the level payment', () => {
    const plan = loanPlan(50_000_000, 600, 360);
    const result = forecastLongTerm(plan);
    const level = standardLoanPayment(50_000_000, 600, 360);
    const paid = result.years.slice(1).reduce((sum, y) => sum + y.loanPayments, 0);
    const interest = result.years.slice(1).reduce((sum, y) => sum + y.loanInterest, 0);
    expect(result.years[30].balances.loan).toBe(0);
    expect(result.years[31].loanPayments).toBe(0);
    // Everything paid = principal + interest, and the shortfall to level payments is rounding only
    expect(paid).toBe(50_000_000 + interest);
    expect(Math.abs(paid - level * 360)).toBeLessThan(1000);
  });

  it('with zero interest, repays exactly the principal', () => {
    const result = forecastLongTerm(loanPlan(1_200_000, 0, 24));
    expect(result.years.slice(1).reduce((s, y) => s + y.loanPayments, 0)).toBe(1_200_000);
    expect(result.years[2].balances.loan).toBe(0);
  });
});

describe('plain sums', () => {
  it('a zero-growth, zero-inflation plan equals the plain sum of its flows', () => {
    const plan = basePlan({
      events: [
        ev({
          id: 'w',
          name: 'Windfall',
          kind: 'oneOff',
          start: { year: 2030 },
          amount: 5_000_000,
          todaysDollars: true,
        }),
        ev({
          id: 'c',
          name: 'Car',
          kind: 'oneOff',
          start: { age: 45 },
          amount: -2_000_000,
          todaysDollars: false,
        }),
        ev({
          id: 'r',
          name: 'Side income',
          kind: 'recurring',
          start: { year: 2028 },
          amount: 100_000,
          endYear: 2031,
          everyYears: 1,
          escalation: { mode: 'none' },
        }),
      ],
    });
    const years = 10;
    // Every year's closing worth is the opening plus that year's flows
    const all = forecastLongTerm(plan).years;
    all.slice(1).forEach((y, i) => {
      const flowsSoFar =
        y.income.reduce((s, r) => s + r.amount, 0) -
        y.spending +
        y.eventFlows.reduce((s, r) => s + r.amount, 0);
      expect(y.closingNetWorth - y.openingNetWorth, `year ${i + 1}`).toBe(flowsSoFar);
    });
    const flows = years * (8_000_000 - 6_000_000) + 5_000_000 - 2_000_000 + 4 * 100_000;
    const last = closing(plan);
    expect(last.closingNetWorth).toBe(1_000_000 + flows);
    expect(last.unfundedBalance).toBe(0);
  });
});

describe('overlapping reductions', () => {
  it('are capped at the income and added, never multiplied', () => {
    expect(applyCappedReductions(100_000, [6000, 6000])).toEqual({
      reductions: [60_000, 40_000],
      total: 100_000,
      remaining: 0,
    });
    expect(applyCappedReductions(100_000, [2000, 3000]).total).toBe(50_000);
  });

  it('applies in event start order, not list order', () => {
    const plan = basePlan({
      endAge: 42,
      events: [
        ev({
          id: 'ret',
          name: 'Retirement',
          kind: 'retirement',
          start: { year: 2028 },
          spendingMultiplierBps: 10000,
          reductions: { salary: 6000 },
        }),
        ev({
          id: 'brk',
          name: 'Break',
          kind: 'careerBreak',
          start: { year: 2027 },
          durationYears: 2,
          spendingMultiplierBps: 10000,
          reductions: { salary: 6000 },
        }),
      ],
    });
    const [, y1, y2] = forecastLongTerm(plan).years;
    expect(y1.income[0].amount).toBe(3_200_000); // break only: 60% off
    expect(y2.income[0].reductions.map((r) => r.id)).toEqual(['brk', 'ret']);
    expect(y2.income[0].reductions.map((r) => r.amount)).toEqual([4_800_000, 3_200_000]);
    expect(y2.income[0].amount).toBe(0);
  });

  it('caps spending reductions at the baseline and never lets an addition raise the cap', () => {
    const plan = basePlan({
      endAge: 41,
      events: [
        ev({
          id: 'a',
          name: 'Break',
          kind: 'careerBreak',
          start: { year: 2027 },
          durationYears: 5,
          spendingMultiplierBps: 5000,
          reductions: {},
        }),
        ev({
          id: 'b',
          name: 'Retire',
          kind: 'retirement',
          start: { year: 2027 },
          spendingMultiplierBps: 2000,
          reductions: {},
        }),
      ],
    });
    const y = forecastLongTerm(plan).years[1];
    // 50% off then 80% off: 3,000,000 + min(3,000,000, 4,800,000) = all of it, not 60%×…
    expect(y.spendingChanges.map((c) => c.amount)).toEqual([-3_000_000, -3_000_000]);
    expect(y.spending).toBe(0);
  });

  it('refuses a new job reducing itself or an unknown source', () => {
    const job = (reductions: Record<string, number>) =>
      basePlan({
        events: [
          ev({
            id: 'job',
            name: 'Job',
            kind: 'newJob',
            start: { year: 2029 },
            takeHome: 1,
            escalation: { mode: 'none' },
            signingBonus: 0,
            grossSalary: 0,
            reductions,
          }),
        ],
      });
    expect(() => forecastLongTerm(job({ job: 5000 }))).toThrow(LongTermForecastError);
    expect(() => forecastLongTerm(job({ nope: 5000 }))).toThrow(LongTermForecastError);
    expect(() => forecastLongTerm(job({ salary: 10000 }))).not.toThrow();
  });
});

describe('savings splits', () => {
  const splitPlan = (splits: ForecastPlan['splits']) =>
    basePlan({
      endAge: 41,
      salary: { takeHome: 1_000_000, grossForSuper: 0, escalation: { mode: 'none' } },
      spending: { annual: 0, escalation: { mode: 'none' } },
      accounts: [acct('a', 'cash', 0), acct('b', 'investments', 0)],
      splits,
    });

  it("are sequential percentages of what is left (Monarch's 10,000 example)", () => {
    const y = forecastLongTerm(
      splitPlan([
        { accountId: 'a', mode: 'percent', bps: 5000 },
        { accountId: 'b', mode: 'percent', bps: 5000 },
      ]),
    ).years[1];
    expect(y.allocations.map((r) => [r.id, r.amount])).toEqual([
      ['a', 500_000],
      ['b', 250_000],
      [EXTRA_SAVINGS_ID, 250_000],
    ]);
  });

  it('caps a fixed amount and gives a percentage of the rest', () => {
    const y = forecastLongTerm(
      splitPlan([
        { accountId: 'a', mode: 'fixed', amount: 300_000 },
        { accountId: 'b', mode: 'percent', bps: 5000 },
      ]),
    ).years[1];
    expect(y.allocations.map((r) => r.amount)).toEqual([300_000, 350_000, 350_000]);
  });

  it('gives later accounts nothing once the surplus is spent, and always sums exactly', () => {
    const y = forecastLongTerm(
      splitPlan([
        { accountId: 'a', mode: 'fixed', amount: 5_000_000 },
        { accountId: 'b', mode: 'percent', bps: 5000 },
      ]),
    ).years[1];
    expect(y.allocations.map((r) => [r.id, r.amount])).toEqual([['a', 1_000_000]]);
    const odd = forecastLongTerm(
      splitPlan([
        { accountId: 'a', mode: 'percent', bps: 3333 },
        { accountId: 'b', mode: 'percent', bps: 3333 },
      ]),
    ).years[1];
    expect(odd.allocations.reduce((s, r) => s + r.amount, 0)).toBe(1_000_000);
  });

  it('inflates a fixed amount cap with inflation', () => {
    const plan = splitPlan([{ accountId: 'a', mode: 'fixed', amount: 100_000 }]);
    plan.inflationBps = 1000;
    plan.salary.escalation = { mode: 'inflation' };
    const y = forecastLongTerm(plan).years[1];
    expect(y.allocations[0].amount).toBe(110_000);
  });
});

describe('shortfalls', () => {
  const lean = (over: Partial<ForecastPlan> = {}) =>
    basePlan({
      endAge: 44,
      salary: { takeHome: 0, grossForSuper: 0, escalation: { mode: 'none' } },
      spending: { annual: 1_000_000, escalation: { mode: 'none' } },
      ...over,
    });

  it('withdraws cash, then investments, and locks super', () => {
    const plan = lean({
      accounts: [
        acct('inv', 'investments', 1_500_000),
        acct('cash', 'cash', 500_000),
        acct('sup', 'super', 9_000_000),
      ],
    });
    const years = forecastLongTerm(plan).years;
    expect(years[1].withdrawals.map((w) => [w.id, w.amount])).toEqual([
      ['cash', 500_000],
      ['inv', 500_000],
    ]);
    expect(years[2].withdrawals.map((w) => [w.id, w.amount])).toEqual([['inv', 1_000_000]]);
    expect(years[3].unfundedAdded).toBe(1_000_000);
    expect(years[3].balances.sup).toBe(9_000_000);
  });

  it('honours a custom order and puts Extra savings first by default', () => {
    const plan = lean({
      accounts: [acct('inv', 'investments', 5_000_000), acct('cash', 'cash', 5_000_000)],
      withdrawalOrder: ['inv'],
    });
    expect(forecastLongTerm(plan).years[1].withdrawals.map((w) => w.id)).toEqual(['inv']);
  });

  it('reports the first unfunded year and repays it first from later surplus', () => {
    const plan = lean({
      accounts: [acct('cash', 'cash', 1_500_000)],
      events: [
        ev({
          id: 'w',
          name: 'Windfall',
          kind: 'oneOff',
          start: { year: 2030 },
          amount: 5_000_000,
          todaysDollars: false,
        }),
      ],
      endAge: 45,
    });
    const result = forecastLongTerm(plan);
    expect(result.firstUnfunded).toEqual({ index: 2, calendarYear: 2028, age: 41 });
    const y4 = result.years[4];
    expect(result.years[3].unfundedBalance).toBe(1_500_000);
    expect(y4.unfundedRepaid).toBe(1_500_000);
    expect(y4.unfundedBalance).toBe(0);
    expect(y4.allocations).toEqual([
      { id: EXTRA_SAVINGS_ID, name: 'Extra savings', amount: 2_500_000 },
    ]);
  });

  it('counts unfunded spending against net worth', () => {
    const result = forecastLongTerm(lean({ accounts: [] }));
    expect(result.years[1].closingNetWorth).toBe(-1_000_000);
  });

  it('unlocks super only after retirement and the preservation age', () => {
    const plan = (retireYear: number, preservationAge: number) =>
      lean({
        endAge: 46,
        accounts: [acct('sup', 'super', 3_000_000)],
        super: { guaranteeBps: 1200, contributionsTaxBps: 1500, preservationAge },
        events: [
          ev({
            id: 'ret',
            name: 'Retire',
            kind: 'retirement',
            start: { year: retireYear },
            spendingMultiplierBps: 10000,
            reductions: {},
          }),
        ],
      });
    // Retired in 2027 but preserved until age 42 (2029)
    const early = forecastLongTerm(plan(2027, 42)).years;
    expect(early[1].unfundedAdded).toBe(1_000_000);
    expect(early[2].unfundedAdded).toBe(1_000_000);
    expect(early[3].withdrawals[0]).toMatchObject({ id: 'sup', amount: 1_000_000 });
    // Past the preservation age but never retired
    const never = forecastLongTerm(plan(2040, 40)).years;
    expect(never[1].withdrawals).toEqual([]);
  });
});

describe('super contributions', () => {
  it('pays employer super on the salary that remains, after contributions tax', () => {
    const plan = basePlan({
      endAge: 43,
      salary: { takeHome: 8_000_000, grossForSuper: 10_000_000, escalation: { mode: 'none' } },
      accounts: [acct('sup', 'super', 0)],
      events: [
        ev({
          id: 'brk',
          name: 'Break',
          kind: 'careerBreak',
          start: { year: 2028 },
          durationYears: 1,
          spendingMultiplierBps: 10000,
          reductions: { salary: 5000 },
        }),
      ],
    });
    const years = forecastLongTerm(plan).years;
    expect(years[1]).toMatchObject({
      superContribution: 1_200_000,
      superTax: 180_000,
      superNet: 1_020_000,
    });
    expect(years[2].superContribution).toBe(600_000);
    expect(years[3].balances.sup).toBe(1_020_000 + 510_000 + 1_020_000);
  });

  it('stops at retirement and does not count as spendable income', () => {
    const plan = basePlan({
      endAge: 42,
      salary: { takeHome: 8_000_000, grossForSuper: 10_000_000, escalation: { mode: 'none' } },
      events: [
        ev({
          id: 'ret',
          name: 'Retire',
          kind: 'retirement',
          start: { year: 2028 },
          spendingMultiplierBps: 10000,
          reductions: { salary: 10000 },
        }),
      ],
    });
    const years = forecastLongTerm(plan).years;
    expect(years[1].superNet).toBe(1_020_000);
    expect(years[2].superNet).toBe(0);
    expect(years[1].netCashFlow).toBe(2_000_000);
  });
});

describe('Australian super rules', () => {
  const retire = (year: number) =>
    ev({
      id: 'ret',
      name: 'Retire',
      kind: 'retirement',
      start: { year },
      spendingMultiplierBps: 10000,
      reductions: { salary: 10000 },
    });
  const noPay = { takeHome: 0, grossForSuper: 0, escalation: { mode: 'none' } } as const;

  it('releases super at 65 without retiring, and splits wealth by what can be spent', () => {
    const plan = basePlan({
      startAge: 63,
      endAge: 67,
      salary: noPay,
      spending: { annual: 1_000_000, escalation: { mode: 'none' } },
      accounts: [acct('sup', 'super', 5_000_000)],
    });
    const years = forecastLongTerm(plan).years;
    expect(years.map((y) => y.superPhase)).toEqual([
      'preserved',
      'preserved',
      'preserved',
      'accessible',
      'accessible',
    ]);
    expect(years[2].unfundedAdded).toBe(1_000_000);
    expect(years[3].withdrawals).toEqual([{ id: 'sup', name: 'sup', amount: 1_000_000 }]);
    expect(years[3].superDrawdown).toBe(0);
    // Closing balances are labelled by what super can do at the next year's start
    expect(years[1].wealth).toEqual({
      accessible: -1_000_000,
      preserved: 5_000_000,
      illiquid: 0,
      debts: 0,
    });
    expect(years[2].wealth).toMatchObject({ accessible: 3_000_000, preserved: 0 });
  });

  it('pays the minimum pension once retired and released, with tax-free earnings', () => {
    const plan = basePlan({
      startAge: 60,
      endAge: 67,
      salary: noPay,
      spending: { annual: 0, escalation: { mode: 'none' } },
      accounts: [acct('sup', 'super', 10_000_000, 1000)],
      super: {
        guaranteeBps: 1200,
        contributionsTaxBps: 1500,
        preservationAge: 60,
        earningsTaxBps: 1500,
        minimumDrawdown: true,
      },
      events: [retire(2027)],
    });
    const years = forecastLongTerm(plan).years;
    expect(years[1]).toMatchObject({
      superPhase: 'pension',
      superDrawdown: 400_000,
      netCashFlow: 400_000,
      superEarningsTax: 0,
      allocations: [{ id: EXTRA_SAVINGS_ID, name: 'Extra savings', amount: 400_000 }],
    });
    // Growth on the balance after the payment left
    expect(years[1].balances.sup).toBe(10_000_000 - 400_000 + 960_000);
    // The rate steps up to 5% from 65
    const at65 = years[6];
    expect(at65.age).toBe(65);
    expect(at65.superDrawdown).toBe(mulDiv(years[5].balances.sup, 500, 10_000));
  });

  it('leaves super alone when the minimum payment is turned off', () => {
    const plan = basePlan({
      startAge: 60,
      endAge: 62,
      salary: noPay,
      spending: { annual: 0, escalation: { mode: 'none' } },
      accounts: [acct('sup', 'super', 10_000_000)],
      events: [retire(2027)],
    });
    expect(forecastLongTerm(plan).years[1].superDrawdown).toBe(0);
  });

  it('taxes earnings in the accumulation phase', () => {
    const plan = basePlan({
      endAge: 41,
      salary: noPay,
      spending: { annual: 0, escalation: { mode: 'none' } },
      accounts: [acct('sup', 'super', 10_000_000, 1000)],
      super: {
        guaranteeBps: 1200,
        contributionsTaxBps: 1500,
        preservationAge: 60,
        earningsTaxBps: 1500,
      },
    });
    const y = forecastLongTerm(plan).years[1];
    expect(y).toMatchObject({
      superPhase: 'preserved',
      growthTotal: 1_000_000,
      superEarningsTax: 150_000,
    });
    expect(y.balances.sup).toBe(10_850_000);
    expect(y.bridgeDifference).toBe(0);
  });

  it('adds salary sacrifice to concessional contributions, following the salary', () => {
    const plan = basePlan({
      endAge: 43,
      salary: { takeHome: 8_000_000, grossForSuper: 10_000_000, escalation: { mode: 'none' } },
      accounts: [acct('sup', 'super', 0)],
      super: {
        guaranteeBps: 1200,
        contributionsTaxBps: 1500,
        preservationAge: 60,
        salarySacrifice: 1_000_000,
      },
      events: [
        ev({
          id: 'brk',
          name: 'Break',
          kind: 'careerBreak',
          start: { year: 2028 },
          durationYears: 1,
          spendingMultiplierBps: 10000,
          reductions: { salary: 5000 },
        }),
      ],
    });
    const years = forecastLongTerm(plan).years;
    expect(years[1]).toMatchObject({
      superContribution: 2_200_000,
      superSalarySacrifice: 1_000_000,
      superTax: 330_000,
      superNet: 1_870_000,
    });
    expect(years[2]).toMatchObject({ superContribution: 1_100_000, superSalarySacrifice: 500_000 });
  });

  it('pays personal contributions from surplus while working, never more than the surplus', () => {
    const plan = (personalContribution: number) =>
      basePlan({
        endAge: 43,
        accounts: [acct('sup', 'super', 0)],
        super: {
          guaranteeBps: 1200,
          contributionsTaxBps: 1500,
          preservationAge: 60,
          personalContribution,
        },
        events: [retire(2028)],
      });
    const some = forecastLongTerm(plan(500_000)).years;
    expect(some[1].superPersonal).toBe(500_000);
    expect(some[1].allocations).toEqual([
      { id: 'sup', name: 'sup', amount: 500_000 },
      { id: EXTRA_SAVINGS_ID, name: 'Extra savings', amount: 1_500_000 },
    ]);
    expect(some[2].superPersonal).toBe(0);
    // Surplus is 2,000,000: a larger target takes only that
    expect(forecastLongTerm(plan(3_000_000)).years[1].superPersonal).toBe(2_000_000);
  });

  it('takes fees from super, never below zero', () => {
    const plan = basePlan({
      endAge: 42,
      salary: noPay,
      spending: { annual: 0, escalation: { mode: 'none' } },
      accounts: [acct('sup', 'super', 30_000)],
      super: {
        guaranteeBps: 1200,
        contributionsTaxBps: 1500,
        preservationAge: 60,
        feesAnnual: 50_000,
      },
    });
    const years = forecastLongTerm(plan).years;
    expect(years[1]).toMatchObject({ superFees: 30_000, closingNetWorth: 0, bridgeDifference: 0 });
    expect(years[2].superFees).toBe(0);
  });

  it('never grows or shrinks money the fees took', () => {
    const closing = (growthBps: number) =>
      forecastLongTerm(
        basePlan({
          endAge: 42,
          salary: noPay,
          spending: { annual: 0, escalation: { mode: 'none' } },
          accounts: [acct('sup', 'super', 30_000, growthBps)],
          super: {
            guaranteeBps: 1200,
            contributionsTaxBps: 1500,
            preservationAge: 60,
            feesAnnual: 50_000,
          },
        }),
      ).years.map((y) => y.balances.sup);
    expect(closing(-1000)).toEqual([30_000, 0, 0]);
    expect(closing(1000)).toEqual([30_000, 0, 0]);
    // Fees smaller than the fund: growth on what is left
    expect(
      forecastLongTerm(
        basePlan({
          endAge: 41,
          salary: noPay,
          spending: { annual: 0, escalation: { mode: 'none' } },
          accounts: [acct('sup', 'super', 1_000_000, 1000)],
          super: {
            guaranteeBps: 1200,
            contributionsTaxBps: 1500,
            preservationAge: 60,
            feesAnnual: 100_000,
          },
        }),
      ).years[1].balances.sup,
    ).toBe(1_000_000 - 100_000 + 90_000);
  });

  it('warns when contributions or a pension pass the caps', () => {
    const caps = {
      concessionalCap: 3_250_000,
      nonConcessionalCap: 13_000_000,
      transferBalanceCap: 210_000_000,
    };
    const over = forecastLongTerm(
      basePlan({
        salary: { takeHome: 20_000_000, grossForSuper: 30_000_000, escalation: { mode: 'none' } },
        super: {
          guaranteeBps: 1200,
          contributionsTaxBps: 1500,
          preservationAge: 60,
          personalContribution: 14_000_000,
          ...caps,
        },
      }),
    ).warnings;
    expect(
      over.some((w) => w.startsWith('Concessional super contributions pass the cap in 2027')),
    ).toBe(true);
    expect(over.some((w) => w.includes('non-concessional cap'))).toBe(true);
    const rich = forecastLongTerm(
      basePlan({
        startAge: 60,
        endAge: 62,
        salary: noPay,
        accounts: [acct('sup', 'super', 300_000_000)],
        super: { guaranteeBps: 1200, contributionsTaxBps: 1500, preservationAge: 60, ...caps },
        events: [retire(2027)],
      }),
    ).warnings;
    expect(rich.some((w) => w.includes('transfer balance cap'))).toBe(true);
  });

  it('uses the standard minimum drawdown rates', () => {
    expect([60, 64, 65, 74, 75, 80, 85, 90, 95, 100].map(minimumDrawdownBps)).toEqual([
      400, 400, 500, 500, 600, 700, 900, 1100, 1400, 1400,
    ]);
  });
});

describe('study loans (HECS-HELP and SSL)', () => {
  const study = (
    id: string,
    balance: number,
    kind: StudyLoanKind = 'help',
    extraAnnual = 0,
  ): PlanLoan => ({
    id,
    name: id,
    balance,
    rateBps: 0,
    monthlyRepayment: 0,
    termMonths: null,
    study: { kind, extraAnnual },
  });
  const rules = (over: Partial<NonNullable<ForecastPlan['studyLoans']>> = {}) => ({
    withheldFromPay: true,
    otherRepaymentIncome: 0,
    indexationBps: 300,
    bands: STUDY_REPAYMENT_BANDS,
    ...over,
  });
  const paid = (over: Partial<ForecastPlan> = {}) =>
    basePlan({
      endAge: 45,
      salary: { takeHome: 8_000_000, grossForSuper: 10_000_000, escalation: { mode: 'none' } },
      super: { guaranteeBps: 0, contributionsTaxBps: 1500, preservationAge: 60 },
      studyLoans: rules(),
      ...over,
    });

  it('works out the compulsory repayment with the 2026–27 marginal bands', () => {
    const due = (dollars: number) => compulsoryStudyRepayment(dollars * 100, STUDY_REPAYMENT_BANDS);
    expect(due(69_528)).toBe(0);
    expect(due(80_000)).toBe(157_080);
    expect(due(150_000)).toBe(902_835 + 344_811);
    expect(due(200_000)).toBe(2_000_000);
    // The top band starts where the marginal bands reach 10% of income, within a few cents
    expect(Math.abs(due(186_050) - due(186_051))).toBeLessThan(100);
  });

  it('repays from withheld pay, indexes what is left, and frees the pay once repaid', () => {
    const result = forecastLongTerm(paid({ loans: [study('hecs', -1_000_000)] }));
    const [, y1, y2, y3, y4] = result.years;
    expect(y1).toMatchObject({
      studyRepaymentIncome: 10_000_000,
      studyCompulsory: 457_080,
      studyWithheld: 457_080,
      studyIndexation: 16_288,
      netCashFlow: 2_000_000,
    });
    expect(y1.balances.hecs).toBe(-559_208);
    expect(y2.balances.hecs).toBe(-105_192);
    expect(y3).toMatchObject({ studyCompulsory: 105_192, studyIndexation: 0 });
    expect(y3.netCashFlow).toBe(2_000_000 + 457_080 - 105_192);
    // Repaid: the withholding stops, so all of it is cash
    expect(y4.netCashFlow).toBe(2_457_080);
    expect(result.studyLoans).toMatchObject({
      repaid: { index: 3, calendarYear: 2029, age: 42 },
      minimumOnly: { repaid: { index: 3 }, indexationTotal: 16_288 + 3_064 },
    });
    for (const y of result.years) expect(y.bridgeDifference).toBe(0);
  });

  it('takes voluntary payments from surplus and compares them with the minimum', () => {
    const result = forecastLongTerm(paid({ loans: [study('hecs', -1_000_000, 'help', 500_000)] }));
    expect(result.years[1].studyVoluntary).toBe(500_000);
    expect(result.years[1].allocations[0]).toEqual({ id: 'hecs', name: 'hecs', amount: 500_000 });
    expect(result.years[1].balances.hecs).toBe(-59_208);
    expect(result.studyLoans).toMatchObject({
      repaid: { index: 2 },
      indexationTotal: 16_288,
      voluntaryTotal: 500_000,
      minimumOnly: { repaid: { index: 3 }, indexationTotal: 19_352 },
    });
  });

  it('repays HELP before a Student Start-up Loan, whatever their order', () => {
    const y = forecastLongTerm(
      paid({
        studyLoans: rules({ indexationBps: 0 }),
        loans: [study('ssl', -300_000, 'ssl'), study('help', -300_000)],
      }),
    ).years[1];
    expect(y.balances.help).toBe(0);
    expect(y.balances.ssl).toBe(-(300_000 - 157_080));
  });

  it('pays from cash flow when take-home is before withholding', () => {
    const y = forecastLongTerm(
      paid({ studyLoans: rules({ withheldFromPay: false }), loans: [study('hecs', -1_000_000)] }),
    ).years[1];
    expect(y).toMatchObject({ studyWithheld: 0, netCashFlow: 2_000_000 - 457_080 });
  });

  it('never indexes down, and warns when there is no repayment income', () => {
    const result = forecastLongTerm(
      paid({
        inflationBps: -100,
        salary: { takeHome: 8_000_000, grossForSuper: 0, escalation: { mode: 'none' } },
        studyLoans: rules({ indexationBps: null }),
        loans: [study('hecs', -1_000_000)],
      }),
    );
    expect(result.years[1]).toMatchObject({ studyCompulsory: 0, studyIndexation: 0 });
    expect(result.years.at(-1)!.balances.hecs).toBe(-1_000_000);
    expect(result.studyLoans!.repaid).toBeNull();
    expect(result.warnings.some((w) => w.startsWith('Study loans have no repayment income'))).toBe(
      true,
    );
  });

  it('can be paid off with a lump sum event', () => {
    const result = forecastLongTerm(
      paid({
        accounts: [acct('cash', 'cash', 5_000_000)],
        loans: [study('hecs', -1_000_000)],
        events: [
          ev({
            id: 'po',
            name: 'Clear HECS',
            kind: 'payOff',
            start: { year: 2027 },
            loanId: 'hecs',
            amount: null,
          }),
        ],
      }),
    );
    expect(result.years[1]).toMatchObject({ loanPayments: 1_000_000, studyCompulsory: 0 });
    expect(result.studyLoans!.repaid).toMatchObject({ index: 1 });
  });
});

describe('growth and inflation', () => {
  it('grows the balance after withdrawals but before deposits', () => {
    const plan = basePlan({
      endAge: 41,
      accounts: [acct('cash', 'cash', 1_000_000, 1000)],
      salary: { takeHome: 500_000, grossForSuper: 0, escalation: { mode: 'none' } },
      spending: { annual: 0, escalation: { mode: 'none' } },
      splits: [{ accountId: 'cash', mode: 'percent', bps: 10000 }],
    });
    const y = forecastLongTerm(plan).years[1];
    expect(y.growthTotal).toBe(100_000); // on 1,000,000, not on the 500,000 deposited this year
    expect(y.balances.cash).toBe(1_600_000);
  });

  it('never grows money that was withdrawn', () => {
    const plan = basePlan({
      endAge: 41,
      accounts: [acct('cash', 'cash', 1_000_000, 1000)],
      salary: { takeHome: 0, grossForSuper: 0, escalation: { mode: 'none' } },
      spending: { annual: 1_000_000, escalation: { mode: 'none' } },
    });
    const y = forecastLongTerm(plan).years[1];
    expect(y.balances.cash).toBe(0);
    expect(y.growthTotal).toBe(0);
  });

  it('indexes amounts with inflation and compounds the index once a year', () => {
    const plan = basePlan({
      endAge: 42,
      inflationBps: 300,
      salary: { takeHome: 1_000_000, grossForSuper: 0, escalation: { mode: 'inflation' } },
      spending: { annual: 0, escalation: { mode: 'inflation' } },
    });
    const years = forecastLongTerm(plan).years;
    expect(years[1].income[0].amount).toBe(1_030_000);
    expect(years[2].income[0].amount).toBe(1_060_900);
    expect(years[2].inflationIndexPpb).toBe(1_060_900_000);
  });

  it('adds the Age Pension from its age, indexed', () => {
    const plan = basePlan({
      startAge: 66,
      endAge: 69,
      salary: { takeHome: 0, grossForSuper: 0, escalation: { mode: 'none' } },
      spending: { annual: 0, escalation: { mode: 'none' } },
      agePension: { enabled: true, annual: 2_500_000, startAge: 67 },
    });
    const years = forecastLongTerm(plan).years;
    expect(years[1].agePension).toBe(0);
    expect(years[2].agePension).toBe(2_500_000);
  });
});

describe('life events', () => {
  const home = ev({
    id: 'home',
    name: 'Home',
    kind: 'home',
    start: { year: 2029 },
    price: 40_000_000,
    deposit: { kind: 'percent', bps: 2000 },
    loanRateBps: 650,
    termYears: 30,
    purchaseCosts: 1_500_000,
    annualRates: 300_000,
    annualInsurance: 200_000,
    rentMonthly: 200_000,
    replaceRent: true,
    propertyGrowthBps: 0,
  });

  it('opens a property and mortgage, pays costs once, and starts repayments next year', () => {
    const plan = basePlan({
      endAge: 45,
      accounts: [acct('cash', 'cash', 20_000_000)],
      events: [home],
    });
    const years = forecastLongTerm(plan).years;
    const buy = years[3];
    expect(buy.balances['home:property']).toBe(40_000_000);
    expect(buy.balances['home:mortgage']).toBe(-32_000_000);
    expect(buy.openedByEvents).toBe(8_000_000);
    expect(buy.loanPayments).toBe(0);
    expect(buy.eventFlows.find((r) => r.id === 'home')!.amount).toBe(
      -(8_000_000 + 1_500_000 + 500_000),
    );
    expect(years[4].loanPayments).toBeGreaterThan(0);
    expect(years[4].loanInterest).toBeGreaterThan(0);
  });

  it('removes rent from spending as a capped reduction', () => {
    const plan = basePlan({
      endAge: 45,
      spending: { annual: 6_000_000, escalation: { mode: 'none' } },
      accounts: [acct('cash', 'cash', 50_000_000)],
      events: [home],
    });
    const years = forecastLongTerm(plan).years;
    expect(years[2].spending).toBe(6_000_000);
    expect(years[3].spending).toBe(6_000_000 - 2_400_000);
    expect(years[3].spendingChanges[0].amount).toBe(-2_400_000);
  });

  it('pays off a loan from cash flow, and a new job replaces the salary', () => {
    const plan = basePlan({
      endAge: 44,
      accounts: [acct('cash', 'cash', 10_000_000)],
      loans: [
        {
          id: 'car',
          name: 'Car loan',
          balance: -3_000_000,
          rateBps: 700,
          monthlyRepayment: 50_000,
          termMonths: null,
        },
      ],
      events: [
        ev({
          id: 'po',
          name: 'Pay off car',
          kind: 'payOff',
          start: { year: 2028 },
          loanId: 'car',
          amount: null,
        }),
        ev({
          id: 'job',
          name: 'New job',
          kind: 'newJob',
          start: { year: 2029 },
          takeHome: 12_000_000,
          escalation: { mode: 'none' },
          signingBonus: 1_000_000,
          grossSalary: 0,
          reductions: { salary: 10000 },
        }),
      ],
    });
    const years = forecastLongTerm(plan).years;
    expect(years[1].loanPayments).toBeGreaterThan(0);
    expect(years[2].balances.car).toBe(0);
    expect(years[2].loanPayments).toBe(years[2].loanPrincipal);
    expect(years[2].loanInterest).toBe(0);
    expect(years[3].income.map((i) => [i.sourceId, i.amount])).toEqual([
      ['salary', 0],
      ['job', 12_000_000],
    ]);
    expect(years[3].eventFlows.find((r) => r.id === 'job:bonus')!.amount).toBe(1_000_000);
  });

  it('ignores a home, one-off or pay-off dated before today and says so', () => {
    const result = forecastLongTerm(basePlan({ events: [{ ...home, start: { year: 2020 } }] }));
    expect(result.warnings.some((w) => w.includes('dated before today'))).toBe(true);
    expect(result.years[1].balances['home:property']).toBeUndefined();
  });

  it('charges a child upfront and for its years, with escalation', () => {
    const plan = basePlan({
      endAge: 43,
      events: [
        ev({
          id: 'kid',
          name: 'Child',
          kind: 'child',
          start: { year: 2028 },
          years: 2,
          annualCost: 1_000_000,
          upfrontCost: 400_000,
          escalation: { mode: 'rate', rateBps: 1000 },
        }),
      ],
    });
    const years = forecastLongTerm(plan).years;
    expect(years[1].eventFlows).toEqual([]);
    expect(years[2].eventFlows[0].amount).toBe(-(400_000 + 1_000_000));
    expect(years[3].eventFlows[0].amount).toBe(-1_100_000);
  });
});

describe('invariants', () => {
  it('gives the same output for the same input', () => {
    const plan = busyPlan(7);
    expect(JSON.stringify(forecastLongTerm(plan))).toBe(
      JSON.stringify(forecastLongTerm(structuredClone(plan))),
    );
  });

  it('never mutates its input', () => {
    const plan = busyPlan(3);
    const before = JSON.stringify(plan);
    forecastLongTerm(plan);
    expect(JSON.stringify(plan)).toBe(before);
  });

  it('closing = opening + the parts, to the cent, over many generated plans', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const result = forecastLongTerm(busyPlan(seed));
      for (const y of result.years) {
        expect(y.bridgeDifference, `seed ${seed} year ${y.index}`).toBe(0);
        const w = y.wealth;
        expect(w.accessible + w.preserved + w.illiquid + w.debts).toBe(y.closingNetWorth);
        if (y.index > 0) expect(y.openingNetWorth).toBe(result.years[y.index - 1].closingNetWorth);
      }
    }
  });

  it('keeps the explanation rows consistent with their totals', () => {
    for (let seed = 100; seed < 130; seed++) {
      for (const y of forecastLongTerm(busyPlan(seed)).years.slice(1)) {
        const out = y.withdrawals.reduce((s, r) => s + r.amount, 0);
        const inn = y.allocations.reduce((s, r) => s + r.amount, 0);
        if (y.netCashFlow >= 0) expect(inn + y.unfundedRepaid).toBe(y.netCashFlow);
        else expect(out + y.unfundedAdded).toBe(-y.netCashFlow);
        expect(y.growth.reduce((s, r) => s + r.amount, 0)).toBe(y.growthTotal);
        expect(y.superContribution - y.superTax).toBe(y.superNet);
        const rowsNet =
          y.income.reduce((s, r) => s + r.amount, 0) +
          y.agePension +
          y.eventFlows.reduce((s, r) => s + r.amount, 0) -
          y.spending -
          y.loanPayments +
          y.superDrawdown +
          y.studyWithheld -
          y.studyCompulsory;
        expect(rowsNet).toBe(y.netCashFlow);
        expect(y.studyCompulsory).toBeLessThanOrEqual(
          compulsoryStudyRepayment(y.studyRepaymentIncome + 1_000_000_000, STUDY_REPAYMENT_BANDS),
        );
        if (y.studyWithheld) expect(y.studyWithheld).toBeGreaterThanOrEqual(y.studyCompulsory);
        expect(y.superSalarySacrifice).toBeLessThanOrEqual(y.superContribution);
        if (y.superPhase === 'pension') expect(y.superEarningsTax).toBe(0);
        if (y.superPhase !== 'pension') expect(y.superDrawdown).toBe(0);
        if (y.superPersonal > 0)
          expect(y.allocations.find((r) => r.id === 'sup')?.amount).toBeGreaterThanOrEqual(
            y.superPersonal,
          );
        expect(y.spendingBase + y.spendingChanges.reduce((s, r) => s + r.amount, 0)).toBe(
          y.spending,
        );
        for (const row of y.income) {
          expect(row.gross - row.reductions.reduce((s, r) => s + r.amount, 0)).toBe(row.amount);
        }
      }
    }
  });

  it('is a pure module: no database, clock or randomness', () => {
    const source = readFileSync(new URL('./longTermForecast.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*(db|drizzle|express)[^'"]*['"]/);
    expect(source).not.toMatch(/Date\.now|new Date|Math\.random|performance\.now/);
  });
});

describe('validation', () => {
  it('rejects bad plans with a clear error', () => {
    expect(() => forecastLongTerm(basePlan({ endAge: 40 }))).toThrow(/End age/);
    expect(() => forecastLongTerm(basePlan({ endAge: 200 }))).toThrow(LongTermForecastError);
    expect(() => forecastLongTerm(basePlan({ inflationBps: 1.5 }))).toThrow(LongTermForecastError);
    expect(() =>
      forecastLongTerm(
        basePlan({
          loans: [
            { id: 'l', name: 'L', balance: 5, rateBps: 0, monthlyRepayment: 0, termMonths: null },
          ],
        }),
      ),
    ).toThrow(/negative/);
    expect(() =>
      forecastLongTerm(basePlan({ splits: [{ accountId: 'nope', mode: 'percent', bps: 100 }] })),
    ).toThrow(/cash or investment/);
    expect(() =>
      forecastLongTerm(basePlan({ accounts: [acct('x', 'cash', 0), acct('x', 'cash', 0)] })),
    ).toThrow(/twice/);
  });

  it('warns when a loan has no repayment data', () => {
    const result = forecastLongTerm(
      basePlan({
        loans: [
          {
            id: 'l',
            name: 'Card',
            balance: -100_000,
            rateBps: 0,
            monthlyRepayment: 0,
            termMonths: null,
          },
        ],
      }),
    );
    expect(result.warnings).toEqual(['Card has no repayment data and stays flat']);
    expect(result.years[10].balances.l).toBe(-100_000);
  });
});

/** A deterministic mixed plan for property-style checks (a local LCG; the engine has no randomness) */
function busyPlan(seed: number): ForecastPlan {
  let state = seed * 2654435761;
  const rnd = (n: number) => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state % n;
  };
  position = 0;
  const events: LifeEvent[] = [
    ev({
      id: 'home',
      name: 'Home',
      kind: 'home',
      start: { year: 2028 + rnd(8) },
      price: 30_000_000 + rnd(30_000_000),
      deposit: rnd(2)
        ? { kind: 'percent', bps: 1000 + rnd(3000) }
        : { kind: 'amount', cents: 5_000_000 + rnd(5_000_000) },
      loanRateBps: 400 + rnd(500),
      termYears: 20 + rnd(11),
      purchaseCosts: 1_000_000 + rnd(1_000_000),
      annualRates: 250_000 + rnd(200_000),
      annualInsurance: 150_000 + rnd(100_000),
      rentMonthly: rnd(3) * 100_000,
      replaceRent: rnd(2) === 1,
      propertyGrowthBps: rnd(600),
    }),
    ev({
      id: 'brk',
      name: 'Break',
      kind: 'careerBreak',
      start: { age: 40 + rnd(10) },
      durationYears: 1 + rnd(3),
      spendingMultiplierBps: 6000 + rnd(5000),
      reductions: { salary: rnd(10001) },
    }),
    ev({
      id: 'job',
      name: 'Job',
      kind: 'newJob',
      start: { year: 2030 + rnd(10) },
      takeHome: 5_000_000 + rnd(9_000_000),
      escalation: { mode: 'rate', rateBps: rnd(500) },
      signingBonus: rnd(2) * 300_000,
      grossSalary: 7_000_000 + rnd(6_000_000),
      reductions: { salary: rnd(10001) },
    }),
    ev({
      id: 'kid',
      name: 'Child',
      kind: 'child',
      start: { year: 2027 + rnd(6) },
      years: 5 + rnd(10),
      annualCost: 800_000 + rnd(800_000),
      upfrontCost: rnd(500_000),
      escalation: { mode: 'inflation' },
    }),
    ev({
      id: 'po',
      name: 'Pay off',
      kind: 'payOff',
      start: { year: 2030 + rnd(10) },
      loanId: 'car',
      amount: rnd(2) ? null : 400_000,
    }),
    ev({
      id: 'inc',
      name: 'Rental',
      kind: 'recurring',
      start: { year: 2029 + rnd(5) },
      amount: 600_000,
      endYear: rnd(2) ? null : 2045,
      everyYears: 1 + rnd(2),
      escalation: { mode: 'inflation' },
    }),
    ev({
      id: 'ret',
      name: 'Retire',
      kind: 'retirement',
      start: { age: 55 + rnd(10) },
      spendingMultiplierBps: 6000 + rnd(3000),
      reductions: { salary: 10000, job: 10000, inc: rnd(2) * 10000 },
    }),
  ];
  return {
    startYear: 2027,
    startAge: 38,
    endAge: 38 + 40 + rnd(20),
    inflationBps: rnd(600),
    accounts: [
      acct('cash', 'cash', rnd(10_000_000), rnd(400)),
      acct('inv', 'investments', rnd(20_000_000), rnd(900)),
      acct('sup', 'super', rnd(30_000_000), rnd(800)),
      acct('veh', 'vehicles', rnd(3_000_000), -1500),
    ],
    loans: [
      {
        id: 'car',
        name: 'Car',
        balance: -(1_000_000 + rnd(2_000_000)),
        rateBps: 500 + rnd(500),
        monthlyRepayment: 40_000 + rnd(40_000),
        termMonths: null,
      },
      {
        id: 'hecs',
        name: 'HECS',
        balance: -rnd(6_000_000),
        rateBps: 0,
        monthlyRepayment: 0,
        termMonths: null,
        study: { kind: rnd(2) ? 'help' : 'ssl', extraAnnual: rnd(2) * rnd(800_000) },
      },
    ],
    studyLoans: {
      withheldFromPay: rnd(2) === 1,
      otherRepaymentIncome: rnd(2) * rnd(2_000_000),
      indexationBps: rnd(2) ? null : rnd(500),
      bands: STUDY_REPAYMENT_BANDS,
    },
    salary: {
      takeHome: 6_000_000 + rnd(6_000_000),
      grossForSuper: 8_000_000 + rnd(4_000_000),
      escalation: { mode: 'inflation' },
    },
    spending: { annual: 4_000_000 + rnd(4_000_000), escalation: { mode: 'inflation' } },
    super: {
      guaranteeBps: 1200,
      contributionsTaxBps: 1500,
      preservationAge: 60,
      salarySacrifice: rnd(2) * rnd(1_500_000),
      personalContribution: rnd(2) * rnd(1_000_000),
      feesAnnual: rnd(60_000),
      earningsTaxBps: rnd(2) * rnd(1500),
      minimumDrawdown: rnd(4) > 0,
      concessionalCap: 3_250_000,
      nonConcessionalCap: 13_000_000,
      transferBalanceCap: 210_000_000,
    },
    agePension: { enabled: rnd(2) === 1, annual: 2_400_000, startAge: 67 },
    extraSavingsGrowthBps: 200,
    splits: [
      { accountId: 'cash', mode: 'fixed', amount: 500_000 },
      { accountId: 'inv', mode: 'percent', bps: 3333 },
    ],
    withdrawalOrder: [],
    events,
  };
}

describe('more behaviours', () => {
  it('treats a blank split entry as 0', () => {
    const plan = basePlan({
      endAge: 41,
      accounts: [acct('a', 'cash', 0)],
      splits: [
        { accountId: 'a', mode: 'percent' },
        { accountId: 'a', mode: 'fixed' },
      ],
    });
    const y = forecastLongTerm(plan).years[1];
    expect(y.allocations).toEqual([
      { id: EXTRA_SAVINGS_ID, name: 'Extra savings', amount: 2_000_000 },
    ]);
  });

  it('rejects bad event fields with a typed error, not a crash', () => {
    const oneOff = (over: Record<string, unknown>) =>
      basePlan({
        events: [
          ev({
            id: 'x',
            name: 'X',
            kind: 'oneOff',
            start: { year: 2030 },
            amount: 100,
            todaysDollars: true,
            ...over,
          }),
        ],
      });
    expect(() => forecastLongTerm(oneOff({ amount: 1.5 }))).toThrow(LongTermForecastError);
    expect(() => forecastLongTerm(oneOff({ start: { year: 2028.5 } }))).toThrow(
      LongTermForecastError,
    );
    expect(() => forecastLongTerm(oneOff({ start: { year: NaN } }))).toThrow(LongTermForecastError);
    expect(() => forecastLongTerm(oneOff({ kind: 'mystery' }))).toThrow(/Unknown event kind/);
    const home = (over: Record<string, unknown>) =>
      basePlan({ events: [{ ...homeEvent(), ...over } as LifeEvent] });
    expect(() => forecastLongTerm(home({ price: -1 }))).toThrow(/price/);
    expect(() => forecastLongTerm(home({ repaymentOverride: -5 }))).toThrow(/repayment/);
    const payOff = basePlan({
      loans: [
        { id: 'l', name: 'L', balance: -1000, rateBps: 0, monthlyRepayment: 0, termMonths: null },
      ],
      events: [
        ev({ id: 'p', name: 'P', kind: 'payOff', start: { year: 2030 }, loanId: 'l', amount: -5 }),
      ],
    });
    expect(() => forecastLongTerm(payOff)).toThrow(/non-negative/);
  });

  it('reserves ids it generates', () => {
    const plan = basePlan({
      accounts: [acct('home:property', 'cash', 0)],
      events: [homeEvent()],
    });
    expect(() => forecastLongTerm(plan)).toThrow(/twice/);
  });

  it('turns arithmetic overflow into a typed error', () => {
    const plan = basePlan({
      endAge: 140,
      startAge: 40,
      accounts: [acct('inv', 'investments', 9_000_000_000_000_000 - 1, 1500)],
    });
    expect(() => forecastLongTerm(plan)).toThrow(LongTermForecastError);
    expect(() => forecastLongTerm(basePlan({ inflationBps: 100_000 }))).toThrow(
      LongTermForecastError,
    );
  });

  it('adds a spending addition without raising the cap, mixed with replaced rent, in start order', () => {
    const plan = basePlan({
      endAge: 41,
      spending: { annual: 6_000_000, escalation: { mode: 'none' } },
      accounts: [acct('cash', 'cash', 50_000_000)],
      events: [
        ev({
          id: 'up',
          name: 'Higher costs',
          kind: 'careerBreak',
          start: { year: 2027 },
          durationYears: 3,
          spendingMultiplierBps: 15000,
          reductions: {},
        }),
        { ...homeEvent(), start: { year: 2027 }, rentMonthly: 400_000, replaceRent: true },
        ev({
          id: 'ret',
          name: 'Retire',
          kind: 'retirement',
          start: { year: 2027 },
          spendingMultiplierBps: 0,
          reductions: {},
        }),
      ],
    });
    const y = forecastLongTerm(plan).years[1];
    // +50% (3,000,000), then rent -4,800,000, then retirement takes the remaining 1,200,000 of 6,000,000
    expect(y.spendingChanges.map((c) => c.amount)).toEqual([3_000_000, -4_800_000, -1_200_000]);
    expect(y.spending).toBe(3_000_000);
  });

  it('withdraws Extra savings first, skips locked super and non-liquid assets, and ignores overdrawn accounts', () => {
    const plan = basePlan({
      endAge: 42,
      salary: { takeHome: 5_000_000, grossForSuper: 0, escalation: { mode: 'none' } },
      spending: { annual: 3_000_000, escalation: { mode: 'none' } },
      accounts: [
        acct('cash', 'cash', 100_000),
        acct('over', 'cash', -500_000),
        acct('sup', 'super', 9_000_000),
        acct('house', 'property', 90_000_000),
        acct('car', 'vehicles', 9_000_000),
      ],
      splits: [],
      withdrawalOrder: ['sup', 'house'],
    });
    const years = forecastLongTerm(plan).years;
    // Surplus years build Extra savings
    expect(years[1].allocations[0].id).toBe(EXTRA_SAVINGS_ID);
    const lean = forecastLongTerm({
      ...plan,
      salary: { ...plan.salary, takeHome: 0 },
      spending: { annual: 2_100_000, escalation: { mode: 'none' } },
    }).years;
    expect(lean[1].withdrawals.map((w) => [w.id, w.amount])).toEqual([['cash', 100_000]]);
    expect(lean[1].unfundedAdded).toBe(2_000_000);
    expect(lean[1].balances).toMatchObject({
      sup: 9_000_000,
      house: 90_000_000,
      car: 9_000_000,
    });
  });

  it('puts Extra savings ahead of cash by default', () => {
    const plan = basePlan({
      endAge: 43,
      accounts: [acct('cash', 'cash', 100_000_000)],
      salary: { takeHome: 3_000_000, grossForSuper: 0, escalation: { mode: 'none' } },
      spending: { annual: 1_000_000, escalation: { mode: 'none' } },
      events: [
        ev({
          id: 'x',
          name: 'Big bill',
          kind: 'oneOff',
          start: { year: 2028 },
          amount: -4_000_000,
          todaysDollars: false,
        }),
      ],
    });
    const y2 = forecastLongTerm(plan).years[2];
    expect(y2.withdrawals.map((w) => [w.id, w.amount])).toEqual([[EXTRA_SAVINGS_ID, 2_000_000]]);
    const y2b = forecastLongTerm({
      ...plan,
      events: [
        ev({
          id: 'x',
          name: 'Big bill',
          kind: 'oneOff',
          start: { year: 2028 },
          amount: -6_000_000,
          todaysDollars: false,
        }),
      ],
    }).years[2];
    expect(y2b.withdrawals.map((w) => [w.id, w.amount])).toEqual([
      [EXTRA_SAVINGS_ID, 2_000_000],
      ['cash', 2_000_000],
    ]);
  });

  it('clears a home mortgage exactly at its last month, paying nothing in the opening year', () => {
    const plan = basePlan({
      endAge: 40 + 34,
      salary: { takeHome: 90_000_000, grossForSuper: 0, escalation: { mode: 'none' } },
      accounts: [acct('cash', 'cash', 60_000_000)],
      events: [{ ...homeEvent(), start: { year: 2028 } }],
    });
    const years = forecastLongTerm(plan).years;
    const open = 2; // 2028
    const level = standardLoanPayment(32_000_000, 650, 360);
    expect(years[open].loanPayments).toBe(0);
    expect(years[open + 29].balances['home:mortgage']).not.toBe(0);
    expect(years[open + 30].balances['home:mortgage']).toBe(0);
    expect(years[open + 31].loanPayments).toBe(0);
    const finalYear = years[open + 30];
    const normalYear = years[open + 29];
    expect(Math.abs(finalYear.loanPayments - 12 * level)).toBeLessThan(5_000);
    expect(normalYear.loanPayments).toBe(12 * level);
  });

  it('handles recurring events: every two years, an end year, and expenses', () => {
    const plan = basePlan({
      endAge: 48,
      events: [
        ev({
          id: 'inc',
          name: 'Rent',
          kind: 'recurring',
          start: { year: 2028 },
          amount: 500_000,
          endYear: 2032,
          everyYears: 2,
          escalation: { mode: 'none' },
        }),
        ev({
          id: 'exp',
          name: 'Service',
          kind: 'recurring',
          start: { year: 2027 },
          amount: -100_000,
          endYear: null,
          everyYears: 3,
          escalation: { mode: 'none' },
        }),
      ],
    });
    const years = forecastLongTerm(plan).years;
    const incomeOf = (i: number) => years[i].income.find((r) => r.sourceId === 'inc')?.amount ?? 0;
    // 2028, 2030, 2032 are plan years 2, 4, 6; 2034 is past the end year
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(incomeOf)).toEqual([
      0, 500_000, 0, 500_000, 0, 500_000, 0, 0,
    ]);
    const expenseOf = (i: number) => years[i].eventFlows.find((r) => r.id === 'exp')?.amount ?? 0;
    expect([1, 2, 3, 4, 5, 6, 7].map(expenseOf)).toEqual([
      -100_000, 0, 0, -100_000, 0, 0, -100_000,
    ]);
  });

  it('pins escalation with inflation: level in real terms, flat in nominal, or compounding from the start year', () => {
    const plan = (escalation: ForecastPlan['salary']['escalation']) =>
      basePlan({
        endAge: 43,
        inflationBps: 1000,
        salary: { takeHome: 1_000_000, grossForSuper: 0, escalation },
        spending: { annual: 0, escalation: { mode: 'none' } },
      });
    const amounts = (e: ForecastPlan['salary']['escalation']) =>
      forecastLongTerm(plan(e))
        .years.slice(1)
        .map((y) => y.income[0].amount);
    expect(amounts({ mode: 'inflation' })).toEqual([1_100_000, 1_210_000, 1_331_000]);
    expect(amounts({ mode: 'none' })).toEqual([1_100_000, 1_100_000, 1_100_000]);
    expect(amounts({ mode: 'rate', rateBps: 300 })).toEqual([1_100_000, 1_133_000, 1_166_990]);
  });

  it('warns about events after the plan ends, and about loans that never shrink', () => {
    const result = forecastLongTerm(
      basePlan({
        loans: [
          {
            id: 'card',
            name: 'Card',
            balance: -1_000_000,
            rateBps: 2000,
            monthlyRepayment: 10_000,
            termMonths: null,
          },
          {
            id: 'bal',
            name: 'Balloon',
            balance: -1_000_000,
            rateBps: 500,
            monthlyRepayment: 0,
            termMonths: 24,
          },
        ],
        events: [
          ev({
            id: 'late',
            name: 'Late',
            kind: 'oneOff',
            start: { year: 2099 },
            amount: 1,
            todaysDollars: false,
          }),
        ],
      }),
    );
    expect(result.warnings).toEqual([
      'Late is dated after the end of the plan and never happens',
      "Card's repayment does not cover its interest, so the balance grows",
      'Balloon has no repayment, so its whole balance falls due in its last month',
    ]);
  });

  it('ignores a one-off or pay-off dated before today, not only a home', () => {
    const result = forecastLongTerm(
      basePlan({
        loans: [
          {
            id: 'l',
            name: 'L',
            balance: -1_000_000,
            rateBps: 0,
            monthlyRepayment: 10_000,
            termMonths: null,
          },
        ],
        events: [
          ev({
            id: 'o',
            name: 'Old windfall',
            kind: 'oneOff',
            start: { year: 2020 },
            amount: 5_000_000,
            todaysDollars: false,
          }),
          ev({
            id: 'p',
            name: 'Old payoff',
            kind: 'payOff',
            start: { age: 20 },
            loanId: 'l',
            amount: null,
          }),
        ],
      }),
    );
    expect(result.warnings.filter((w) => w.includes('dated before today'))).toHaveLength(2);
    expect(result.years[1].eventFlows).toEqual([]);
    expect(result.years[1].balances.l).toBe(-1_000_000 + 120_000);
  });
});

function homeEvent() {
  return ev({
    id: 'home',
    name: 'Home',
    kind: 'home',
    start: { year: 2029 },
    price: 40_000_000,
    deposit: { kind: 'percent', bps: 2000 },
    loanRateBps: 650,
    termYears: 30,
    purchaseCosts: 1_500_000,
    annualRates: 300_000,
    annualInsurance: 200_000,
    rentMonthly: 200_000,
    replaceRent: true,
    propertyGrowthBps: 0,
  });
}
