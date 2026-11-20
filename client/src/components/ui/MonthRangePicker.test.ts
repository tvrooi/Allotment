import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatMonthRange } from '../../utils/dateRange';
import { MonthRangePicker } from './MonthRangePicker';

// useIsPhone reads matchMedia, which server rendering has not got: it reports desktop unless a
// test says it is a phone
const screen = vi.hoisted(() => ({ phone: false, nativeMonth: true }));
vi.mock('../../hooks/useIsPhone', () => ({ useIsPhone: () => screen.phone }));
// Whether the browser has a native month input; Firefox has not (02-REVIEW WR-02)
vi.mock('./nativeInput', () => ({ supportsMonthInput: () => screen.nativeMonth }));
afterEach(() => {
  screen.phone = false;
  screen.nativeMonth = true;
});

type Props = Parameters<typeof MonthRangePicker>[0];
const noop = () => {};
const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(MonthRangePicker, {
      from: '2026-06',
      to: '2026-11',
      max: '2026-12',
      onChange: noop,
      ...props,
    }),
  );
const group = (html: string) => html.match(/<div([^>]*role="group"[^>]*)>/)?.[1] ?? '';

const FULL_MONTHS =
  /\b(January|February|March|April|June|July|August|September|October|November|December)\b/;

const SHORT_BY_MONTH = [
  ['2026-01', 'Jan 2026'],
  ['2026-02', 'Feb 2026'],
  ['2026-03', 'Mar 2026'],
  ['2026-04', 'Apr 2026'],
  ['2026-05', 'May 2026'],
  ['2026-06', 'Jun 2026'],
  ['2026-07', 'Jul 2026'],
  ['2026-08', 'Aug 2026'],
  ['2026-09', 'Sep 2026'],
  ['2026-10', 'Oct 2026'],
  ['2026-11', 'Nov 2026'],
  ['2026-12', 'Dec 2026'],
] as const;

describe('MonthRangePicker on desktop', () => {
  it('is a dialog trigger showing the range, with no native month input', () => {
    const html = render();
    const trigger = html.match(/<button([^>]*)>/)?.[1] ?? '';
    expect(trigger).toMatch(/ aria-haspopup="dialog"/);
    expect(trigger).toMatch(/ aria-expanded="false"/);
    expect(html).toContain(`>${formatMonthRange('2026-06', '2026-11')}<`);
    expect(html).toContain('Nov 2026');
    expect(html).not.toMatch(FULL_MONTHS);
    expect(html).not.toContain('<input');
  });

  it('formats every month as a short month name and year with no full month name', () => {
    for (const [iso, short] of SHORT_BY_MONTH) {
      const html = render({ from: iso, to: iso, max: '2026-12' });
      expect(html).toContain(`>${short}<`);
      expect(html).not.toMatch(FULL_MONTHS);
    }
  });

  it('without a label the range text alone names the trigger', () => {
    const trigger = render().match(/<button([^>]*)>/)?.[1] ?? '';
    expect(trigger).not.toMatch(/aria-label/);
  });

  it('with a label the trigger is labelled by the label, then the range', () => {
    const html = render({ label: 'Report months' });
    const trigger = html.match(/<button([^>]*)>/)?.[1] ?? '';
    const [labelId, valueId] = trigger.match(/ aria-labelledby="([^"]*)"/)![1].split(' ');
    expect(html).toMatch(new RegExp(`<span[^>]*id="${labelId}"[^>]*>Report months`));
    expect(html).toMatch(new RegExp(`<span[^>]*id="${valueId}"[^>]*>Jun 2026 – Nov 2026`));
    expect(html).not.toContain('<label');
  });

  it('disabled, invalid and read-only reach the trigger group', () => {
    expect(group(render({ isDisabled: true }))).toMatch(/ data-disabled="true"/);
    expect(group(render({ isInvalid: true }))).toMatch(/ data-invalid="true"/);
    expect(group(render({ isReadOnly: true }))).toMatch(/ data-readonly="true"/);
    expect(render({ isDisabled: true })).toMatch(/<button[^>]* disabled=""/);
  });

  it('shows its help line, and its error line only while invalid', () => {
    const help = render({ description: 'Months the report covers' });
    expect(help).toContain('Months the report covers');
    expect(render({ errorMessage: 'Choose a full year' })).not.toContain('Choose a full year');
    expect(render({ isInvalid: true, errorMessage: 'Choose a full year' })).toContain(
      'Choose a full year',
    );
  });
});

