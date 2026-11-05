import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOUSING_CATEGORIES, categoryTemplate } from './defaultCategories.js';

describe('category templates for new budgets', () => {
  it('call the catch-all "Other", not "Uncategorized" (which is what a missing category is)', () => {
    for (const env of ['default', 'au']) {
      const names = categoryTemplate(env).flatMap((g) => g.categories.map((c) => c.name));
      expect(names).not.toContain('Uncategorized');
      expect(names).not.toContain('Uncategorised');
    }
    const other = categoryTemplate('default').find((g) => g.name === 'Other');
    expect(other?.categories.map((c) => c.name)).toContain('Other');
  });
});

// The client finds these categories by their stored names. A display-casing pass over the UI's
// text once rewrote "Property Tax" to "Property tax" there, so renters and owners stopped
// matching (a case-sensitive lookup, not a label).
describe('category names the client looks up', () => {
  const clientFile = (path: string) =>
    readFileSync(new URL(`../../../client/src/${path}`, import.meta.url), 'utf8');

  it('the rent or own question lists exactly the stored housing names', () => {
    const source = clientFile('components/budget/RentOrOwn.tsx');
    const block = source.slice(
      source.indexOf('const ONLY_FOR'),
      source.indexOf('};', source.indexOf('const ONLY_FOR')),
    );
    const quoted = (text: string) => [...text.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const own = quoted(block.slice(block.indexOf('own:')));
    const rent = quoted(block.slice(block.indexOf('rent:'), block.indexOf('own:')));
    expect(rent).toEqual(HOUSING_CATEGORIES.rent);
    expect(own).toEqual(HOUSING_CATEGORIES.own);
  });

  it("the payment plan's late fee finds the seeded Bank Fees category", () => {
    const names = categoryTemplate('default').flatMap((g) => g.categories.map((c) => c.name));
    const lookup = clientFile('components/plans/PlanCard.tsx').match(/c\.name === '([^']+)'/);
    expect(lookup).not.toBeNull();
    expect(names).toContain(lookup![1]);
  });
});
