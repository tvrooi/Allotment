import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  availability,
  categoryFigures,
  isActiveCategory,
  selectionFigures,
  splitCategories,
} from './budgetFigures';
import type { BudgetCategory } from '../types';

const cents = fc.integer({ min: -10_000_000, max: 10_000_000 });
const category = fc
  .record({ budgeted: cents, spent: fc.nat(10_000_000), carryOver: cents, received: cents })
  .map(({ budgeted, spent, carryOver, received }): BudgetCategory => ({
    id: 'c',
    groupId: 'g',
    name: 'Category',
    icon: null,
    budgetType: null,
    sortOrder: 0,
    createdAt: '',
    budgeted,
    spent,
    carryOver,
    // The server's balance: carry-over + planned + this month's activity
    balance: carryOver + budgeted + received,
  }));

describe('categoryFigures (property-based)', () => {
  it('a transfer into a linked account funds the envelope without being activity', () => {
    fc.assert(
      fc.property(category, fc.nat(10_000_000), (cat, transferred) => {
        const linked = { ...cat, transferred, balance: cat.balance + transferred };
        const { actual, remaining } = categoryFigures(linked, false);
        expect(actual).toBe(categoryFigures(cat, false).actual);
        expect(remaining).toBe(linked.balance);
      }),
    );
  });

  it('expenses: activity is signed and availability includes rollover', () => {
    fc.assert(
      fc.property(category, (cat) => {
        const { actual, remaining } = categoryFigures(cat, false);
        expect(actual).toBe(cat.balance - cat.carryOver - cat.budgeted);
        expect(remaining).toBe(cat.balance);
      }),
    );
  });

  it('income: actual is what came in this month, and remaining is never negative', () => {
    fc.assert(
      fc.property(category, (cat) => {
        const { actual, remaining } = categoryFigures(cat, true);
        expect(actual).toBe(cat.balance - cat.carryOver - cat.budgeted);
        expect(remaining).toBe(Math.max(cat.budgeted - actual, 0));
        expect(remaining).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('a category is inactive only with nothing planned and nothing happening', () => {
    fc.assert(
      fc.property(category, fc.boolean(), (cat, isIncome) => {
        const idle =
          cat.balance === 0 &&
          cat.carryOver === 0 &&
          cat.budgeted === 0 &&
          categoryFigures(cat, isIncome).actual === 0;
        expect(isActiveCategory(cat, isIncome)).toBe(!idle);
      }),
    );
  });
});

describe('splitCategories (property-based)', () => {
  // Categories that are often idle (nothing planned, nothing happening), with distinct ids
  const idleOrNot = fc.oneof(
    category,
    category.map((c) => ({ ...c, budgeted: 0, spent: 0, balance: c.carryOver })),
  );
  const section = fc
    .array(idleOrNot, { maxLength: 30 })
    .map((cats) => cats.map((c, i) => ({ ...c, id: `c${i}`, sortOrder: i })));

  it('lists every active category and at least `min` in all, in the section order', () => {
    fc.assert(
      fc.property(section, fc.boolean(), fc.nat(6), (cats, isIncome, min) => {
        const { shown, hidden } = splitCategories(cats, isIncome, min);
        // Nothing lost or repeated, and the order is kept
        expect([...shown, ...hidden].map((c) => c.id).sort()).toEqual(cats.map((c) => c.id).sort());
        const order = (list: BudgetCategory[]) => list.map((c) => c.sortOrder);
        expect(order(shown)).toEqual([...order(shown)].sort((a, b) => a - b));
        expect(order(hidden)).toEqual([...order(hidden)].sort((a, b) => a - b));
        // Only inactive categories are tucked away
        for (const c of hidden) expect(isActiveCategory(c, isIncome)).toBe(false);
        for (const c of cats.filter((c) => isActiveCategory(c, isIncome))) {
          expect(shown).toContain(c);
        }
        // Never fewer than `min` shown (unless the section has fewer)
        expect(shown.length).toBeGreaterThanOrEqual(Math.min(min, cats.length));
        // And no more than needed: extra inactive ones only to reach `min`
        const active = cats.filter((c) => isActiveCategory(c, isIncome)).length;
        expect(shown.length).toBe(Math.max(active, Math.min(min, cats.length)));
      }),
    );
  });
});

describe('splitCategories picks common categories to top up a section', () => {
  const idle = (name: string, sortOrder: number): BudgetCategory => ({
    id: name,
    groupId: 'g',
    name,
    icon: null,
    budgetType: 'flexible',
    sortOrder,
    createdAt: '',
    budgeted: 0,
    spent: 0,
    carryOver: 0,
    balance: 0,
  });

  it('prefers Groceries and Restaurants over what happens to sort first', () => {
    const names = ['Charity', 'Gifts', 'Donations', 'Gas / Fuel', 'Groceries', 'Restaurants'];
    const { shown } = splitCategories(names.map(idle), false);
    // In the section's order, not the ranking's
    expect(shown.map((c) => c.name)).toEqual(['Gas / Fuel', 'Groceries', 'Restaurants']);
  });

  it('falls back to the section order for names it does not know', () => {
    const names = ['Zoo Trips', 'Alpacas', 'Kayaks', 'Board Games'];
    const { shown } = splitCategories(names.map(idle), false);
    expect(shown.map((c) => c.name)).toEqual(['Zoo Trips', 'Alpacas', 'Kayaks']);
  });
});

describe('expected recurring debits', () => {
  it('keep an otherwise empty category listed, without changing its figures', () => {
    const empty: BudgetCategory = {
      id: 'phone',
      groupId: 'g',
      name: 'Phone',
      icon: null,
      budgetType: null,
      sortOrder: 0,
      createdAt: '',
      budgeted: 0,
      spent: 0,
      carryOver: 0,
      balance: 0,
    };
    expect(isActiveCategory(empty, false)).toBe(false);
    const expecting = { ...empty, expected: 5000 };
    expect(isActiveCategory(expecting, false)).toBe(true);
    expect(categoryFigures(expecting, false)).toEqual(categoryFigures(empty, false));
  });
});

describe('availability', () => {
  const base: BudgetCategory = {
    id: 'c',
    groupId: 'g',
    name: 'Groceries',
    icon: null,
    budgetType: null,
    sortOrder: 0,
    createdAt: '',
    budgeted: 0,
    spent: 0,
    carryOver: 0,
    balance: 0,
  };
  const target = (underfunded: number) =>
    ({ underfunded }) as unknown as NonNullable<BudgetCategory['target']>;

  it('a $600 carry + $100 assigned − $500 spent is $200 available, covered, not a deficit', () => {
    const cat = { ...base, carryOver: 60_000, budgeted: 10_000, spent: 50_000, balance: 20_000 };
    expect(availability(cat, false)).toEqual({
      kind: 'carried',
      remaining: 20_000,
      caption: 'Covered by carried funds',
    });
  });

  it('names each state in words, not only colour', () => {
    expect(availability({ ...base, balance: -500, spent: 500 }, false).caption).toBe('Overspent');
    expect(availability({ ...base, balance: 0 }, false)).toMatchObject({ kind: 'zero' });
    expect(availability({ ...base, balance: 300, budgeted: 300 }, false)).toMatchObject({
      kind: 'available',
      caption: null,
    });
    expect(
      availability({ ...base, balance: 300, budgeted: 300, target: target(100) }, false),
    ).toMatchObject({
      kind: 'short',
      caption: 'Short of target',
    });
  });

  it('names an overspending carried in by a category that keeps it, and still reads as overspent', () => {
    const kept = { ...base, keepOverspending: 1, carryOver: -5_000, balance: -5_000 };
    expect(availability(kept, false)).toEqual({
      kind: 'overspent',
      remaining: -5_000,
      caption: 'Overspending kept',
    });
    // The month it happens it is plain overspending, and a category that resets never says kept
    expect(availability({ ...kept, carryOver: 0 }, false).caption).toBe('Overspent');
    expect(availability({ ...kept, keepOverspending: 0 }, false).caption).toBe('Overspent');
  });

  it('an overspent envelope with a target is still overspent', () => {
    const cat = { ...base, balance: -100, spent: 100, target: target(50) };
    expect(availability(cat, false).kind).toBe('overspent');
  });

  it('income never reads as overspent or short', () => {
    expect(availability({ ...base, budgeted: 500, balance: 200 }, true).kind).toBe('available');
    expect(availability({ ...base, budgeted: 500, balance: 1000 }, true).kind).toBe('zero');
  });

  it('only a negative balance is overspent, and the amount is categoryFigures remaining', () => {
    fc.assert(
      fc.property(category, (cat) => {
        const a = availability(cat, false);
        expect(a.remaining).toBe(categoryFigures(cat, false).remaining);
        expect(a.kind === 'overspent').toBe(cat.balance < 0);
      }),
    );
  });
});

describe('selectionFigures (BUD-10, property-based)', () => {
  const budget = fc
    .array(fc.tuple(category, fc.nat(1_000_000), fc.boolean()), { maxLength: 12 })
    .map((rows) =>
      rows.map(([cat, transferred, picked], i) => ({
        cat: { ...cat, id: `c${i}`, transferred, balance: cat.balance + transferred },
        picked,
      })),
    );

  it('adds up exactly the selected rows, as the table shows them', () => {
    fc.assert(
      fc.property(budget, (rows) => {
        const picked = rows.filter((r) => r.picked).map((r) => r.cat);
        const figures = selectionFigures(picked);
        const sum = (f: (c: BudgetCategory) => number) => picked.reduce((s, c) => s + f(c), 0);
        expect(figures.assigned).toBe(sum((c) => c.budgeted));
        expect(figures.activity).toBe(sum((c) => categoryFigures(c, false).actual));
        expect(figures.available).toBe(sum((c) => availability(c, false).remaining));
        expect(figures.available).toBe(
          figures.carriedIn + figures.assigned + figures.transferred + figures.activity,
        );
      }),
    );
  });

  it('is all zeros for no selection', () => {
    expect(Object.values(selectionFigures([])).every((v) => v === 0)).toBe(true);
  });
});
