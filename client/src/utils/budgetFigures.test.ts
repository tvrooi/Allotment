import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  availability,
  availableTone,
  captionTone,
  categoryFigures,
  plotOf,
  barOf,
  isActiveCategory,
  savedSplit,
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

  it('flags bills still to come that the envelope cannot cover, naming the bill', () => {
    const item = (name: string, amount: number) => ({
      scheduleId: name,
      name,
      date: '2026-11-20',
      amount,
    });
    const charity = {
      ...base,
      balance: 0,
      expected: 2_500,
      expectedItems: [item('Food bank', 2_500)],
    };
    expect(availability(charity, false)).toEqual({
      kind: 'uncovered',
      remaining: 0,
      caption: '$25 short for Food bank',
    });
    // Only the part that is not covered is short; several bills are not named one by one
    const two = {
      ...base,
      balance: 1_000,
      budgeted: 1_000,
      expected: 2_500,
      expectedItems: [item('A', 1_500), item('B', 1_000)],
    };
    expect(availability(two, false).caption).toBe('$15 short of expected bills');
    expect(availableTone('uncovered', 0)).toContain('bg-caution-subtle');
    expect(captionTone('uncovered')).toBe('text-caution');
  });

  it('stays calm when the money covers the bills, and overspent still wins', () => {
    const covered = { ...base, balance: 2_500, budgeted: 2_500, expected: 2_500 };
    expect(availability(covered, false).kind).toBe('available');
    expect(availability({ ...base, balance: 0, expected: 0 }, false).kind).toBe('zero');
    expect(availability({ ...base, balance: -100, spent: 100, expected: 500 }, false).kind).toBe(
      'overspent',
    );
    // A bill that has posted is no longer expected: it is in the balance, not counted twice
    expect(availability({ ...base, balance: 0, spent: 2_500, expected: 0 }, false).kind).toBe(
      'zero',
    );
    expect(availability({ ...base, balance: 0, expected: 500 }, true).kind).toBe('zero');
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

describe('availableTone', () => {
  it('marks only what needs a decision as a pill, in its own colour', () => {
    expect(availableTone('overspent', -500)).toContain('bg-negative-subtle');
    expect(availableTone('overspent', -500)).toContain('text-negative');
    expect(availableTone('short', 500)).toContain('bg-caution-subtle');
    expect(availableTone('carried', 500)).toContain('text-caution');
    // An envelope with money in it, or nothing, is a plain figure
    expect(availableTone('available', 500)).not.toMatch(/\bbg-/);
    expect(availableTone('zero', 0)).toBe('text-text-tertiary');
    expect(captionTone('overspent')).toBe('text-negative');
    expect(captionTone('short')).toBe('text-caution');
  });
});

describe('plotOf', () => {
  const base: BudgetCategory = {
    id: 'c',
    groupId: 'g',
    name: 'Rent',
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

  it('fills with the money still in the envelope, so spending empties it', () => {
    expect(plotOf(base)).toEqual({ state: 'bare', fill: 0 });
    expect(plotOf({ ...base, budgeted: 230_000, balance: 230_000 })).toEqual({
      state: 'planted',
      fill: 1,
    });
    expect(plotOf({ ...base, budgeted: 230_000, spent: 115_000, balance: 115_000 })).toEqual({
      state: 'planted',
      fill: 0.5,
    });
    expect(plotOf({ ...base, budgeted: 6_500, spent: 6_500, balance: 0 })).toEqual({
      state: 'used',
      fill: 0,
    });
    // Carried-in money counts as given, so it isn't bare
    expect(plotOf({ ...base, carryOver: 5_000, balance: 5_000 }).state).toBe('planted');
    // Short of a target: growing, filled by how much of the need is in
    expect(plotOf({ ...base, budgeted: 3_000, balance: 3_000, target: target(1_000) })).toEqual({
      state: 'growing',
      fill: 0.75,
    });
    expect(plotOf({ ...base, budgeted: 1_000, spent: 1_500, balance: -500 }).state).toBe(
      'overspent',
    );
  });
});

describe('barOf', () => {
  const base: BudgetCategory = {
    id: 'c',
    groupId: 'g',
    name: 'Eating Out',
    icon: null,
    budgetType: null,
    sortOrder: 0,
    createdAt: '',
    budgeted: 0,
    spent: 0,
    carryOver: 0,
    balance: 0,
  };

  it('shows money left out of carried-in plus assigned, not spent over assigned', () => {
    // Assigned $200, $88 carried in, $182 spent: 77% of the assignment, but $106 is left
    const bar = barOf(
      { ...base, budgeted: 20_000, carryOver: 8_800, spent: 18_200, balance: 10_600 },
      false,
    );
    expect(bar?.label).toBe('$106 left of $288');
    expect(bar?.state).toBe('ok');
    expect(bar?.fill).toBeCloseTo(10_600 / 28_800);
  });

  it('says so in words when the bills still expected outrun what is left', () => {
    const bar = barOf({ ...base, budgeted: 1_000, balance: 1_000, expected: 2_500 }, false);
    expect(bar?.label).toBe('$10 left of $10, $25 still expected, $15 short');
  });

  it('takes recurring debits still expected out of what is left', () => {
    const bar = barOf({ ...base, budgeted: 10_000, balance: 10_000, expected: 2_500 }, false);
    expect(bar?.fill).toBeCloseTo(0.75);
    expect(bar?.expectedFill).toBeCloseTo(0.25);
    expect(bar?.label).toContain('$25 still expected');
  });

  it('marks low, empty and overspent in words as well as colour', () => {
    expect(barOf({ ...base, budgeted: 10_000, balance: 1_000 }, false)?.state).toBe('low');
    expect(barOf({ ...base, budgeted: 10_000, spent: 10_000, balance: 0 }, false)?.state).toBe(
      'empty',
    );
    expect(barOf({ ...base, budgeted: 10_000, spent: 12_000, balance: -2_000 }, false)).toEqual({
      state: 'overspent',
      fill: 1,
      expectedFill: 0,
      label: 'Overspent by $20',
    });
  });

  it('draws nothing for an envelope that was given nothing', () => {
    expect(barOf(base, false)).toBeNull();
  });

  it('fills income as the plan arrives', () => {
    const bar = barOf({ ...base, budgeted: 100_000, balance: 140_000 }, true);
    expect(bar?.state).toBe('income');
    expect(bar?.fill).toBeCloseTo(0.4);
    expect(bar?.label).toBe('$400 received of $1,000 planned');
  });
});

describe('savedSplit', () => {
  const env = (budgetType: BudgetCategory['budgetType'], balance: number) =>
    ({
      id: 'x',
      name: 'x',
      budgetType,
      budgeted: 0,
      spent: 0,
      carryOver: balance,
      balance,
    }) as unknown as BudgetCategory;

  it('puts Savings-type envelopes in saved and the rest in spending, adding up to the total', () => {
    const split = savedSplit([
      env('flexible', 300_000),
      env('fixed', 50_000),
      env('savings', 5_000_000),
    ]);
    expect(split).toEqual({ spending: 350_000, saved: 5_000_000, total: 5_350_000 });
  });

  it('has nothing saved when no envelope is a Savings one', () => {
    expect(savedSplit([env(null, 1_000)]).saved).toBe(0);
  });
});
