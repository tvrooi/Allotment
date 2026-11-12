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
type Watch = (onChange: () => void) => () => void;

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
