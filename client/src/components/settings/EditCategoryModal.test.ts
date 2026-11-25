import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Category, CategoryGroup } from '../../types';

vi.mock('../ui/Modal', () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? createElement('div', { role: 'dialog' }, children) : null,
}));
vi.mock('../../hooks/useCategories', () => ({
  useUpdateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => ({ data: [] }),
}));
vi.mock('../../hooks/useConnection', () => ({
  useCanSave: () => true,
}));
vi.mock('../../hooks/useOffline', () => ({
  useCanAddTransaction: () => ({ allowed: true, onDevice: false }),
}));
vi.mock('../../store/preferencesStore', () => ({
  usePreferencesStore: (sel: (s: { showCategoryIcons: boolean }) => unknown) =>
    sel({ showCategoryIcons: true }),
}));

import { EditCategoryModal } from './EditCategoryModal';

const CATEGORY: Category = {
  id: 'cat-1',
  groupId: 'grp-1',
  name: 'Parking',
  icon: 'Car',
  sortOrder: 0,
  budgetType: 'flexible',
  linkedAccountId: null,
  poolAccountId: null,
  keepOverspending: 0,
  hidden: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
};

const GROUPS: CategoryGroup[] = [
  {
    id: 'grp-1',
    name: 'Transportation',
    isIncome: 0,
    sortOrder: 0,
    categories: [CATEGORY],
    createdAt: '2026-11-01T00:00:00.000Z',
  },
];

describe('EditCategoryModal', () => {
  it('keeps "Icon & Name" label bound to the name input while preserving accessible name "Category name" (WR-01)', () => {
    const html = renderToStaticMarkup(
      createElement(EditCategoryModal, {
        category: CATEGORY,
        groups: GROUPS,
        isIncome: false,
        onClose: () => {},
        onDelete: () => {},
      }),
    );

    const nameInput = html.match(/<input[^>]*placeholder="Category name"[^>]*>/)?.[0] ?? '';
    expect(nameInput).not.toBe('');

    const inputId = nameInput.match(/ id="([^"]*)"/)?.[1];
    expect(inputId).toBeTruthy();

    // Label is bound to the input so accessibility.spec.ts strayLabels stays empty
    expect(html).toMatch(new RegExp(`<label[^>]*for="${inputId}"[^>]*>Icon &amp; Name</label>`));

    // Accessible name stays "Category name" (aria-label wins over <label for>, not overridden by aria-labelledby)
    expect(nameInput).toContain('aria-label="Category name"');
    expect(nameInput).not.toContain('aria-labelledby=');
  });
});
