import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { format, parse } from 'date-fns';
import {
  formatOrdinalDay,
  formatAsOfDay,
  formatDay,
  formatDayTime,
  formatShortDay,
  formatWeekday,
  shortDayPattern,
} from './dates';
import type { DateFormatOption } from '../store/preferencesStore';

const PATTERNS: DateFormatOption[] = [
  'd MMM yyyy',
  'MM/dd/yyyy',
  'dd/MM/yyyy',
  'dd.MM.yyyy',
  'yyyy-MM-dd',
];

// Any day from 1990 to 2100, as stored: yyyy-MM-dd
const day = fc
  .date({ min: new Date(1990, 0, 1), max: new Date(2100, 11, 31), noInvalidDate: true })
  .map((d) => format(d, 'yyyy-MM-dd'));

describe('dates shown in the Date Format preference (property-based)', () => {
  it('formatDay writes the chosen pattern, and reads back as the same day', () => {
    fc.assert(
      fc.property(day, fc.constantFrom(...PATTERNS), (iso, pattern) => {
        const shown = formatDay(iso, pattern);
        expect(format(parse(shown, pattern, new Date()), 'yyyy-MM-dd')).toBe(iso);
      }),
    );
    expect(formatDay('2026-01-05', 'dd.MM.yyyy')).toBe('05.01.2026');
    expect(formatDay('2026-01-05', 'd MMM yyyy')).toBe('5 Jan 2026');
  });

  it('puts the weekday first', () => {
    expect(formatWeekday('2026-01-05', {}, 'dd.MM.yyyy')).toBe('Mon, 05.01.2026');
    expect(formatWeekday('2026-01-05', { long: true }, 'd MMM yyyy')).toBe(
      'Monday, 5 January 2026',
    );
  });

  it('writes short days in the order of the preference', () => {
    expect(formatShortDay('2026-01-05', {}, 'd MMM yyyy')).toBe('5 Jan');
    expect(formatShortDay('2026-01-05', {}, 'MM/dd/yyyy')).toBe('Jan 5');
    expect(formatShortDay('2026-01-05', {}, 'yyyy-MM-dd')).toBe('Jan 5');
    expect(formatShortDay('2026-01-05', {}, 'dd/MM/yyyy')).toBe('5 Jan');
    expect(formatShortDay('2026-01-05', { long: true }, 'dd.MM.yyyy')).toBe('5. January');
    expect(format(new Date(2026, 0, 5), shortDayPattern({ year: true }, 'dd.MM.yyyy'))).toBe(
      "5. Jan '26",
    );
  });
});

describe('formatAsOfDay', () => {
  it("shows a month view's 31st as that month's last day", () => {
    expect(formatAsOfDay('2026-09-31', 'yyyy-MM-dd')).toBe('2026-09-30');
    expect(formatAsOfDay('2026-02-31', 'yyyy-MM-dd')).toBe('2026-02-28');
    expect(formatAsOfDay('2026-10-21', 'yyyy-MM-dd')).toBe('2026-10-21');
  });
});

describe('dates that do not parse (audit F-20)', () => {
  it('are shown as they came instead of throwing while the page draws', () => {
    expect(formatDay('not a date', 'dd/MM/yyyy')).toBe('not a date');
    expect(formatDay('', 'dd/MM/yyyy')).toBe('');
    expect(formatDayTime('soon', 'dd/MM/yyyy')).toBe('soon');
  });

  it('formatDayTime is the day in the preference, then the time', () => {
    expect(formatDayTime(new Date(2026, 0, 5, 14, 30), 'dd/MM/yyyy')).toBe('05/01/2026, 2:30 pm');
    expect(formatDayTime(new Date(2026, 0, 5, 0, 5), 'd MMM yyyy')).toBe('5 Jan 2026, 12:05 am');
  });
});

it('formats funding deadline days with their ordinal suffix', () => {
  for (const [day, label] of [
    ['01', '1st'],
    ['02', '2nd'],
    ['03', '3rd'],
    ['11', '11th'],
    ['12', '12th'],
    ['13', '13th'],
    ['21', '21st'],
    ['31', '31st'],
  ])
    expect(formatOrdinalDay(`2026-01-${day}`)).toBe(label);
});
