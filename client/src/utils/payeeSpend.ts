import type { Transaction } from '../types';
import { transactionValue } from './accountMoney';

/**
 * A payee's money out for each of the last 12 months, oldest first, in the budget's currency
 * (refunds are money in, so they don't count). A split counts once, as its parent.
 */
export function spendByMonth(
  transactions: Pick<
    Transaction,
    'date' | 'amount' | 'mainAmount' | 'mainAmountSource' | 'parentTransactionId'
  >[],
  today: string,
): { month: string; amount: number }[] {
  const [year, month] = today.split('-').map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 12 + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const totals = new Map(months.map((m) => [m, 0]));
  for (const t of transactions) {
    if (t.parentTransactionId) continue;
    const key = t.date.slice(0, 7);
    const value = transactionValue(t);
    if (value < 0 && totals.has(key)) totals.set(key, totals.get(key)! - value);
  }
  return months.map((m) => ({ month: m, amount: totals.get(m)! }));
}
