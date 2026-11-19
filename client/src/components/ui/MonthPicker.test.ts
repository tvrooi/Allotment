import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatMonth } from '../../utils/dateRange';
import { MonthGrid, MonthPicker } from './MonthPicker';

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

type Props = Parameters<typeof MonthPicker>[0];
const noop = () => {};
const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(MonthPicker, { label: 'Start month', value: '', onChange: noop, ...props }),
  );
const trigger = (html: string) => html.match(/<button([^>]*aria-labelledby[^>]*)>/)?.[1] ?? '';
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];

describe('MonthPicker on desktop', () => {
  it('unset, the trigger shows Select month in the tertiary colour', () => {
    const html = render();
    expect(html).toMatch(/<span[^>]*class="[^"]*text-text-tertiary[^"]*"[^>]*>Select month</);
  });

  it('set, it shows the month as formatMonth writes it', () => {
    const html = render({ value: '2026-11' });
    expect(html).toContain(`>${formatMonth('2026-11')}<`);
    expect(html).not.toContain('Select month');
  });

  it('the trigger is labelled by the label, then the value', () => {
    const html = render({ value: '2026-11' });
    const [labelId, valueId] = attr(trigger(html), 'aria-labelledby')!.split(' ');
    expect(html).toMatch(new RegExp(`<span[^>]*id="${labelId}"[^>]*>Start month`));
    expect(html).toMatch(new RegExp(`<span[^>]*id="${valueId}"[^>]*>Nov 2026`));
    expect(html).not.toContain('<label');
  });

  it('disabled, invalid and read-only reach the group; Clear only when it applies', () => {
    const group = (html: string) => html.match(/<div([^>]*role="group"[^>]*)>/)?.[1] ?? '';
    expect(group(render({ isDisabled: true }))).toMatch(/ data-disabled="true"/);
    expect(group(render({ isInvalid: true }))).toMatch(/ data-invalid="true"/);
    expect(group(render({ isReadOnly: true }))).toMatch(/ data-readonly="true"/);
    const set = { value: '2026-11', optional: true };
    expect(render(set)).toContain('aria-label="Clear Start month"');
    expect(render({ ...set, errorLabel: 'start month' })).toContain(
      'aria-label="Clear start month"',
    );
    expect(render({ ...set, value: '' })).not.toContain('Clear');
    expect(render({ ...set, isDisabled: true })).not.toContain('Clear');
    expect(render({ ...set, isReadOnly: true })).not.toContain('Clear');
  });

  it('a month outside the range shows the range line; a bound itself is allowed', () => {
    expect(render({ value: '2026-12', maxValue: '2026-11' })).toContain(
      'Choose a month on or before Nov 2026',
    );
    expect(render({ value: '2026-11', maxValue: '2026-11' })).not.toContain('Choose a month');
    expect(render({ value: '2026-02', minValue: '2026-03', maxValue: '2026-11' })).toContain(
      'Choose a month between Mar 2026 and Nov 2026',
    );
  });

  it('a required, invalid one names its subject in the default line', () => {
    expect(render({ isRequired: true, isInvalid: true })).toContain(
      'Select Start month to continue',
    );
    expect(render({ isRequired: true })).not.toContain('to continue');
  });
});

describe('MonthPicker on phones', () => {
  const phone = (props: Partial<Props> = {}) => {
    screen.phone = true;
    return render(props);
  };
  const input = (html: string) => html.match(/<input([^>]*)>/)?.[1] ?? '';

  it('is a native month input inside its label, carrying its range and states', () => {
    const html = phone({ value: '2026-11', minValue: '2026-01', maxValue: '2026-12' });
    expect(html).toMatch(/<label[^>]*><span[^>]*>Start month<\/span><input[^>]*type="month"/);
    expect(html).not.toContain('<button');
    const tag = input(html);
    expect(tag).toMatch(/ min="2026-01"/);
    expect(tag).toMatch(/ max="2026-12"/);
    expect(tag).toMatch(/class="[^"]*min-h-11[^"]*text-base|class="[^"]*text-base[^"]*min-h-11/);
    expect(input(phone({ isDisabled: true }))).toMatch(/ disabled=""/);
    expect(input(phone({ isReadOnly: true }))).toMatch(/ readOnly=""/);
    expect(input(phone({ isRequired: true }))).toMatch(/ required=""/);
  });

  it('without a native month input, it is the month grid trigger, never a text box', () => {
    screen.nativeMonth = false;
    const html = phone({ value: '2026-11' });
    expect(html).not.toContain('<input');
    expect(trigger(html)).toBeTruthy();
    expect(html).toContain(`>${formatMonth('2026-11')}<`);
  });
});

describe('MonthGrid', () => {
  afterEach(() => vi.useRealTimers());

  const grid = (props: Partial<Parameters<typeof MonthGrid>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(MonthGrid, {
        value: '2026-11',
        onPick: noop,
        isDisabled: () => false,
        ...props,
      }),
    );

  it('with a label it is a group named by it', () => {
    expect(grid({ label: 'From' })).toMatch(/^<div role="group" aria-label="From">/);
  });

  it('has twelve months, the chosen one pressed, each named by its full month and year', () => {
    const html = grid();
    expect(html.match(/aria-pressed="/g)).toHaveLength(12);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="November 2026"/);
    expect(html).toContain('aria-label="Select this month"');
  });

  it("marks this month from the device's today (thisMonthIso), and opens on its year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2031, 2, 10, 12));
    const html = grid({ value: '' });
    expect(html).toMatch(/aria-label="March 2031" data-this-month="true"/);
    expect(html.match(/data-this-month=/g)).toHaveLength(1);
  });

  it('stops at the year 2000, or at a later floor', () => {
    const previous = (html: string) =>
      html.match(/<button[^>]*aria-label="Previous year"[^>]*>/)![0];
    expect(previous(grid({ value: '2000-05' }))).toMatch(/ disabled=""/);
    expect(previous(grid({ value: '2001-05' }))).not.toMatch(/ disabled=""/);
    expect(previous(grid({ value: '2026-05', minYear: 2026 }))).toMatch(/ disabled=""/);
  });

  it('months it is told are out of range are disabled buttons', () => {
    const html = grid({ isDisabled: (m) => m > '2026-10' });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="November 2026"/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="October 2026"/);
  });
});
