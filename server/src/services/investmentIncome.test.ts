import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  holdingPeriodConcerns,
  incomeYearTotals,
  partsDisagree,
  type IncomeFigures,
} from './investmentIncome.js';

// D3b (docs/INVESTMENT-SALES-AND-INCOME.md §3 and §7): dividend and franking rules, each on its
// own. Amounts are cents. Mock figures only.

const RUNS = Number(process.env.PROPERTY_RUNS ?? 100);

describe('a year by return item', () => {
  const row = (r: Partial<IncomeFigures> & Pick<IncomeFigures, 'kind'>): IncomeFigures => ({
    amount: 0,
    unfranked: 0,
    franked: 0,
    frankingCredit: 0,
    withheld: 0,
    ...r,
  });

  it('puts dividends in item 11, distributions apart and interest in item 10', () => {
    const totals = incomeYearTotals([
      row({
        kind: 'dividend',
        amount: 10_000,
        unfranked: 2_000,
        franked: 8_000,
        frankingCredit: 3_429,
      }),
      row({ kind: 'dividend', amount: 5_300, unfranked: 10_000, withheld: 4_700 }),
      row({ kind: 'distribution', amount: 1_200, franked: 300, frankingCredit: 129 }),
      row({ kind: 'interest', amount: 900, withheld: 100 }),
      row({ kind: 'dividend', amount: null }),
    ]);
    expect(totals).toEqual({
      dividends: {
        unfranked: 12_000,
        franked: 8_000,
        frankingCredit: 3_429,
        withheld: 4_700,
        count: 2,
      },
      distributions: { amount: 1_200, franked: 300, frankingCredit: 129, count: 1 },
      interest: { gross: 1_000, withheld: 100, count: 1 },
      unconverted: 1,
    });
  });

  it("flags a dividend whose parts aren't the payment plus tax withheld", () => {
    const ok = {
      kind: 'dividend' as const,
      amount: 5_300,
      unfranked: 10_000,
      franked: 0,
      withheld: 4_700,
    };
    expect(partsDisagree(ok)).toBe(false);
    expect(partsDisagree({ ...ok, franked: 1 })).toBe(true);
    expect(partsDisagree({ ...ok, kind: 'distribution', franked: 1 })).toBe(false);
  });

  it('adds every converted row once, and only those', () => {
    const kinds = ['dividend', 'distribution', 'interest'] as const;
    const cents = fc.integer({ min: 0, max: 1e9 });
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kind: fc.constantFrom(...kinds),
            amount: fc.option(cents, { nil: null }),
            unfranked: cents,
            franked: cents,
            frankingCredit: cents,
            withheld: cents,
          }),
          { maxLength: 15 },
        ),
        (rows) => {
          const t = incomeYearTotals(rows);
          const counted = rows.filter((r) => r.amount !== null);
          expect(t.unconverted).toBe(rows.length - counted.length);
          expect(t.dividends.count + t.distributions.count + t.interest.count).toBe(counted.length);
          const sum = (k: (typeof kinds)[number], f: (r: (typeof rows)[number]) => number) =>
            counted.filter((r) => r.kind === k).reduce((s, r) => s + f(r), 0);
          expect(t.dividends.frankingCredit).toBe(sum('dividend', (r) => r.frankingCredit));
          expect(t.interest.gross).toBe(sum('interest', (r) => r.amount! + r.withheld));
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('the 45-day holding period', () => {
  const payment = { id: 'p', holdingId: 'h', paidOn: '2025-09-20', frankingCredit: 1_000 };

  it('flags a franked payment with units bought and sold within 45 days around it', () => {
    // Bought 1 September, sold 30 September: 28 days held, not counting either day
    expect(
      holdingPeriodConcerns(
        [payment],
        [{ holdingId: 'h', acquiredOn: '2025-09-01', soldOn: '2025-09-30' }],
      ),
    ).toEqual(['p']);
  });

  it('leaves out units held 45 days, other holdings, unfranked payments and later purchases', () => {
    const parcels = [
      // 45 days at risk (2 September to 16 October): bought 1 September, sold 17 October
      { holdingId: 'h', acquiredOn: '2025-09-01', soldOn: '2025-10-17' },
      { holdingId: 'other', acquiredOn: '2025-09-01', soldOn: '2025-09-30' },
      { holdingId: 'h', acquiredOn: '2025-09-21', soldOn: '2025-09-30' },
    ];
    expect(holdingPeriodConcerns([payment], parcels)).toEqual([]);
    expect(
      holdingPeriodConcerns(
        [{ ...payment, frankingCredit: 0 }],
        [{ holdingId: 'h', acquiredOn: '2025-09-01', soldOn: '2025-09-30' }],
      ),
    ).toEqual([]);
    // One day short: 44 days at risk
    expect(
      holdingPeriodConcerns(
        [payment],
        [{ holdingId: 'h', acquiredOn: '2025-09-01', soldOn: '2025-10-16' }],
      ),
    ).toEqual(['p']);
  });
});
