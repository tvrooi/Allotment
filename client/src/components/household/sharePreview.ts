import type { SharePreview } from '../../api/households';

export interface PreviewLine {
  personId: string;
  /** What this person would come to owe, in minor units */
  amount: number;
}

/**
 * What sharing a bill's payments would add to the balances, from the server's preview. A payment
 * from your own account makes everyone else owe you their part (your part stays yours); one from
 * the household account makes every part owed to that account. Refused payments are listed, not
 * counted.
 */
export function summarisePreview(
  preview: SharePreview,
  people: { id: string; isSelf: number }[],
  fromPool: boolean,
) {
  const owed = new Map<string, number>();
  const refused: string[] = [];
  let count = 0;
  let total = 0;
  for (const r of preview.results) {
    if (!r.ok) {
      refused.push(r.error);
      continue;
    }
    count += 1;
    total += r.amount;
    for (const s of r.shares) owed.set(s.personId, (owed.get(s.personId) ?? 0) + s.amount);
  }
  const lines: PreviewLine[] = people
    .filter((p) => fromPool || !p.isSelf)
    .map((p) => ({ personId: p.id, amount: owed.get(p.id) ?? 0 }))
    .filter((l) => l.amount > 0);
  return { count, total, lines, refused };
}
