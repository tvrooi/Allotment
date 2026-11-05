import { describe, it, expect } from 'vitest';
import { addDaysIso, isIsoDay, localDayIso } from './calendarDay';

describe('calendar days', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDaysIso('2026-11-03', 14)).toBe('2026-11-17');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('knows which days exist', () => {
    expect(isIsoDay('2028-02-29')).toBe(true);
    expect(isIsoDay('2027-02-29')).toBe(false);
    expect(isIsoDay('2026-1-1')).toBe(false);
    expect(isIsoDay(null)).toBe(false);
  });

  it('reads the wall-clock day of a local date', () => {
    expect(localDayIso(new Date(2026, 10, 3, 0, 5))).toBe('2026-11-03');
    expect(localDayIso(new Date(2026, 10, 3, 23, 55))).toBe('2026-11-03');
  });
});
