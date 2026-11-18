import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatMonthRange } from '../../utils/dateRange';
import { MonthRangePicker } from './MonthRangePicker';

// useIsPhone reads matchMedia, which server rendering has not got: it reports desktop unless a
// test says it is a phone
const screen = vi.hoisted(() => ({ phone: false }));
vi.mock('../../hooks/useIsPhone', () => ({ useIsPhone: () => screen.phone }));
afterEach(() => {
  screen.phone = false;
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

describe('MonthRangePicker on desktop', () => {
  it('is a dialog trigger showing the range, with no native month input', () => {
    const html = render();
    const trigger = html.match(/<button([^>]*)>/)?.[1] ?? '';
    expect(trigger).toMatch(/ aria-haspopup="dialog"/);
    expect(trigger).toMatch(/ aria-expanded="false"/);
    expect(html).toContain(`>${formatMonthRange('2026-06', '2026-11')}<`);
    expect(html).not.toContain('<input');
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
  const phone = (props: Partial<Props> = {}) => {
    screen.phone = true;
    return render(props);
  };
  const inputs = (html: string) => [...html.matchAll(/<input([^>]*)>/g)].map((m) => m[1]);

  it('is a group of two native month inputs, From and To, inside their labels', () => {
    const html = phone();
    expect(group(html)).toMatch(/ aria-label="Months"/);
    expect(html).toMatch(/<label[^>]*><span[^>]*>From<\/span><input[^>]*type="month"/);
    expect(html).toMatch(/<label[^>]*><span[^>]*>To<\/span><input[^>]*type="month"/);
    expect(html).not.toContain('<button');
    const [from, to] = inputs(html);
    expect(from).toMatch(/ value="2026-06"/);
    expect(from).toMatch(/ max="2026-12"/);
    expect(to).toMatch(/ value="2026-11"/);
    expect(to).toMatch(/ min="2026-06"/);
    expect(to).toMatch(/ max="2026-12"/);
    for (const tag of [from, to])
      expect(tag).toMatch(/class="[^"]*min-h-11[^"]*text-base|class="[^"]*text-base[^"]*min-h-11/);
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
});
