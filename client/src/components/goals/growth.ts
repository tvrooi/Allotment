// The goal plant's bloom memory (#241): a reached goal's flower opens once per goal on this
// device, then stays still, also when the goal is reached while its row is on the page. The
// stages themselves are decided by plantStage (ui/Plant.tsx).

/** Goals whose flower has opened on this device, so each blooms once and then stays still */
export const BLOOMED_KEY = 'flybudget:goals-bloomed';
const MAX_REMEMBERED = 200;

/**
 * True the first time a reached goal is seen on this device (and remembers it). Without
 * storage (a private window, blocked site data) it is false: the flower shows, still.
 */
export function firstBloom(goalId: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem(BLOOMED_KEY) ?? '[]') as unknown;
    const list = Array.isArray(seen) ? seen.filter((x): x is string => typeof x === 'string') : [];
    if (list.includes(goalId)) return false;
    localStorage.setItem(BLOOMED_KEY, JSON.stringify([...list, goalId].slice(-MAX_REMEMBERED)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether a goal's flower blooms now, given what its row showed last. A goal can be reached, dip
 * below its target and return while its row stays on the page, so the bloom follows each change:
 * it starts only when the goal becomes reached, and only the first time this device sees it
 * (firstBloom); a goal that stays reached keeps what it had. The one rule for when a flower blooms.
 */
export function nextBloom(
  goalId: string,
  wasComplete: boolean,
  complete: boolean,
  bloom: boolean,
): boolean {
  if (!complete) return false;
  if (wasComplete) return bloom;
  return firstBloom(goalId);
}
