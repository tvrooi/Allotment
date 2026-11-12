import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_REMEMBERED,
  enterEntry,
  forgetScrolls,
  recallScroll,
  rememberScroll,
  restoreScroll,
  type Scroller,
} from './scrollMemory';

/** A scroll container whose content grows when told, like a list whose rows arrive late */
function fakeScroller(contentHeight: number) {
  const listeners = new Map<string, Set<() => void>>();
  let changed: () => void = () => {};
  const el: Scroller & { grow: (h: number) => void; fire: (type: string) => void } = {
    clientHeight: 500,
    scrollHeight: contentHeight,
    scrollTop: 0,
    addEventListener: (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
    grow(h: number) {
      el.scrollHeight = h;
      changed();
    },
    fire(type: string) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
  };
  const watch = (onChange: () => void) => {
    changed = onChange;
    return () => {
      changed = () => {};
    };
  };
  return { el, watch };
}

describe('scroll memory (#245)', () => {
  beforeEach(forgetScrolls);

  it('remembers an offset per history entry, bounded', () => {
    rememberScroll('a:main', 300);
    rememberScroll('b:main', 40);
    expect(recallScroll('a:main')).toBe(300);
    for (let i = 0; i < MAX_REMEMBERED; i++) rememberScroll(`k${i}:main`, i);
    // The oldest entries go first
    expect(recallScroll('a:main')).toBeUndefined();
    expect(recallScroll(`k${MAX_REMEMBERED - 1}:main`)).toBe(MAX_REMEMBERED - 1);
  });

  it('restores at once when the content is already tall enough', () => {
    const { el, watch } = fakeScroller(3000);
    restoreScroll(el, 1200, watch);
    expect(el.scrollTop).toBe(1200);
  });

  it('waits for the content to be tall enough, then restores once', () => {
    const { el, watch } = fakeScroller(600);
    restoreScroll(el, 1200, watch);
    expect(el.scrollTop).toBe(0);
    el.grow(1000);
    expect(el.scrollTop).toBe(0);
    el.grow(2000);
    expect(el.scrollTop).toBe(1200);
    el.scrollTop = 50;
    el.grow(4000);
    expect(el.scrollTop).toBe(50);
  });

  it("gives way to the person's own scrolling", () => {
    for (const intent of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
      const { el, watch } = fakeScroller(600);
      restoreScroll(el, 1200, watch);
      el.fire(intent);
      el.grow(3000);
      expect(el.scrollTop).toBe(0);
    }
  });

  it('stops when the page goes elsewhere first', () => {
    const { el, watch } = fakeScroller(600);
    const stop = restoreScroll(el, 1200, watch);
    stop();
    el.grow(3000);
    expect(el.scrollTop).toBe(0);
  });
});

describe('moving between history entries (#245)', () => {
  beforeEach(forgetScrolls);
  const at = (key: string, pathname: string, navigation: 'POP' | 'PUSH' | 'REPLACE') => ({
    key,
    pathname,
    navigation,
  });

  it('Back to an entry saved at the top goes to the top, even on the same page', () => {
    const { el, watch } = fakeScroller(3000);
    rememberScroll('a', 0);
    el.scrollTop = 900; // the other entry of the same page (other filters) was scrolled
    enterEntry(el, { key: 'b', pathname: '/transactions' }, at('a', '/transactions', 'POP'), watch);
    expect(el.scrollTop).toBe(0);
  });

  it('a filter change that replaces the entry keeps the offset for Back', () => {
    const { el, watch } = fakeScroller(3000);
    el.scrollTop = 1200;
    rememberScroll('a', 1200);
    enterEntry(
      el,
      { key: 'a', pathname: '/accounts/x' },
      at('a2', '/accounts/x', 'REPLACE'),
      watch,
    );
    expect(recallScroll('a2')).toBe(1200);
    // Later, Back to the replaced entry
    el.scrollTop = 0;
    enterEntry(el, { key: 'p', pathname: '/payees/y' }, at('a2', '/accounts/x', 'POP'), watch);
    expect(el.scrollTop).toBe(1200);
  });

  it('a new page starts at the top; a new entry of the same page keeps its place', () => {
    const { el, watch } = fakeScroller(3000);
    el.scrollTop = 700;
    enterEntry(el, { key: 'a', pathname: '/goals' }, at('b', '/goals', 'PUSH'), watch);
    expect(el.scrollTop).toBe(700);
    enterEntry(el, { key: 'b', pathname: '/goals' }, at('c', '/budget', 'PUSH'), watch);
    expect(el.scrollTop).toBe(0);
  });

  it('a container that mounts on its entry restores on Back, and stays put otherwise', () => {
    const { el, watch } = fakeScroller(3000);
    rememberScroll('a', 450);
    enterEntry(el, { key: 'a', pathname: '/payees' }, at('a', '/payees', 'POP'), watch);
    expect(el.scrollTop).toBe(450);
    const other = fakeScroller(3000);
    enterEntry(
      other.el,
      { key: 'b', pathname: '/payees' },
      at('b', '/payees', 'PUSH'),
      other.watch,
    );
    expect(other.el.scrollTop).toBe(0);
  });
});
