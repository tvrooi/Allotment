import type { HouseholdSplit } from '../../api/households';
import { describeSplit } from './SplitEditor';

/** "50/50" for two people splitting equally, else the split in words */
export function splitLabel(split: HouseholdSplit | null, people: { id: string; name: string }[]) {
  const equal = !split || split.mode === 'equal';
  if (equal && people.length === 2) return '50/50';
  if (equal) return `equally between all ${people.length}`;
  return describeSplit(split, people);
}
