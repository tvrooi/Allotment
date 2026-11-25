import type { HouseholdSplit } from '../../api/households';

/** The slider moves in 5% steps */
export const SPLIT_STEP = 5;

/** Your share (0-100) of a two-person household's default split; 50 when it isn't a set percentage */
export function defaultShare(split: HouseholdSplit | null, selfId: string) {
  const mine =
    split?.mode === 'percentage' ? split.shares.find((s) => s.personId === selfId) : null;
  const pct = mine ? mine.value / 100 : 50;
  return Number.isInteger(pct) && pct >= 0 && pct <= 100
    ? Math.round(pct / SPLIT_STEP) * SPLIT_STEP
    : 50;
}

/** What the slider sends for one expense: an equal split (null) at 50, else percentages in basis points */
export function sliderSplit(
  myShare: number,
  selfId: string,
  partnerId: string,
): HouseholdSplit | null {
  if (myShare === 50) return null;
  return {
    mode: 'percentage',
    shares: [
      { personId: selfId, value: myShare * 100 },
      { personId: partnerId, value: (100 - myShare) * 100 },
    ],
  };
}
