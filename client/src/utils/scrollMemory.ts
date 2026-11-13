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

type Navigation = 'POP' | 'PUSH' | 'REPLACE';

/**
 * One scroll container's view of the history (useScrollMemory holds one per container). The
 * page moves by itself only on Back and Forward: an entry reached that way gets its remembered
 * offset back, the top included, until the person scrolls or shows they mean to (then their
 * position is what's remembered). A filter change that replaces the entry carries the offset
 * forward as the new entry's remembered value, for a later Back, but moves nothing. A
 * different page starts at the top. It follows the entry even while its element is missing
 * (a page drawing its loading state), so the element finds its offset when it arrives.
 */
export function createScrollTracker(initial: Entry, arrival: Navigation) {
  let seen = initial;
  // Reached by Back or Forward, and the person hasn't scrolled since (a replace keeps it)
  let restoring = arrival === 'POP';
  return {
    enter(el: Scroller | null, to: Entry & { navigation: Navigation }, watch?: Watch) {
      const from = seen;
      seen = { key: to.key, pathname: to.pathname };
      if (from.key !== to.key) {
        if (to.navigation === 'POP') restoring = true;
        else if (to.navigation === 'PUSH') restoring = false;
        else if (from.pathname === to.pathname) {
          const carried = recallScroll(from.key) ?? el?.scrollTop;
          if (carried !== undefined) rememberScroll(to.key, carried);
        }
      }
      if (!el) return () => {};
      const saved = recallScroll(to.key);
      if (restoring && saved !== undefined) return restoreScroll(el, saved, watch);
      if (from.key !== to.key && from.pathname !== to.pathname) el.scrollTop = 0;
      return () => {};
    },
    /** Listens to the element: its scrolls are remembered for the entry it shows, and scroll
     * intent ends any restoring (its position, moved or not, becomes the remembered one) */
    attach(el: Scroller) {
      const save = () => rememberScroll(seen.key, el.scrollTop);
      const intent = () => {
        restoring = false;
        save();
      };
      el.addEventListener('scroll', save, { passive: true });
      for (const type of INTENT) el.addEventListener(type, intent, { passive: true });
      return () => {
        el.removeEventListener('scroll', save);
        for (const type of INTENT) el.removeEventListener(type, intent);
      };
    },
  };
}
