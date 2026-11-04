import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  daysHeld,
  poolEntryFor,
  poolEntryOf,
  poolSchedule,
  schedule,
  type AssetTerms,
} from './depreciation.js';

// The plan's worked example (docs/DEPRECIATING-ASSETS-PLAN.md §3.2): a $2,400 laptop first used
// on 1 October 2026, effective life 2 years, 80% for work. FY 2027–28 holds 29 February 2028.
const laptop = (method: AssetTerms['method']): AssetTerms => ({
  cost: 240_000,
  startDate: '2026-10-01',
  method,
  effectiveLifeHundredths: 200,
  workUseBps: 8_000,
});

describe('decline in value', () => {
  it('prime cost: the worked example, ending at exactly zero', () => {
    expect(
      schedule(laptop('prime_cost'), 2035).map((r) => [
        r.financialYear,
        r.daysHeld,
        r.decline,
        r.deduction,
        r.closing,
      ]),
    ).toEqual([
      [2026, 273, 89_753, 71_802, 150_247],
      [2027, 366, 120_329, 96_263, 29_918],
      [2028, 365, 29_918, 23_934, 0],
    ]);
  });

  it('diminishing value: the worked example, capped at the base value', () => {
    expect(
      schedule(laptop('diminishing_value'), 2035).map((r) => [
        r.financialYear,
        r.decline,
        r.deduction,
        r.closing,
      ]),
    ).toEqual([
      [2026, 179_507, 143_606, 60_493],
      [2027, 60_493, 48_394, 0],
    ]);
  });

  it("the ATO guide's diminishing value: a $80,000 asset over 5 years, a full first year", () => {
    // 200% ÷ 5 = 40% a year on the opening adjustable value
    const rows = schedule(
      {
        cost: 8_000_000,
        startDate: '2025-07-01',
        method: 'diminishing_value',
        effectiveLifeHundredths: 500,
        workUseBps: 10_000,
      },
      2027,
    );
    // 40% a year: 3,200,000 then 1,920,000; FY 2027–28 holds 29 February 2028 (366 days ÷ 365)
    expect(rows[0]).toMatchObject({ daysHeld: 365, decline: 3_200_000, closing: 4_800_000 });
    expect(rows[1]).toMatchObject({ baseValue: 4_800_000, decline: 1_920_000, closing: 2_880_000 });
    expect(rows[2]).toMatchObject({ daysHeld: 366, decline: 1_155_156, closing: 1_724_844 });
  });

  it('a work-use share that changes by year changes the deduction, never the decline', () => {
    const terms = { ...laptop('prime_cost'), yearWorkUse: { 2027: 5_000 } };
    const rows = schedule(terms, 2035);
    expect(rows.map((r) => r.decline)).toEqual(
      schedule(laptop('prime_cost'), 2035).map((r) => r.decline),
    );
    expect(rows[1]).toMatchObject({ workUseBps: 5_000, deduction: 60_165 });
  });

  it('brought in mid-life: starts from the opening adjustable value', () => {
    const rows = schedule(
      { ...laptop('diminishing_value'), openingFy: 2027, openingAdjustableValue: 100_000 },
      2027,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        financialYear: 2027,
        opening: 100_000,
        baseValue: 100_000,
        decline: 100_000,
      }),
    ]);
  });

  it('disposal: the decline to the day, then a balancing adjustment by its taxable share', () => {
    const sold = { ...laptop('prime_cost'), disposedDate: '2027-12-31', terminationValue: 50_000 };
    const rows = schedule(sold, 2035);
    expect(rows).toHaveLength(2);
    const last = rows[1];
    expect(last.daysHeld).toBe(184); // 1 July to 31 December 2027
    expect(last.closing).toBe(0);
    // Sold for less than its adjustable value: a deduction (negative), 80% of it
    expect(last.balancingAdjustment).toBe(50_000 - (150_247 - last.decline));
    expect(last.balancingTaxable).toBe(Math.round((last.balancingAdjustment! * 8_000) / 10_000));
    // Sold for more: assessable income
    const dear = schedule({ ...sold, terminationValue: 200_000 }, 2035).at(-1)!;
    expect(dear.balancingAdjustment).toBeGreaterThan(0);
  });

  it('a disposal after the value reaches zero still has its balancing adjustment', () => {
    // Fully declined by 2028–29 (prime cost, 2 years), sold for $500 in September 2030
    const sold = { ...laptop('prime_cost'), disposedDate: '2030-09-15', terminationValue: 50_000 };
    const rows = schedule(sold, 2035);
    expect(rows.map((r) => r.financialYear)).toEqual([2026, 2027, 2028, 2030]);
    const last = rows.at(-1)!;
    expect(last).toMatchObject({ opening: 0, decline: 0, deduction: 0, closing: 0 });
    expect(last.balancingAdjustment).toBe(50_000);
    expect(last.balancingTaxable).toBe(40_000);
    // Not there before the year it happens
    expect(schedule(sold, 2029).map((r) => r.financialYear)).toEqual([2026, 2027, 2028]);
  });

  it('days held count both ends, and nothing outside the life', () => {
    expect(daysHeld(laptop('prime_cost'), 2026)).toBe(273);
    expect(daysHeld(laptop('prime_cost'), 2025)).toBe(0);
    expect(daysHeld({ ...laptop('prime_cost'), startDate: '2027-06-30' }, 2026)).toBe(1);
  });

  it('properties: prime cost adds up to exactly the cost; nothing ever goes below zero', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30_001, max: 500_000_000 }),
        fc.integer({ min: 0, max: 3_000 }),
        fc.integer({ min: 50, max: 4_000 }),
        fc.integer({ min: 1, max: 10_000 }),
        fc.constantFrom<AssetTerms['method']>('prime_cost', 'diminishing_value'),
        (cost, offset, life, work, method) => {
          const start = new Date(Date.UTC(2010, 0, 1) + offset * 86_400_000)
            .toISOString()
            .slice(0, 10);
          const rows = schedule(
            { cost, startDate: start, method, effectiveLifeHundredths: life, workUseBps: work },
            2010 + 60,
          );
          for (const r of rows) {
            expect(r.decline).toBeGreaterThanOrEqual(0);
            expect(r.closing).toBeGreaterThanOrEqual(0);
            expect(r.closing).toBe(r.opening - r.decline);
            expect(r.deduction).toBeLessThanOrEqual(r.decline);
          }
          if (method === 'prime_cost') expect(rows.reduce((s, r) => s + r.decline, 0)).toBe(cost);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('low-value pool (phase 3)', () => {
  const headset: AssetTerms = {
    cost: 80_000,
    startDate: '2026-10-01',
    method: 'diminishing_value',
    effectiveLifeHundredths: 300,
    workUseBps: 10_000,
  };

  it('a low-cost asset: 18.75% in its first year, whatever the days held, then 37.5%', () => {
    const entry = poolEntryOf({ ...headset, pooledFy: 2026 })!;
    expect(entry).toMatchObject({ kind: 'low_cost', fy: 2026, amount: 80_000 });
    const rows = poolSchedule([entry], 2028);
    expect(rows.map((r) => [r.financialYear, r.decline, r.closing])).toEqual([
      [2026, 15_000, 65_000],
      [2027, 24_375, 40_625],
      [2028, 15_234, 25_391], // 15,234.375 rounds down
    ]);
    // Pooled from its first year: no schedule of its own
    expect(schedule({ ...headset, pooledFy: 2026 }, 2030)).toEqual([]);
    // Only in its first year
    expect(poolEntryFor(headset, 2027)).toEqual({
      refused: 'A low-cost asset goes into the pool in its first year',
    });
  });

  it('a low-value asset: its own schedule to the year before, then 37.5% of its taxable share', () => {
    // The worked example's laptop on diminishing value: $604.93 left after 2026–27
    const laptop: AssetTerms = {
      cost: 240_000,
      startDate: '2026-10-01',
      method: 'diminishing_value',
      effectiveLifeHundredths: 200,
      workUseBps: 8_000,
    };
    expect(poolEntryFor(laptop, 2026)).toMatchObject({
      refused: expect.stringMatching(/no adjustable value/),
    });
    // Worth $1,000 or more at the start of the year: not yet
    expect(poolEntryFor({ ...laptop, effectiveLifeHundredths: 500 }, 2027)).toMatchObject({
      refused: expect.stringMatching(/\$1,000 or more/),
    });
    const pooled = { ...laptop, pooledFy: 2027 };
    expect(schedule(pooled, 2030).map((r) => r.financialYear)).toEqual([2026]);
    const entry = poolEntryOf(pooled)!;
    expect(entry).toMatchObject({ kind: 'low_value', amount: 48_394 }); // 80% of 60,493
    expect(poolSchedule([entry], 2027)[0]).toMatchObject({ decline: 18_148, closing: 30_246 });
    // Prime cost never joins later
    expect(poolEntryFor({ ...laptop, method: 'prime_cost' }, 2027)).toMatchObject({
      refused: expect.stringMatching(/diminishing value/),
    });
  });

  it('disposal takes its taxable termination value off the balance; any excess is income', () => {
    const entry = poolEntryOf({
      ...headset,
      workUseBps: 5_000,
      pooledFy: 2026,
      disposedDate: '2027-08-01',
      terminationValue: 100_000,
    })!;
    expect(entry.disposal).toEqual({ fy: 2027, amount: 50_000 });
    // 40,000 in; 7,500 decline; 32,500 then 12,188 decline, less 50,000: 29,688 is income
    const rows = poolSchedule([entry], 2030);
    expect(rows.at(-1)).toMatchObject({
      financialYear: 2027,
      decline: 12_188,
      terminations: 50_000,
      closing: 0,
      income: 29_688,
    });
    expect(rows).toHaveLength(2);
  });

  it('several assets share one pool: each year adds to the balance', () => {
    const a = poolEntryOf({ ...headset, pooledFy: 2026 })!;
    const b = poolEntryOf({ ...headset, startDate: '2027-07-15', cost: 40_000, pooledFy: 2027 })!;
    const rows = poolSchedule([a, b], 2027);
    // 2027: 18.75% of 40,000 + 37.5% of 65,000
    expect(rows[1]).toMatchObject({
      opening: 65_000,
      lowCostAdded: 40_000,
      decline: 7_500 + 24_375,
    });
  });

  it('properties: the pool never goes below zero, and decline plus closing never exceed what went in', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kind: fc.constantFrom('low_cost' as const, 'low_value' as const),
            fy: fc.integer({ min: 2010, max: 2030 }),
            amount: fc.integer({ min: 1, max: 99_999 }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        (entries) => {
          const rows = poolSchedule(entries, 2040);
          const added = entries.reduce((s, e) => s + e.amount, 0);
          const declined = rows.reduce((s, r) => s + r.decline, 0);
          for (const r of rows) expect(r.closing).toBeGreaterThanOrEqual(0);
          expect(declined + (rows.at(-1)?.closing ?? 0)).toBe(added);
        },
      ),
    );
  });
});
