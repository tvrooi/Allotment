import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CurrencyInput } from './CurrencyInput';

const render = () =>
  renderToStaticMarkup(
    createElement(CurrencyInput, { value: 0, onChange: () => {}, 'aria-label': 'Amount' }),
  );
const input = (html: string) => html.match(/<input([^>]*)>/)?.[1] ?? '';

describe('CurrencyInput', () => {
  it('draws its placeholder in the tertiary text colour, which meets 4.5:1 (WAVG-02)', () => {
    const cls =
      input(render())
        .match(/class="([^"]*)"/)?.[1]
        .split(' ') ?? [];
    expect(cls).toContain('placeholder:text-text-tertiary');
    expect(cls.join(' ')).not.toMatch(/placeholder(-|:text-)text-disabled/);
  });

  it('stays a text field with the decimal keyboard, so a decimal comma can be typed', () => {
    const tag = input(render());
    expect(tag).toMatch(/ type="text"/);
    expect(tag).toMatch(/ inputMode="decimal"/i);
  });
});
