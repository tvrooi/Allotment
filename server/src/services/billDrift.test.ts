import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { billDrift } from './billDrift.js';

const paid = (...amounts: number[]) =>
  amounts.map((amount, i) => ({ date: `2026-1${1 - Math.min(i, 1)}-0${9 - i}`, amount }));

describe('billDrift', () => {
  it('prompts when the newest payment is outside the tolerance, with the last 3 averaged', () => {
    // OVO: expected A$150, paid A$107 then A$100 twice
    expect(billDrift(15000, 'variable', paid(10700, 10000, 10000, 10000))).toEqual({
      lastPaid: 10700,
      lastDate: '2026-11-09',
      average: 10233,
      averageOf: 3,
    });
  });

  it('stays quiet within the tolerance Recurring matching uses', () => {
    // Superloop: A$115 expected, A$114 paid: within 10% (approximate) and 25% (variable)
    expect(billDrift(11500, 'approximate', paid(11400))).toBeNull();
    expect(billDrift(11500, 'variable', paid(11400))).toBeNull();
    // An exact bill prompts on any change
    expect(billDrift(11500, 'exact', paid(11400))).toMatchObject({ lastPaid: 11400 });
    expect(billDrift(11500, 'exact', paid(11500))).toBeNull();
  });

  it('needs a payment, and averages however many there are', () => {
    expect(billDrift(15000, 'exact', [])).toBeNull();
    expect(billDrift(15000, 'exact', paid(10000, 10001))).toMatchObject({
      average: 10001,
      averageOf: 2,
    });
  });

  it('always gives whole cents between the smallest and largest of the payments averaged', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1e8 }), { minLength: 1, maxLength: 6 }),
        (xs) => {
          const drift = billDrift(0, 'exact', paid(...xs));
          expect(drift).not.toBeNull();
          const used = xs.slice(0, 3);
          expect(Number.isInteger(drift!.average)).toBe(true);
          expect(drift!.average).toBeGreaterThanOrEqual(Math.min(...used));
          expect(drift!.average).toBeLessThanOrEqual(Math.max(...used));
        },
      ),
    );
  });
});
