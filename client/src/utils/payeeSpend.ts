import type { Transaction } from '../types';
import { transactionValue } from './accountMoney';

type SpendRow = Pick<
  Transaction,
  'date' | 'amount' | 'mainAmount' | 'mainAmountSource' | 'parentTransactionId'
>;

/** The last 12 months, oldest first, as YYYY-MM */
function window12(today: string) {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 12 + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** The rows the chart sums: a split once (as its parent), money out, in the window */
const charted = (t: SpendRow, months: Set<string>) =>
  !t.parentTransactionId && t.amount < 0 && months.has(t.date.slice(0, 7));

/**
 * A payee's money out for each of the last 12 months, oldest first, in the budget's currency
 * (refunds are money in, so they don't count). A split counts once, as its parent.
 */
export function spendByMonth(
  transactions: SpendRow[],
  today: string,
): { month: string; amount: number }[] {
  const months = window12(today);
  const inWindow = new Set(months);
  const totals = new Map(months.map((m) => [m, 0]));
  for (const t of transactions) {
    if (!charted(t, inWindow)) continue;
    const value = transactionValue(t);
    const key = t.date.slice(0, 7);
    if (value < 0) totals.set(key, totals.get(key)! - value);
  }
  return months.map((m) => ({ month: m, amount: totals.get(m)! }));
}

/** How many of the rows spendByMonth would sum have no exchange rate yet (and count as 0) */
export function spendWithoutRate(transactions: SpendRow[], today: string): number {
  const inWindow = new Set(window12(today));
  return transactions.filter((t) => charted(t, inWindow) && t.mainAmountSource === 'missing')
    .length;
}
