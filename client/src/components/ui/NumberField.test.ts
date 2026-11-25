import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NumberField } from './NumberField';

type Props = Parameters<typeof NumberField>[0];

const render = (overrides: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(NumberField, {
      label: 'Repeats every (months)',
      value: 12,
      onChange: vi.fn(),
      min: 1,
      max: 60,
      ...overrides,
    }),
  );

const inputTag = (html: string) => html.match(/<input([^>]*)>/)?.[1] ?? '';
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`, 'i'))?.[1];

describe('NumberField', () => {
  it('renders a numeric text input with label, value and no aria-invalid in bounds', () => {
    const html = render();
    const input = inputTag(html);
    const id = attr(input, 'id');
    expect(id).toBeTruthy();
    expect(attr(input, 'type')).toBe('text');
    expect(attr(input, 'inputmode')).toBe('numeric');
    expect(attr(input, 'value')).toBe('12');
    expect(attr(input, 'aria-invalid')).toBeUndefined();
    expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>Repeats every \\(months\\)`));
  });

  it('uses inputmode="decimal" when allowDecimal is true', () => {
    const html = render({
      label: 'Split percentage',
      value: 33.33,
      min: 0,
      max: 100,
      allowDecimal: true,
    });
    const input = inputTag(html);
    expect(attr(input, 'type')).toBe('text');
    expect(attr(input, 'inputmode')).toBe('decimal');
    expect(attr(input, 'value')).toBe('33.33');
    expect(attr(input, 'aria-invalid')).toBeUndefined();
  });

  it('marks aria-invalid and shows the range message when the value is outside bounds', () => {
    const html = render({ value: 61, min: 1, max: 60 });
    const input = inputTag(html);
    expect(attr(input, 'aria-invalid')).toBe('true');
    expect(attr(input, 'value')).toBe('61');
    expect(html).toContain('Enter a whole number from 1 to 60.');
    const errorId = html.match(
      /id="([^"]*)"[^>]*><span role="alert">Enter a whole number from 1 to 60\.<\/span>/,
    )?.[1];
    expect(errorId).toBeTruthy();
    expect(attr(input, 'aria-describedby')?.split(' ')).toContain(errorId);
  });

  it('uses percentRangeMessage for invalid decimals and supports custom errorMessage', () => {
    const decimalHtml = render({
      label: 'Split percentage',
      value: 101,
      min: 0,
      max: 100,
      allowDecimal: true,
    });
    expect(attr(inputTag(decimalHtml), 'aria-invalid')).toBe('true');
    expect(decimalHtml).toContain('Enter a percentage from 0% to 100%.');

    const customHtml = render({
      label: 'Last year',
      value: 1800,
      min: 1900,
      max: 2300,
      optional: true,
      errorMessage: 'Enter a whole year between 1900 and 2300, or leave this blank.',
    });
    expect(attr(inputTag(customHtml), 'aria-invalid')).toBe('true');
    expect(customHtml).toContain('Enter a whole year between 1900 and 2300, or leave this blank.');
  });

  it('uses wholeNumberMinMessage when max is Infinity', () => {
    const html = render({
      label: 'Custom length number',
      value: 0,
      min: 1,
      max: Infinity,
    });
    expect(attr(inputTag(html), 'aria-invalid')).toBe('true');
    expect(html).toContain('Enter a whole number of 1 or more.');
  });

  it('treats blank null value as valid when optional and invalid when required', () => {
    const optionalHtml = render({ value: null, optional: true });
    const optionalInput = inputTag(optionalHtml);
    expect(attr(optionalInput, 'value')).toBe('');
    expect(attr(optionalInput, 'aria-invalid')).toBeUndefined();
    expect(optionalHtml).not.toContain('Enter a whole number');

    const requiredHtml = render({ value: null, optional: false });
    const requiredInput = inputTag(requiredHtml);
    expect(attr(requiredInput, 'value')).toBe('');
    expect(attr(requiredInput, 'aria-invalid')).toBe('true');
    expect(requiredHtml).toContain('Enter a whole number from 1 to 60.');
  });

  it('renders an aria-hidden suffix adornment with right padding on the input', () => {
    const html = render({
      label: 'Split percentage',
      value: 50,
      min: 0,
      max: 100,
      allowDecimal: true,
      suffix: '%',
    });
    const input = inputTag(html);
    expect(attr(input, 'class')).toContain('pr-8');
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>%<\/span>/);
  });

  it('supports fieldSize="sm", description, isDisabled and custom id', () => {
    const html = render({
      fieldSize: 'sm',
      description: 'Between 1 and 60 months',
      isDisabled: true,
      id: 'cycle-months',
    });
    const input = inputTag(html);
    expect(attr(input, 'class')).toContain('h-8');
    expect(input).toMatch(/ disabled=""/);
    expect(attr(input, 'id')).toBe('cycle-months');
    expect(html).toContain('Between 1 and 60 months');
  });

  it('announces range errors with role="alert" while keeping aria-describedby linkage (WR-01)', () => {
    const validHtml = render({ value: 12, min: 1, max: 60 });
    expect(validHtml).not.toContain('role="alert"');

    const invalidHtml = render({ value: 61, min: 1, max: 60 });
    const input = inputTag(invalidHtml);
    const describedBy = attr(input, 'aria-describedby')?.split(' ') ?? [];
    const errorSpan = invalidHtml.match(
      /<span[^>]*id="([^"]*)"[^>]*><span role="alert">Enter a whole number from 1 to 60\.<\/span><\/span>/,
    );
    expect(errorSpan).toBeTruthy();
    expect(describedBy).toContain(errorSpan?.[1]);
  });
});
