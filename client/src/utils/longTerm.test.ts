import { describe, expect, it } from 'vitest';
import type { YearResult } from '../api/longTerm';
import {
  apportion,
  bpsToInput,
  bridge,
  draftIssues,
  EVENT_KINDS,
  eventYear,
  inDollars,
  inputToBps,
  mulDiv,
  newDraft,
  PPB,
  worked,
} from './longTerm';

// The long-term screen's pure helpers. Mock numbers only.

const year = (over: Partial<YearResult> = {}): YearResult => ({
  index: 2,
  calendarYear: 2028,
  age: 41,
  inflationIndexPpb: 1_060_900_000,
  income: [
    { sourceId: 'salary', name: 'Salary', gross: 9_000_000, reductions: [], amount: 9_000_000 },
  ],
  agePension: 0,
  eventFlows: [{ id: 'kid', name: 'Child', amount: -1_234_567 }],
  spending: 6_123_457,
  spendingBase: 6_123_457,
  spendingChanges: [],
  loanPayments: 1_111_111,
  loanInterest: 700_001,
  loanPrincipal: 411_110,
  openedByEvents: 0,
  superContribution: 1_000_000,
  superTax: 150_000,
  superNet: 850_000,
  netCashFlow: 0,
  withdrawals: [],
  allocations: [],
  unfundedAdded: 0,
  unfundedRepaid: 0,
  growth: [],
  growthTotal: 777_777,
  openingNetWorth: 50_000_000,
  closingNetWorth:
    50_000_000 + 9_000_000 - 1_234_567 - 6_123_457 - 1_111_111 + 411_110 + 850_000 + 777_777,
  balances: {},
  unfundedBalance: 0,
  bridgeDifference: 0,
  ...over,
});

describe('mulDiv', () => {
  it('rounds half away from zero, exactly', () => {
    expect(mulDiv(5, 1, 2)).toBe(3);
    expect(mulDiv(-5, 1, 2)).toBe(-3);
    expect(mulDiv(9_000_000_000_000, 1_000_000_007, 1_000_000_000)).toBe(9_000_000_063_000);
  });
});

describe('apportion', () => {
  it('adds up exactly to the rounded total, largest remainders first', () => {
    // 3 × (1 ÷ 3) rounds to 1 in total: one part takes it, the first on a tie
    expect(apportion([1, 1, 1], 1, 3)).toEqual([1, 0, 0]);
    // 10 ÷ 3 each: floors 3, 3, 3 and a total of 10, so one extra cent
    expect(apportion([10, 10, 10], 1, 3)).toEqual([4, 3, 3]);
    // Each floors to -1; the total rounds to -1, so two parts give a cent back
    expect(apportion([-1, -1, -1], 1, 3)).toEqual([0, 0, -1]);
  });

  it('keeps signs and sums for mixed parts', () => {
    const cases: [number[], number, number][] = [
      [[9_000_000, -1_234_567, -6_123_457, 777_777], PPB, 1_060_900_000],
      [[1, -2, 3, -4, 5], 7, 11],
      [[-5, -5, 10, 0], 1, 3],
    ];
    for (const [values, num, den] of cases) {
      const out = apportion(values, num, den);
      const total = values.reduce((s, v) => s + v, 0);
      expect(out.reduce((s, v) => s + v, 0)).toBe(mulDiv(total, num, den));
      // each part is within a cent of its own exact share
      out.forEach((v, i) => expect(Math.abs(v - (values[i] * num) / den)).toBeLessThan(1 + 1e-6));
    }
  });
});

describe('bridge', () => {
  it('adds up in future dollars, as the engine made it', () => {
    const b = bridge(year(), 1_030_000_000, 'future');
    expect(b.difference).toBe(0);
    expect(b.rows.find((r) => r.key === 'spending')!.amount).toBe(-6_123_457);
    expect(b.rows.find((r) => r.key === 'inflation')).toBeUndefined();
  });

  it("adds up to the cent in today's dollars, with an inflation row for the rest", () => {
    const y = year();
    const b = bridge(y, 1_030_000_000, 'today');
    expect(b.difference).toBe(0);
    expect(b.opening).toBe(mulDiv(y.openingNetWorth, PPB, 1_030_000_000));
    expect(b.closing).toBe(mulDiv(y.closingNetWorth, PPB, y.inflationIndexPpb));
    const inflation = b.rows.find((r) => r.key === 'inflation')!;
    expect(inflation.amount).toBeLessThan(0);
    // It is what the year's price rise did to the opening balance: O × (1/I_k − 1/I_k−1),
    // give or take the cents the other rows were apportioned
    const expected = (y.openingNetWorth * PPB) / y.inflationIndexPpb - b.opening;
    expect(Math.abs(inflation.amount - expected)).toBeLessThan(10);
    // The other rows are the year's flows at this year's prices
    const flows = b.rows.filter((r) => r.key !== 'inflation').reduce((s, r) => s + r.amount, 0);
    expect(flows).toBe(mulDiv(y.closingNetWorth - y.openingNetWorth, PPB, y.inflationIndexPpb));
  });

  it('adds up over many awkward years, including a negative net worth', () => {
    for (let k = 1; k < 200; k++) {
      const index = 1_000_000_000 + k * 7_919_113;
      const y = year({
        inflationIndexPpb: index,
        openingNetWorth: -k * 123_457,
        closingNetWorth:
          -k * 123_457 +
          9_000_000 -
          1_234_567 -
          6_123_457 -
          1_111_111 +
          411_110 +
          850_000 +
          777_777,
      });
      expect(bridge(y, index - 7_919_113, 'today').difference, `year ${k}`).toBe(0);
    }
  });

  it("fails when the engine's own parts do not add up, even in today's dollars", () => {
    const broken = year({ closingNetWorth: year().closingNetWorth + 1 });
    expect(bridge(broken, 1_030_000_000, 'future').difference).toBe(-1);
    expect(bridge(broken, 1_030_000_000, 'today').difference).not.toBe(0);
  });

  it('treats today and future as the same at zero inflation', () => {
    const y = year({ inflationIndexPpb: PPB });
    const today = bridge(y, PPB, 'today');
    expect(today.rows.find((r) => r.key === 'inflation')!.amount).toBe(0);
    expect(today.rows.filter((r) => r.key !== 'inflation').map((r) => r.amount)).toEqual(
      bridge(y, PPB, 'future').rows.map((r) => r.amount),
    );
  });
});

