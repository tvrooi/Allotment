import { format, parseISO } from 'date-fns';
import { formatCurrency } from '../../utils/currency';
import type { BudgetCategory } from '../../types';

/**
 * Recurring debits still expected in this category this month, in orange: planned to leave
 * the account but not spent yet. They don't change Activity or Available until they arrive.
 */
export function ExpectedNote({ cat, className = '' }: { cat: BudgetCategory; className?: string }) {
  const items = cat.expectedItems ?? [];
  const expected = cat.expected ?? 0;
  if (!expected || !items.length) return null;
  const list = items
    .map((i) => `${format(parseISO(i.date), 'd MMM')} · ${i.name}: ${formatCurrency(-i.amount)}`)
    .join('\n');
  const title = `Recurring, not debited yet:\n${list}\nAvailable after these: ${formatCurrency(cat.balance - expected)}`;
  return (
    <span
      className={`block text-xs tabular-nums text-expected ${className}`}
      title={title}
      data-testid="expected-debit"
    >
      {formatCurrency(-expected)} expected
      <span className="sr-only">
        {' '}
        from {items.length} recurring {items.length === 1 ? 'item' : 'items'}:{' '}
        {items.map((i) => i.name).join(', ')}
      </span>
    </span>
  );
}
