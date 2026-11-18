import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Input, Select } from './Input';

type Props = Parameters<typeof Input>[0];
const render = (props: Props = {}) => renderToStaticMarkup(createElement(Input, props));
const classes = (html: string) => (html.match(/class="([^"]*)"/)?.[1] ?? '').split(' ');

describe('Input', () => {
  it('is full width, 40 px tall (44 px on phones) with 16 px phone text and a tertiary placeholder', () => {
    const cls = classes(render({ 'aria-label': 'Payee' }));
    expect(cls).toEqual(
      expect.arrayContaining([
        'w-full',
        'h-10',
        'max-md:min-h-11',
        'text-sm',
        'max-md:text-base',
        'placeholder:text-text-tertiary',
        'outline-none',
      ]),
    );
  });

  it('fieldSize="sm" is 32 px tall and keeps the 44 px phone target', () => {
    const cls = classes(render({ 'aria-label': 'Search', fieldSize: 'sm' }));
    expect(cls).toContain('h-8');
    expect(cls).not.toContain('h-10');
    expect(cls).toContain('max-md:min-h-11');
  });

  it("a caller's className is added to the field's classes, not substituted", () => {
    const cls = classes(render({ 'aria-label': 'Rate', className: 'w-20 text-right' }));
    expect(cls).toEqual(expect.arrayContaining(['w-20', 'text-right', 'h-10', 'border-border']));
    expect(cls).not.toContain('w-full');
  });

  it('passes native attributes through, so a password stays masked', () => {
    const html = render({
      type: 'password',
      autoComplete: 'current-password',
      name: 'password',
      'aria-label': 'Password',
    });
    expect(html).toMatch(/ type="password"/);
    expect(html).toMatch(/ autoComplete="current-password"|autocomplete="current-password"/);
    expect(html).toMatch(/ name="password"/);
  });

  it('isInvalid sets aria-invalid; without it there is none', () => {
    expect(render({ 'aria-label': 'Payee', isInvalid: true })).toMatch(/ aria-invalid="true"/);
    expect(render({ 'aria-label': 'Payee' })).not.toMatch(/ aria-invalid=/);
  });

  it('has a look for disabled, read-only and invalid, with no opacity and no hex colour', () => {
    const cls = classes(render({ 'aria-label': 'Payee' })).join(' ');
    expect(cls).toMatch(/disabled:bg-surface-alt/);
    expect(cls).toMatch(/disabled:text-text-disabled/);
    expect(cls).toMatch(/disabled:cursor-not-allowed/);
    expect(cls).toMatch(/\[readonly\]\]:bg-surface-alt\/60/);
    expect(cls).toMatch(/aria-invalid:border-negative/);
    expect(cls).not.toMatch(/opacity-/);
    for (const props of [{}, { disabled: true }, { readOnly: true }, { isInvalid: true }])
      expect(render({ 'aria-label': 'Payee', ...props })).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  it('the native Select is still exported and renders a select', () => {
    const html = renderToStaticMarkup(
      createElement(Select, { 'aria-label': 'Account' }, createElement('option', null, 'Everyday')),
    );
    expect(html).toMatch(/^<select/);
    expect(html).toContain('<option>Everyday</option>');
  });
});