describe('inDollars', () => {
  it('deflates by the year index, or leaves future dollars alone', () => {
    expect(inDollars(1_060_900, 1_060_900_000, 'today')).toBe(1_000_000);
    expect(inDollars(1_060_900, 1_060_900_000, 'future')).toBe(1_060_900);
  });
});

describe('worked savings example', () => {
  const money = (c: number) => `$${c / 100}`;
  it('is percent of what is left, then the rest, as in the design note', () => {
    const steps = worked(
      1_000_000,
      [
        { name: 'A', accountId: 'a', mode: 'percent', bps: 5000 },
        { name: 'B', accountId: 'b', mode: 'percent', bps: 5000 },
      ],
      money,
    );
    expect(steps.map((s) => [s.name, s.amount, s.remaining])).toEqual([
      ['A', 500_000, 500_000],
      ['B', 250_000, 250_000],
      ['Extra savings', 250_000, 0],
    ]);
    expect(steps[0].rule).toBe('50% of what is left');
  });

  it('caps a fixed amount and stops once nothing is left', () => {
    const steps = worked(
      1_000_000,
      [
        { name: 'A', accountId: 'a', mode: 'fixed', amount: 300_000 },
        { name: 'B', accountId: 'b', mode: 'fixed', amount: 9_000_000 },
        { name: 'C', accountId: 'c', mode: 'percent', bps: 5000 },
      ],
      money,
    );
    expect(steps.map((s) => s.amount)).toEqual([300_000, 700_000, 0, 0]);
    expect(steps.reduce((s, x) => s + x.amount, 0)).toBe(1_000_000);
    expect(steps[0].rule).toBe('up to $3000');
  });
});

describe('event drafts', () => {
  it('has a draft and an editor label for each kind, none ready until filled in', () => {
    for (const { kind } of EVENT_KINDS) {
      const draft = newDraft(kind, { startYear: 2026 });
      expect(draft.kind).toBe(kind);
      expect(draft.id).toMatch(/^[A-Za-z0-9_-]{1,40}$/);
      expect(draft.enabled).toBe(true);
      // A break and a retirement are complete as drafted; the rest need an amount or a choice
      expect(draftIssues(draft).length > 0).toBe(kind !== 'retirement' && kind !== 'careerBreak');
    }
    expect(new Set(EVENT_KINDS.map((k) => newDraft(k.kind, { startYear: 2026 }).id)).size).toBe(8);
  });

  it('says what is missing', () => {
    const home = newDraft('home', { startYear: 2026 });
    if (home.kind !== 'home') throw new Error();
    expect(draftIssues(home)).toEqual(['Enter the purchase price']);
    expect(draftIssues({ ...home, price: 1, name: ' ' })).toEqual(['Give the event a name']);
    expect(draftIssues({ ...home, price: 40_000_000 })).toEqual([]);
  });

  it('dates events by year or age', () => {
    expect(eventYear({ year: 2031 }, 1985)).toBe(2031);
    expect(eventYear({ age: 65 }, 1985)).toBe(2050);
  });
});

describe('rates as typed', () => {
  it('moves between basis points and percent text', () => {
    expect(bpsToInput(650)).toBe('6.5');
    expect(inputToBps('6.5')).toBe(650);
    expect(inputToBps('2.75')).toBe(275);
    expect(inputToBps('')).toBeNull();
    expect(inputToBps('abc')).toBeNull();
    expect(inputToBps('3x')).toBeNull();
    expect(inputToBps('0x10')).toBeNull();
    expect(inputToBps('1e3')).toBeNull();
    expect(inputToBps('-1.5')).toBe(-150);
  });
});
