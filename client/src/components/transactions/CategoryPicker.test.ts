import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category, CategoryGroup } from '../../types';
import {
  CreateCategoryForm,
  categoryKeyboardOrder,
  categoryList,
  categoryListEmpty,
  categorySections,
} from './CategoryPicker';
import { CategorySelectButton, categoryButtonPickerProps } from './CategorySelectButton';

// The picker's module also holds the component, whose create-category hook reaches the API
// client, which reads window at import; these rules need neither
vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({ data: GROUPS }),
  useCreateCategory: () => ({}),
}));
const connection = vi.hoisted(() => ({ canSave: true }));
vi.mock('../../hooks/useConnection', () => ({
  useCanSave: () => connection.canSave,
}));
vi.mock('../../hooks/useOffline', () => ({
  useCanAddTransaction: () => ({ allowed: true, onDevice: false }),
}));
afterEach(() => {
  connection.canSave = true;
});

// The category picker's list rules as pure functions (#267, plan 02-10): which rows show, in
// which sections, and the order the arrow keys walk. The hand-rolled picker reads them today and
// plan 02-18's wrapper over SearchList calls the same ones.

const category = (id: string, name: string, extra: Partial<Category> = {}): Category => ({
  id,
  groupId: 'g',
  name,
  icon: null,
  budgetType: 'flexible',
  sortOrder: 0,
  createdAt: '2026-11-18T00:00:00.000Z',
  ...extra,
});

const group = (id: string, name: string, categories: Category[]): CategoryGroup => ({
  id,
  name,
  isIncome: 0,
  sortOrder: 0,
  createdAt: '2026-11-18T00:00:00.000Z',
  categories,
});

// Deliberately not alphabetical: the caller's order is the order shown (E-02 ordering)
const GROUPS: CategoryGroup[] = [
  group('everyday', 'Everyday', [
    category('groceries', 'Groceries'),
    category('dining', 'Dining out'),
    category('old', 'Old gym', { hidden: 1 }),
  ]),
  group('bills', 'Bills', [category('rent', 'Rent'), category('power', 'Power')]),
];
const ACCOUNTS = [
  { id: 'sav', name: 'Rainy Day Savings' },
  { id: 'chk', name: 'Everyday Checking' },
];

const values = (sections: ReturnType<typeof categorySections>) =>
  sections.map((s) => [s.heading, s.options.map((o) => o.value)]);

describe('categorySections', () => {
  it('lists every group, then the Transfer section, in the order given', () => {
    expect(values(categorySections(GROUPS, ACCOUNTS, '', null))).toEqual([
      ['Everyday', ['groceries', 'dining']],
      ['Bills', ['rent', 'power']],
      ['Transfer', ['transfer:sav', 'transfer:chk']],
    ]);
  });

  it('labels each option with its name, and a transfer as "Transfer: name"', () => {
    const sections = categorySections(GROUPS, ACCOUNTS, '', null);
    expect(sections[0].options[0]).toMatchObject({ value: 'groceries', label: 'Groceries' });
    expect(sections[2].options[0]).toMatchObject({
      value: 'transfer:sav',
      label: 'Transfer: Rainy Day Savings',
    });
  });

  it('leaves hidden categories out unless one is the chosen value', () => {
    expect(values(categorySections(GROUPS, [], 'gym', null))).toEqual([]);
    expect(values(categorySections(GROUPS, [], 'gym', 'old'))).toEqual([['Everyday', ['old']]]);
  });

  it('includes hidden categories when includeHidden is true (WR-04)', () => {
    expect(values(categorySections(GROUPS, [], '', null, undefined, true))).toEqual([
      ['Everyday', ['groceries', 'dining', 'old']],
      ['Bills', ['rent', 'power']],
    ]);
    expect(values(categorySections(GROUPS, [], 'gym', null, undefined, true))).toEqual([
      ['Everyday', ['old']],
    ]);
  });

  it('matches a lower-cased substring, letter case ignored on both sides (E-02 encoding)', () => {
    expect(values(categorySections(GROUPS, [], 'gRoCeR', null))).toEqual([
      ['Everyday', ['groceries']],
    ]);
    // Inside a word, not only at its start
    expect(values(categorySections(GROUPS, [], 'OUT', null))).toEqual([['Everyday', ['dining']]]);
  });

  it('matches a transfer on its whole "Transfer: name" text', () => {
    expect(values(categorySections(GROUPS, ACCOUNTS, 'transfer', null))).toEqual([
      ['Transfer', ['transfer:sav', 'transfer:chk']],
    ]);
    // "everyday" finds the Everyday Checking transfer, not the Everyday group's name
    expect(values(categorySections(GROUPS, ACCOUNTS, 'everyday', null))).toEqual([
      ['Transfer', ['transfer:chk']],
    ]);
  });

  it('drops a group with no match, and the Transfer section when no transfer matches', () => {
    expect(values(categorySections(GROUPS, ACCOUNTS, 'rent', null))).toEqual([['Bills', ['rent']]]);
  });
});

