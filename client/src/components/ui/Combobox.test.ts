import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Combobox, SearchListBody } from './Combobox';
import comboboxSource from './Combobox.tsx?raw';
import type { ListGroup, ListOption } from './listItems';

type Props = Parameters<typeof Combobox>[0];
const noop = () => {};
const ACCOUNTS = [
  { value: 'everyday', label: 'Everyday' },
  { value: 'savings', label: 'Savings' },
];
const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(Combobox, {
      label: 'Account',
      items: ACCOUNTS,
      value: '',
      onChange: noop,
      ...props,
    } as Props),
  );

const input = (html: string) => html.match(/<input([^>]*role="combobox"[^>]*)>/)?.[1] ?? '';
const group = (html: string) => html.match(/<div([^>]*role="group"[^>]*)>/)?.[1] ?? '';
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const classes = (tag: string) => (attr(tag, 'class') ?? '').split(' ');

// A type check, run by the client build (tsc -b), not by Vitest: E-03, a Combobox without a
// label or an aria-label has no accessible name, so its props refuse it
// @ts-expect-error a Combobox needs a label or an aria-label
export const unnamed = () => createElement(Combobox, { value: '', onChange: noop, items: [] });

describe('Combobox', () => {
  it('is a text input with the combobox role, named by its visible label', () => {
    const html = render();
    const tag = input(html);
    expect(tag).not.toBe('');
    const labelId = html.match(/<label[^>]*id="([^"]*)"[^>]*>Account/)?.[1];
    expect(labelId).toBeTruthy();
    expect(attr(tag, 'aria-labelledby')?.split(' ')).toContain(labelId);
  });

  it('named only by aria-label, the input carries it', () => {
    const html = render({ label: undefined, 'aria-label': 'Payee' });
    expect(html).not.toContain('<label');
    expect(attr(input(html), 'aria-label')).toBe('Payee');
  });

  it('the group has the field height and look; sm is 32 px', () => {
    expect(classes(group(render()))).toEqual(
      expect.arrayContaining(['h-10', 'rounded-md', 'border', 'border-border']),
    );
    expect(classes(group(render({ fieldSize: 'sm' })))).toContain('h-8');
    expect(classes(group(render({ fieldSize: 'sm' })))).not.toContain('h-10');
  });

  it('shows the placeholder in the tertiary colour', () => {
    const tag = input(render({ placeholder: 'Choose an account' }));
    expect(attr(tag, 'placeholder')).toBe('Choose an account');
    expect(classes(tag)).toContain('placeholder:text-text-tertiary');
  });

  it('shows the chosen option label in the field', () => {
    expect(attr(input(render({ value: 'savings' })), 'value')).toBe('Savings');
  });

  it('disabled, invalid and read-only reach the group and the input', () => {
    expect(group(render({ isDisabled: true }))).toMatch(/ data-disabled="true"/);
    expect(input(render({ isDisabled: true }))).toMatch(/ disabled=""/);
    expect(group(render({ isInvalid: true }))).toMatch(/ data-invalid="true"/);
    expect(attr(input(render({ isInvalid: true })), 'aria-invalid')).toBe('true');
    expect(group(render({ isReadOnly: true }))).toMatch(/ data-readonly="true"/);
    const readOnly = input(render({ isReadOnly: true }));
    expect(readOnly).toMatch(/ readOnly=""/i);
    expect(readOnly).not.toMatch(/ disabled=""/);
    expect(group(render())).not.toMatch(/ data-(invalid|readonly|disabled)=/);
  });

  it('uses no hex colour and no opacity dimming', () => {
    const html = render({ isDisabled: true, isInvalid: true, description: 'Where it was paid' });
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).not.toMatch(/opacity-/);
  });

  it('the description sits under the field and describes the input', () => {
    const html = render({ description: 'Where it was paid' });
    const id = html.match(/id="([^"]*)"[^>]*>Where it was paid/)?.[1];
    expect(id).toBeTruthy();
    expect(attr(input(html), 'aria-describedby')?.split(' ')).toContain(id);
  });

  it('takes extra classes on the input, for a wrapper with its own text size', () => {
    expect(classes(input(render({ inputClassName: 'text-base' })))).toContain('text-base');
  });

  it('uses ListOption and ListGroup from listItems without duplicate Combobox option types (WR-03)', () => {
    const iconOption: ListOption = {
      value: 'p1',
      label: 'Corner Grocery',
      icon: createElement('span', null, 'icon'),
      trailing: createElement('span', null, '3'),
    };
    const grouped: ListGroup = { label: 'Common', options: [iconOption] };
    expect(attr(input(render({ items: [grouped], value: 'p1' })), 'value')).toBe('Corner Grocery');

    expect(comboboxSource).not.toMatch(/\bComboboxOption\b|\bComboboxGroup\b/);
    expect(comboboxSource).toMatch(/from '\.\/listItems'/);
  });
});

