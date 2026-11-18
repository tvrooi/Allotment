import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

// useIsPhone reads matchMedia, which server rendering has not got: it reports desktop unless a
// test says it is a phone
const screen = vi.hoisted(() => ({ phone: false }));
vi.mock('../../hooks/useIsPhone', () => ({ useIsPhone: () => screen.phone }));
afterEach(() => {
  screen.phone = false;
});

type Props = Parameters<typeof Select>[0];
const noop = () => {};
const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];
const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(Select, {
      label: 'Frequency',
      value: '',
      onChange: noop,
      options: FREQUENCIES,
      ...props,
    } as Props),
  );

const trigger = (html: string) => html.match(/<button([^>]*)>/)?.[1] ?? '';
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const classes = (tag: string) => (attr(tag, 'class') ?? '').split(' ');

// A type check, run by the client build (tsc -b), not by Vitest: E-03, a Select without a
// label or an aria-label has no accessible name, so its props refuse it
// @ts-expect-error a Select needs a label or an aria-label
export const unnamed = () => createElement(Select, { value: '', onChange: noop, options: [] });

describe('Select on desktop', () => {
  it('is a button trigger with the field height, and no native select the person can see', () => {
    const html = render();
    const button = trigger(html);
    expect(attr(button, 'aria-haspopup')).toBe('listbox');
    expect(classes(button)).toEqual(expect.arrayContaining(['h-10', 'rounded-md', 'border']));
    // React Aria keeps a hidden native select for forms and autofill, inside an aria-hidden box
    for (const select of html.matchAll(/<select/g)) {
      const before = html.slice(0, select.index);
      expect(before.lastIndexOf('aria-hidden="true"')).toBeGreaterThan(
        before.lastIndexOf('<button'),
      );
    }
  });

  it('labels it with a span, and shows the placeholder in the tertiary colour', () => {
    const html = render({ placeholder: 'Choose how often' });
    expect(html).toMatch(/<span[^>]*id="[^"]*"[^>]*>Frequency/);
    expect(html).not.toMatch(/<label[^>]*>Frequency/);
    expect(html).toMatch(/<span[^>]*class="[^"]*text-text-tertiary[^"]*"[^>]*>Choose how often/);
  });

  // Never React Aria's own "Select an item" (02-UI-REVIEW top fix 3)
  it('with no placeholder given, an unset Select shows "Select one" in the tertiary colour', () => {
    const html = render();
    expect(html).toMatch(/<span[^>]*class="[^"]*text-text-tertiary[^"]*"[^>]*>Select one</);
    expect(html).not.toContain('Select an item');
  });

  it('shows the chosen label, not the placeholder', () => {
    const html = render({ value: 'monthly', placeholder: 'Choose how often' });
    expect(html).toContain('Monthly');
    expect(html).not.toContain('Choose how often');
  });

  it('fieldSize sm gives the 32 px height', () => {
    expect(classes(trigger(render({ fieldSize: 'sm' })))).toContain('h-8');
    expect(classes(trigger(render({ fieldSize: 'sm' })))).not.toContain('h-10');
  });

  it('disabled, invalid and read-only reach the trigger as attributes', () => {
    expect(trigger(render({ isDisabled: true }))).toMatch(/ data-disabled="true"/);
    expect(trigger(render({ isDisabled: true }))).toMatch(/ disabled=""/);
    expect(trigger(render({ isInvalid: true }))).toMatch(/ data-invalid="true"/);
    const readOnly = trigger(render({ isReadOnly: true }));
    expect(readOnly).toMatch(/ data-readonly="true"/);
    // Not on a button: WAI-ARIA gives role button no aria-readonly
    expect(readOnly).not.toMatch(/ aria-readonly=/);
    // Read-only stays focusable: it is never disabled
    expect(readOnly).not.toMatch(/ disabled=""/);
    expect(trigger(render())).not.toMatch(/ data-(invalid|readonly|disabled)=/);
  });

  it('uses no hex colour and no opacity dimming', () => {
    const html = render({ isDisabled: true, isInvalid: true, description: 'How often it repeats' });
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).not.toMatch(/opacity-/);
  });

  it('a required, invalid Select with no message names its visible label', () => {
    const html = render({ label: 'Account type', isRequired: true, isInvalid: true });
    expect(html).toContain('Select Account type to continue');
    expect(html).not.toContain('undefined');
  });

  it('a required, invalid Select named only by aria-label names that', () => {
    const html = renderToStaticMarkup(
      createElement(Select, {
        'aria-label': 'Frequency',
        value: '',
        onChange: noop,
        options: FREQUENCIES,
        isRequired: true,
        isInvalid: true,
      }),
    );
    expect(html).toContain('Select Frequency to continue');
    expect(html).not.toContain('undefined');
  });

  it('errorLabel names the subject, and a supplied errorMessage wins', () => {
    expect(
      render({ label: 'Type', errorLabel: 'an account type', isRequired: true, isInvalid: true }),
    ).toContain('Select an account type to continue');
    const html = render({ isRequired: true, isInvalid: true, errorMessage: 'Pick one we support' });
    expect(html).toContain('Pick one we support');
    expect(html).not.toContain('to continue');
  });

  // The same rule as Field and the toggles (02-REVIEW WR-05): an empty message counts as none,
  // so it neither hides the default line nor leaves an empty error element and its gap
  it.each(['', false] as const)(
    'a required, invalid Select given errorMessage %j shows the default line',
    (errorMessage) => {
      const html = render({
        label: 'Account type',
        isRequired: true,
        isInvalid: true,
        errorMessage,
      });
      expect(html).toContain('Select Account type to continue');
    },
  );

  it.each(['', false] as const)(
    'an optional Select given errorMessage %j has no error element',
    (errorMessage) => {
      const html = render({ isInvalid: true, errorMessage });
      expect(html).not.toContain('slot="errorMessage"');
      expect(html).not.toContain('FieldError');
    },
  );

  it('the description sits under the trigger and describes it', () => {
    const html = render({ description: 'How often it repeats' });
    const id = html.match(/id="([^"]*)"[^>]*>How often it repeats/)?.[1];
    expect(id).toBeTruthy();
    expect(attr(trigger(html), 'aria-describedby')?.split(' ')).toContain(id);
  });
});

