import type { TargetStatus } from '../types';
import { formatCurrency } from './currency';
import { formatDay } from './dates';

/** One line for a budget row: what the target still needs this month. An envelope linked to an
 * account (`moveTo`, its name) is funded by moving money into that account. */
export function targetLabel(t: TargetStatus, moveTo?: string): string {
  if (t.paused) return 'Goal not active · no new funding suggested';
  if (t.ended) return 'Target date passed';
  const due = t.dueDate ? ` · due ${formatDay(t.dueDate)}` : '';
  if (t.underfunded === 0) return `Target funded${due}`;
  const catchUp = t.catchUp ? ` (incl. ${formatCurrency(t.catchUp)} catch-up)` : '';
  return moveTo
    ? `Move ${formatCurrency(t.underfunded)} more to ${moveTo}${catchUp}${due}`
    : `Needs ${formatCurrency(t.underfunded)} more${catchUp}${due}`;
}
