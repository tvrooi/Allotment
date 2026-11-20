import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  MerchantSelect,
  merchantFooterState,
  PAUSED_CREATE_MESSAGE,
  sortPayees,
} from './MerchantSelect';

// MerchantSelect's hooks reach the API client, which reads window at import; mock them here
vi.mock('../../hooks/usePayees', () => ({
  usePayees: () => ({ data: [] }),
  useCreatePayee: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock('../../hooks/useConnection', () => ({
  useCanSave: () => true,
}));

const noop = () => {};

function renderMerchant(props: Partial<Parameters<typeof MerchantSelect>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(MerchantSelect, {
      label: 'Payee',
      value: { id: 'p1', name: 'Corner Grocery' },
      onChange: noop,
      ...props,
    }),
  );
}

const comboboxInput = (html: string) => html.match(/<input([^>]*role="combobox"[^>]*)>/)?.[1] ?? '';
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];

describe('MerchantSelect', () => {
  it('renders a combobox input named by its label prop showing the confirmed payee name', () => {
    const html = renderMerchant({
      label: 'Payee',
      value: { id: 'p1', name: 'Corner Grocery' },
    });
    const tag = comboboxInput(html);
    expect(tag).not.toBe('');
    expect(attr(tag, 'aria-label')).toBe('Payee');
    expect(attr(tag, 'value')).toBe('Corner Grocery');
  });

  it('uses a custom label prop as the combobox accessible name', () => {
    const html = renderMerchant({
      label: 'Merchant',
      value: { id: null, name: '' },
    });
    const tag = comboboxInput(html);
    expect(tag).not.toBe('');
    expect(attr(tag, 'aria-label')).toBe('Merchant');
  });
});

describe('sortPayees', () => {
  it('orders payees by transactionCount descending, then by name ascending', () => {
    const input = [
      { id: '1', name: 'Zebra Cafe', transactionCount: 2 },
      { id: '2', name: 'Apple Market', transactionCount: 2 },
      { id: '3', name: 'Top Grocer', transactionCount: 10 },
      { id: '4', name: 'Fresh Bakery', transactionCount: 0 },
    ];
    const sorted = sortPayees(input);
    expect(sorted.map((p) => p.name)).toEqual([
      'Top Grocer',
      'Apple Market',
      'Zebra Cafe',
      'Fresh Bakery',
    ]);
    // Does not mutate caller's array
    expect(input.map((p) => p.id)).toEqual(['1', '2', '3', '4']);
  });
});

describe('merchantFooterState', () => {
  const payees = [{ name: 'Corner Grocery' }, { name: 'Fuel Stop' }];

  it('shows the reconnect message and no create action while saving is paused', () => {
    expect(merchantFooterState(payees, 'Iron Temple Gym', false)).toEqual({
      kind: 'paused',
      message: PAUSED_CREATE_MESSAGE,
    });
    expect(PAUSED_CREATE_MESSAGE).toBe('New payees can be added once Allotment reconnects.');
  });

  it('offers to create a trimmed new payee while saving is allowed', () => {
    expect(merchantFooterState(payees, '  Iron Temple Gym  ', true)).toEqual({
      kind: 'create',
      name: 'Iron Temple Gym',
    });
  });

  it('returns none when the query is blank or matches an existing payee case-insensitively', () => {
    expect(merchantFooterState(payees, '', true)).toEqual({ kind: 'none' });
    expect(merchantFooterState(payees, '   ', false)).toEqual({ kind: 'none' });
    expect(merchantFooterState(payees, 'corner grocery', true)).toEqual({ kind: 'none' });
    expect(merchantFooterState(payees, 'FUEL STOP', false)).toEqual({ kind: 'none' });
  });
});