describe('categoryKeyboardOrder', () => {
  const all = categorySections(GROUPS, ACCOUNTS, '', null);

  it('starts on the no-category row when it is offered and nothing is typed', () => {
    expect(categoryKeyboardOrder(all, '', true)).toEqual([
      null,
      'groceries',
      'dining',
      'rent',
      'power',
      'transfer:sav',
      'transfer:chk',
    ]);
  });

  it('leaves the no-category row out while searching, though the row still shows', () => {
    const found = categorySections(GROUPS, ACCOUNTS, 'r', null);
    expect(categoryKeyboardOrder(found, 'r', true)).toEqual([
      'groceries',
      'rent',
      'power',
      'transfer:sav',
      'transfer:chk',
    ]);
  });

  it('never has the no-category row when it is not offered', () => {
    expect(categoryKeyboardOrder(all, '', false)[0]).toBe('groceries');
    expect(categoryKeyboardOrder(all, '', false)).not.toContain(null);
  });

  it('puts categories before transfers', () => {
    const order = categoryKeyboardOrder(all, '', false);
    expect(order.indexOf('power')).toBeLessThan(order.indexOf('transfer:sav'));
  });
});

describe('categoryListEmpty', () => {
  it('is true when no category and no transfer matches, even with the no-category row', () => {
    const none = categorySections(GROUPS, ACCOUNTS, 'zzz', null);
    expect(categoryListEmpty(none)).toBe(true);
    // The no-category row does not count as a match
    expect(categoryKeyboardOrder(none, 'zzz', true)).toEqual([]);
  });

  it('is false when only a transfer matches', () => {
    expect(categoryListEmpty(categorySections(GROUPS, ACCOUNTS, 'savings', null))).toBe(false);
  });

  it('is false with matches', () => {
    expect(categoryListEmpty(categorySections(GROUPS, [], '', null))).toBe(false);
  });
});

