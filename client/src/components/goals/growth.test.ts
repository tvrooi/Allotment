import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOOMED_KEY, firstBloom, growthStage } from './growth';

describe('growthStage (#241)', () => {
  it('grows from a seed through a sprout, leaves and a bud as the goal fills', () => {
    expect(growthStage(0, false)).toBe('seed');
    expect(growthStage(9.9, false)).toBe('seed');
    expect(growthStage(10, false)).toBe('sprout');
    expect(growthStage(25, false)).toBe('sprout');
    expect(growthStage(40, false)).toBe('leaf');
    expect(growthStage(69, false)).toBe('leaf');
    expect(growthStage(70, false)).toBe('bud');
    expect(growthStage(75, false)).toBe('bud');
  });

  it('flowers only when the goal is reached, not at a rounded 100%', () => {
    expect(growthStage(100, false)).toBe('bud');
    expect(growthStage(100, true)).toBe('flower');
  });
});

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
