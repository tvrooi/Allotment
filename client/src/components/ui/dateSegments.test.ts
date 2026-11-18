import { describe, expect, it } from 'vitest';
import type { DateFormatOption } from '../../store/preferencesStore';
import { dateExample, segmentLocale } from './dateSegments';

// Every Date format preference, its segment locale and the example date in that order
const CASES: [DateFormatOption, string, string][] = [
  ['d MMM yyyy', 'en-AU', '16/11/2026'],
  ['dd/MM/yyyy', 'en-AU', '16/11/2026'],
  ['dd.MM.yyyy', 'de-DE', '16.11.2026'],
  ['MM/dd/yyyy', 'en-US', '11/16/2026'],
  ['yyyy-MM-dd', 'en-CA', '2026-11-16'],
];

describe('segmentLocale', () => {
  it.each(CASES)('%s types in %s order', (format, locale) => {
    expect(segmentLocale(format)).toBe(locale);
  });

  it('the default preference is day first, not month first', () => {
    expect(segmentLocale('d MMM yyyy')).not.toBe('en-US');
  });

  it.each(CASES)("each locale's own numeric date has the same order as %s", (format, locale) => {
    const parts = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(new Date(Date.UTC(2026, 10, 16)));
    const order = parts.filter((p) => p.type !== 'literal').map((p) => p.type);
    const expected = format.startsWith('y')
      ? ['year', 'month', 'day']
      : format.startsWith('M')
        ? ['month', 'day', 'year']
        : ['day', 'month', 'year'];
    expect(order).toEqual(expected);
  });
});

describe('dateExample', () => {
  it.each(CASES)('%s (%s) gives %s', (format, _locale, example) => {
    expect(dateExample(format)).toBe(example);
  });
});
