import { describe, expect, it, vi } from 'vitest';
import type { Category, CategoryGroup } from '../../types';
import {
  categoryKeyboardOrder,
  categoryList,
  categoryListEmpty,
  categorySections,
} from './CategoryPicker';

// The picker's module also holds the component, whose create-category hook reaches the API
// client, which reads window at import; these rules need neither
vi.mock('../../hooks/useCategories', () => ({ useCreateCategory: () => ({}) }));

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
});
