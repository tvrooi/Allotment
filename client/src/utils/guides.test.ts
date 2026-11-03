import { describe, expect, it } from 'vitest';
import type { GuideProgress } from '../api/guides';
import { GUIDES, TIPS, guideById, welcomeTour } from '../guides';
import type { Guide } from '../guides/types';
import {
  applyGuideUpdate,
  bannerFor,
  guideClosedUpdate,
  guideForPage,
  guideStatus,
  placeCard,
  spotlightRect,
  tipVisible,
} from './guides';

const fresh: GuideProgress = {
  tipsEnabled: true,
  pageGuidesEnabled: true,
  welcomeTour: 'offer',
  guidesNotice: false,
  seenGuides: {},
  dismissedTips: [],
};
const budget = guideById('budget')!;

describe('guide content', () => {
  // Every app source file, as text: the markers guides point at must exist
  const sources = Object.values(
    import.meta.glob<string>('../**/*.tsx', { query: '?raw', import: 'default', eager: true }),
  ).join('\n');

  it('every highlighted element has its data-guide marker in the app', () => {
    const targets = GUIDES.flatMap((g) => g.steps.flatMap((s) => s.target ?? []));
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(sources, `data-guide="${target}"`).toContain(`data-guide="${target}"`);
    }
  });

  it('ids are unique and storable, and steps have words', () => {
    const ids = GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tipIds = Object.values(TIPS).map((t) => t.id);
    expect(new Set(tipIds).size).toBe(tipIds.length);
    // The server's rule (services/guideService.ts)
    for (const id of [...ids, ...tipIds]) expect(id).toMatch(/^[a-z0-9][a-z0-9.-]{0,63}$/);
    for (const g of GUIDES) {
      expect(g.version).toBeGreaterThanOrEqual(1);
      expect(g.steps.length).toBeGreaterThan(0);
      for (const s of g.steps) expect(s.title && s.body).toBeTruthy();
    }
  });

  it('a page has at most one guide', () => {
    const pages = GUIDES.flatMap((g) => g.page ?? []);
    expect(new Set(pages).size).toBe(pages.length);
  });
});

describe('which banner a page shows', () => {
  it('offers the welcome tour to a new budget on the dashboard only', () => {
    expect(bannerFor('/dashboard', fresh, GUIDES, false)).toEqual({ kind: 'welcome' });
    expect(bannerFor('/accounts', fresh, GUIDES, false)).toBeNull();
    // A page's own guide waits until the tour is taken or turned down
    expect(bannerFor('/budget', fresh, GUIDES, false)).toBeNull();
  });

  it('shows nothing while a guide runs or before progress loads', () => {
    expect(bannerFor('/dashboard', fresh, GUIDES, true)).toBeNull();
    expect(bannerFor('/dashboard', undefined, GUIDES, false)).toBeNull();
  });

  it('tells people who were here before guides where they are, on any page', () => {
    const before = { ...fresh, welcomeTour: 'dismissed' as const, guidesNotice: true };
    expect(bannerFor('/budget', before, GUIDES, false)).toEqual({ kind: 'notice' });
  });

  it('offers a page’s guide until seen, and again once it changes', () => {
    const toured = { ...fresh, welcomeTour: 'done' as const };
    expect(bannerFor('/budget', toured, GUIDES, false)).toEqual({
      kind: 'page',
      guide: budget,
      updated: false,
    });
    expect(bannerFor('/budget/', toured, GUIDES, false)).toMatchObject({ kind: 'page' });
    const seen = { ...toured, seenGuides: { budget: budget.version } };
    expect(bannerFor('/budget', seen, GUIDES, false)).toBeNull();
    const newer: Guide = { ...budget, version: budget.version + 1 };
    expect(bannerFor('/budget', seen, [newer], false)).toEqual({
      kind: 'page',
      guide: newer,
      updated: true,
    });
    expect(bannerFor('/budget', { ...toured, pageGuidesEnabled: false }, GUIDES, false)).toBeNull();
  });

  it('finds a guide by page, not by prefix', () => {
    expect(guideForPage('/budget', GUIDES)).toBe(budget);
    expect(guideForPage('/budget/year', GUIDES)).toBeUndefined();
    expect(guideStatus(budget, fresh)).toBe('new');
  });
});

