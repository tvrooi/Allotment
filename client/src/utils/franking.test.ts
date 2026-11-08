import { describe, expect, it } from 'vitest';
import { frankingCredit } from './franking';

describe('franking credit prefill', () => {
  it('is the company tax on the franked amount at 30% or 25%', () => {
    expect(frankingCredit(7_000, 3_000)).toBe(3_000);
    expect(frankingCredit(7_500, 2_500)).toBe(2_500);
    // $100 franked at 30%: $42.857… rounds to $42.86
    expect(frankingCredit(10_000, 3_000)).toBe(4_286);
    expect(frankingCredit(0, 3_000)).toBe(0);
    // Exact well past what a float multiplies safely
    expect(frankingCredit(7_000_000_000_000_000, 3_000)).toBe(3_000_000_000_000_000);
  });
});