describe('MonthRangePicker on phones', () => {
  afterEach(() => vi.useRealTimers());

  it("without a max, the latest month is this month on the device's today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2031, 2, 10, 12));
    screen.phone = true;
    const html = renderToStaticMarkup(
      createElement(MonthRangePicker, { from: '2031-01', to: '2031-02', onChange: noop }),
    );
    for (const [, tag] of html.matchAll(/<input([^>]*)>/g)) expect(tag).toMatch(/ max="2031-03"/);
  });

  const phone = (props: Partial<Props> = {}) => {
    screen.phone = true;
    return render(props);
  };
  const inputs = (html: string) => [...html.matchAll(/<input([^>]*)>/g)].map((m) => m[1]);

  it('is a group of two native month inputs with short month text (MonthRangePicker phone: short)', () => {
    const html = phone();
    expect(group(html)).toMatch(/ aria-label="Months"/);
    const fromId = html.match(/<label[^>]*for="([^"]*)"[^>]*>From<\/label>/)?.[1];
    const toId = html.match(/<label[^>]*for="([^"]*)"[^>]*>To<\/label>/)?.[1];
    expect(fromId).toBeTruthy();
    expect(toId).toBeTruthy();
    expect(html).toContain('>Jun 2026<');
    expect(html).toContain('>Nov 2026<');
    expect(html).not.toMatch(FULL_MONTHS);
    expect(html).not.toContain('<button');
    const [from, to] = inputs(html);
    expect(from).toContain(`id="${fromId}"`);
    expect(from).toMatch(/ type="month"/);
    expect(from).toMatch(/ value="2026-06"/);
    expect(from).toMatch(/ max="2026-12"/);
    expect(to).toContain(`id="${toId}"`);
    expect(to).toMatch(/ type="month"/);
    expect(to).toMatch(/ value="2026-11"/);
    expect(to).toMatch(/ min="2026-06"/);
    expect(to).toMatch(/ max="2026-12"/);
    for (const tag of [from, to])
      expect(tag).toMatch(/class="[^"]*min-h-11[^"]*text-base|class="[^"]*text-base[^"]*min-h-11/);
  });

  it('formats every month on phones as a short month name and year, and shows placeholder when empty', () => {
    for (const [iso, short] of SHORT_BY_MONTH) {
      const html = phone({ from: iso, to: iso, max: '2026-12' });
      expect(html).toContain(`>${short}<`);
      expect(html).not.toMatch(FULL_MONTHS);
    }
    const emptyHtml = phone({ from: '', to: '' });
    expect(emptyHtml).toContain('>Select month<');
  });

  it('reveals the native month input and hides the display span on keyboard focus (WR-03)', () => {
    const html = phone();
    for (const tag of inputs(html)) {
      expect(tag).toMatch(/\bpeer\b/);
      expect(tag).toContain('focus-visible:opacity-100');
    }
    expect(html.indexOf('<input')).toBeLessThan(html.indexOf('data-month-display="from"'));
    expect(html).toMatch(/data-month-display="from"[^>]*peer-focus-visible:invisible/);
    expect(html).toMatch(/data-month-display="to"[^>]*peer-focus-visible:invisible/);
  });

  it('a label names the group instead of Months', () => {
    expect(group(phone({ label: 'Report months' }))).toMatch(/ aria-labelledby="/);
    expect(phone({ label: 'Report months' })).toContain('>Report months<');
  });

  it('both inputs carry disabled, read-only and invalid', () => {
    for (const tag of inputs(phone({ isDisabled: true }))) expect(tag).toMatch(/ disabled=""/);
    for (const tag of inputs(phone({ isReadOnly: true }))) expect(tag).toMatch(/ readOnly=""/);
    for (const tag of inputs(phone({ isInvalid: true })))
      expect(tag).toMatch(/ aria-invalid="true"/);
    expect(phone({ isInvalid: true, errorMessage: 'Choose a full year' })).toContain(
      'Choose a full year',
    );
  });

  it('without a native month input, it is the grid trigger, never a text box', () => {
    screen.nativeMonth = false;
    const html = phone();
    expect(html).not.toContain('<input');
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"/);
    expect(html).toContain(formatMonthRange('2026-06', '2026-11'));
  });
});