describe('Combobox clearing and messages', () => {
  const clear = (html: string) => html.match(/<button[^>]*aria-label="(Clear [^"]*)"/)?.[1];

  it('an optional Combobox with a value has a Clear button named by its visible label', () => {
    const html = render({ optional: true, value: 'savings' });
    expect(clear(html)).toBe('Clear Account');
    expect(html).not.toContain('undefined');
  });

  it('named only by aria-label, the Clear button names that', () => {
    const html = render({
      label: undefined,
      'aria-label': 'Payee',
      optional: true,
      value: 'savings',
    });
    expect(clear(html)).toBe('Clear Payee');
    expect(html).not.toContain('undefined');
  });

  it('errorLabel names the Clear button when given', () => {
    expect(clear(render({ optional: true, value: 'savings', errorLabel: 'the account' }))).toBe(
      'Clear the account',
    );
  });

  it('a caller-owned custom text counts as a value to clear', () => {
    expect(clear(render({ optional: true, allowsCustomValue: true, inputValue: 'Cash jar' }))).toBe(
      'Clear Account',
    );
  });

  it('there is no Clear button with no value, when not optional, disabled or read-only', () => {
    expect(clear(render({ optional: true }))).toBeUndefined();
    expect(clear(render({ value: 'savings' }))).toBeUndefined();
    expect(clear(render({ optional: true, value: 'savings', isDisabled: true }))).toBeUndefined();
    expect(clear(render({ optional: true, value: 'savings', isReadOnly: true }))).toBeUndefined();
  });

  it('the Clear and chevron buttons are 44 px targets on phones', () => {
    const html = render({ optional: true, value: 'savings' });
    const buttons = [...html.matchAll(/<button([^>]*)>/g)].map(([, tag]) => classes(tag));
    expect(buttons).toHaveLength(2);
    for (const button of buttons)
      expect(button).toEqual(expect.arrayContaining(['max-md:min-h-11', 'max-md:min-w-11']));
  });

  it('a required, invalid Combobox with no message names its visible label', () => {
    const html = render({ isRequired: true, isInvalid: true });
    expect(html).toContain('Select Account to continue');
    expect(html).not.toContain('undefined');
  });

  it('a required, invalid Combobox named only by aria-label names that', () => {
    const html = render({
      label: undefined,
      'aria-label': 'Payee',
      isRequired: true,
      isInvalid: true,
    });
    expect(html).toContain('Select Payee to continue');
    expect(html).not.toContain('undefined');
  });

  it('a supplied errorMessage wins over the default line', () => {
    const html = render({ isRequired: true, isInvalid: true, errorMessage: 'Pick a live account' });
    expect(html).toContain('Pick a live account');
    expect(html).not.toContain('to continue');
  });

  // The same rule as Field and the toggles (02-REVIEW WR-05): an empty message counts as none
  it.each(['', false] as const)(
    'a required, invalid Combobox given errorMessage %j shows the default line',
    (errorMessage) => {
      expect(render({ isRequired: true, isInvalid: true, errorMessage })).toContain(
        'Select Account to continue',
      );
    },
  );

  it("fieldClassName replaces the field's box and buttons with the caller's input classes", () => {
    const html = render({ fieldClassName: 'block w-full bg-transparent text-sm' });
    expect(classes(group(html))).toEqual(['w-full']);
    expect(classes(input(html))).toEqual([
      'min-w-0',
      'flex-1',
      'block',
      'w-full',
      'bg-transparent',
      'text-sm',
    ]);
    expect(html).not.toContain('<button');
  });
});

type BodyProps = Parameters<typeof SearchListBody>[0];
const SECTIONS: BodyProps['sections'] = [
  {
    id: 'everyday',
    heading: 'Everyday',
    options: [
      { value: 'groceries', label: 'Groceries' },
      { value: 'fuel', label: 'Fuel' },
    ],
  },
  { id: 'bills', heading: 'Bills', options: [{ value: 'rent', label: 'Rent' }] },
  { id: 'empty', heading: 'Nothing here', options: [] },
];
const renderBody = (props: Partial<BodyProps> = {}) =>
  renderToStaticMarkup(
    createElement(SearchListBody, {
      searchLabel: 'Search categories',
      searchPlaceholder: 'Search categories...',
      query: '',
      onQueryChange: noop,
      sections: SECTIONS,
      value: null,
      onPick: noop,
      emptyText: 'No categories found',
      onClose: noop,
      ...props,
    }),
  );
