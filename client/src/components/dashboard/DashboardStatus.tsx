import { DataFeedback, dataUnavailable } from './DataFeedback';
import { addDays, format, parseISO } from 'date-fns';
import { useAccounts } from '../../hooks/useAccounts';
import { useBudget } from '../../hooks/useBudget';
import { useScheduleOccurrences } from '../../hooks/useSchedules';
import { formatCurrency } from '../../utils/currency';
import { leftToSpend as figureLeftToSpend, savingsCategoryIds } from '../../utils/leftToSpend';
import { useGoals } from '../../hooks/useGoals';
import { Private } from '../ui/Private';
import { UpSyncBadge } from '../up/UpSyncBadge';
import { groupOccurrences } from '../recurring/scheduleFormat';

/**
 * The dashboard's opening line: what's left to spend this month, and when the next pay arrives,
 * in one line (instead of a heading that says nothing). A new budget gets a welcome instead.
 */
export function DashboardStatus({
  currentMonth,
  refined = false,
}: {
  currentMonth: string;
  refined?: boolean;
}) {
  const accountsQuery = useAccounts();
  const { data: accounts = [] } = accountsQuery;
  const budgetQuery = useBudget(currentMonth);
  const { data: budget = [] } = budgetQuery;
  const goalsQuery = useGoals();
  const { data: goals = [] } = goalsQuery;
  const today = format(new Date(), 'yyyy-MM-dd');
  const scheduleOccurrencesQuery = useScheduleOccurrences(
    today,
    format(addDays(new Date(), 35), 'yyyy-MM-dd'),
  );
  const { data: occurrences = [] } = scheduleOccurrencesQuery;
  const sources = [accountsQuery, budgetQuery, goalsQuery, scheduleOccurrencesQuery];
  if (dataUnavailable(sources)) return <DataFeedback title="monthly overview" sources={sources} />;

  if (sources.some((q) => q.isLoading)) return <div className="h-9" aria-hidden />;

  // Savings envelopes (Savings categories, goals' categories) aren't spending money
  const { left, planned } = figureLeftToSpend(budget, savingsCategoryIds(goals));
  // The owner's own money in: a housemate's rent day into a household account isn't pay
  const nextPay = groupOccurrences(occurrences).income.find(
    (o) => o.displayStatus === 'upcoming' || o.displayStatus === 'due',
  );
  const payday = nextPay ? format(parseISO(nextPay.expectedDate), 'EEE d MMM') : null;

  let line: React.ReactNode;
  if (accounts.length === 0) {
    line = 'Welcome to Allotment. Start with the steps below.';
  } else if (!planned) {
    line = 'Nothing’s planned for this month yet: give your money a job on the Budget page.';
  } else if (refined) {
    line = payday
      ? `Next pay ${payday}.`
      : `Your budget · ${format(parseISO(`${currentMonth}-01`), 'MMMM yyyy')}`;
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
      <DataFeedback title="monthly overview" sources={sources} />
      <h1 className="font-display text-2xl max-md:text-xl tracking-tight text-text-secondary">
        {line}
      </h1>
      <UpSyncBadge />
    </div>
  );
}
