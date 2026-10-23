import { describe, expect, it } from 'vitest';
import { positionValue, priceOn, valueHolding } from './investmentMath.js';

// P3 investments: valuing a manual position. Mock numbers only.

const units = (n: number) => Math.round(n * 1_000_000);

describe('positionValue', () => {
  it('multiplies millionths of a unit by a price in minor units, rounding half away from zero', () => {
    expect(positionValue(units(1), 50000)).toBe(50000);
    expect(positionValue(units(2.5), 10001)).toBe(25003); // 25002.5
    expect(positionValue(units(0.000001), 50000)).toBe(0); // 0.05 of a cent
    expect(positionValue(units(0.00001), 50000)).toBe(1); // 0.5 of a cent
  });

  it('stays exact beyond floating point precision', () => {
    expect(positionValue(units(123_456_789.123456), 98765)).toBe(12193209777778);
  });
});

describe('priceOn', () => {
  const prices = [
    { date: '2026-03-01', price: 100 },
    { date: '2026-01-01', price: 90 },
    { date: '2026-02-01', price: 95 },
  ];
  it('uses the latest price on or before the day, never a later one', () => {
    expect(priceOn(prices, '2026-02-15')).toEqual({ date: '2026-02-01', price: 95 });
    expect(priceOn(prices, '2026-03-01')).toEqual({ date: '2026-03-01', price: 100 });
    expect(priceOn(prices, '2025-12-31')).toBeNull();
  });
});

describe('valueHolding', () => {
  const prices = [{ date: '2026-10-22', price: 71072 }];

  it('matches the inspected sample: one unit bought for 500.00, worth 710.72', () => {
    const v = valueHolding(
      units(1),
      [{ quantity: units(1), costBasis: 50000 }],
      prices,
      '2026-10-22',
    );
    expect(v).toMatchObject({
      value: 71072,
      basisStatus: 'complete',
      costBasis: 50000,
      unrealizedGain: 21072,
      gainPercent: 42.14,
      priceStale: false,
    });
  });

  it('gives no value without a price, rather than zero', () => {
    const v = valueHolding(units(3), [], [], '2026-10-22');
    expect(v.value).toBeNull();
    expect(v.priceDate).toBeNull();
    expect(v.unrealizedGain).toBeNull();
  });

  it('treats a holding without lots as missing basis, not a zero gain', () => {
    const v = valueHolding(units(1), [], prices, '2026-10-22');
    expect(v).toMatchObject({ value: 71072, basisStatus: 'missing', costBasis: null });
    expect(v.unrealizedGain).toBeNull();
  });

  it('only gives a gain when every unit has a known cost', () => {
    const lots = [
      { quantity: units(1), costBasis: 50000 },
      { quantity: units(1), costBasis: null },
    ];
    const v = valueHolding(units(2), lots, prices, '2026-10-22');
    expect(v).toMatchObject({
      basisStatus: 'partial',
      knownBasisQuantity: units(1),
      knownBasis: 50000,
      costBasis: null,
      unrealizedGain: null,
    });
  });

  it('flags lots that add up to a different quantity than the holding', () => {
    const v = valueHolding(
      units(3),
      [{ quantity: units(2), costBasis: 100 }],
      prices,
      '2026-10-22',
    );
    expect(v.basisStatus).toBe('mismatch');
    expect(v.unrealizedGain).toBeNull();
  });

  it('counts a zero cost as known, with a gain but no percentage', () => {
    const v = valueHolding(units(1), [{ quantity: units(1), costBasis: 0 }], prices, '2026-10-22');
    expect(v).toMatchObject({ costBasis: 0, unrealizedGain: 71072, gainPercent: null });
  });

  it('marks a price more than a week old as stale but still uses it', () => {
    const v = valueHolding(units(1), [], prices, '2026-10-30');
    expect(v).toMatchObject({ value: 71072, priceDate: '2026-10-22', priceStale: true });
    expect(valueHolding(units(1), [], prices, '2026-10-29').priceStale).toBe(false);
  });
});
