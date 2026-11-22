import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DateFormatOption } from '../../store/preferencesStore';
import { DatePicker, nativeValue } from './DatePicker';

// useIsPhone reads matchMedia, which server rendering has not got: it reports desktop unless a
// test says it is a phone
const screen = vi.hoisted(() => ({ phone: false }));
vi.mock('../../hooks/useIsPhone', () => ({ useIsPhone: () => screen.phone }));
// Server rendering reads a store's initial state, so the Date format preference is mocked
const prefs = vi.hoisted(() => ({ dateFormat: 'd MMM yyyy' as DateFormatOption }));
vi.mock('../../store/preferencesStore', () => ({
  usePreferencesStore: Object.assign((pick: (s: typeof prefs) => unknown) => pick(prefs), {
    getState: () => prefs,
  }),
}));
const setFormat = (format: DateFormatOption) => {
  prefs.dateFormat = format;
};
afterEach(() => {
  screen.phone = false;
  setFormat('d MMM yyyy');
});

type Props = Parameters<typeof DatePicker>[0];
const noop = () => {};
const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(DatePicker, {
      label: 'Paid on',
      value: '2026-11-16',
      onChange: noop,
      ...props,
    }),
  );

/** The trigger group's opening tag */
const group = (html: string) => html.match(/<div([^>]*role="group"[^>]*)>/)?.[1] ?? '';
/** The editable segments' types, in the order they are typed */
const segmentOrder = (html: string) =>
  [...html.matchAll(/<[^>]*role="spinbutton"[^>]*>/g)].map(
    ([tag]) => tag.match(/ data-type="([^"]*)"/)?.[1],
  );

