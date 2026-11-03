import { addDays, format, parseISO } from 'date-fns';
import { useAccounts } from '../../hooks/useAccounts';
import { useBudget } from '../../hooks/useBudget';
import { useScheduleOccurrences } from '../../hooks/useSchedules';
import { formatCurrency } from '../../utils/currency';
import { Private } from '../ui/Private';
import { UpSyncBadge } from '../up/UpSyncBadge';

/**
 * The dashboard's opening line: what's left to spend this month, and when the next pay arrives,
 * in one line (instead of a heading that says nothing). A new budget gets a welcome instead.
 */
export function DashboardStatus({ currentMonth }: { currentMonth: string }) {
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const { data: budget = [], isLoading: budgetLoading } = useBudget(currentMonth);
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: occurrences = [] } = useScheduleOccurrences(
    today,
    format(addDays(new Date(), 35), 'yyyy-MM-dd'),
  );
  if (accountsLoading || budgetLoading) return <div className="h-9" aria-hidden />;

  const expense = budget.filter((g) => g.isIncome === 0).flatMap((g) => g.categories);
  const planned = expense.reduce((s, c) => s + c.budgeted, 0);
  const left = planned - expense.reduce((s, c) => s + Math.abs(c.spent), 0);
  const nextPay = occurrences.find(
    (o) => o.expectedAmount > 0 && (o.displayStatus === 'upcoming' || o.displayStatus === 'due'),
  );
  const payday = nextPay ? format(parseISO(nextPay.expectedDate), 'EEE d MMM') : null;

  let line: React.ReactNode;
  if (accounts.length === 0) {
    line = 'Welcome to Allotment. Start with the steps below.';
  } else if (planned === 0) {
    line = 'Nothing’s planned for this month yet: give your money a job on the Budget page.';
  } else {
    line = (
      <>
        You have{' '}
        <b className={left < 0 ? 'text-negative' : 'text-text'}>
          <Private>{formatCurrency(left)}</Private>
        </b>{' '}
        left to spend this month.
        {payday && <span className="text-text-tertiary"> Next pay {payday}.</span>}
      </>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h1 className="font-display text-2xl max-md:text-xl tracking-tight text-text-secondary">
        {line}
      </h1>
      <UpSyncBadge />
    </div>
  );
}