describe('categoryList', () => {
  const base = {
    groups: GROUPS,
    transferAccounts: ACCOUNTS,
    value: null,
    allowNone: true,
    noneLabel: 'Uncategorised',
    showIcons: false,
    onChange: () => {},
  };

  it("hands SearchList categorySections' output, in the caller's order", () => {
    for (const query of ['', 'r', 'gRoCeR', 'savings']) {
      expect(categoryList({ ...base, query }).sections).toEqual(
        categorySections(GROUPS, ACCOUNTS, query, null),
      );
    }
  });

  it('shows "No categories found" only when categoryListEmpty says so', () => {
    expect(categoryList({ ...base, query: 'zzz' }).emptyText).toBe('No categories found');
    expect(categoryList({ ...base, query: 'gro' }).emptyText).toBeNull();
  });

  it("pins the no-category row with the caller's label, in the keys only while nothing is typed", () => {
    const empty = categoryList({ ...base, query: '', noneLabel: 'No default category' }).pinned!;
    expect(empty).toMatchObject({
      label: 'No default category',
      isSelected: true,
      inKeyboardOrder: true,
    });
    expect(categoryList({ ...base, query: 'gro' }).pinned!.inKeyboardOrder).toBe(false);
    expect(categoryList({ ...base, query: '', value: 'rent' }).pinned!.isSelected).toBe(false);
    expect(categoryList({ ...base, query: '', allowNone: false }).pinned).toBeUndefined();
  });

  it('picks the chosen value as given, and null from the no-category row', () => {
    const picked: (string | null)[] = [];
    const list = categoryList({ ...base, query: '', onChange: (id) => picked.push(id) });
    list.onPick('transfer:sav');
    list.pinned!.onPick();
    expect(picked).toEqual(['transfer:sav', null]);
  });

  it('adds an icon to a category only when the preference shows them', () => {
    const groups = [group('g', 'G', [category('c', 'Coffee', { icon: 'coffee' })])];
    const icon = (showIcons: boolean) =>
      categoryList({ ...base, groups, query: '', showIcons }).sections[0].options[0].icon;
    expect(icon(false)).toBeUndefined();
    expect(icon(true)).toBeTruthy();
  });

  it('pins extraItem ahead of categories when allowNone is off, and picking it passes its value', () => {
    const picked: (string | null)[] = [];
    const list = categoryList({
      ...base,
      allowNone: false,
      query: '',
      value: 'ready-to-assign',
      extraItem: { value: 'ready-to-assign', label: 'Ready to assign' },
      onChange: (id) => picked.push(id),
    });
    expect(list.pinned).toMatchObject({
      label: 'Ready to assign',
      isSelected: true,
      inKeyboardOrder: true,
    });
    list.pinned!.onPick();
    expect(picked).toEqual(['ready-to-assign']);
  });

  it('keeps both allowNone and extraItem when both are enabled, with extraItem ahead of groups', () => {
    const picked: (string | null)[] = [];
    const list = categoryList({
      ...base,
      allowNone: true,
      noneLabel: 'Uncategorised',
      query: '',
      extraItem: { value: '__new', label: 'Create “Coffee” as new' },
      onChange: (id) => picked.push(id),
    });
    expect(list.pinned?.label).toBe('Uncategorised');
    expect(list.sections[0]).toEqual({
      id: 'extra',
      options: [{ value: '__new', label: 'Create “Coffee” as new' }],
    });
    list.onPick('__new');
    list.pinned!.onPick();
    expect(picked).toEqual(['__new', null]);
  });

  it('appends hint text after each category name without changing transfers', () => {
    const list = categoryList({
      ...base,
      query: '',
      hint: (id) => (id === 'groceries' ? '($12.00 available)' : ''),
    });
    expect(list.sections[0].options[0]).toMatchObject({
      value: 'groceries',
      label: 'Groceries ($12.00 available)',
    });
    expect(list.sections[0].options[1]).toMatchObject({
      value: 'dining',
      label: 'Dining out',
    });
    expect(list.sections[2].options[0]).toMatchObject({
      value: 'transfer:sav',
      label: 'Transfer: Rainy Day Savings',
    });
  });
});

