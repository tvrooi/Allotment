import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Radio, RadioGroup } from './RadioGroup';

type Props = Parameters<typeof RadioGroup>[0];
type RadioProps = Parameters<typeof Radio>[0];
const noop = () => {};
const OPTIONS = ['Weekly', 'Monthly'];
const render = (props: Partial<Props> = {}, radio: Partial<RadioProps> = {}) =>
  renderToStaticMarkup(
    createElement(
      RadioGroup,
      { label: 'Repeat', value: '', onChange: noop, ...props } as Props,
      OPTIONS.map((name) =>
        createElement(Radio, { key: name, value: name.toLowerCase(), children: name, ...radio }),
      ),
    ),
  );

const inputs = (html: string) => [...html.matchAll(/<input([^>]*)>/g)].map((m) => m[1]);
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const group = (html: string) => html.match(/<div([^>]*role="radiogroup"[^>]*)>/)?.[1] ?? '';
// Each Radio's indicator is the visible circle after its hidden input
const circles = (html: string) =>
  [...html.matchAll(/<span aria-hidden="true" class="([^"]*)"/g)].map((m) => m[1]);

// A type check, run by the client build (tsc -b), not by Vitest (E-03)
// @ts-expect-error a RadioGroup needs a label or an aria-label
export const unnamed = () => createElement(RadioGroup, { value: '', onChange: noop });

describe('RadioGroup', () => {
  // React Aria's hidden input is absolutely placed; an unpositioned label lets it sit against the
  // page and stretch the document (plan 02-12, found on the phone welcome screen's switches)
  it('the label is positioned, so the hidden input stays inside it', () => {
    for (const label of render().match(/<label[^>]*>/g) ?? [])
      expect(label).toMatch(/ class="group relative /);
    expect(render().match(/<label[^>]*>/g)?.length).toBe(2);
  });

  it('its label is a span, and each Radio is a label wrapping its input', () => {
    const html = render();
    expect(html).toMatch(/<span[^>]*id="[^"]*"[^>]*>Repeat/);
    expect(html).not.toMatch(/<label[^>]*>Repeat/);
    expect(html.match(/<label[^>]*>(?:(?!<\/label>).)*<input/g)).toHaveLength(2);
    expect(inputs(html).every((tag) => attr(tag, 'type') === 'radio')).toBe(true);
  });

  it('an unselected Radio has the tertiary ring; the chosen one a brand ring and dot', () => {
    const html = render({ value: 'monthly' });
    const [weekly, monthly] = circles(html);
    expect(weekly).toContain('ring-text-tertiary');
    expect(monthly).toContain('ring-brand-600');
    expect(html).toMatch(/<span class="[^"]*size-2[^"]*bg-brand-600/);
    expect(attr(inputs(html)[1], 'checked')).toBe('');
  });

  it.each([
    ['the group', { isDisabled: true }, {}],
    ['one Radio', {}, { isDisabled: true }],
  ] as const)(
    'a disabled Radio (%s) reads as disabled, with no brand colour or dimming',
    (_, props, radio) => {
      const html = render({ value: 'weekly', ...props }, radio);
      expect(inputs(html).every((tag) => attr(tag, 'disabled') === '')).toBe(true);
      expect(html).not.toMatch(/bg-brand-|ring-brand-/);
      expect(html).not.toMatch(/opacity-/);
      for (const circle of circles(html)) expect(circle).toContain('bg-surface-alt');
    },
  );

  it('a read-only group shows its choice in text-secondary and carries aria-readonly', () => {
    const html = render({ value: 'weekly', isReadOnly: true });
    expect(attr(group(html), 'aria-readonly')).toBe('true');
    expect(html).toMatch(/<span class="[^"]*size-2[^"]*bg-text-secondary/);
    expect(html).not.toMatch(/bg-brand-|ring-brand-/);
  });

  it('an invalid group has the negative ring and aria-invalid', () => {
    const html = render({ isInvalid: true });
    expect(attr(group(html), 'aria-invalid')).toBe('true');
    for (const circle of circles(html)) expect(circle).toContain('ring-negative');
  });

  it('a required, invalid group names its visible label in the default line', () => {
    const html = render({ isRequired: true, isInvalid: true });
    expect(html).toContain('Select Repeat to continue');
  });

  it('a group named only by aria-label names it in the default line', () => {
    const html = render({
      label: undefined,
      'aria-label': 'Frequency',
      isRequired: true,
      isInvalid: true,
    });
    expect(html).toContain('Select Frequency to continue');
    expect(html).not.toContain('undefined');
  });

  it("errorLabel names the subject instead, and a caller's errorMessage wins", () => {
    expect(render({ isRequired: true, isInvalid: true, errorLabel: 'Up sync' })).toContain(
      'Select Up sync to continue',
    );
    const own = render({ isRequired: true, isInvalid: true, errorMessage: 'Pick how often' });
    expect(own).toContain('Pick how often');
    expect(own).not.toContain('Select Repeat');
  });

  it('an invalid group that is not required shows no error line without a message', () => {
    const html = render({ isInvalid: true });
    expect(html).not.toContain('slot="errorMessage"');
    expect(html).not.toMatch(/text-negative/);
  });

  it('help text and the error line describe the group, and are absent without one', () => {
    const html = render({ isRequired: true, isInvalid: true, description: 'How often it repeats' });
    const describedBy = attr(group(html), 'aria-describedby')?.split(' ') ?? [];
    const description = html.match(/id="([^"]*)"[^>]*>How often it repeats/)?.[1];
    const error = html.match(/id="([^"]*)"[^>]*>Select Repeat to continue/)?.[1];
    expect(describedBy).toContain(description);
    expect(describedBy).toContain(error);

    const bare = render();
    expect(bare).not.toContain('slot="description"');
    expect(bare).not.toContain('slot="errorMessage"');
  });

  it('lays out vertically by default and wraps when horizontal', () => {
    expect(render()).toMatch(/class="flex flex-col gap-2"/);
    expect(render({ orientation: 'horizontal' })).toMatch(/class="flex flex-wrap gap-x-4 gap-y-2"/);
  });

  it('each Radio is a 44 px target on phones', () => {
    for (const tag of render().match(/<label[^>]*>/g) ?? [])
      expect(tag).toMatch(/max-md:min-h-11 max-md:min-w-11/);
  });

  it('never writes undefined and uses design tokens only, never a hex colour', () => {
    for (const props of [
      {},
      { value: 'weekly' },
      { isDisabled: true, value: 'weekly' },
      { isReadOnly: true, value: 'weekly' },
      { isInvalid: true, isRequired: true },
    ] as Partial<Props>[]) {
      const html = render(props);
      expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
      expect(html).not.toContain('undefined');
    }
  });
});
