import { describe, expect, it } from 'vitest';
import { monthStartBefore, recentEntries } from './recentEntries';

const entry = (id: string, date: string) => ({ id, date });

describe('monthStartBefore', () => {
  it('counts back whole months, across a year boundary', () => {
    expect(monthStartBefore('2026-11-08', 0)).toBe('2026-11-01');
    expect(monthStartBefore('2026-11-08', 1)).toBe('2026-10-01');
    expect(monthStartBefore('2026-01-31', 1)).toBe('2025-12-01');
    expect(monthStartBefore('2026-03-15', 14)).toBe('2025-01-01');
  });
});

describe('recentEntries', () => {
  const entries = [
    entry('a', '2026-05-04'),
    entry('b', '2026-09-28'),
    entry('c', '2026-10-08'),
    entry('d', '2026-11-06'),
    entry('e', '2026-11-06'),
  ];

  it('shows the newest entry first, from the start of the month before it', () => {
    const { shown, older } = recentEntries(entries, 2);
    expect(shown.map((e) => e.id)).toEqual(['e', 'd', 'c']);
    expect(older).toBe(2);
  });

  it('Show older always reaches the next hidden entry, then a few months more', () => {
    // September is 2 months before November: show 2 + 3 months
    expect(recentEntries(entries, 2).more).toBe(5);
    // May is 6 months back, past a 3-month step from 5
    expect(recentEntries(entries, 5).more).toBe(9);
    expect(recentEntries(entries, 9).more).toBe(9);
  });

  it('shows older entries a month at a time, and all of them with Infinity', () => {
    expect(recentEntries(entries, 3).shown.map((e) => e.id)).toEqual(['e', 'd', 'c', 'b']);
    expect(recentEntries(entries, Infinity)).toEqual({
      shown: ['e', 'd', 'c', 'b', 'a'].map((id) => entries.find((e) => e.id === id)),
      older: 0,
      more: Infinity,
    });
  });

  it('counts from the newest entry, so a quiet household still shows its last activity', () => {
    const { shown } = recentEntries([entry('x', '2025-02-10'), entry('y', '2025-01-03')], 2);
    expect(shown.map((e) => e.id)).toEqual(['x', 'y']);
  });

  it('leaves the input untouched and handles an empty list', () => {
    const copy = [...entries];
    recentEntries(entries, 1);
    expect(entries).toEqual(copy);
    expect(recentEntries([], 2)).toEqual({ shown: [], older: 0, more: 2 });
  });
});
