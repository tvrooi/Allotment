import { describe, expect, it } from 'vitest';
import { DOCS_PAGES } from '../utils/project';
import { GUIDE_ARTICLES, articleFor } from './articles';

describe('the user guide', () => {
  it('has one article for every guide page', () => {
    const pages = GUIDE_ARTICLES.map((a) => a.page);
    expect(new Set(pages).size).toBe(pages.length);
    expect([...pages].sort()).toEqual([...DOCS_PAGES].sort());
    for (const a of GUIDE_ARTICLES) {
      expect(a.title && a.summary, a.page).toBeTruthy();
      expect(a.sections.length, a.page).toBeGreaterThan(0);
      const headings = a.sections.map((s) => s.heading);
      expect(new Set(headings).size, a.page).toBe(headings.length);
    }
  });

  it('every article is linked from a page of the app, not only from the guide', () => {
    // Every app source file but the guide's own, as text (comments are fine: a link is markup)
    const sources = Object.entries(
      import.meta.glob<string>('../**/*.tsx', { query: '?raw', import: 'default', eager: true }),
    )
      .filter(([path]) => !path.includes('/userGuide/') && !path.endsWith('/pages/Guide.tsx'))
      .map(([, text]) => text)
      .join('\n');
    for (const page of DOCS_PAGES) {
      expect(sources, `a link to /guide/${page}`).toMatch(
        new RegExp(`(page|learnMore)="${page}"|/guide/${page}\\b`),
      );
    }
  });

  it('finds an article by its page, and nothing for an unknown one', () => {
    expect(articleFor('payday-plans')?.title).toBe('Payday plans');
    expect(articleFor('long-term-forecast')?.title).toBe('Long-term forecast');
    expect(articleFor('no-such-page')).toBeUndefined();
    expect(articleFor(undefined)).toBeUndefined();
  });
});
