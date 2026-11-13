// A goal's progress bar grows a plant (#241): a seed, a sprout, leaves, a bud, then a flower
// when the goal is reached. The thresholds are the only place the stages are decided.

export type GrowthStage = 'seed' | 'sprout' | 'leaf' | 'bud' | 'flower';

export function growthStage(pct: number, complete: boolean): GrowthStage {
  if (complete) return 'flower';
  if (pct < 10) return 'seed';
  if (pct < 40) return 'sprout';
  if (pct < 70) return 'leaf';
  return 'bud';
}

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
