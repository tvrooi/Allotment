import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalPlant } from './GoalPlant';

// The bloom is remembered only once a plant is on the page (#241). A render React throws away
// (a suspended or interrupted mount) must not use up a goal's one bloom; a static render, which
// runs no effects, stands in for it.
describe('GoalPlant (#241)', () => {
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

  it('records no bloom for a reached goal whose render is never shown', () => {
    const html = renderToStaticMarkup(
      createElement(GoalPlant, { goalId: 'g1', pct: 100, complete: true }),
    );
    expect(html).toMatch(/data-stage="flower"/);
    expect(store.size).toBe(0);
  });
});
