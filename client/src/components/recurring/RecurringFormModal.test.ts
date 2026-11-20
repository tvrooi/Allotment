import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../ui/Modal', () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? createElement('div', { role: 'dialog' }, children) : null,
}));
vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => ({ data: [{ id: 'acc-1', name: 'Checking' }] }),
}));
vi.mock('../../hooks/usePayees', () => ({
  usePayees: () => ({ data: [] }),
  useCreatePayee: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../../hooks/useReminders', () => ({
  useReminderSettings: () => ({ data: { available: false, enabled: false, viaGateway: false } }),
}));
vi.mock('../../hooks/useConnection', () => ({
  useCanSave: () => true,
}));
vi.mock('../../hooks/useOffline', () => ({
  useCanAddTransaction: () => ({ allowed: true, onDevice: false }),
}));
vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({ data: [] }),
  useCreateCategory: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../../store/preferencesStore', () => ({
  usePreferencesStore: (
    sel: (s: {
      dateFormat: string;
      currencySymbol: string;
      amountFormat: string;
      symbolPosition: string;
      currencyStyles: Record<string, never>;
      showCategoryIcons: boolean;
      showMerchantIcons: boolean;
    }) => unknown,
  ) =>
    sel({
      dateFormat: 'd MMM yyyy',
      currencySymbol: '$',
      amountFormat: 'dot',
      symbolPosition: 'before',
      currencyStyles: {},
      showCategoryIcons: true,
      showMerchantIcons: true,
    }),
}));

import RecurringFormModal, { nextAdvancedOpen } from './RecurringFormModal';

describe('RecurringFormModal', () => {
  it('keeps the Advanced section mounted while collapsed so invalid Date flexibility still gates Save (WR-02)', () => {
    const html = renderToStaticMarkup(
      createElement(RecurringFormModal, {
        isOpen: true,
        onClose: () => {},
        onSave: () => {},
      }),
    );

    // On a new schedule, Advanced starts collapsed, yet Date flexibility stays mounted so
    // NumberField keeps reporting validity to AmountFields.
    expect(html).toContain('Date flexibility');
    expect(html).toContain('aria-expanded="false"');
  });

  it('refuses to collapse Advanced while Date flexibility is invalid (WR-06)', () => {
    expect(nextAdvancedOpen(true, true)).toBe(true);
    expect(nextAdvancedOpen(false, true)).toBe(true);
    expect(nextAdvancedOpen(true, false)).toBe(false);
    expect(nextAdvancedOpen(false, false)).toBe(true);
  });

  it('marks Start date as required on the shared DatePicker (WR-03)', () => {
    const html = renderToStaticMarkup(
      createElement(RecurringFormModal, {
        isOpen: true,
        onClose: () => {},
        onSave: () => {},
      }),
    );

    expect(html).toMatch(/>Start date<span aria-hidden="true"[^>]*>\*<\/span><\/span>/);
    expect(html).toContain('aria-required="true"');
  });

  it('keeps End date accessible name as "End date" while showing a muted "(optional)" hint (WR-05)', () => {
    const html = renderToStaticMarkup(
      createElement(RecurringFormModal, {
        isOpen: true,
        onClose: () => {},
        onSave: () => {},
      }),
    );

    const labelMatch = html.match(
      /<span[^>]*id="([^"]+)"[^>]*>End date<span aria-hidden="true" class="ml-1 font-normal text-text-tertiary">\(optional\)<\/span><\/span>/,
    );
    expect(labelMatch).not.toBeNull();
    const labelId = labelMatch![1];
    // Group references the label id, whose accessible name (ignoring aria-hidden) is strictly "End date"
    const groupTag = html.match(new RegExp(`<div[^>]*aria-labelledby="${labelId}"[^>]*>`))?.[0];
    expect(groupTag).toContain('role="group"');
    expect(html).not.toContain('>End date (optional)</span>');
  });
});
