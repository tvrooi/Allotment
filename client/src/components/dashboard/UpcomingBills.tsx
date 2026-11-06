import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, parseISO, differenceInCalendarDays } from 'date-fns';
import { useScheduleOccurrences } from '../../hooks/useSchedules';
import { formatCurrency } from '../../utils/currency';
import { CalendarClock } from 'lucide-react';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ButtonLink } from '../ui/Button';
import { useSchedules } from '../../hooks/useSchedules';
import { formatShortDay } from '../../utils/dates';
import { groupOccurrences } from '../recurring/scheduleFormat';

export default function UpcomingBills() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysOut = format(addDays(new Date(), 30), 'yyyy-MM-dd');

  const { data: occurrences = [], isLoading } = useScheduleOccurrences(today, thirtyDaysOut);
  const { data: schedules = [] } = useSchedules();

  const pending = useMemo(
    () =>
      occurrences.filter(
        (o) =>
          o.displayStatus === 'upcoming' ||
          o.displayStatus === 'due' ||
          o.displayStatus === 'waiting',
      ),
    [occurrences],
  );
  // Money going out and money coming in, listed apart: pay isn't a bill. A household bill shows
  // the owner's share, and housemates' money is neither
  const grouped = groupOccurrences(pending);
  const bills = grouped.expenses.filter((o) => o.expectedAmount < 0).slice(0, 4);
  const income = grouped.income.slice(0, 3);
  const upcoming = [...bills, ...income];

  if (isLoading) {
    return (
      <Card>
        <div className="h-5 w-32 bg-surface-alt rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-surface-alt rounded animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text">Bills and income</h2>
        <Link
          to="/recurring"
          aria-label="View all bills and income"
          className="text-xs text-brand-600 hover:text-brand-700 font-medium max-md:min-h-11 max-md:inline-flex max-md:items-center"
        >
          View all
        </Link>
      </div>

      {upcoming.length === 0 ? (
        schedules.length === 0 ? (
          <EmptyState
            compact
            icon={<CalendarClock size={20} />}
            title="Track your bills and pay"
            description="Add rent, subscriptions and income that repeat, or let Allotment find them in your transactions."
            actions={
              <ButtonLink size="sm" to="/recurring?add=1">
                Add recurring
              </ButtonLink>
            }
          />
        ) : (
          <p className="text-sm text-text-tertiary py-6 text-center">
            Nothing due in the next 30 days.
          </p>
        )
      ) : (
        <div className="space-y-4">
          {[
            { title: 'Bills', rows: bills, none: 'No bills due in the next 30 days.' },
            { title: 'Income', rows: income, none: 'No pay expected in the next 30 days.' },
          ].map((list) => (
            <section key={list.title} aria-label={list.title}>
              <h3 className="text-xs font-medium uppercase tracking-wide text-text-tertiary mb-1">
                {list.title}
              </h3>
              {list.rows.length === 0 ? (
                <p className="text-xs text-text-tertiary py-2">{list.none}</p>
              ) : (
                <div className="divide-y divide-border-light">
                  {list.rows.map((occ, i) => (
                    <UpcomingRow key={`${occ.scheduleId}-${occ.id}-${i}`} occ={occ} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

type Occurrence = NonNullable<ReturnType<typeof useScheduleOccurrences>['data']>[number];

function UpcomingRow({ occ }: { occ: Occurrence }) {
  // Calendar days: tomorrow is 1 day away even late in the evening
  const daysUntil = differenceInCalendarDays(parseISO(occ.expectedDate), new Date());
  const isWaiting = occ.displayStatus === 'waiting';
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isWaiting ? 'bg-caution' : occ.expectedAmount > 0 ? 'bg-positive' : 'bg-text-tertiary'}`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isWaiting ? 'text-caution font-medium' : 'text-text'}`}>
          {occ.scheduleName}
        </p>
        <p className="text-xs text-text-tertiary">
          {formatShortDay(occ.expectedDate)}
          {occ.shareOf ? ` · Shared, ${formatCurrency(occ.shareOf)} in all` : ''}
          {isWaiting
            ? ` · ${Math.abs(daysUntil)}d overdue`
            : daysUntil === 0
              ? ' · Today'
              : daysUntil === 1
                ? ' · Tomorrow'
                : ` · in ${daysUntil}d`}
        </p>
      </div>
      <span
        className={`text-sm font-medium tabular-nums whitespace-nowrap ${
          occ.expectedAmount > 0 ? 'text-positive' : 'text-text'
        }`}
      >
        {formatCurrency(Math.abs(occ.expectedAmount))}
      </span>
    </div>
  );
}
