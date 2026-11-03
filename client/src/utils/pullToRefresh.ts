/** How far (px, after damping) a pull has to travel before letting go refreshes */
export const PULL_THRESHOLD = 64;
/** The indicator never travels further than this */
export const PULL_MAX = 96;

/**
 * The distance the indicator moves for a finger that has travelled `dy` pixels down: it follows
 * the finger at half speed and slows further near PULL_MAX, the way a native pull feels.
 */
export function pullDistance(dy: number): number {
  if (dy <= 0) return 0;
  const half = dy / 2;
  return Math.min(PULL_MAX, PULL_MAX * (1 - Math.exp(-half / PULL_MAX)) * 1.4);
}

/**
 * Whether a touch that moved (dx, dy) is a pull down rather than a sideways swipe or a scroll up.
 * Small moves stay undecided (null) so a tap or a slight wobble starts nothing.
 */
export function isPullGesture(dx: number, dy: number): boolean | null {
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return null;
  return dy > 0 && dy > Math.abs(dx) * 1.5;
}

/**
 * True when nothing between the touched element and the scroller (inclusive) can still scroll
 * up: only then does dragging down mean "refresh" rather than "scroll this list back up".
 */
export function atTopOfEverything(target: Element | null, scroller: Element): boolean {
  let el: Element | null = target;
  while (el) {
    if (el.scrollTop > 0) return false;
    if (el === scroller) return true;
    el = el.parentElement;
  }
  return scroller.scrollTop <= 0;
}
