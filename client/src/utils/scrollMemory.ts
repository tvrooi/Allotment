// Scroll offsets per history entry, so browser Back and Forward return to where a list was
// (#245). In memory only: a reload or a fresh visit starts at the top. Read through
// hooks/useScrollMemory.ts, which every page-level scroll container uses.

/** Entries kept: the oldest is forgotten first */
export const MAX_REMEMBERED = 100;

const offsets = new Map<string, number>();

export function rememberScroll(key: string, top: number) {
  offsets.delete(key);
  offsets.set(key, top);
  if (offsets.size > MAX_REMEMBERED) offsets.delete(offsets.keys().next().value!);
}

export const recallScroll = (key: string) => offsets.get(key);

/** For tests */
export const forgetScrolls = () => offsets.clear();

/** The parts of a scroll container this reads and moves (an element, or a test's stand-in) */
export interface Scroller {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  addEventListener(type: string, fn: () => void, options?: AddEventListenerOptions): void;
  removeEventListener(type: string, fn: () => void): void;
}

/** Calls onChange whenever the container's content may have grown; returns a stop function */
export type Watch = (onChange: () => void) => () => void;

const watchContent =
  (el: HTMLElement): Watch =>
  (onChange) => {
    const resized = new ResizeObserver(onChange);
    resized.observe(el);
    const added = new MutationObserver(() => {
      for (const child of el.children) resized.observe(child);
      onChange();
    });
    for (const child of el.children) resized.observe(child);
    added.observe(el, { childList: true, subtree: true });
    return () => {
      resized.disconnect();
      added.disconnect();
    };
  };

/** What says the person is scrolling themselves: restoring then stops, never fighting them */
const INTENT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/**
 * Scrolls to `top` as soon as the content is tall enough (rows often arrive after the page),
 * once. Observers, not timers: nothing polls. Returns a function that stops waiting.
 */
export function restoreScroll(
  el: Scroller,
  top: number,
  watch: Watch = watchContent(el as HTMLElement),
): () => void {
  let unwatch = () => {};
  const stop = () => {
    unwatch();
    for (const type of INTENT) el.removeEventListener(type, stop);
  };
  const tryRestore = () => {
    if (el.scrollHeight - el.clientHeight < top) return false;
    el.scrollTop = top;
    stop();
    return true;
  };
  if (tryRestore()) return stop;
  unwatch = watch(tryRestore);
  for (const type of INTENT) el.addEventListener(type, stop, { passive: true });
  return stop;
}

export interface Entry {
  key: string;
  pathname: string;
}

/**
 * What a scroll container does as the app moves from one history entry to another (or mounts
 * on one): Back and Forward put back the offset saved for the entry, the top included; a
 * filter change that replaces the entry carries the current offset over to its new key, so
 * Back finds it; a different page starts at the top. Returns a function that stops restoring.
 */
export function enterEntry(
  el: Scroller,
  from: Entry,
  to: Entry & { navigation: 'POP' | 'PUSH' | 'REPLACE' },
  watch?: Watch,
): () => void {
  const saved = recallScroll(to.key);
  // Back and Forward, or a list mounting on an entry it was scrolled in before (it was still
  // loading when the entry came back): a new entry has nothing saved
  if (saved !== undefined && (to.navigation === 'POP' || from.key === to.key))
    return restoreScroll(el, saved, watch);
  if (from.key !== to.key) {
    if (from.pathname !== to.pathname) el.scrollTop = 0;
    else if (to.navigation === 'REPLACE') {
      // The replaced entry's offset goes with it: as saved, or where the list is now. A list
      // that mounted after the replace (still loading on Back) is moved there once it can be.
      const carried = recallScroll(from.key) ?? el.scrollTop;
      rememberScroll(to.key, carried);
      if (el.scrollTop < carried) return restoreScroll(el, carried, watch);
    }
  }
  return () => {};
}

/**
 * One scroll container's view of the history: the entry it is on, followed even while its
 * element is missing (a page drawing its loading state), with a replace in the meantime
 * handing the saved offset on, so the element finds it when it arrives. useScrollMemory
 * holds one per container.
 */
export function createScrollTracker(initial: Entry) {
  let seen = initial;
  return {
    enter(
      el: Scroller | null,
      to: Entry & { navigation: 'POP' | 'PUSH' | 'REPLACE' },
      watch?: Watch,
    ) {
      const from = seen;
      seen = { key: to.key, pathname: to.pathname };
      if (el) return enterEntry(el, from, to, watch);
      // No element yet: a replace still hands the saved offset on to the new entry
      const saved = recallScroll(from.key);
      if (to.navigation === 'REPLACE' && from.pathname === to.pathname && saved !== undefined)
        rememberScroll(to.key, saved);
      return () => {};
    },
    /** Files the element's offset under the entry it shows */
    save(el: Scroller) {
      rememberScroll(seen.key, el.scrollTop);
    },
  };
}
