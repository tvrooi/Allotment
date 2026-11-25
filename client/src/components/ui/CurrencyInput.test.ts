import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AmountStyle } from '../../utils/currency';

const AU_STYLE = vi.hoisted((): AmountStyle => ({
  format: 'dot',
  position: 'before',
  symbol: '$',
  minor: 2,
}));

vi.mock('../../utils/currency', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/currency')>();
  return {
    ...actual,
    useAmountStyle: (currency?: string) =>
      currency === 'JPY' ? { ...AU_STYLE, minor: 0 } : AU_STYLE,
  };
});

import { CurrencyInput, readMoneyText } from './CurrencyInput';

type Props = Parameters<typeof CurrencyInput>[0];

const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(CurrencyInput, {
      value: 0,
      onChange: () => {},
      'aria-label': 'Amount',
      ...props,
    } as Props),
  );
const input = (html: string) => html.match(/<input([^>]*)>/)?.[1] ?? '';
const classes = (html: string) => (input(html).match(/class="([^"]*)"/)?.[1] ?? '').split(' ');

describe('CurrencyInput', () => {
  it('shows 0 as empty by default, but as an amount of its own when nullable (03-24 WR-01)', () => {
    const value = (html: string) => input(html).match(/ value="([^"]*)"/)?.[1];
    expect(value(render({ value: 0 }))).toBe('');
    expect(value(render({ nullable: true, value: 0, onChange: () => {} }))).toBe('$0');
    expect(value(render({ nullable: true, value: null, onChange: () => {} }))).toBe('');
    expect(value(render({ nullable: true, value: 1250, onChange: () => {} }))).toBe('$12.50');
  });

  it('draws its placeholder in the tertiary text colour, which meets 4.5:1 (WAVG-02)', () => {
    const cls = classes(render());
    expect(cls).toContain('placeholder:text-text-tertiary');
    expect(cls.join(' ')).not.toMatch(/placeholder(-|:text-)text-disabled/);
  });

  it('stays a text field with the decimal keyboard, so a decimal comma can be typed', () => {
    const tag = input(render());
    expect(tag).toMatch(/ type="text"/);
    expect(tag).toMatch(/ inputMode="decimal"/i);
  });

  it('uses shared fieldHeights so phones get a 44 px target at md and sm sizes', () => {
    const mdCls = classes(render());
    expect(mdCls).toEqual(expect.arrayContaining(['h-10', 'max-md:min-h-11']));
    expect(mdCls).not.toContain('py-2');

    const smCls = classes(render({ fieldSize: 'sm' }));
    expect(smCls).toEqual(expect.arrayContaining(['h-8', 'max-md:min-h-11']));
    expect(smCls).not.toContain('h-10');
  });

  it('forwards a ref to its input as a forwardRef component', () => {
    expect((CurrencyInput as unknown as { $$typeof?: symbol }).$$typeof).toBe(
      Symbol.for('react.forward_ref'),
    );
    const ref = createRef<HTMLInputElement>();
    expect(() =>
      renderToStaticMarkup(
        createElement(CurrencyInput, {
          ref,
          value: 0,
          onChange: () => {},
          'aria-label': 'Amount',
        }),
      ),
    ).not.toThrow();
  });

  it('passes through readOnly, aria-busy, aria-describedby, title and opt-in handlers', () => {
    const tag = input(
      render({
        readOnly: true,
        autoFocus: true,
        'aria-busy': true,
        'aria-describedby': 'planned-save-error',
        title: 'Enter an amount',
        expression: true,
        commitOnBlur: false,
        onTextChange: () => {},
        onKeyDown: () => {},
      }),
    );
    expect(tag).toMatch(/ readonly=""/i);
    expect(tag).toMatch(/ aria-busy="true"/);
    expect(tag).toMatch(/ aria-describedby="planned-save-error"/);
    expect(tag).toMatch(/ title="Enter an amount"/);
  });
});

describe('readMoneyText', () => {
  it('reads sums with expression on and keeps plain amounts working', () => {
    expect(readMoneyText('100+50', AU_STYLE, true)).toBe(15000);
    expect(readMoneyText('12.50', AU_STYLE, true)).toBe(1250);
    expect(readMoneyText('150*2', AU_STYLE, true)).toBe(30000);
    expect(readMoneyText('abc', AU_STYLE, true)).toBeNull();
    expect(readMoneyText('10/0', AU_STYLE, true)).toBeNull();
  });

  it('refuses sums when expression is off or omitted, matching today', () => {
    expect(readMoneyText('100+50', AU_STYLE, false)).toBeNull();
    expect(readMoneyText('100+50', AU_STYLE)).toBeNull();
    expect(readMoneyText('12.50', AU_STYLE, false)).toBe(1250);
    expect(readMoneyText('', AU_STYLE, false)).toBe(0);
  });
});

it.each([
  [0, '0.00'],
  [1, '0.01'],
  [10, '0.10'],
  [99, '0.99'],
  [100, '1.00'],
  [1234, '12.34'],
  [99999999, '999999.99'],
  [-1234, '-12.34'],
  [null, ''],
])('submits a plain AUD decimal for %j', (defaultValue, text) => {
  const html = render({
    name: 'amount',
    currency: 'AUD',
    value: undefined,
    defaultValue,
    allowNegative: true,
  } as Partial<Props>);
  const submitted = html.match(/<input type="hidden" name="amount" value="([^"]*)"/)?.[1];
  expect(submitted).toBe(text);
  if (defaultValue !== null && defaultValue >= 0) {
    const [, dollars, cents] = /^(\d+)\.(\d{2})$/.exec(submitted ?? '') ?? [];
    expect(parseInt(dollars, 10) * 100 + parseInt(cents, 10)).toBe(defaultValue);
  }
});

// Household currency is constrained to AUD by the household route.
it('submits whole yen for a zero-decimal currency', () => {
  const html = render({ name: 'amount', currency: 'JPY', value: undefined, defaultValue: 1234 });
  expect(html).toContain('<input type="hidden" name="amount" value="1234"');
});