const options = (html: string) =>
  [...html.matchAll(/<div[^>]*role="option"[^>]*>/g)].map((m) => m[0]);

describe('SearchList', () => {
  it('the search field is a text input (role textbox), named and with its placeholder', () => {
    const tag = renderBody().match(/<input([^>]*)>/)?.[1] ?? '';
    expect(attr(tag, 'type')).toBe('text');
    expect(attr(tag, 'role')).toBeUndefined();
    expect(attr(tag, 'aria-label')).toBe('Search categories');
    expect(attr(tag, 'placeholder')).toBe('Search categories...');
  });

  it('each section is a group named by its heading, in the order given; an empty one is left out', () => {
    const html = renderBody();
    expect(html).toContain('role="listbox"');
    const groups = [...html.matchAll(/role="group" aria-labelledby="([^"]*)"/g)].map((m) => m[1]);
    expect(groups).toHaveLength(2);
    const headings = groups.map((id) => html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`))?.[1]);
    expect(headings).toEqual(['Everyday', 'Bills']);
    expect(html).not.toContain('Nothing here');
    expect(html.indexOf('Groceries')).toBeLessThan(html.indexOf('Fuel'));
    expect(html.indexOf('Fuel')).toBeLessThan(html.indexOf('Rent'));
  });

  it('the headings are small medium-weight tertiary text on surface-alt', () => {
    const tag = renderBody().match(/<div([^>]*role="presentation"[^>]*)>Everyday/)?.[1] ?? '';
    expect(classes(tag)).toEqual(
      expect.arrayContaining(['text-xs', 'font-medium', 'text-text-tertiary', 'bg-surface-alt']),
    );
  });

  it('the chosen option is selected and ticked; options use the shared option classes', () => {
    const html = renderBody({ value: 'fuel' });
    const rows = options(html);
    expect(rows).toHaveLength(3);
    const fuel = rows.find((r) => r.includes('aria-selected="true"')) ?? '';
    expect(fuel).toMatch(/ data-selected="true"/);
    expect(classes(fuel)).toContain('data-[selected]:bg-brand-50');
    expect(rows.filter((r) => r.includes('aria-selected="true"'))).toHaveLength(1);
    expect(html.match(/lucide-check/g)).toHaveLength(1);
  });

  it('with nothing typed nothing is highlighted; with a search typed the first option is', () => {
    const idle = renderBody();
    expect(idle).not.toContain('aria-activedescendant');
    expect(idle).not.toContain('data-focused');
    const typed = renderBody({ query: 'r' });
    const first = options(typed)[0];
    expect(first).toMatch(/ data-focused="true"/);
    expect(attr(typed.match(/<input([^>]*)>/)?.[1] ?? '', 'aria-activedescendant')).toBe(
      attr(first, 'id'),
    );
  });

  it('the pinned row is the first option; while searching the first section option is highlighted instead', () => {
    const pinned = {
      label: 'Uncategorised',
      isSelected: true,
      onPick: noop,
      inKeyboardOrder: false,
    };
    const html = renderBody({ query: 'r', pinned });
    const rows = options(html);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatch(/aria-selected="true"/);
    expect(rows[0]).not.toMatch(/data-focused/);
    expect(rows[1]).toMatch(/ data-focused="true"/);
    // When the caller puts it in the keyboard order, a typed search highlights it first
    const reachable = renderBody({ query: 'r', pinned: { ...pinned, inKeyboardOrder: true } });
    expect(options(reachable)[0]).toMatch(/ data-focused="true"/);
  });

  it('the empty text shows when no section has an option, even with the pinned row', () => {
    const empty = SECTIONS.map((s) => ({ ...s, options: [] }));
    const pinned = {
      label: 'Uncategorised',
      isSelected: false,
      onPick: noop,
      inKeyboardOrder: true,
    };
    const html = renderBody({ sections: empty, pinned, query: 'zzz' });
    expect(html).toContain('No categories found');
    expect(options(html)).toHaveLength(1);
    expect(renderBody()).not.toContain('No categories found');
  });

  it('the footer sits below the list, outside it', () => {
    const html = renderBody({
      footer: createElement('button', { type: 'button' }, 'Create new category'),
    });
    const listEnd = html.lastIndexOf('role="option"');
    expect(html.indexOf('Create new category')).toBeGreaterThan(listEnd);
    expect(html.match(/role="listbox"[\s\S]*Create new category/)).toBeTruthy();
  });

  it('uses no hex colour and no opacity dimming', () => {
    const html = renderBody({
      value: 'rent',
      query: 'e',
      pinned: { label: 'Uncategorised', isSelected: false, onPick: noop, inKeyboardOrder: false },
      footer: 'Footer',
    });
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/opacity-/);
  });
});