describe('DatePicker on desktop', () => {
  it('is a group of segments with a calendar button, labelled by a span, not a label', () => {
    const html = render();
    expect(group(html)).toBeTruthy();
    expect(segmentOrder(html)).toHaveLength(3);
    expect(html).toContain('aria-label="Choose from a calendar"');
    expect(html).not.toContain('<label');
    expect(html).toMatch(/<span[^>]*id="[^"]*"[^>]*>Paid on/);
  });

  it('types day, month, year for the default preference', () => {
    setFormat('d MMM yyyy');
    expect(segmentOrder(render())).toEqual(['day', 'month', 'year']);
  });

  it('types month first for MM/dd/yyyy and year first for yyyy-MM-dd', () => {
    setFormat('MM/dd/yyyy');
    expect(segmentOrder(render())).toEqual(['month', 'day', 'year']);
    setFormat('yyyy-MM-dd');
    expect(segmentOrder(render())).toEqual(['year', 'month', 'day']);
    setFormat('dd.MM.yyyy');
    expect(segmentOrder(render())).toEqual(['day', 'month', 'year']);
  });

  it('disabled, invalid and read-only reach the group as data attributes', () => {
    expect(group(render({ isDisabled: true }))).toMatch(/ data-disabled="true"/);
    expect(group(render({ isInvalid: true }))).toMatch(/ data-invalid="true"/);
    expect(group(render({ isReadOnly: true }))).toMatch(/ data-readonly="true"/);
    expect(group(render())).not.toMatch(/ data-(invalid|readonly|disabled)=/);
  });

  it('a read-only date stays focusable but cannot be edited, and its calendar does not open', () => {
    const html = render({ isReadOnly: true });
    expect(html).not.toContain('contenteditable="true"');
    expect(html).toMatch(/role="spinbutton"[^>]*tabindex="0"|tabindex="0"[^>]*role="spinbutton"/);
    const button = html.match(/<button[^>]*aria-label="Choose from a calendar"[^>]*>/)?.[0];
    expect(button).toMatch(/ disabled=""/);
  });

  it('the Clear button names its subject through fieldSubject, casing kept', () => {
    const html = render({
      label: 'Target date (optional)',
      errorLabel: 'target date',
      optional: true,
    });
    expect(html).toContain('aria-label="Clear target date"');
    expect(render({ label: 'Up start date', optional: true })).toContain(
      'aria-label="Clear Up start date"',
    );
  });

  it('the Clear button shows only when optional, set, and changeable', () => {
    expect(render({ optional: true })).toContain('aria-label="Clear Paid on"');
    expect(render()).not.toContain('Clear Paid on');
    expect(render({ optional: true, value: '' })).not.toContain('Clear Paid on');
    expect(render({ optional: true, isDisabled: true })).not.toContain('Clear Paid on');
    expect(render({ optional: true, isReadOnly: true })).not.toContain('Clear Paid on');
  });

  it('help text and the required mark render only when they apply', () => {
    expect(render({ description: 'When the money left' })).toContain('When the money left');
    expect(render()).not.toContain('text-xs text-text-tertiary');
    expect(render({ isRequired: true })).toMatch(/aria-hidden="true"[^>]*>\*</);
    expect(render()).not.toMatch(/>\*</);
  });

  it('optionalHint shows a muted "(optional)" hint kept out of the accessible name (WR-05)', () => {
    const html = render({ label: 'End date', optional: true, optionalHint: true });
    expect(html).toMatch(
      />End date<span aria-hidden="true" class="ml-1 font-normal text-text-tertiary">\(optional\)<\/span><\/span>/,
    );
    expect(html).toContain('aria-label="Clear End date"');
    expect(render({ label: 'End date', optional: true })).not.toContain('(optional)');
    expect(render({ label: 'End date', isRequired: true, optionalHint: true })).not.toContain(
      '(optional)',
    );
  });

  it('a required, invalid one names its subject in the default line; a message wins', () => {
    expect(render({ isRequired: true, isInvalid: true, value: '' })).toContain(
      'Select Paid on to continue',
    );
    const html = render({ isInvalid: true, errorMessage: 'Pick a weekday' });
    expect(html).toContain('Pick a weekday');
    expect(html).not.toContain('to continue');
  });

  it('renders a stored day that does not round-trip, without re-rendering forever (review-3 CR-01)', () => {
    // A rule condition is checked for shape only, so 0000-01-01 can be stored; CalendarDate
    // reads year 0 as 1, so the held day never writes back the same string
    expect(() => render({ value: '0000-01-01' })).not.toThrow();
    expect(() => render({ value: '2026-02-30' })).not.toThrow();
  });

  it('uses no hex colour, no opacity dimming and no semibold weight', () => {
    const html = render({ isDisabled: true, isInvalid: true, description: 'Help' });
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).not.toMatch(/opacity-/);
    expect(html).not.toContain('font-semibold');
  });
});

