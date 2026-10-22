import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_LAYOUTS,
  HOME_CARDS,
  moveCard,
  normalizeLayout,
  setCardHidden,
  visibleCards,
  type HomeCardId,
} from './homeCards';
import { migratePreferences } from '../store/preferencesStore';

const ids = HOME_CARDS.map((c) => c.id) as HomeCardId[];

describe('home card layout', () => {
  it('uses the defaults when nothing usable is saved', () => {
    expect(normalizeLayout(undefined, 'desktop')).toEqual(DEFAULT_LAYOUTS.desktop);
    expect(normalizeLayout('nonsense', 'phone')).toEqual(DEFAULT_LAYOUTS.phone);
    expect(new Set(DEFAULT_LAYOUTS.phone.order)).toEqual(new Set(ids));
  });

  it('always draws every known card exactly once, whatever was saved', () => {
    const saved = fc.record({
      order: fc.array(fc.oneof(fc.constantFrom(...ids), fc.string()), { maxLength: 12 }),
      hidden: fc.array(fc.oneof(fc.constantFrom(...ids), fc.string()), { maxLength: 12 }),
    });
    fc.assert(
      fc.property(saved, fc.constantFrom('desktop' as const, 'phone' as const), (s, factor) => {
        const layout = normalizeLayout(s, factor);
        expect([...layout.order].sort()).toEqual([...ids].sort());
        expect(layout.hidden.every((h) => ids.includes(h))).toBe(true);
        expect(new Set(layout.hidden).size).toBe(layout.hidden.length);
      }),
    );
  });

  it('keeps a saved order and slots in a card added later where the default has it', () => {
    const saved = { order: ['recent-transactions', 'net-worth'], hidden: ['net-worth'] };
    const layout = normalizeLayout(saved, 'desktop');
    expect(layout.order.slice(0, 2)).toEqual(['recent-transactions', 'net-worth']);
    expect(layout.order.indexOf('summary')).toBe(layout.order.indexOf('net-worth') + 1);
    expect(visibleCards(layout)).not.toContain('net-worth');
  });

  it('moves and hides cards without losing any', () => {
    let layout = DEFAULT_LAYOUTS.desktop;
    layout = moveCard(layout, 'summary', -1);
    expect(layout.order.slice(0, 2)).toEqual(['summary', 'net-worth']);
    expect(moveCard(layout, 'summary', -1)).toBe(layout);
    layout = setCardHidden(layout, 'summary', true);
    layout = setCardHidden(layout, 'summary', true);
    expect(layout.hidden).toEqual(['summary']);
    expect(visibleCards(setCardHidden(layout, 'summary', false))).toContain('summary');
  });

  it('migrates older preferences to keep the default layout and drops a malformed one', () => {
    expect(migratePreferences({ theme: 'dark' }, 1)).toEqual({ theme: 'dark' });
    expect(migratePreferences({ homeLayouts: 'broken' }, 1)).toEqual({});
    const good = { homeLayouts: { phone: { order: ['summary'], hidden: [] } } };
    expect(migratePreferences(good, 1)).toEqual(good);
  });
});
