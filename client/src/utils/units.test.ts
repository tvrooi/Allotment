import { describe, expect, it } from 'vitest';
import { formatUnits, parseUnits, unitsToInput } from './units';

describe('parseUnits', () => {
  it('reads whole and fractional quantities exactly', () => {
    expect(parseUnits('12')).toBe(12_000_000);
    expect(parseUnits(' 0.5 ')).toBe(500_000);
    expect(parseUnits('0.000001')).toBe(1);
    expect(parseUnits('1,25')).toBe(1_250_000);
    expect(parseUnits('1,000')).toBe(1_000_000_000);
    expect(parseUnits('1,234.5')).toBe(1_234_500_000);
    expect(parseUnits('1 000.5')).toBe(1_000_500_000);
  });

  it('refuses what is not a quantity', () => {
    expect(parseUnits('')).toBeNull();
    expect(parseUnits('-1')).toBeNull();
    expect(parseUnits('1.0000001')).toBeNull();
    expect(parseUnits('abc')).toBeNull();
    expect(parseUnits('99999999999999')).toBeNull();
  });
});

describe('formatUnits', () => {
  it('shows only the decimals there are', () => {
    expect(formatUnits(12_000_000)).toBe('12');
    expect(formatUnits(500_000)).toBe('0.5');
    expect(formatUnits(1_234_000_001)).toBe('1,234.000001');
    expect(unitsToInput(1_234_500_000)).toBe('1234.5');
    expect(parseUnits(unitsToInput(1_234_000_001))).toBe(1_234_000_001);
  });
});
