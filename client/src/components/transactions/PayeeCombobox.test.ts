import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Payee } from '../../types';
import { isNewPayee, PayeeCombobox, payeeSuggestions } from './PayeeCombobox';

const payee = (name: string, i: number): Payee => ({
  id: `payee-${i}`,
  name,
  defaultCategoryId: null,
  logo: null,
  skipCategoryFollowup: 0,
  createdAt: '2026-11-18T00:00:00.000Z',
});

/** Twelve payees, in the order a caller gives them (not alphabetical) */
const PAYEES = [
  'Corner Grocery',
  'Fuel Stop',
  'Groceries Direct',
  'Bäckerei Müller',
  'Corner Bakery',
  'Streamflix',
  'City Council',
  'Gym Co',
  'Pharmacy',
  'Bookshop',
  'Corner Café',
  'Zoo',
].map(payee);

const names = (list: Payee[]) => list.map((p) => p.name);

describe('payeeSuggestions', () => {
  it('with no text, the first eight in the order given', () => {
    expect(names(payeeSuggestions(PAYEES, ''))).toEqual(names(PAYEES.slice(0, 8)));
  });

  it('with text, at most eight whose lower-cased name contains it, in the order given', () => {
    expect(names(payeeSuggestions(PAYEES, 'corner'))).toEqual([
      'Corner Grocery',
      'Corner Bakery',
      'Corner Café',
    ]);
    // 'gRoCeR' finds both grocers whatever its letter case
    expect(names(payeeSuggestions(PAYEES, 'gRoCeR'))).toEqual([
      'Corner Grocery',
      'Groceries Direct',
    ]);
    const many = Array.from({ length: 12 }, (_, i) => payee(`Shop ${i}`, i));
    expect(payeeSuggestions(many, 'shop')).toHaveLength(8);
  });

  it('accents count: "backerei" does not find "Bäckerei Müller"', () => {
    expect(payeeSuggestions(PAYEES, 'backerei')).toEqual([]);
    expect(names(payeeSuggestions(PAYEES, 'bäckerei'))).toEqual(['Bäckerei Müller']);
  });
});

describe('isNewPayee', () => {
  it('text that is no payee is new, also when nothing matches at all', () => {
    expect(isNewPayee(PAYEES, 'Corner')).toBe(true);
    expect(isNewPayee(PAYEES, 'Night Market')).toBe(true);
  });

  it('an exact match in any letter case is not new, and no text is not new', () => {
    expect(isNewPayee(PAYEES, 'Corner Grocery')).toBe(false);
    expect(isNewPayee(PAYEES, 'CORNER GROCERY')).toBe(false);
    expect(isNewPayee(PAYEES, 'bäckerei müller')).toBe(false);
    expect(isNewPayee(PAYEES, '')).toBe(false);
  });
});

describe('PayeeCombobox', () => {
  const render = (props: Partial<Parameters<typeof PayeeCombobox>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(PayeeCombobox, {
        value: { id: null, name: 'Bäckerei Ünal' },
        onChange: () => {},
        payees: PAYEES,
        id: 'tx-payee',
        ...props,
      }),
    );
  const input = (html: string) => html.match(/<input([^>]*)>/)?.[1] ?? '';
  const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];

  it('is a combobox named "Payee", with the placeholder "Payee" and the given id', () => {
    const tag = input(render());
    expect(attr(tag, 'role')).toBe('combobox');
    expect(attr(tag, 'aria-label')).toBe('Payee');
    expect(attr(tag, 'placeholder')).toBe('Payee');
    expect(attr(tag, 'id')).toBe('tx-payee');
  });

  it('shows the name exactly as given, non-ASCII letters included', () => {
    expect(attr(input(render()), 'value')).toBe('Bäckerei Ünal');
  });

  it("is bare in the row, keeps the panel's classes, and takes the sheet's in their place", () => {
    const row = attr(input(render()), 'class')!.split(' ');
    expect(row).toEqual(expect.arrayContaining(['bg-transparent', 'text-sm']));
    expect(row).not.toContain('border');
    const panel = attr(input(render({ className: 'border rounded-lg px-3 py-2' })), 'class');
    expect(panel?.split(' ')).toEqual(expect.arrayContaining(['bg-transparent', 'border', 'px-3']));
    const sheet = attr(input(render({ fieldClassName: 'w-full text-base border' })), 'class');
    expect(sheet?.split(' ')).toEqual(['min-w-0', 'flex-1', 'w-full', 'text-base', 'border']);
  });

  // The global focus outline is in @layer base, so focus:outline-none wins over it: the bare field
  // in the register row and the detail panel must draw its own focus mark (plan 02-12)
  it('the bare field shows a focus ring of its own, in the row and the panel', () => {
    for (const html of [render(), render({ className: 'border rounded-lg px-3 py-2' })])
      expect(attr(input(html), 'class')?.split(' ')).toEqual(
        expect.arrayContaining(['focus-visible:ring-2', 'focus-visible:ring-brand-600']),
      );
  });
});
