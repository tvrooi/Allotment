import { describe, expect, it } from 'vitest';
import { knownUpCategories, mapUpCategory } from './upCategoryMap.js';
import { upImportRows, upTransactionSchema } from './upTransactions.js';
import { upMockTransaction } from '../test/upMock.js';
import { payInterval } from './importTidy.js';

const names = (...n: string[]) => new Map(n.map((x) => [x.toLowerCase(), `id:${x}`]));

describe('Up category mapping', () => {
  it('maps a slug to the first matching name in either category template', () => {
    expect(mapUpCategory('groceries', names('Groceries'))).toBe('id:Groceries');
    expect(mapUpCategory('takeaway', names('Fast Food'))).toBe('id:Fast Food');
    expect(mapUpCategory('takeaway', names('Takeaway & Delivery', 'Fast Food'))).toBe(
      'id:Takeaway & Delivery',
    );
    expect(mapUpCategory('fuel', names('Gas / Fuel'))).toBe('id:Gas / Fuel');
  });
  it('leaves a row uncategorised for no category, an unknown slug or a missing FlyBudget name', () => {
    expect(mapUpCategory(null, names('Groceries'))).toBeNull();
    expect(mapUpCategory('a-category-up-adds-later', names('Groceries'))).toBeNull();
    expect(mapUpCategory('groceries', names('Pharmacy'))).toBeNull();
    // Up's parent categories are too broad to guess from
    expect(mapUpCategory('home', names('Home Maintenance'))).toBeNull();
  });
  it('covers the slugs Up documents', () => {
    expect(knownUpCategories()).toEqual(
      expect.arrayContaining(['groceries', 'restaurants-and-cafes', 'rent-and-mortgage', 'fuel']),
    );
  });
  it('reads Up’s category, tolerates a new slug, and never categorises a transfer', () => {
    const raw = (category: string | null, transfer: boolean) => {
      const tx = upMockTransaction('t', -500);
      return upTransactionSchema.parse({
        ...tx,
        relationships: {
          ...tx.relationships,
          transferAccount: { data: transfer ? { id: 'saver' } : null },
          category: { data: category ? { type: 'categories', id: category } : null },
          parentCategory: { data: { type: 'categories', id: 'good-life' } },
        },
      });
    };
    expect(upImportRows(raw('groceries', false), 'spending')[0].upCategory).toBe('groceries');
    expect(upImportRows(raw('brand-new-slug', false), 'spending')[0].upCategory).toBe(
      'brand-new-slug',
    );
    expect(upImportRows(raw(null, false), 'spending')[0].upCategory).toBeNull();
    expect(upImportRows(raw('groceries', true), 'spending')[0].upCategory).toBeNull();
    // The original shape, with no category relationships at all, still parses
    expect(
      upImportRows(upTransactionSchema.parse(upMockTransaction('c', -1)), 'spending')[0].upCategory,
    ).toBeNull();
  });
});

describe('pay interval', () => {
  const every = (start: string, gap: number, n: number) =>
    Array.from({ length: n }, (_, i) =>
      new Date(Date.parse(start) + i * gap * 86_400_000).toISOString().slice(0, 10),
    );
  it('recognises weekly, fortnightly and monthly pay', () => {
    expect(payInterval(every('2026-08-01', 7, 5))?.schedule).toBe('weekly');
    expect(payInterval(every('2026-08-01', 14, 4))?.days).toBe(14);
    expect(payInterval(['2026-07-31', '2026-08-31', '2026-09-30'])?.schedule).toBe('monthly');
  });
  it('needs three deposits, and a steady gap', () => {
    expect(payInterval(every('2026-08-01', 14, 2))).toBeNull();
    expect(payInterval(['2026-08-01', '2026-08-10', '2026-09-20'])).toBeNull();
  });
  it('forgives one missed deposit in a longer run only', () => {
    const run = every('2026-01-01', 14, 6);
    run.splice(3, 1);
    expect(payInterval(run)?.days).toBe(14);
    const two = every('2026-01-01', 14, 7);
    two.splice(5, 1);
    two.splice(2, 1);
    expect(payInterval(two)).toBeNull();
    // A short run has no room for a miss
    const short = every('2026-01-01', 14, 4);
    short.splice(2, 1);
    expect(payInterval(short)).toBeNull();
  });
});