describe('CategorySelectButton', () => {
  const renderButton = (props: Partial<Parameters<typeof CategorySelectButton>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(CategorySelectButton, {
        value: 'groceries',
        onChange: () => {},
        ...props,
      }),
    );
  const ariaLabel = (html: string) => html.match(/aria-label="([^"]*)"/)?.[1];

  it('uses label prop for its accessible name and defaults to Category', () => {
    expect(ariaLabel(renderButton({ label: 'Split 1 category', value: 'groceries' }))).toBe(
      'Split 1 category: Groceries',
    );
    expect(ariaLabel(renderButton({ value: 'groceries' }))).toBe('Category: Groceries');
  });

  it('shows extraItem label when value matches extraItem.value', () => {
    const html = renderButton({
      label: 'Move to',
      value: 'ready-to-assign',
      extraItem: { value: 'ready-to-assign', label: 'Ready to assign' },
    });
    expect(ariaLabel(html)).toBe('Move to: Ready to assign');
    expect(html).toContain('Ready to assign');
  });

  it('shows noneLabel when allowNone is true and value is null, and keeps placeholder when omitted', () => {
    const withNone = renderButton({
      value: null,
      allowNone: true,
      noneLabel: 'Uncategorised',
    });
    expect(ariaLabel(withNone)).toBe('Category: Uncategorised');
    expect(withNone).toContain('Uncategorised');

    const defaultNull = renderButton({ value: null });
    expect(ariaLabel(defaultNull)).toBe('Category: Search categories...');
  });

  it('resolves shown name from groups prop instead of useCategories when given', () => {
    const billsOnly = [GROUPS[1]];
    expect(ariaLabel(renderButton({ groups: billsOnly, value: 'rent' }))).toBe('Category: Rent');
    // Groceries is in useCategories() mock, not in billsOnly, so it must not resolve
    expect(ariaLabel(renderButton({ groups: billsOnly, value: 'groceries' }))).toBe(
      'Category: Search categories...',
    );
  });

  it('forwards groups prop to CategoryPicker instead of useCategories() so only those groups appear (WR-05)', () => {
    const billsOnly = [GROUPS[1]];
    const picker = categoryButtonPickerProps(
      {
        value: null,
        groups: billsOnly,
        allowNone: true,
        noneLabel: 'No category (net worth only)',
        allowCreate: false,
        includeHidden: true,
      },
      GROUPS,
    );
    expect(picker.groups).toBe(billsOnly);
    expect(picker.allowCreate).toBe(false);
    expect(picker.includeHidden).toBe(true);

    const list = categoryList({
      groups: picker.groups,
      transferAccounts: picker.transferAccounts ?? [],
      value: picker.value,
      allowNone: picker.allowNone ?? true,
      noneLabel: picker.noneLabel ?? 'Uncategorised',
      extraItem: picker.extraItem,
      hint: picker.hint,
      includeHidden: picker.includeHidden,
      query: '',
      showIcons: false,
      onChange: () => {},
    });
    expect(list.pinned?.label).toBe('No category (net worth only)');
    expect(values(list.sections)).toEqual([['Bills', ['rent', 'power']]]);

    // Without optional props, groups falls back to fetchedGroups and picker defaults are NOT restated (R2-WR-01)
    const fallback = categoryButtonPickerProps({ value: null }, GROUPS);
    expect(fallback.groups).toBe(GROUPS);
    expect(fallback.allowNone).toBeUndefined();
    expect(fallback.noneLabel).toBeUndefined();
    expect(fallback.allowCreate).toBeUndefined();
    expect(fallback.includeHidden).toBeUndefined();
    expect(fallback.transferAccounts).toBeUndefined();
  });
});

describe('categoryButtonPickerProps categoryIds (03-10 WR-01)', () => {
  it('keeps only the given categories, in their groups and order, and drops emptied groups', () => {
    const picker = categoryButtonPickerProps(
      { value: null, categoryIds: ['power', 'old', 'groceries'] },
      GROUPS,
    );
    expect(picker.groups.map((g) => [g.name, g.categories.map((c) => c.id)])).toEqual([
      ['Everyday', ['groceries', 'old']],
      ['Bills', ['power']],
    ]);
    // A screen's own subset is not a picker prop
    expect('categoryIds' in picker).toBe(false);
  });

  it('filters the groups prop too, and drops a group with none left', () => {
    const picker = categoryButtonPickerProps(
      { value: null, groups: GROUPS, categoryIds: ['rent'] },
      [],
    );
    expect(picker.groups.map((g) => [g.name, g.categories.map((c) => c.id)])).toEqual([
      ['Bills', ['rent']],
    ]);
  });

  it('offers nothing for an empty subset', () => {
    expect(categoryButtonPickerProps({ value: null, categoryIds: [] }, GROUPS).groups).toEqual([]);
  });
});

describe('CreateCategoryForm paused saving (WR-04)', () => {
  const renderForm = (onCreate?: Parameters<typeof CreateCategoryForm>[0]['onCreate']) =>
    renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(CreateCategoryForm, {
          groups: GROUPS,
          onCreated: () => {},
          onCreate,
        }),
      ),
    );

  it('disables Create new category and shows SavingPausedHint while saving is paused', () => {
    connection.canSave = false;
    const html = renderForm();
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Create new category/);
    expect(html).toContain('Saving is paused until Allotment reconnects.');
  });

  it('keeps Create new category enabled when saving is allowed or a local onCreate is supplied', () => {
    connection.canSave = true;
    const allowed = renderForm();
    expect(allowed).not.toMatch(/<button[^>]*disabled=""/);
    expect(allowed).not.toContain('Saving is paused');

    connection.canSave = false;
    const gallery = renderForm(async () => ({ id: 'local' }));
    expect(gallery).not.toMatch(/<button[^>]*disabled=""/);
    expect(gallery).not.toContain('Saving is paused');
  });
});
