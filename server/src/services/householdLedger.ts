/** Exact largest-remainder allocation; input order breaks ties and is saved with the expense. */
export function allocateShares(amount: number, weights: number[]): number[] {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !weights.length ||
    weights.some((w) => !Number.isSafeInteger(w) || w < 0) ||
    !weights.some((w) => w > 0)
  )
    throw new Error('Invalid allocation');
  const total = weights.reduce((s, w) => s + BigInt(w), 0n);
  const products = weights.map((w) => BigInt(amount) * BigInt(w));
  const result = products.map((p) => Number(p / total));
  const order = products
    .map((p, i) => ({ i, remainder: p % total }))
    .sort((a, b) => (a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1));
  for (let left = amount - result.reduce((s, v) => s + v, 0), i = 0; left > 0; left--, i++)
    result[order[i].i]++;
  return result;
}

type Event = {
  id: string;
  kind: string;
  amount: number;
  payerId: string | null;
  recipientId: string | null;
};
type Share = { eventId: string; personId: string; amount: number };
/** Positive = prepaid credit / owed to the person; negative = owes the group. Pool is implicit. */
export function householdLedger(people: { id: string }[], events: Event[], shares: Share[]) {
  const balances: Record<string, number> = Object.fromEntries(people.map((p) => [p.id, 0]));
  const byEvent = new Map<string, Share[]>();
  for (const share of shares) {
    const list = byEvent.get(share.eventId) ?? [];
    list.push(share);
    byEvent.set(share.eventId, list);
  }
  let pool = 0;
  for (const e of events) {
    if (e.kind === 'expense' || e.kind === 'refund') {
      if (e.payerId) balances[e.payerId] += e.amount;
      else pool -= e.amount;
      for (const s of byEvent.get(e.id) ?? []) balances[s.personId] -= s.amount;
    } else if (e.kind === 'contribution') {
      balances[e.payerId!] += e.amount;
      pool += e.amount;
    } else if (e.kind === 'settlement') {
      balances[e.payerId!] += e.amount;
      balances[e.recipientId!] -= e.amount;
    }
  }
  return { balances, pool };
}
