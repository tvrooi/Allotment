import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOOMED_KEY, firstBloom } from './growth';

describe('firstBloom (#241)', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is true the first time a goal is seen reached on this device, then false', () => {
    expect(firstBloom('g1')).toBe(true);
    expect(firstBloom('g1')).toBe(false);
    expect(firstBloom('g2')).toBe(true);
    expect(JSON.parse(store.get(BLOOMED_KEY)!)).toEqual(['g1', 'g2']);
  });

  it('keeps only the most recent goals', () => {
    for (let i = 0; i < 205; i++) firstBloom(`g${i}`);
    const kept = JSON.parse(store.get(BLOOMED_KEY)!) as string[];
    expect(kept).toHaveLength(200);
    expect(kept.at(-1)).toBe('g204');
  });

  it('stays still rather than failing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(firstBloom('g1')).toBe(false);
  });
});
