export interface LedgerEntry {
  id: string;
  kind: string;
  date: string;
  description: string;
  amount: number;
  payerId: string | null;
  shares: { personId: string; amount: number }[];
}

/** The newest shared expenses, newest first (the server sends entries oldest first, by date then id) */
export function latestExpenses<T extends { kind: string }>(entries: readonly T[], count: number) {
  return entries
    .filter((e) => e.kind === 'expense')
    .slice(-count)
    .reverse();
}