describe('progress', () => {
  it('tips show while on and not dismissed, once the welcome tour is decided', () => {
    const toured = { ...fresh, welcomeTour: 'done' as const };
    expect(tipVisible('a', toured)).toBe(true);
    expect(tipVisible('a', fresh)).toBe(false);
    expect(tipVisible('a', { ...toured, dismissedTips: ['a'] })).toBe(false);
    expect(tipVisible('a', { ...toured, tipsEnabled: false })).toBe(false);
    expect(tipVisible('a', undefined)).toBe(false);
  });

  it('updates merge like the server does', () => {
    const before = { ...fresh, seenGuides: { welcome: 2 }, dismissedTips: ['a'] };
    expect(
      applyGuideUpdate(before, {
        seenGuides: { welcome: 1, budget: 1 },
        dismissedTips: ['a', 'b'],
        guidesNotice: false,
        tipsEnabled: false,
      }),
    ).toEqual({
      ...fresh,
      tipsEnabled: false,
      seenGuides: { welcome: 2, budget: 1 },
      dismissedTips: ['a', 'b'],
    });
  });

  it('closing the welcome tour records whether it was finished', () => {
    expect(guideClosedUpdate(welcomeTour, true)).toEqual({
      seenGuides: { welcome: welcomeTour.version },
      welcomeTour: 'done',
    });
    expect(guideClosedUpdate(welcomeTour, false).welcomeTour).toBe('dismissed');
    expect(guideClosedUpdate(budget, false)).toEqual({ seenGuides: { budget: budget.version } });
  });
});

describe('placing a step’s card', () => {
  const viewport = { width: 1400, height: 900 };
  const card = { width: 340, height: 200 };

  it('goes in the middle with nothing to point at', () => {
    expect(placeCard(null, card, viewport, false)).toEqual({ mode: 'center' });
  });

  it('goes below by preference, kept on screen', () => {
    expect(
      placeCard({ top: 20, left: 1300, width: 40, height: 30 }, card, viewport, false),
    ).toEqual({ mode: 'float', side: 'below', top: 62, left: 1400 - 340 - 16 });
  });

  it('goes above an element near the bottom, then beside a tall one', () => {
    expect(
      placeCard({ top: 800, left: 100, width: 200, height: 40 }, card, viewport, false),
    ).toMatchObject({ side: 'above', top: 800 - 12 - 200 });
    expect(
      placeCard({ top: 0, left: 20, width: 220, height: 900 }, card, viewport, false),
    ).toMatchObject({ side: 'right', left: 252 });
  });

  it('covers part of an element that fills the screen', () => {
    expect(
      placeCard({ top: 0, left: 0, width: 1400, height: 900 }, card, viewport, false),
    ).toMatchObject({ side: 'below', top: 900 - 200 - 16 });
  });

  it('is a sheet on phones, on the edge away from the element', () => {
    const phone = { width: 390, height: 844 };
    expect(placeCard({ top: 700, left: 0, width: 50, height: 50 }, card, phone, true)).toEqual({
      mode: 'sheet',
      edge: 'top',
    });
    expect(placeCard({ top: 10, left: 0, width: 50, height: 50 }, card, phone, true)).toEqual({
      mode: 'sheet',
      edge: 'bottom',
    });
  });

  it('pads the highlight and keeps it on screen', () => {
    expect(spotlightRect({ top: 2, left: 100, width: 50, height: 20 }, viewport)).toEqual({
      top: 0,
      left: 94,
      width: 62,
      height: 28,
    });
  });
});
