import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { readDecimal, readWholeNumber } from './numberText';

describe('readWholeNumber', () => {
  it('accepts whole numbers inside its inclusive bounds and trims surrounding spaces', () => {
    expect(readWholeNumber('12', 1, 60)).toBe(12);
    expect(readWholeNumber('1', 1, 60)).toBe(1);
    expect(readWholeNumber('60', 1, 60)).toBe(60);
    expect(readWholeNumber('  7 ', 1, 60)).toBe(7);
  });

  it('refuses values outside bounds, fractions, blanks and non-plain numeric shapes', () => {
    for (const text of ['0', '61', '1.5', '', '  ', 'abc', '1e2', '+5', '0x10', '1,5', '-', '.']) {
      expect(readWholeNumber(text, 1, 60), text).toBeNull();
    }
  });

  it('handles negative bounds and normalises -0 to 0 when 0 is in bounds', () => {
    expect(readWholeNumber('-1', -5, 5)).toBe(-1);
    expect(readWholeNumber('-5', -5, 5)).toBe(-5);
    expect(readWholeNumber('-6', -5, 5)).toBeNull();
    expect(readWholeNumber('-1', 0, 14)).toBeNull();
    expect(Object.is(readWholeNumber('-0', 0, 14), 0)).toBe(true);
    expect(readWholeNumber('-0', 1, 14)).toBeNull();
  });

  it('refuses unsafe integers even when max is Infinity', () => {
    expect(readWholeNumber('99999999999999999999999', 1, Infinity)).toBeNull();
    expect(readWholeNumber('1', 1, Infinity)).toBe(1);
  });

  it('matches bounds for every integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000, max: 10_000 }),
        fc.integer({ min: -10_000, max: 10_000 }),
        fc.integer({ min: -10_000, max: 10_000 }),
        (a, b, n) => {
          const min = Math.min(a, b);
          const max = Math.max(a, b);
          const expected = n >= min && n <= max ? n : null;
          expect(readWholeNumber(String(n), min, max)).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('readDecimal', () => {
  it('accepts decimals and whole numbers inside its inclusive bounds', () => {
    expect(readDecimal('0', 0, 100)).toBe(0);
    expect(readDecimal('33.33', 0, 100)).toBe(33.33);
    expect(readDecimal('100', 0, 100)).toBe(100);
    expect(readDecimal(' .5 ', 0, 100)).toBe(0.5);
    expect(readDecimal('5.', 0, 100)).toBe(5);
    expect(Object.is(readDecimal('-0.0', 0, 100), 0)).toBe(true);
  });

  it('refuses values outside bounds, bare punctuation, comma decimals and non-plain shapes', () => {
    for (const text of [
      '100.01',
      '-1',
      '.',
      '-',
      '-.',
      '1,5',
      '',
      '  ',
      '1e2',
      '+5',
      '0x10',
      '1.2.3',
    ]) {
      expect(readDecimal(text, 0, 100), text).toBeNull();
    }
  });

  it('accepts negative decimals within negative bounds and refuses values outside them', () => {
    expect(readDecimal('-100', -100, 50)).toBe(-100);
    expect(readDecimal('-12.5', -100, 50)).toBe(-12.5);
    expect(readDecimal('50', -100, 50)).toBe(50);
    expect(readDecimal('-101', -100, 50)).toBeNull();
    expect(readDecimal('-100.01', -100, 50)).toBeNull();
    expect(readDecimal('51', -100, 50)).toBeNull();
  });

  it('refuses decimals that exceed bounds only beyond float precision (CR-05)', () => {
    expect(readDecimal('100.000000000000001', 0, 100)).toBeNull();
    expect(readDecimal('-100.000000000000001', -100, 50)).toBeNull();
    expect(readDecimal('50.000000000000001', -100, 50)).toBeNull();
    expect(readDecimal('-0.00000000000000000001', 0, 100)).toBeNull();
    // Trailing zeros equal to the bound itself stay valid
    expect(readDecimal('100.000000000000000', 0, 100)).toBe(100);
    expect(readDecimal('-100.000000000000000', -100, 50)).toBe(-100);
  });
});
