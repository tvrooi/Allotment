import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  WHOLE,
  amountsToPercents,
  leftToSplit,
  percentToInput,
  percentsToAmounts,
  readPercent,
} from './splitParts';

/** 2-6 percentages (hundredths) adding up to 100% */
const percents = fc
  .array(fc.integer({ min: 1, max: 4000 }), { minLength: 1, maxLength: 5 })
  .filter((p) => p.reduce((a, b) => a + b, 0) < WHOLE)
  .map((p) => [...p, WHOLE - p.reduce((a, b) => a + b, 0)]);
const total = fc.integer({ min: -1e9, max: 1e9 }).filter((n) => n !== 0);

describe('percentsToAmounts', () => {
  it('always adds up to the transaction exactly, each part within a cent of its share', () => {
    fc.assert(
      fc.property(total, percents, (t, p) => {
        const amounts = percentsToAmounts(t, p)!;
        expect(amounts.reduce((a, b) => a + b, 0)).toBe(t);
        amounts.forEach((a, i) => expect(Math.abs(a - (t * p[i]) / WHOLE)).toBeLessThan(1));
      }),
    );
  });

  it('splits $45.00 a third each without losing a cent', () => {
    expect(percentsToAmounts(-4500, [3333, 3333, 3334])).toEqual([-1500, -1500, -1500]);
    expect(percentsToAmounts(-1000, [3333, 3333, 3334])!.reduce((a, b) => a + b)).toBe(-1000);
  });

  it('refuses percentages that do not make 100%', () => {
    expect(percentsToAmounts(1000, [5000, 4000])).toBeNull();
  });
});

describe('amountsToPercents', () => {
  it('always makes exactly 100%', () => {
    fc.assert(
      fc.property(total, percents, (t, p) => {
        const amounts = percentsToAmounts(t, p)!;
        expect(amountsToPercents(t, amounts).reduce((a, b) => a + b, 0)).toBe(WHOLE);
      }),
    );
  });
});

describe('readPercent', () => {
  it('reads what people type and round-trips through the field', () => {
    expect(readPercent('33.33')).toBe(3333);
    expect(readPercent('12,5')).toBe(1250);
    expect(readPercent('50 %')).toBe(5000);
    expect(readPercent('0')).toBeNull();
    expect(readPercent('101')).toBeNull();
    expect(readPercent('abc')).toBeNull();
    fc.assert(
      fc.property(fc.integer({ min: 1, max: WHOLE }), (h) => {
        expect(readPercent(percentToInput(h))).toBe(h);
      }),
    );
  });
});

describe('leftToSplit', () => {
  it('is what the last part would need', () => {
    expect(leftToSplit(-4500, [-1500, -1500])).toBe(-1500);
  });
});
