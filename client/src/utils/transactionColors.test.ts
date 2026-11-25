import { describe, expect, it } from 'vitest';
import { PAYEE_COLORS, payeeColor } from './transactionColors';

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('payee colours', () => {
  it('keep a white initial readable (WCAG AA, 4.5:1)', () => {
    for (const color of PAYEE_COLORS) {
      expect(1.05 / (luminance(color) + 0.05), color).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('give the same colour for the same name', () => {
    expect(payeeColor('Rent')).toBe(payeeColor('Rent'));
    expect(PAYEE_COLORS).toContain(payeeColor('Rent'));
  });
});