describe('Select on phones', () => {
  const phone = (props: Partial<Props> = {}) => {
    screen.phone = true;
    return render(props);
  };
  const select = (html: string) => html.match(/<select([^>]*)>/)?.[1] ?? '';
  const optionTags = (html: string) => [...html.matchAll(/<option([^>]*)>([^<]*)</g)];

  it('is a native select inside its label, 44 px tall with 16 px text, and no trigger', () => {
    const html = phone();
    expect(html).not.toContain('<button');
    expect(html).toMatch(/^<div[^>]*><label[^>]*><span[^>]*>Frequency<\/span><select/);
    expect(classes(select(html))).toEqual(
      expect.arrayContaining(['min-h-11', 'text-base', 'rounded-md', 'border', 'w-full']),
    );
  });

  it('with no placeholder given, its unset first option reads "Select one"', () => {
    const [first] = optionTags(phone());
    expect(first[1]).toMatch(/ value=""/);
    expect(first[2]).toBe('Select one');
  });

  it('shows the placeholder as a first, empty-valued option, and groups as optgroups', () => {
    const html = phone({
      placeholder: 'Choose a type',
      options: [
        { label: 'Cash', options: [{ value: 'savings', label: 'Savings' }] },
        { label: 'Credit', options: [{ value: 'loan', label: 'Loan' }] },
      ],
    });
    const options = optionTags(html);
    expect(options[0][1]).toMatch(/ value=""/);
    expect(options[0][2]).toBe('Choose a type');
    expect(html).toMatch(/<optgroup label="Cash"><option value="savings"[^>]*>Savings/);
    expect(html).toMatch(/<optgroup label="Credit"><option value="loan"[^>]*>Loan/);
    expect(classes(select(html))).toContain('text-text-tertiary');
  });

  it('a chosen value is selected and the placeholder kept out of the way', () => {
    const html = phone({ value: 'monthly' });
    expect(html).toMatch(/<option value="monthly" selected="">Monthly/);
    expect(optionTags(html).map(([, , text]) => text)).toEqual(['Weekly', 'Monthly']);
    expect(classes(select(html))).not.toContain('text-text-tertiary');
  });

  it('disabled, required and invalid reach the select, with the default line under it', () => {
    expect(select(phone({ isDisabled: true }))).toMatch(/ disabled=""/);
    const html = phone({ label: 'Account type', isRequired: true, isInvalid: true });
    const tag = select(html);
    expect(tag).toMatch(/ required=""/);
    expect(attr(tag, 'aria-invalid')).toBe('true');
    const errorId = html.match(/id="([^"]*)"[^>]*>Select Account type to continue/)?.[1];
    expect(errorId).toBeTruthy();
    expect(attr(tag, 'aria-describedby')?.split(' ')).toContain(errorId);
    expect(html).not.toContain('undefined');
  });

  it('named only by aria-label, it has no label element and names that in its line', () => {
    screen.phone = true;
    const html = renderToStaticMarkup(
      createElement(Select, {
        'aria-label': 'Frequency',
        value: '',
        onChange: noop,
        options: FREQUENCIES,
        isRequired: true,
        isInvalid: true,
      }),
    );
    expect(html).not.toContain('<label');
    expect(attr(select(html), 'aria-label')).toBe('Frequency');
    expect(html).toContain('Select Frequency to continue');
  });

  it('read-only stays focusable, and only the chosen option can be picked', () => {
    const html = phone({ value: 'monthly', isReadOnly: true });
    const tag = select(html);
    expect(tag).not.toMatch(/ disabled=""/);
    expect(attr(tag, 'aria-readonly')).toBe('true');
    expect(attr(tag, 'data-readonly')).toBe('true');
    expect(html).toMatch(/<option value="weekly" disabled="">/);
    expect(html).not.toMatch(/<option value="monthly"[^>]*disabled/);
  });

  it('the description sits under the select and describes it', () => {
    const html = phone({ description: 'How often it repeats' });
    const id = html.match(/id="([^"]*)"[^>]*>How often it repeats/)?.[1];
    expect(id).toBeTruthy();
    expect(attr(select(html), 'aria-describedby')?.split(' ')).toContain(id);
  });
});
