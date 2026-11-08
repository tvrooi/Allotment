import { describe, expect, it } from 'vitest';
import { dueLabel } from './dueLabel';
import { daysBetweenIso } from '../../utils/calendarDay';

describe('dueLabel', () => {
  it('says how soon a bill is due, counted from the given day', () => {
    expect(dueLabel('2026-11-08', '2026-11-08')).toEqual({ text: 'Due today', tone: 'soon' });
    expect(dueLabel('2026-11-09', '2026-11-08')).toEqual({ text: 'Due tomorrow', tone: 'soon' });
    expect(dueLabel('2026-11-11', '2026-11-08')).toEqual({ text: 'Due in 3 days', tone: 'soon' });
    expect(dueLabel('2026-11-28', '2026-11-08')?.tone).toBe('later');
    expect(dueLabel('2026-11-01', '2026-11-08')?.text).toMatch(/^Overdue since /);
    expect(dueLabel(null, '2026-11-08')).toBeNull();
  });

  it('counts whole days across months, years and daylight saving', () => {
    expect(daysBetweenIso('2026-12-30', '2027-01-02')).toBe(3);
    expect(daysBetweenIso('2026-10-03', '2026-10-05')).toBe(2);
    expect(daysBetweenIso('2026-11-08', '2026-11-01')).toBe(-7);
  });
});
