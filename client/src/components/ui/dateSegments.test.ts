import { parseDate, type CalendarDate } from '@internationalized/date';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker,
  DateSegment,
  type DateSegmentProps,
  Heading,
  I18nProvider,
} from 'react-aria-components';
import { describe, expect, it } from 'vitest';
import type { DateFormatOption } from '../../store/preferencesStore';
import { dateExample, segmentLocale } from './dateSegments';

// Every Date format preference, its segment locale and the example date in that order
const CASES: [DateFormatOption, string, string][] = [
  ['d MMM yyyy', 'en-AU', '16/11/2026'],
  ['dd/MM/yyyy', 'en-AU', '16/11/2026'],
  ['dd.MM.yyyy', 'en-CH', '16.11.2026'],
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

// The DatePicker wraps its segments, calendar and popover in I18nProvider with this locale, so
// React Aria's own words come from it as well as the segment order (02-REVIEW WR-01)
describe('the segment locale keeps the picker in English', () => {
  const calendar = (locale: string) =>
    renderToStaticMarkup(
      h(I18nProvider, {
        locale,
        children: h(Calendar, {
          'aria-label': 'Paid on',
          defaultValue: parseDate('2026-03-16'),
          children: [
            h(Heading, { key: 'heading' }),
            h(CalendarGrid, {
              key: 'grid',
              children: [
                h(CalendarGridHeader, {
                  key: 'head',
                  children: (day: string) => h(CalendarHeaderCell, { children: day }),
                }),
                h(CalendarGridBody, {
                  key: 'body',
                  children: (date: CalendarDate) => h(CalendarCell, { date }),
                }),
              ],
            }),
          ],
        }),
      }),
    );
  const segmentNames = (locale: string) =>
    [
      ...renderToStaticMarkup(
        h(I18nProvider, {
          locale,
          children: h(DatePicker, {
            'aria-label': 'Paid on',
            defaultValue: parseDate('2026-03-16'),
            children: h(DateInput, {
              children: (segment: DateSegmentProps['segment']) => h(DateSegment, { segment }),
            }),
          }),
        }),
      ).matchAll(
        /role="spinbutton"[^>]*aria-label="([^"]*)"|aria-label="([^"]*)"[^>]*role="spinbutton"/g,
      ),
    ].map((m) => m[1] ?? m[2]);

  it.each(CASES)('%s: the calendar heading, weekdays and days are English', (format) => {
    const html = calendar(segmentLocale(format));
    expect(html).toMatch(/<h2[^>]*>March 2026<\/h2>/);
    // Each locale punctuates a day its own way ("Monday 16 March", "Monday, March 16")
    expect(html).toMatch(/aria-label="Monday,? (16 March|March 16),? 2026/);
    expect(html).not.toMatch(/März|Montag|Dienstag/);
  });

  it.each(CASES)('%s: the segments are announced as day, month and year', (format) => {
    const names = segmentNames(segmentLocale(format)).map((name) => name.split(',')[0]);
    expect([...names].sort()).toEqual(['day', 'month', 'year']);
  });
});

describe('dateExample', () => {
  it.each(CASES)('%s (%s) gives %s', (format, _locale, example) => {
    expect(dateExample(format)).toBe(example);
  });
});
