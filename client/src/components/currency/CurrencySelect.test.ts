import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Select } from '../ui/Select';
import { CurrencySelect } from './CurrencySelect';

const screen = vi.hoisted(() => ({ phone: false }));
vi.mock('../../hooks/useIsPhone', () => ({ useIsPhone: () => screen.phone }));
afterEach(() => {
  screen.phone = false;
});

const noop = () => {};
const trigger = (html: string) => html.match(/<button([^>]*)>/)?.[1] ?? '';
const select = (html: string) => html.match(/<select([^>]*)>/)?.[1] ?? '';
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const rootClasses = (html: string) =>
  (attr(html.match(/<div([^>]*flex flex-col[^>]*)>/)?.[1] ?? '', 'class') ?? '').split(' ');

describe('CurrencySelect aria-describedby (WR-01)', () => {
  it('forwards aria-describedby to the trigger button on desktop', () => {
    const html = renderToStaticMarkup(
      createElement(CurrencySelect, {
        value: 'EUR',
        onChange: noop,
        'aria-describedby': 'add-account-currency-hint',
      }),
    );
    expect(attr(trigger(html), 'aria-describedby')?.split(' ')).toContain(
      'add-account-currency-hint',
    );
  });

  it('forwards aria-describedby to the native select on phones', () => {
    screen.phone = true;
    const html = renderToStaticMarkup(
      createElement(CurrencySelect, {
        value: 'EUR',
        onChange: noop,
        'aria-describedby': 'edit-account-currency-hint',
      }),
    );
    expect(attr(select(html), 'aria-describedby')?.split(' ')).toContain(
      'edit-account-currency-hint',
    );
  });

  it('merges external aria-describedby with Select description on desktop and phone', () => {
    const options = [{ value: 'EUR', label: 'EUR · Euro' }];

    const desktopHtml = renderToStaticMarkup(
      createElement(Select, {
        label: 'Currency',
        value: 'EUR',
        onChange: noop,
        options,
        description: 'Internal help',
        'aria-describedby': 'external-hint',
      }),
    );
    const desktopDescId = desktopHtml.match(/id="([^"]*)"[^>]*>Internal help/)?.[1];
    expect(desktopDescId).toBeTruthy();
    expect(attr(trigger(desktopHtml), 'aria-describedby')?.split(' ')).toEqual(
      expect.arrayContaining([desktopDescId, 'external-hint']),
    );

    screen.phone = true;
    const phoneHtml = renderToStaticMarkup(
      createElement(Select, {
        label: 'Currency',
        value: 'EUR',
        onChange: noop,
        options,
        description: 'Internal help',
        'aria-describedby': 'external-hint',
      }),
    );
    const phoneDescId = phoneHtml.match(/id="([^"]*)"[^>]*>Internal help/)?.[1];
    expect(phoneDescId).toBeTruthy();
    expect(attr(select(phoneHtml), 'aria-describedby')?.split(' ')).toEqual(
      expect.arrayContaining([phoneDescId, 'external-hint']),
    );
  });
});

describe('CurrencySelect width class (WR-02)', () => {
  it('keeps w-full when given max-w-* or min-w-* classes (CurrencySettings max-w-xs)', () => {
    const maxWidth = renderToStaticMarkup(
      createElement(CurrencySelect, { value: 'EUR', onChange: noop, className: 'max-w-xs' }),
    );
    expect(rootClasses(maxWidth)).toEqual(expect.arrayContaining(['w-full', 'max-w-xs']));

    const minWidth = renderToStaticMarkup(
      createElement(CurrencySelect, { value: 'EUR', onChange: noop, className: 'min-w-0' }),
    );
    expect(rootClasses(minWidth)).toEqual(expect.arrayContaining(['w-full', 'min-w-0']));
  });

  it('drops w-full only when an explicit standalone w-* class is passed', () => {
    const fixedWidth = renderToStaticMarkup(
      createElement(CurrencySelect, { value: 'EUR', onChange: noop, className: 'w-48' }),
    );
    expect(rootClasses(fixedWidth)).toContain('w-48');
    expect(rootClasses(fixedWidth)).not.toContain('w-full');

    const defaultWidth = renderToStaticMarkup(
      createElement(CurrencySelect, { value: 'EUR', onChange: noop }),
    );
    expect(rootClasses(defaultWidth)).toContain('w-full');
  });
});

describe('CurrencySelect accessible name and label association (IN-04)', () => {
  it('keeps aria-label "Currency" (or caller override) and places id on the control on desktop and phone', () => {
    const desktop = renderToStaticMarkup(
      createElement(CurrencySelect, { id: 'rate-currency', value: 'EUR', onChange: noop }),
    );
    expect(attr(trigger(desktop), 'aria-label')).toBe('Currency');
    expect(attr(trigger(desktop), 'id')).toBe('rate-currency');

    const budgetDesktop = renderToStaticMarkup(
      createElement(CurrencySelect, {
        value: 'EUR',
        onChange: noop,
        'aria-label': 'Budget currency',
      }),
    );
    expect(attr(trigger(budgetDesktop), 'aria-label')).toBe('Budget currency');

    screen.phone = true;
    const phone = renderToStaticMarkup(
      createElement(CurrencySelect, { id: 'rate-currency', value: 'EUR', onChange: noop }),
    );
    expect(attr(select(phone), 'aria-label')).toBe('Currency');
    expect(attr(select(phone), 'id')).toBe('rate-currency');
  });
});
