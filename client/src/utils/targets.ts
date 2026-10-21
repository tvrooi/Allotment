import type { TargetStatus } from '../types';
import { formatCurrency } from './currency';
import { formatDay } from './dates';

/** One line for a budget row: what the target still needs this month. */
export function targetLabel(t: TargetStatus): string {
  if (t.ended) return 'Target date passed';
  const due = t.dueDate ? ` · due ${formatDay(t.dueDate)}` : '';
  if (t.underfunded === 0) return `Target funded${due}`;
  const catchUp = t.catchUp ? ` (incl. ${formatCurrency(t.catchUp)} catch-up)` : '';
  return `Needs ${formatCurrency(t.underfunded)} more${catchUp}${due}`;
}
