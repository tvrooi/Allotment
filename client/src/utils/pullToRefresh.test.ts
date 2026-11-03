import { describe, expect, it } from 'vitest';
import {
  PULL_MAX,
  PULL_THRESHOLD,
  atTopOfEverything,
  isPullGesture,
  pullDistance,
} from './pullToRefresh';

describe('pullDistance', () => {
  it('does not move for an upward or zero drag', () => {
    expect(pullDistance(0)).toBe(0);
    expect(pullDistance(-40)).toBe(0);
  });

  it('grows with the drag and never passes the maximum', () => {
    expect(pullDistance(80)).toBeLessThan(pullDistance(160));
    expect(pullDistance(10_000)).toBe(PULL_MAX);
  });

  it('needs a deliberate pull to reach the threshold', () => {
    expect(pullDistance(60)).toBeLessThan(PULL_THRESHOLD);
    expect(pullDistance(220)).toBeGreaterThanOrEqual(PULL_THRESHOLD);
  });
});

describe('isPullGesture', () => {
  it('waits on small moves', () => {
    expect(isPullGesture(2, 3)).toBeNull();
  });

  it('accepts a mostly vertical pull down', () => {
    expect(isPullGesture(4, 30)).toBe(true);
  });

  it('rejects sideways swipes and upward drags', () => {
    expect(isPullGesture(30, 20)).toBe(false);
    expect(isPullGesture(0, -30)).toBe(false);
  });
});

describe('atTopOfEverything', () => {
  // Just the two properties the check reads, as a chain of elements would have them
  const tree = (innerTop: number, outerTop: number) => {
    const outer = { scrollTop: outerTop, parentElement: null } as unknown as Element;
    const inner = { scrollTop: innerTop, parentElement: outer } as unknown as Element;
    const leaf = { scrollTop: 0, parentElement: inner } as unknown as Element;
    return { outer, leaf };
  };

  it('is true when neither the list nor the page has scrolled', () => {
    const { outer, leaf } = tree(0, 0);
    expect(atTopOfEverything(leaf, outer)).toBe(true);
  });

  it('is false when an inner list can still scroll up', () => {
    const { outer, leaf } = tree(120, 0);
    expect(atTopOfEverything(leaf, outer)).toBe(false);
  });

  it('is false when the page itself has scrolled', () => {
    const { outer, leaf } = tree(0, 300);
    expect(atTopOfEverything(leaf, outer)).toBe(false);
  });
});
