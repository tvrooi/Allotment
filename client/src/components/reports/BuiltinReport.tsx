import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TOP_TREND_CATEGORIES,
  useIncomeVsExpenses,
  useTopSpendingCategories,
  useUncategorisedSummary,
} from '../../hooks/useReports';
import { dayBounds } from '../../utils/dateRange';
import { formatCurrency } from '../../utils/currency';
import { transactionsLink } from '../../utils/transactionFilters';
import { Private } from '../ui/Private';
import { expenseFigure, incomeFigure, monthsToAverage } from '../../utils/reportSummary';
import {
  NetWorthChart,
  IncomeExpensesChart,
  SpendingChart,
  SpendingTrendsChart,
} from './BuiltinCharts';
import { TransactionCalendar } from './TransactionCalendar';
import { ChartSkeleton } from './ChartHelpers';
import type { StatCard } from './ChartHelpers';
import type { BuiltinWidgetType } from '../../types';
import { PrivateSection } from '../ui/Private';

export const BUILTIN_REPORTS: Record<BuiltinWidgetType, { label: string; description: string }> = {
  summary: { label: 'Summary', description: 'Income, expenses and monthly averages' },
  'net-worth': { label: 'Net Worth', description: 'Assets, liabilities and net worth over time' },
  'income-expenses': {
    label: 'Income & Expenses',
    description: 'Money in vs. money out each month',
  },
  spending: { label: 'Spending by Category', description: 'Where your money went, by category' },
  'spending-trends': {
    label: 'Spending Trends',
    description: 'How spending in your biggest categories changes over time',
  },
  calendar: { label: 'Transaction Calendar', description: 'Money in and out on each day' },
};

export const BUILTIN_TYPES = Object.keys(BUILTIN_REPORTS) as BuiltinWidgetType[];

/**
 * Totals for the range. Expenses show what was spent (red), or "+$X" in green when refunds
 * outweighed spending. The monthly average counts only months since the budget's first
 * activity in the range.
 */
export function useSummaryCards(from: string, to: string): StatCard[] {
  const { data: ieData = [] } = useIncomeVsExpenses(from, to);
  return useMemo(() => {
    const totalInc = ieData.reduce((s, d) => s + d.income, 0);
    const expNet = ieData.reduce((s, d) => s + d.expenseNet, 0);
    const txCount = ieData.reduce((s, d) => s + d.expenseCount, 0);
    return [
      { label: 'Total Income', ...incomeFigure(totalInc) },
      { label: 'Total Expenses', ...expenseFigure(expNet) },
      { label: 'Avg Monthly Expenses', ...expenseFigure(expNet / monthsToAverage(ieData)) },
      { label: 'Avg Per Transaction', ...expenseFigure(txCount > 0 ? expNet / txCount : 0) },
    ];
  }, [ieData]);
}

const TONE_CLASS = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-text-tertiary',
};

/**
 * The summary widget: four figures in a row next to the title on a wide card (the card is the
 * @container, see WidgetCard), two by two under it otherwise.
 */
function SummaryTiles({ from, to }: { from: string; to: string }) {
  const cards = useSummaryCards(from, to);
  const days = dayBounds(from, to);
  const { data: left } = useUncategorisedSummary(days.from, days.to);
  // Without any categorised income, "Income $0" and a green "+$X" of expenses are nonsense:
  // the money is there, it just has no category yet. Say that instead of the figures.
  if (
    left &&
    left.categorisedIncome === 0 &&
    (left.uncategorisedIncomeCount > 0 || left.uncategorisedSpendingCount > 0)
  )
    return (
      <div role="status" className="h-full flex flex-col justify-center gap-1 text-sm text-text">
        <p>
          These totals need categories.{' '}
          <Private>{formatCurrency(left.uncategorisedIncome)}</Private> of money in and{' '}
          <Private>{formatCurrency(left.uncategorisedSpending)}</Private> of spending aren&rsquo;t
          categorised yet, so income and expenses can&rsquo;t be worked out.
        </p>
        <Link
          to={transactionsLink({ uncategorized: true, datePreset: 'custom', ...days })}
          className="font-medium text-brand-600 hover:underline"
        >
          Sort them
        </Link>
      </div>
    );
  return (
    <div className="h-full grid grid-cols-2 @4xl:grid-cols-4 gap-x-3 gap-y-2 content-center">
      {cards.map((c) => (
        <div key={c.label} className="text-center min-w-0">
          {/* A size down on narrow cards (a phone), so "$12,345.67" fits two to a row */}
          <p
            className={`text-lg @sm:text-xl font-semibold tabular-nums break-words ${c.tone ? TONE_CLASS[c.tone] : 'text-text'}`}
          >
            {c.value}
          </p>
          <p className="text-xs text-text-secondary mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Spending Trends on a dashboard: the widget's chosen categories, or else the
 * TOP_TREND_CATEGORIES with the most spending in the range.
 */
function DashboardSpendingTrends({
  from,
  to,
  categoryIds,
}: {
  from: string;
  to: string;
  categoryIds?: string[];
}) {
  const top = useTopSpendingCategories(from, to, TOP_TREND_CATEGORIES);
  const ids = categoryIds ?? top.ids;
  if (!categoryIds && top.isLoading) return <ChartSkeleton />;
  const caption = categoryIds
    ? undefined
    : ids.length === 1
      ? 'Biggest spending category'
      : `${ids.length} biggest spending categories`;
  return <SpendingTrendsChart from={from} to={to} categoryIds={ids} caption={caption} />;
}

/** A built-in report as its dashboard widget shows it (the full view is in ReportDetail). */
export function BuiltinReportChart({
  type,
  from,
  to,
  categoryIds,
}: {
  type: BuiltinWidgetType;
  from: string;
  to: string;
  /** Spending Trends: the categories to chart (undefined = the biggest ones) */
  categoryIds?: string[];
}) {
  switch (type) {
    case 'summary':
      return <SummaryTiles from={from} to={to} />;
    case 'net-worth':
      return (
        <PrivateSection title="Net worth is hidden in Safe mode">
          <NetWorthChart from={from} to={to} headline />
        </PrivateSection>
      );
    case 'income-expenses':
      return <IncomeExpensesChart from={from} to={to} />;
    case 'spending':
      return <SpendingChart from={from} to={to} />;
    case 'calendar':
      return <TransactionCalendar from={from} to={to} fit />;
    case 'spending-trends':
      return <DashboardSpendingTrends from={from} to={to} categoryIds={categoryIds} />;
  }
}
