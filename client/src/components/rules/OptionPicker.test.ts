import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/base', () => ({ API_BASE: '/api' }));
vi.mock('../../hooks/useCategories', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('../../hooks/usePayees', () => ({
  usePayees: () => ({ data: [] }),
  useCreatePayee: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('../../hooks/useConnection', () => ({ useCanSave: () => true }));
vi.mock('../../store/preferencesStore', () => ({
  usePreferencesStore: (pick: (s: { showCategoryIcons: boolean }) => unknown) =>
    pick({ showCategoryIcons: false }),
}));

import { OptionPicker } from './OptionPicker';
import optionPickerSource from './OptionPicker.tsx?raw';

describe('OptionPicker single-value stale id marker (WR-02)', () => {
  it('shows (deleted) for a stale account id in Combobox', () => {
    const html = renderToStaticMarkup(
      createElement(OptionPicker, {
        kind: 'account',
        label: 'Account',
        options: [{ id: 'acc-1', label: 'Checking' }],
        value: 'acc-removed',
        onChange: vi.fn(),
        placeholder: 'Choose…',
      }),
    );
    expect(html).toContain('(deleted)');
  });

  it('shows the live payee name in MerchantSelect for a matched payee id (WR-06)', () => {
    const html = renderToStaticMarkup(
      createElement(OptionPicker, {
        kind: 'payee',
        label: 'Payee',
        options: [{ id: 'pay-1', label: 'Corner Cafe' }],
        value: 'pay-1',
        onChange: vi.fn(),
        placeholder: 'Choose…',
      }),
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Payee"');
    expect(html).toContain('value="Corner Cafe"');
  });

  it('shows (deleted) for a stale payee id in MerchantSelect', () => {
    const html = renderToStaticMarkup(
      createElement(OptionPicker, {
        kind: 'payee',
        label: 'Payee',
        options: [{ id: 'pay-1', label: 'Coffee Co' }],
        value: 'pay-removed',
        onChange: vi.fn(),
        placeholder: 'Choose…',
      }),
    );
    expect(html).toContain('(deleted)');
  });

  it('shows (deleted) for a stale category id in CategorySelectButton', () => {
    const html = renderToStaticMarkup(
      createElement(OptionPicker, {
        kind: 'category',
        label: 'Category',
        options: [{ id: 'cat-1', label: 'Groceries', group: 'Everyday' }],
        value: 'cat-removed',
        onChange: vi.fn(),
        placeholder: 'Choose…',
      }),
    );
    expect(html).toContain('(deleted)');
  });
});

describe('OptionPicker multi-select styling (WR-04)', () => {
  it('uses no one-off bg-brand-50, text-brand-700 or ring-brand-400 drift on checklist rows', () => {
    expect(optionPickerSource).not.toContain('bg-brand-50');
    expect(optionPickerSource).not.toContain('text-brand-700');
    expect(optionPickerSource).not.toContain('ring-brand-400');
  });
});
