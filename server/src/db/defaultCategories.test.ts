import { describe, expect, it } from 'vitest';
import { categoryTemplate } from './defaultCategories.js';

describe('category templates for new budgets', () => {
  it('call the catch-all "Other", not "Uncategorized" (which is what a missing category is)', () => {
    for (const env of ['default', 'au']) {
      const names = categoryTemplate(env).flatMap((g) => g.categories.map((c) => c.name));
      expect(names).not.toContain('Uncategorized');
    }
    const other = categoryTemplate('default').find((g) => g.name === 'Other');
    expect(other?.categories.map((c) => c.name)).toContain('Other');
  });
});
