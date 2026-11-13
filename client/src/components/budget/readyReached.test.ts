import { describe, expect, it } from 'vitest';
import { reachedZeroNow } from './readyReached';

describe('reachedZeroNow (#241)', () => {
  it('is true when this month goes from money to assign to fully budgeted', () => {
    expect(reachedZeroNow({ month: '2026-11', full: false }, '2026-11', true)).toBe(true);
  });

  it('is false on arrival, on another month, or when nothing changed', () => {
    expect(reachedZeroNow(null, '2026-11', true)).toBe(false);
    expect(reachedZeroNow({ month: '2026-10', full: false }, '2026-11', true)).toBe(false);
    expect(reachedZeroNow({ month: '2026-11', full: true }, '2026-11', true)).toBe(false);
    expect(reachedZeroNow({ month: '2026-11', full: false }, '2026-11', false)).toBe(false);
  });
});
