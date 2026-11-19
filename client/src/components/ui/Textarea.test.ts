import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Input } from './Input';
import { Textarea } from './Textarea';

type Props = Parameters<typeof Textarea>[0];
const render = (props: Props = {}) => renderToStaticMarkup(createElement(Textarea, props));
const textarea = (html: string) => html.match(/<textarea([^>]*)>/)?.[1] ?? '';
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const classes = (html: string) => (attr(textarea(html), 'class') ?? '').split(' ');

describe('Textarea', () => {
  it('is three rows, at least 80 px, resizes vertically only, with a tertiary placeholder', () => {
    const html = render({ 'aria-label': 'Notes' });
    expect(attr(textarea(html), 'rows')).toBe('3');
    expect(classes(html)).toEqual(
      expect.arrayContaining([
        'w-full',
        'min-h-20',
        'py-2',
        'px-3',
        'resize-y',
        'text-sm',
        'max-md:text-base',
        'placeholder:text-text-tertiary',
        'outline-none',
      ]),
    );
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).not.toMatch(/opacity-/);
  });

  it("has Input's border, radius, focus ring and state classes", () => {
    const input = renderToStaticMarkup(createElement(Input, { 'aria-label': 'Payee' }));
    const inputClasses = (input.match(/class="([^"]*)"/)?.[1] ?? '').split(' ');
    const own = new Set(['h-10', 'max-md:min-h-11']);
    expect(classes(render())).toEqual(
      expect.arrayContaining(inputClasses.filter((cls) => !own.has(cls))),
    );
  });

  it('a caller can set the rows and add a class', () => {
    const html = render({ rows: 6, className: 'w-64' });
    expect(attr(textarea(html), 'rows')).toBe('6');
    expect(classes(html)).toContain('w-64');
    expect(classes(html)).not.toContain('w-full');
  });

  it('isInvalid marks it invalid; disabled and read-only pass through', () => {
    expect(attr(textarea(render({ isInvalid: true })), 'aria-invalid')).toBe('true');
    expect(textarea(render())).not.toMatch(/ aria-invalid=/);
    expect(textarea(render({ disabled: true }))).toMatch(/ disabled=""/);
    expect(textarea(render({ readOnly: true }))).toMatch(/ readonly=""/i);
  });

  it('an empty value renders an empty box and reaches onChange unchanged', () => {
    const onChange = () => {};
    expect(render({ value: '', onChange })).toMatch(/<textarea[^>]*><\/textarea>/);
    // forwardRef's render gives the element it draws: the caller's handler, not a wrapper that
    // could turn '' into null
    const element = (
      Textarea as unknown as { render: (p: Props, r: null) => ReactElement<Props> }
    ).render({ value: '', onChange }, null);
    expect(element.props.onChange).toBe(onChange);
    expect(element.props.value).toBe('');
  });

  it("inside a Field it is labelled by the Field's label and described by its help and error", () => {
    const html = renderToStaticMarkup(
      createElement(Field, {
        label: 'Notes',
        description: 'Only you see these',
        errorMessage: 'Too long',
        children: createElement(Textarea),
      }),
    );
    const tag = textarea(html);
    const id = attr(tag, 'id');
    expect(id).toBeTruthy();
    expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>Notes`));
    const describedBy = attr(tag, 'aria-describedby')?.split(' ') ?? [];
    expect(describedBy).toContain(html.match(/id="([^"]*)"[^>]*>Only you see these/)?.[1]);
    expect(describedBy).toContain(html.match(/id="([^"]*)"[^>]*>Too long/)?.[1]);
    expect(attr(tag, 'aria-invalid')).toBe('true');
  });
});
