import { addMonths, addWeeks, format, parseISO } from 'date-fns';
import { formatCurrency } from './currency';
import type { AmountType, NearMiss } from '../types';

// Near misses from Find recurring: why a regular-looking payee wasn't found, and a recurring
// item to start from when the user adds it anyway

const ROUGHLY: Record<NearMiss['recurrenceType'], string> = {
  weekly: 'every week',
  biweekly: 'every 2 weeks',
  monthly: 'every month',
};

export function nearMissReason(m: NearMiss): string {
  switch (m.reason) {
    case 'amounts_vary': {
      const [low, high] = [Math.abs(m.minAmount), Math.abs(m.maxAmount)].sort((a, b) => a - b);
      return `Amounts vary by more than 7.5% (${formatCurrency(low)} to ${formatCurrency(high)})`;
    }
    case 'too_few':
      return `Only ${m.count} of the 3 payments needed so far`;
    case 'dates_drift':
      return `Dates drift more than 2 days (about ${ROUGHLY[m.recurrenceType]})`;
    case 'mixed_signs':
      return 'Money in and out mixed, like a refund between payments';
  }
}

/** What the recurring form starts from for "Add anyway" */
export interface ScheduleDraft {
  key: string;
  name: string;
  amount: number;
  amountType: AmountType;
  recurrenceType: NearMiss['recurrenceType'];
  startDate: string;
  dateFlexibility: number;
  accountId: string;
  categoryId: string | null;
  payeeId: string | null;
  payeeName: string;
}

const step = (date: Date, type: NearMiss['recurrenceType']) =>
  type === 'weekly'
    ? addWeeks(date, 1)
    : type === 'biweekly'
      ? addWeeks(date, 2)
      : addMonths(date, 1);

/**
 * Starts at the next expected payment after today, so past ones it never linked don't show as
 * missed. Varying amounts are tracked as variable, drifting dates with a week's flexibility.
 */
export function nearMissDraft(m: NearMiss, today: string): ScheduleDraft {
  let next = step(parseISO(m.lastDate), m.recurrenceType);
  while (format(next, 'yyyy-MM-dd') <= today) next = step(next, m.recurrenceType);
  return {
    key: m.id,
    name: m.payeeName,
    amount: m.amount,
    amountType: m.reason === 'amounts_vary' ? 'variable' : 'exact',
    recurrenceType: m.recurrenceType,
    startDate: format(next, 'yyyy-MM-dd'),
    dateFlexibility: m.reason === 'dates_drift' ? 7 : 3,
    accountId: m.accountId,
    categoryId: m.categoryId,
    payeeId: m.payeeId,
    payeeName: m.payeeName,
  };
}
