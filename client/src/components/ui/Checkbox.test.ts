import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './Checkbox';

type Props = Parameters<typeof Checkbox>[0];
const noop = () => {};
const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(Checkbox, {
      checked: false,
      onCheckedChange: noop,
      children: 'Include pending',
      ...props,
    } as Props),
  );

const input = (html: string) => html.match(/<input([^>]*)>/)?.[1] ?? '';
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
// The indicator is the visible box after the hidden input
const box = (html: string) => html.match(/<span aria-hidden="true" class="([^"]*)"/)?.[1] ?? '';
const idOf = (html: string, text: string) =>
  html.match(new RegExp(`id="([^"]*)"[^>]*>${text}`))?.[1];

// Type checks, run by the client build (tsc -b), not by Vitest (E-03)
// @ts-expect-error a Checkbox needs children or an aria-label
export const unnamed = () => createElement(Checkbox, { checked: false, onCheckedChange: noop });
export const requiredNode = () =>
  // @ts-expect-error a required Checkbox named only by a React node needs an errorLabel
  createElement(Checkbox, {
    checked: false,
    onCheckedChange: noop,
    isRequired: true,
    children: createElement('b', null, 'Terms'),
  });

describe('Checkbox', () => {
  // React Aria's hidden input is absolutely placed; an unpositioned label lets it sit against the
  // page and stretch the document (plan 02-12, found on the phone welcome screen's switches)
  it('the label is positioned, so the hidden input stays inside it', () => {
    expect(render()).toMatch(/<label[^>]* class="group relative /);
  });

  it('an unchecked box has the tertiary border on the surface and no mark', () => {
    const html = render();
    expect(box(html)).toContain('ring-text-tertiary');
    expect(box(html)).toContain('bg-surface');
    expect(html).not.toMatch(/bg-brand-/);
    expect(html).not.toContain('<svg');
  });

  it('a checked box is brand filled with a tick, an indeterminate one with a dash', () => {
    const checked = render({ checked: true });
    expect(attr(input(checked), 'checked')).toBe('');
    expect(box(checked)).toContain('bg-brand-600');
    expect(box(checked)).toContain('text-brand-contrast');
    expect(checked).toContain('lucide-check');

    const mixed = render({ isIndeterminate: true });
    expect(box(mixed)).toContain('bg-brand-600');
    expect(mixed).toContain('lucide-minus');
  });

  it.each([false, true])(
    'a disabled box reads as disabled, with no brand colour or dimming (checked: %s)',
    (checked) => {
      const html = render({ checked, disabled: true });
      expect(attr(input(html), 'disabled')).toBe('');
      expect(html).not.toMatch(/bg-brand-/);
      expect(html).not.toMatch(/opacity-/);
      expect(box(html)).toContain('bg-surface-alt');
      expect(box(html)).toContain('ring-border');
    },
  );

  it('a read-only box shows its chosen state in text-secondary and carries aria-readonly', () => {
    const on = render({ checked: true, readOnly: true });
    expect(attr(input(on), 'aria-readonly')).toBe('true');
    expect(attr(input(on), 'disabled')).toBeUndefined();
    expect(box(on)).toContain('bg-text-secondary');
    expect(box(on)).toContain('text-surface');
    expect(on).not.toMatch(/bg-brand-/);
    expect(box(render({ readOnly: true }))).toContain('bg-surface-alt');
  });

  it('an invalid box has the negative ring and aria-invalid', () => {
    const html = render({ isInvalid: true });
    expect(attr(input(html), 'aria-invalid')).toBe('true');
    expect(box(html)).toContain('ring-negative');
  });

  it('a required, invalid box names its plain-text label in the default line', () => {
    const html = render({ isRequired: true, isInvalid: true, children: 'Agree to the terms' });
    expect(attr(input(html), 'required')).toBe('');
    expect(html).toContain('Turn on Agree to the terms to continue');
  });

  it('errorLabel replaces the label in the default line and keeps its capitals', () => {
    const html = render({ isRequired: true, isInvalid: true, errorLabel: 'Up sync' });
    expect(html).toContain('Turn on Up sync to continue');
  });

  it('a box named only by aria-label names it in the default line', () => {
    const html = render({
      children: undefined,
      'aria-label': 'Terms',
      isRequired: true,
      isInvalid: true,
    });
    expect(html).toContain('Turn on Terms to continue');
    expect(html).not.toContain('undefined');
  });

  it("a caller's errorMessage replaces the whole default line", () => {
    const html = render({ isRequired: true, isInvalid: true, errorMessage: 'Tick to agree' });
    expect(html).toContain('Tick to agree');
    expect(html).not.toContain('Turn on');
  });

  it('an invalid box that is not required shows no error line without a message', () => {
    const html = render({ isInvalid: true });
    expect(html).not.toContain('slot="errorMessage"');
    expect(html).not.toMatch(/text-negative/);
  });

  it("the description and the error are in the input's aria-describedby", () => {
    const html = render({
      isRequired: true,
      isInvalid: true,
      description: 'Shown on the budget page',
    });
    const describedBy = attr(input(html), 'aria-describedby')?.split(' ') ?? [];
    const description = idOf(html, 'Shown on the budget page');
    const error = idOf(html, 'Turn on Include pending to continue');
    expect(description).toBeTruthy();
    expect(error).toBeTruthy();
    expect(describedBy).toContain(description);
    expect(describedBy).toContain(error);
  });

  it('without a description or an error, neither element is rendered', () => {
    const html = render();
    expect(html).not.toContain('slot="description"');
    expect(html).not.toContain('slot="errorMessage"');
    expect(html).not.toContain('text-xs');
  });

  it('the hit area is 44 px on phones with or without a visible label', () => {
    for (const html of [render(), render({ children: undefined, 'aria-label': 'Select row' })])
      expect(html).toMatch(/<label[^>]*class="[^"]*max-md:min-h-11 max-md:min-w-11/);
    expect(render({ children: undefined, 'aria-label': 'Select row' })).toMatch(
      /<label[^>]*class="[^"]*justify-center/,
    );
  });

  it('never writes undefined and uses design tokens only, never a hex colour', () => {
    for (const props of [
      {},
      { checked: true },
      { isIndeterminate: true },
      { disabled: true, checked: true },
      { readOnly: true, checked: true },
      { isInvalid: true, isRequired: true },
    ] as Partial<Props>[]) {
      const html = render(props);
      expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
      expect(html).not.toContain('undefined');
    }
  });
});
