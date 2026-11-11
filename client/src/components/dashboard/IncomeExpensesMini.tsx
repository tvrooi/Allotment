import { DataFeedback, dataUnavailable } from './DataFeedback';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { defineChart } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { useIncomeVsExpenses } from '../../hooks/useReports';
import { formatDateRange } from '../../utils/dateRange';
import { formatCurrency } from '../../utils/currency';
import { ArrowLeftRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ButtonLink } from '../ui/Button';
import { FillChart } from '../charts/FillChart';
import { LegendKey } from '../charts/ChartLegend';
import {
  bandScale,
  currencyTooltip,
  INCOME_EXPENSE_COLORS,
  incomeExpenseBars,
  incomeExpenseRows,
} from '../charts/kit';

interface Props {
  sixMonthsAgo: string;
  currentMonth: string;
}

export default function IncomeExpensesMini({ sixMonthsAgo, currentMonth }: Props) {
  const incomeVsExpensesQuery = useIncomeVsExpenses(sixMonthsAgo, currentMonth);
  const { data = [] } = incomeVsExpensesQuery;

  const chartData = useMemo(
    () => data.map((d) => ({ ...d, month: format(parseISO(`${d.month}-01`), 'MMM yy') })),
    [data],
  );
  const rows = useMemo(() => incomeExpenseRows(chartData), [chartData]);
  const definition = useMemo(
    () =>
      defineChart({
        marks: [incomeExpenseBars(rows)],
        scales: { x: bandScale(), y: { scale: scaleLinear, nice: true, axis: false } },
        focus: 'group-x',
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip: currencyTooltip({ colors: INCOME_EXPENSE_COLORS }),
      }),
    [rows],
  );

  const latestNet = data.length > 0 ? data[data.length - 1].net : 0;
  const hasData = data.some((d) => d.income !== 0 || d.expenses !== 0);

  const sources = [incomeVsExpensesQuery];
  if (dataUnavailable(sources)) return <DataFeedback title="Cash flow" sources={sources} />;

  if (sources.some((q) => q.isLoading)) {
    return (
      <Card>
        <div className="h-5 w-36 bg-surface-alt rounded animate-pulse mb-2" />
        <div className="h-48 flex items-end gap-2 animate-pulse">
          {[60, 45, 72, 55, 80, 50].map((h, i) => (
            <div key={i} className="flex-1 bg-surface-alt rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <DataFeedback title="Cash flow" sources={sources} />
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-text">Cash flow</h2>
        <Link
          to="/reports"
          aria-label="View all cash flow reports"
          className="text-xs text-brand-600 hover:text-brand-700 font-medium max-md:min-h-11 max-md:inline-flex max-md:items-center"
        >
          View all
        </Link>
      </div>
      <p className="text-xs text-text-tertiary mb-2">
        {formatDateRange({ preset: 'custom', from: sixMonthsAgo, to: currentMonth })} · includes
        this month so far
      </p>
      {hasData && (
        <p className="text-sm text-text-tertiary mb-3">
          Income minus expenses this month:{' '}
          <span
            className={`font-semibold tabular-nums ${latestNet >= 0 ? 'text-positive' : 'text-text'}`}
          >
            {formatCurrency(latestNet)}
          </span>
        </p>
      )}

      {hasData ? (
        <>
          <FillChart
            definition={definition}
            height={176}
            ariaLabel="Income and expenses by month"
          />
          <div
            data-testid="chart-legend"
            className="flex items-center justify-center gap-3 pt-1 text-2xs text-text-secondary"
          >
            <LegendKey color={INCOME_EXPENSE_COLORS.Income} label="Income" />
            <LegendKey color={INCOME_EXPENSE_COLORS.Expenses} label="Expenses" />
          </div>
        </>
      ) : (
        <EmptyState
          compact
          icon={<ArrowLeftRight size={20} />}
          title="No money in or out yet"
          description="Add transactions to compare what comes in with what goes out, month by month."
          actions={
            <ButtonLink size="sm" to="/transactions?add=1">
              Add a transaction
            </ButtonLink>
          }
        />
      )}
    </Card>
  );
}
