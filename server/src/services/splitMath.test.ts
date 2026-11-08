import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { lotUnitsOn, scaleUnits, unitsBetween, validRatio, type Split } from './splitMath.js';

const U = 1_000_000;
const RUNS = Number(process.env.PROPERTY_RUNS ?? 100);
const twoForOne: Split = { effectiveOn: '2025-03-01', toUnits: 2, fromUnits: 1 };
const oneForThree: Split = { effectiveOn: '2025-09-01', toUnits: 1, fromUnits: 3 };

describe('validRatio', () => {
  it('takes two different whole numbers within the cap', () => {
    expect(validRatio(2, 1)).toBe(true);
    expect(validRatio(1, 3)).toBe(true);
    expect(validRatio(1, 1)).toBe(false);
    expect(validRatio(0, 1)).toBe(false);
    expect(validRatio(1.5, 1)).toBe(false);
    expect(validRatio(100_001, 1)).toBe(false);
  });
});

describe('unitsBetween', () => {
  it('scales units by the splits after a day and on or before the other', () => {
    expect(unitsBetween(100 * U, '2025-01-01', '2025-03-01', [twoForOne])).toEqual({
      units: 200 * U,
      exact: true,
    });
    // Units on the effective date are already the new units
    expect(unitsBetween(100 * U, '2025-03-01', '2025-06-01', [twoForOne]).units).toBe(100 * U);
    expect(unitsBetween(100 * U, '2025-01-01', '2025-02-28', [twoForOne]).units).toBe(100 * U);
  });

  it('applies several splits in order', () => {
    expect(unitsBetween(90 * U, '2025-01-01', '2026-01-01', [twoForOne, oneForThree])).toEqual({
      units: 60 * U,
      exact: true,
    });
  });

  it('goes back through splits, undoing the latest first', () => {
    expect(unitsBetween(60 * U, '2026-01-01', '2025-01-01', [twoForOne, oneForThree]).units).toBe(
      90 * U,
    );
    expect(unitsBetween(120 * U, '2025-06-01', '2025-01-01', [twoForOne]).units).toBe(60 * U);
  });

  it('rounds a consolidation down and says so, and going back rounds up', () => {
    // 10 units in threes: 3.333333, with a third of a millionth dropped
    expect(unitsBetween(10 * U, '2025-01-01', '2026-01-01', [oneForThree])).toEqual({
      units: 3_333_333,
      exact: false,
    });
    expect(unitsBetween(3_333_333, '2026-01-01', '2025-01-01', [oneForThree])).toEqual({
      units: 9_999_999,
      exact: true,
    });
    expect(unitsBetween(1, '2026-01-01', '2025-01-01', [oneForThree]).units).toBe(3);
  });

  it('leaves units alone with no splits between the days', () => {
    expect(unitsBetween(5 * U, '2025-01-01', '2025-01-01', [twoForOne])).toEqual({
      units: 5 * U,
      exact: true,
    });
    expect(unitsBetween(5 * U, '2025-01-01', '2025-02-01', [])).toEqual({
      units: 5 * U,
      exact: true,
    });
  });

  it('forward then back restores a split’s units and never exceeds a consolidation’s', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1e12 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 20 }),
        (quantity, toUnits, fromUnits) => {
          fc.pre(toUnits !== fromUnits);
          const split = { effectiveOn: '2025-06-01', toUnits, fromUnits };
          const forward = unitsBetween(quantity, '2025-01-01', '2026-01-01', [split]).units;
          const back = unitsBetween(forward, '2026-01-01', '2025-01-01', [split]).units;
          if (toUnits > fromUnits) expect(back).toBe(quantity);
          else expect(back).toBeLessThanOrEqual(quantity);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('never turns a split into more units than the exact ratio gives', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1e12 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (quantity, toUnits, fromUnits) => {
          const { units } = scaleUnits(quantity, { toUnits, fromUnits });
          expect(units * fromUnits).toBeLessThanOrEqual(quantity * toUnits);
          expect((units + 1) * fromUnits).toBeGreaterThan(quantity * toUnits);
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('lotUnitsOn', () => {
  const lot = { acquiredOn: '2025-01-01', quantity: 100 * U };

  it('scales only by the splits after the lot was bought', () => {
    expect(lotUnitsOn(lot, [twoForOne], '2026-01-01').units).toBe(200 * U);
    expect(lotUnitsOn({ ...lot, acquiredOn: '2025-03-01' }, [twoForOne], '2026-01-01').units).toBe(
      100 * U,
    );
    expect(lotUnitsOn({ ...lot, acquiredOn: '2025-04-01' }, [twoForOne], '2026-01-01').units).toBe(
      100 * U,
    );
  });

  it('has its recorded units on a day before it was bought', () => {
    expect(lotUnitsOn({ ...lot, acquiredOn: '2025-06-01' }, [twoForOne], '2025-02-01').units).toBe(
      100 * U,
    );
  });

  it('keeps a partly sold lot at the earlier sale’s cost (the 100 unit example)', () => {
    // 100 units costing $100; 40 sold before a 2-for-1 split cost $40 of it
    const soldUnitsToday = unitsBetween(40 * U, '2025-02-01', '2026-01-01', [twoForOne]).units;
    const remaining = lotUnitsOn(lot, [twoForOne], '2026-01-01').units - soldUnitsToday;
    expect(remaining).toBe(120 * U);
  });
});
