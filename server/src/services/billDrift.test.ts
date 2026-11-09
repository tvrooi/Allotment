import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { billDrift } from './billDrift.js';

const paid = (...amounts: number[]) =>
  amounts.map((amount, i) => ({ date: `2026-1${1 - Math.min(i, 1)}-0${9 - i}`, amount }));

describe('billDrift', () => {
  it('prompts when the newest payment is outside the tolerance, with the last 3 averaged', () => {
    // Power: expected A$120, paid A$86.50 then A$80 twice
    expect(billDrift(12000, 'variable', paid(8650, 8000, 8000, 8000))).toEqual({
      lastPaid: 8650,
      lastDate: '2026-11-09',
      average: 8217,
      averageOf: 3,
    });
  });

  it('stays quiet within the tolerance Recurring matching uses', () => {
    // Internet: A$99 expected, A$98 paid: within 10% (approximate) and 25% (variable)
    expect(billDrift(9900, 'approximate', paid(9800))).toBeNull();
    expect(billDrift(9900, 'variable', paid(9800))).toBeNull();
    // An exact bill prompts on any change
    expect(billDrift(9900, 'exact', paid(9800))).toMatchObject({ lastPaid: 9800 });
    expect(billDrift(9900, 'exact', paid(9900))).toBeNull();
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
