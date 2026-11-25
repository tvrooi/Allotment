import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_REMEMBERED,
  createScrollTracker,
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

type Nav = 'POP' | 'PUSH' | 'REPLACE';
const at = (key: string, pathname: string, navigation: Nav) => ({ key, pathname, navigation });

/** A container on `first`, arrived at by `how`, with its element attached */
function track(first: { key: string; pathname: string }, how: Nav, contentHeight = 3000) {
  const scroller = fakeScroller(contentHeight);
  const tracker = createScrollTracker(first, how);
  const detach = tracker.attach(scroller.el);
  tracker.enter(scroller.el, at(first.key, first.pathname, how), scroller.watch);
  return { ...scroller, tracker, detach };
}

describe('moving between history entries (#245)', () => {
  beforeEach(forgetScrolls);

  it('Back to an entry saved at the top goes to the top, even on the same page', () => {
    const { el, tracker, watch } = track({ key: 'b', pathname: '/transactions' }, 'PUSH');
    rememberScroll('a', 0);
    el.scrollTop = 900;
    tracker.enter(el, at('a', '/transactions', 'POP'), watch);
    expect(el.scrollTop).toBe(0);
  });

  it('a filter change that replaces the entry keeps the offset for a later Back', () => {
    const { el, tracker, watch } = track({ key: 'a', pathname: '/accounts/x' }, 'PUSH');
    el.scrollTop = 1200;
    el.fire('scroll');
    tracker.enter(el, at('a2', '/accounts/x', 'REPLACE'), watch);
    expect(recallScroll('a2')).toBe(1200);
    tracker.enter(el, at('p', '/payees/y', 'PUSH'), watch);
    expect(el.scrollTop).toBe(0);
    tracker.enter(el, at('a2', '/accounts/x', 'POP'), watch);
    expect(el.scrollTop).toBe(1200);
  });

  it('a new page starts at the top; a new entry of the same page keeps its place', () => {
    const { el, tracker, watch } = track({ key: 'a', pathname: '/goals' }, 'PUSH');
    el.scrollTop = 700;
    tracker.enter(el, at('b', '/goals', 'PUSH'), watch);
    expect(el.scrollTop).toBe(700);
    tracker.enter(el, at('c', '/budget', 'PUSH'), watch);
    expect(el.scrollTop).toBe(0);
  });

  it('a container mounting on a Back entry restores; on a fresh visit it stays at the top', () => {
    rememberScroll('a', 450);
    const back = track({ key: 'a', pathname: '/payees' }, 'POP');
    expect(back.el.scrollTop).toBe(450);
    rememberScroll('b', 450);
    const fresh = track({ key: 'b', pathname: '/payees' }, 'PUSH');
    expect(fresh.el.scrollTop).toBe(0);
  });

  it('Back while loading, then a replace before the list mounts: the list finds its offset', () => {
    rememberScroll('k1', 1200);
    const scroller = fakeScroller(3000);
    const tracker = createScrollTracker({ key: 'k1', pathname: '/accounts' }, 'POP');
    tracker.enter(null, at('k1', '/accounts', 'POP'), scroller.watch);
    tracker.enter(null, at('k2', '/accounts', 'REPLACE'), scroller.watch);
    tracker.attach(scroller.el);
    tracker.enter(scroller.el, at('k2', '/accounts', 'REPLACE'), scroller.watch);
    expect(scroller.el.scrollTop).toBe(1200);
    scroller.el.scrollTop = 300;
    scroller.el.fire('scroll');
    expect(recallScroll('k2')).toBe(300);
  });
});

describe('the page moves by itself only on Back and Forward (#245)', () => {
  beforeEach(forgetScrolls);

  it('a filter change on a fresh visit never jumps back to the old offset', () => {
    const { el, tracker, watch } = track({ key: 'a', pathname: '/transactions' }, 'PUSH');
    el.scrollTop = 1200;
    el.fire('scroll');
    // The list reloads shorter and the browser clamps the offset
    el.scrollHeight = 600;
    el.scrollTop = 100;
    tracker.enter(el, at('a2', '/transactions', 'REPLACE'), watch);
    el.grow(5000);
    expect(el.scrollTop).toBe(100);
    // Its remembered value still serves a later Back to it
    expect(recallScroll('a2')).toBe(1200);
  });

  it('a container that remounts on a fresh visit (Safe mode on Goals) stays put', () => {
    const first = track({ key: 'g', pathname: '/goals' }, 'PUSH');
    first.el.scrollTop = 800;
    first.el.fire('scroll');
    first.detach();
    const other = fakeScroller(3000);
    first.tracker.attach(other.el);
    first.tracker.enter(other.el, at('g', '/goals', 'PUSH'), other.watch);
    expect(other.el.scrollTop).toBe(0);
  });

  it('once the person scrolls on a Back entry, a filter change arms no restore', () => {
    rememberScroll('a', 1200);
    const { el, tracker, watch } = track({ key: 'a', pathname: '/transactions' }, 'POP', 600);
    expect(el.scrollTop).toBe(0); // still too short to restore
    el.fire('wheel'); // the person scrolls (the short list doesn't move)
    tracker.enter(el, at('a2', '/transactions', 'REPLACE'), watch);
    el.grow(5000);
    expect(el.scrollTop).toBe(0);
    expect(recallScroll('a2')).toBe(0);
  });
});