describe('DatePicker on phones', () => {
  const phone = (props: Partial<Props> = {}) => {
    screen.phone = true;
    return render(props);
  };
  const input = (html: string) => html.match(/<input([^>]*)>/)?.[1] ?? '';

  it('is a native date input inside its label, 44 px tall with 16 px text', () => {
    const html = phone();
    expect(html).toMatch(/<label[^>]*><span[^>]*>Paid on<\/span><input[^>]*type="date"/);
    expect(html).not.toContain('role="spinbutton"');
    expect(input(html)).toMatch(/ value="2026-11-16"/);
    expect(input(html)).toMatch(/class="[^"]*min-h-11[^"]*"/);
    expect(input(html)).toMatch(/class="[^"]*text-base[^"]*"/);
  });

  // iOS Safari sizes a native date input by its value and centres it, so in a flex column it
  // outgrows the sheet unless it may shrink (min-w-0), drops its own appearance and left-aligns
  // the value (UAT G-03-1: the Add transaction Date ran past the sheet's right edge)
  it('the native input cannot outgrow its container (iOS sizes a date input by its value)', () => {
    const tag = input(phone());
    expect(tag).toMatch(/class="[^"]*\bmin-w-0\b[^"]*"/);
    expect(tag).toMatch(/class="[^"]*\bappearance-none\b[^"]*"/);
    // The server markup writes the variant's `&` as `&amp;`
    expect(tag).toMatch(/class="[^"]*webkit-date-and-time-value\]:text-left[^"]*"/);
  });

  // With `block` from fieldBase, iOS stacks the value at the top of the field; a 42 px line
  // (the 44 px field less its two 1 px borders) with no vertical margin centres it, as a text
  // field centres its line (owner, 22 November 2026, UAT G-03-3)
  it('gives the iOS date value box no vertical margin and a 42 px line, keeping the G-03-1 classes (UAT G-03-3)', () => {
    const tag = input(phone());
    // The server markup writes the variant's `&` as `&amp;`
    expect(tag).toMatch(/class="[^"]*webkit-date-and-time-value\]:my-0[^"]*"/);
    expect(tag).toMatch(/class="[^"]*webkit-date-and-time-value\]:leading-\[42px\][^"]*"/);
    expect(tag).toMatch(/class="[^"]*\bmin-h-11\b[^"]*"/);
    expect(tag).toMatch(/class="[^"]*\bmin-w-0\b[^"]*"/);
    expect(tag).toMatch(/class="[^"]*\bappearance-none\b[^"]*"/);
    expect(tag).toMatch(/class="[^"]*webkit-date-and-time-value\]:text-left[^"]*"/);
  });

  it('carries min, max, disabled and readOnly', () => {
    const tag = input(phone({ minValue: '2026-11-01', maxValue: '2026-11-30' }));
    expect(tag).toMatch(/ min="2026-11-01"/);
    expect(tag).toMatch(/ max="2026-11-30"/);
    expect(input(phone({ isDisabled: true }))).toMatch(/ disabled=""/);
    expect(input(phone({ isReadOnly: true }))).toMatch(/ readOnly=""/);
    expect(input(phone())).not.toMatch(/ (disabled|readOnly|required|aria-invalid)=/);
  });

  it('a required, invalid one is marked and described by the default line', () => {
    const html = phone({ isRequired: true, isInvalid: true, value: '' });
    const tag = input(html);
    expect(tag).toMatch(/ required=""/);
    expect(tag).toMatch(/ aria-invalid="true"/);
    const errorId = html.match(/id="([^"]*)"[^>]*>Select Paid on to continue/)?.[1];
    expect(errorId).toBeTruthy();
    expect(tag).toMatch(new RegExp(` aria-describedby="[^"]*${errorId}`));
  });

  it('optionalHint shows a muted "(optional)" hint excluded from the native label name (WR-05)', () => {
    const html = phone({ label: 'End date', optional: true, optionalHint: true });
    expect(html).toMatch(
      /<label[^>]*><span[^>]*>End date<span aria-hidden="true" class="ml-1 font-normal text-text-tertiary">\(optional\)<\/span><\/span><input[^>]*type="date"/,
    );
  });

  it('supports fieldSize sm and hideLabel on desktop and phone (WR-03)', () => {
    const desktopSm = render({ fieldSize: 'sm', hideLabel: true });
    expect(group(desktopSm)).toMatch(/\bh-8\b/);
    expect(group(desktopSm)).not.toMatch(/\bh-10\b/);
    expect(desktopSm).toMatch(/<span[^>]*class="[^"]*\bsr-only\b[^"]*"[^>]*>Paid on/);

    const phoneHidden = phone({ fieldSize: 'sm', hideLabel: true });
    expect(input(phoneHidden)).toMatch(/\bmin-h-11\b/);
    expect(phoneHidden).toMatch(/<span[^>]*class="[^"]*\bsr-only\b[^"]*"[^>]*>Paid on/);
  });
});

// A browser without a native control leaves a text box, whose text never becomes a value
describe('nativeValue', () => {
  it('passes a real month or day through', () => {
    expect(nativeValue('month', '2026-11')).toBe('2026-11');
    expect(nativeValue('date', '2026-11-16')).toBe('2026-11-16');
    expect(nativeValue('month', '')).toBe('');
  });

  it('gives empty for typed text, a day in a month input or an impossible date', () => {
    for (const raw of ['Nov 2026', '11/2026', '2026-13', '2026-1', '2026-11-16'])
      expect(nativeValue('month', raw)).toBe('');
    for (const raw of ['16/11/2026', '2026-02-30', '2026-11'])
      expect(nativeValue('date', raw)).toBe('');
  });
});
