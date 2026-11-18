import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Input } from './Input';

type Props = Parameters<typeof Field>[0];
const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(Field, { label: 'Payee', ...props } as Props, createElement(Input)),
  );

/** The attributes of the one <input> in the markup */
const input = (html: string) => html.match(/<input([^>]*)>/)?.[1] ?? '';
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];

// A type check, run by the client build (tsc -b), not by Vitest: E-03, a Field always names its
// control with a visible label, so its props refuse one without
// @ts-expect-error a Field needs a label
export const unlabelled = () => createElement(Field, { children: createElement(Input) });

describe('Field', () => {
  it('its label points at the input', () => {
    const html = render();
    const id = attr(input(html), 'id');
    expect(id).toBeTruthy();
    expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>Payee`));
  });

  it("the description and the error are in the input's aria-describedby", () => {
    const html = render({
      description: 'As it appears on the statement',
      errorMessage: 'Too long',
    });
    const describedBy = attr(input(html), 'aria-describedby')?.split(' ') ?? [];
    const description = html.match(/id="([^"]*)"[^>]*>As it appears on the statement/)?.[1];
    const error = html.match(/id="([^"]*)"[^>]*>Too long/)?.[1];
    expect(description).toBeTruthy();
    expect(error).toBeTruthy();
    expect(describedBy).toContain(description);
    expect(describedBy).toContain(error);
  });

  it('an invalid Field marks its input invalid and shows the error in the negative colour', () => {
    const html = render({ isInvalid: true, errorMessage: 'Enter a payee' });
    expect(attr(input(html), 'aria-invalid')).toBe('true');
    expect(html).toMatch(/class="[^"]*text-negative[^"]*"[^>]*>Enter a payee/);
  });

  it('an error message alone makes the Field invalid', () => {
    expect(attr(input(render({ errorMessage: 'Enter a payee' })), 'aria-invalid')).toBe('true');
  });

  it('without a description or an error, neither element is rendered', () => {
    const html = render();
    expect(html).not.toContain('slot="description"');
    expect(html).not.toContain('slot="errorMessage"');
    expect(html).not.toContain('text-text-tertiary"');
    expect(html).not.toMatch(/text-negative/);
  });

  it('a required Field marks its input required and shows a mark hidden from screen readers', () => {
    const html = render({ isRequired: true });
    expect(input(html)).toMatch(/ required=""/);
    expect(html).toMatch(
      /<span aria-hidden="true" class="[^"]*ml-1[^"]*text-negative[^"]*">\*<\/span>/,
    );
    expect(render()).not.toContain('>*</span>');
  });

  it('disabled and read-only reach the input', () => {
    expect(input(render({ isDisabled: true }))).toMatch(/ disabled=""/);
    expect(input(render({ isReadOnly: true }))).toMatch(/ readonly=""/i);
  });

  it('long labels and messages wrap rather than truncate', () => {
    const html = render({ description: 'Help', errorMessage: 'Error' });
    for (const text of ['Payee', 'Help', 'Error'])
      expect(html).toMatch(new RegExp(`class="[^"]*break-words[^"]*"[^>]*>${text}`));
    expect(html).not.toMatch(/truncate|text-ellipsis/);
  });

  it('stacks its parts with a 4 px gap', () => {
    expect(render()).toMatch(/^<div[^>]*class="[^"]*flex flex-col gap-1/);
  });

  it('a required, invalid Field with no message shows the default line naming its label', () => {
    const html = render({ isRequired: true, isInvalid: true });
    expect(html).toMatch(/class="[^"]*text-negative[^"]*"[^>]*>Enter Payee to continue</);
    const error = html.match(/id="([^"]*)"[^>]*>Enter Payee to continue/)?.[1];
    expect(attr(input(html), 'aria-describedby')?.split(' ')).toContain(error);
  });

  it('errorLabel names the subject of the default line, keeping its capitals', () => {
    const html = render({
      label: 'Business number',
      errorLabel: 'ABN',
      isRequired: true,
      isInvalid: true,
    });
    expect(html).toContain('>Enter ABN to continue<');
    expect(html).not.toContain('Enter Business number');
  });

  it('a supplied error message wins over the default line', () => {
    const html = render({ isRequired: true, errorMessage: 'Use the name on the statement' });
    expect(html).toContain('>Use the name on the statement<');
    expect(html).not.toContain('to continue');
  });

  it('an invalid Field that is not required shows no default line', () => {
    expect(render({ isInvalid: true })).not.toContain('to continue');
  });
});
