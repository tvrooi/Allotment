// The Household page's answer (BalanceSummary), shared with the dashboard's status strip so
// both say the same thing about the same household.

/**
 * Do you owe or are you owed, across everything shared: `balances` is per person, negative =
 * owes; `sign` is the owner's. With payments not shared yet, "square" is only on what's shared (`unsharedPayments`).
 */
export function balanceHeadline(
  people: { id: string; isSelf: number | boolean }[],
  balances: Record<string, number>,
  unsharedCount: number,
): { text: string; amount?: number; sign: -1 | 0 | 1 } {
  const self = people.find((p) => p.isSelf);
  const mine = self ? (balances[self.id] ?? 0) : 0;
  if (people.every((p) => (balances[p.id] ?? 0) === 0))
    return { text: unsharedCount > 0 ? 'Square on what’s shared' : 'All square', sign: 0 };
  if (mine > 0) return { text: 'You’re owed', amount: mine, sign: 1 };
  if (mine < 0) return { text: 'You owe', amount: -mine, sign: -1 };
  return { text: 'You’re square', sign: 0 };
}

/** Bank payments of recurring bills not in the balances yet, and which bills (none without bills) */
export function unsharedPayments(
  recurringBills: { name: string; payments: { shared: boolean }[] }[],
  withBills: boolean,
) {
  if (!withBills) return { count: 0, bills: [] as string[] };
  const unshared = recurringBills.filter((b) => b.payments.some((p) => !p.shared));
  return {
    count: unshared.reduce((n, b) => n + b.payments.filter((p) => !p.shared).length, 0),
    bills: unshared.map((b) => b.name),
  };
}

/**
 * The household the Household page opens on when none is named (the default, else the first),
 * and the one the dashboard's strip shows; none when the feature is hidden
 */
export function householdToShow<T extends { isDefault?: number }>(
  households: T[],
  featureShown: boolean,
): T | null {
  if (!featureShown) return null;
  return households.find((h) => h.isDefault) ?? households[0] ?? null;
}
