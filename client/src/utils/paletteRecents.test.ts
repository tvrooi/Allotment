import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSignedInPerson } from '../api/person';
import {
  MAX_RECENTS,
  PALETTE_RECENTS_KEY,
  clearRecents,
  readRecents,
  rememberRecent,
} from './paletteRecents';

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  setSignedInPerson(null);
});
afterEach(() => vi.unstubAllGlobals());

const page = (name: string) => ({ name, path: `/${name.toLowerCase()}` });

describe('the palette’s recent destinations', () => {
  it('keeps the newest first, once each, and no more than the cap', () => {
    rememberRecent(page('Budget'));
    rememberRecent(page('Goals'));
    rememberRecent(page('Budget'));
    expect(readRecents().map((r) => r.name)).toEqual(['Budget', 'Goals']);
    // Two goals both open on Goals: each is its own recent
    rememberRecent({ name: 'Holiday', path: '/goals' });
    rememberRecent({ name: 'Car', path: '/goals' });
    expect(readRecents().map((r) => r.name)).toEqual(['Car', 'Holiday', 'Budget', 'Goals']);
    for (let i = 0; i < 12; i++) rememberRecent(page(`Page${i}`));
    const recents = readRecents();
    expect(recents).toHaveLength(MAX_RECENTS);
    expect(recents[0].name).toBe('Page11');
  });

  it('stores names and paths only, under a flybudget key', () => {
    rememberRecent({ name: 'Everyday', path: '/accounts/a1' });
    expect(JSON.parse(store.get(PALETTE_RECENTS_KEY)!)).toEqual({
      person: null,
      items: [{ name: 'Everyday', path: '/accounts/a1' }],
    });
  });

  it('is forgotten when cleared, and the offline copy’s clearing (a budget switch) clears it', async () => {
    rememberRecent(page('Budget'));
    clearRecents();
    expect(readRecents()).toEqual([]);
    rememberRecent(page('Budget'));
    // The offline copy's module, without the browser-only stores it brings along
    vi.doMock('../store/connectionStore', () => ({ useConnectionStore: {} }));
    vi.doMock('../store/preferencesStore', () => ({ usePreferencesStore: {} }));
    vi.doMock('../offline/storage', () => ({ deleteValue: async () => {} }));
    const { clearOfflineCopy } = await import('../offline/snapshot');
    await clearOfflineCopy();
    expect(store.has(PALETTE_RECENTS_KEY)).toBe(false);
  });

  it('shows one person’s recents to nobody else (multi-user mode)', () => {
    setSignedInPerson('alex');
    rememberRecent(page('Budget'));
    expect(readRecents()).toHaveLength(1);
    setSignedInPerson('sam');
    expect(readRecents()).toEqual([]);
  });

  it('ignores unreadable data and blocked storage', () => {
    store.set(PALETTE_RECENTS_KEY, '{not json');
    expect(readRecents()).toEqual([]);
    store.set(
      PALETTE_RECENTS_KEY,
      JSON.stringify({ person: null, items: [{ name: 1 }, page('Ok')] }),
    );
    expect(readRecents().map((r) => r.name)).toEqual(['Ok']);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readRecents()).toEqual([]);
    expect(() => rememberRecent(page('Budget'))).not.toThrow();
    expect(() => clearRecents()).not.toThrow();
  });
});
