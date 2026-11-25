import { categoryFigures } from '../utils/budgetFigures';
import { CategoryIcon } from '../components/ui/CategoryIcon';
import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { barY, defineChart } from '@tanstack/charts';
import type { ChartPoint } from '@tanstack/charts';
import { text } from '@tanstack/charts/text';
import { tooltip } from '@tanstack/charts/tooltip';
import type { ChartTooltipContent } from '@tanstack/charts/tooltip';
import { useRef } from 'react';
import { useBudget, useCategoryHistory } from '../hooks/useBudget';
import { useTransactions } from '../hooks/useTransactions';
import { useAppStore } from '../store/appStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { formatCentsAxis, formatCurrency } from '../utils/currency';
import { chartColors } from '../utils/chartColors';
import { TransactionTable } from '../components/transactions/TransactionTable';
import type { Transaction } from '../types';
import { FillChart } from '../components/charts/FillChart';
import { bandScale, INCOME_EXPENSE_COLORS, valueScale } from '../components/charts/kit';
import { formatDay } from '../utils/dates';
import { TargetCard } from '../components/budget/TargetCard';
import { FilesSection } from '../components/files/FilesSection';
import { useFilterSearch } from '../hooks/useFilterSearch';
import { useScrollMemory } from '../hooks/useScrollMemory';
import { PAGE_GUTTER } from '../components/ui/pageGutter';

interface HistoryChartProps {
  categoryId: string;
  month: string;
  isIncome: boolean;
  selectedBarMonth: string | null;
  onBarClick: (month: string | null) => void;
}

function HistoryChart({
  categoryId,
  month,
  isIncome,
  selectedBarMonth,
  onBarClick,
}: HistoryChartProps) {
  const { data } = useCategoryHistory(categoryId, month);

  const chartData = useMemo(
    () =>
      (data?.history ?? []).map((h) => ({
        label: format(parseISO(`${h.month}-01`), 'MMM'),
        rawMonth: h.month,
        amount: h.amount / 100,
      })),
    [data],
  );

  const hasData = chartData.some((d) => d.amount > 0);
  const barColor = INCOME_EXPENSE_COLORS[isIncome ? 'Income' : 'Expenses'];
  // A click on a bar selects its month; the card's own click (below) clears the selection
  const picked = useRef(false);
  const definition = useMemo(() => {
    // Dollars here: the axis and labels take cents, in the budget's currency, hidden in Safe mode
    const cents = (v: number) => formatCentsAxis(Math.round(v * 100));
    return defineChart({
      marks: [
        barY(chartData, {
          x: 'label',
          y: 'amount',
          // Bars other than the selected month fade back (fillOpacity is one value for the whole mark)
          fill: (d) =>
            selectedBarMonth == null || d.rawMonth === selectedBarMonth
              ? barColor
              : `color-mix(in srgb, ${barColor} 35%, transparent)`,
          radius: [3, 3, 0, 0],
          maxThickness: 36,
          inset: 1,
        }),
        text(chartData, {
          x: 'label',
          y: 'amount',
          text: (d) => cents(d.amount),
          dy: -8,
          fontSize: 10,
          fontWeight: 600,
          fill: chartColors.label,
        }),
      ],
      scales: { x: bandScale(), y: valueScale({ format: cents }) },
      margin: { top: 16 },
      focus: 'nearest-x',
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: {
        use: tooltip,
        content: (points: readonly ChartPoint[]): ChartTooltipContent => {
          const p = points[0];
          return p
            ? {
                title: String(p.xValue),
                rows: [
                  { label: 'Amount', value: formatCurrency(Math.round(Number(p.yValue) * 100)) },
                ],
              }
            : { rows: [] };
        },
      },
    });
  }, [chartData, barColor, selectedBarMonth]);

  return (
    <div
      className="bg-surface rounded-lg shadow-card border border-border-light p-4"
      onClick={() => {
        if (picked.current) picked.current = false;
        else onBarClick(null);
      }}
    >
      <h2 className="text-sm font-semibold text-text mb-3">
        {isIncome ? 'Income history' : 'Spending history'}
      </h2>
      {hasData ? (
        <FillChart
          definition={definition}
          height={200}
          ariaLabel={isIncome ? 'Income by month' : 'Spending by month'}
          onSelect={(point) => {
            const row = point?.datum as (typeof chartData)[number] | undefined;
            if (!row) return;
            picked.current = true;
            onBarClick(row.rawMonth === selectedBarMonth ? null : row.rawMonth);
          }}
        />
      ) : (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-text-tertiary">No history available</p>
        </div>
      )}
    </div>
  );
}

function BudgetWidget({
  budgeted,
  actual,
  remaining,
  month,
  isIncome,
}: {
  budgeted: number;
  actual: number;
  remaining: number;
  month: string;
  isIncome: boolean;
}) {
  const remColor = remaining > 0 ? 'text-positive' : remaining < 0 ? 'text-negative' : 'text-text';

  return (
    <div className="bg-surface rounded-lg shadow-card border border-border-light p-4">
      <h2 className="text-sm font-semibold text-text">Budget</h2>
      <p className="text-xs text-text-tertiary mt-0.5">
        {format(parseISO(`${month}-01`), 'MMMM yyyy')}
      </p>
      <div className="mt-3 border-t border-border-light pt-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{isIncome ? 'Expected' : 'Assigned'}</span>
          <span className="text-sm tabular-nums text-text">{formatCurrency(budgeted)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{isIncome ? 'Received' : 'Activity'}</span>
          <span className="text-sm tabular-nums text-text">{formatCurrency(actual)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            {isIncome ? 'Remaining' : 'Available'}
          </span>
          <span className={`text-sm tabular-nums font-medium ${remColor}`}>
            {formatCurrency(remaining)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** What a transaction put in this category: for a split, only its parts in it */
function amountInCategory(t: Transaction, categoryId: string): number {
  if (!t.children?.length) return t.amount;
  return t.children
    .filter((c) => c.categoryId === categoryId)
    .reduce((sum, c) => sum + c.amount, 0);
}

function SummaryWidget({
  transactions,
  categoryId,
  isIncome,
}: {
  transactions: Transaction[];
  categoryId: string;
  isIncome: boolean;
}) {
  const stats = useMemo(() => {
    if (transactions.length === 0) return null;

    const amounts = transactions.map((t) => Math.abs(amountInCategory(t, categoryId)));
    const total = amounts.reduce((s, a) => s + a, 0);
    const largest = Math.max(...amounts);
    const average = Math.round(total / amounts.length);
    const dates = transactions.map((t) => t.date).sort();

    return {
      count: transactions.length,
      largest,
      average,
      total,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
    };
  }, [transactions, categoryId]);

  const rows = stats
    ? [
        { label: 'Total transactions', value: String(stats.count), isAmount: false },
        { label: 'Largest transaction', value: formatCurrency(stats.largest), isAmount: true },
        { label: 'Average transaction', value: formatCurrency(stats.average), isAmount: true },
        {
          label: `Total ${isIncome ? 'income' : 'spending'}`,
          value: formatCurrency(stats.total),
          isAmount: true,
        },
        {
          label: 'First transaction',
          value: formatDay(stats.firstDate),
          isAmount: false,
        },
        {
          label: 'Last transaction',
          value: formatDay(stats.lastDate),
          isAmount: false,
        },
      ]
    : [];

  return (
    <div className="bg-surface rounded-lg shadow-card border border-border-light p-4">
      <h2 className="text-sm font-semibold text-text mb-3">Summary</h2>
      {!stats ? (
        <p className="text-sm text-text-tertiary py-6 text-center">No data</p>
      ) : (
        <div className="border-t border-border-light pt-3 space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{row.label}</span>
              <span className="text-sm tabular-nums text-text">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoryDetailPage() {
  // Back and Forward return to where this list was (#245)
  const scrollMemory = useScrollMemory('category');
  // The list's filters live in the URL, so Back returns to them (#245)
  const filters = useFilterSearch({ scope: 'category' });
  const { id } = useParams<{ id: string }>();
  const selectedMonth = useAppStore((s) => s.selectedMonth);
  // Opens on all of the category's history (the list's "All time"), as the chart shows several
  // months: starting on the budget month left the list and Summary empty whenever that month
  // had no activity yet, beside a chart full of spending. A bar click narrows all three.
  const [selectedBarMonth, setSelectedBarMonth] = useState<string | null>(null);

  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const { data: budgetData } = useBudget(selectedMonth);
  const { data: historyData } = useCategoryHistory(id ?? null, selectedMonth);

  const txMonth = selectedBarMonth ?? undefined;
  const { data: transactions = [] } = useTransactions(
    id ? { categoryId: id, ...(txMonth ? { month: txMonth } : {}) } : {},
  );

  const cat = useMemo(() => {
    if (!budgetData || !id) return null;
    for (const group of budgetData) {
      const found = group.categories.find((c: any) => c.id === id);
      if (found) return { ...found, isIncome: !!group.isIncome };
    }
    return null;
  }, [budgetData, id]);

  const isIncome = historyData?.isIncome ?? cat?.isIncome ?? false;
  const categoryName = cat?.name ?? 'Category';

  const { actual, remaining } = cat ? categoryFigures(cat, isIncome) : { actual: 0, remaining: 0 };

  return (
    <div className="flex flex-col h-full">
      <div className={`py-3 border-b border-border bg-surface shrink-0 ${PAGE_GUTTER}`}>
        <div className="flex items-center gap-1.5 text-base">
          <Link
            to="/budget"
            className="font-semibold text-text hover:text-brand-600 transition-colors"
          >
            Budget
          </Link>
          <ChevronRight size={14} className="text-text-tertiary" />
          <h1 className="font-semibold text-text inline-flex items-center gap-1.5">
            {showCategoryIcons && <CategoryIcon icon={cat?.icon} size={15} />}
            {categoryName}
          </h1>
        </div>
      </div>

      <div ref={scrollMemory} className={`flex-1 overflow-y-auto py-6 ${PAGE_GUTTER}`}>
        {/* Wide screens: the list sits right under the chart while Budget and Target (often
            taller than the chart) fill the side column above Summary. The last row is 1fr so
            the list, which spans it, never pushes Summary down. Phones keep the DOM order. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-[auto_auto_1fr] lg:items-start">
          <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1">
            {id && (
              <HistoryChart
                categoryId={id}
                month={selectedMonth}
                isIncome={isIncome}
                selectedBarMonth={selectedBarMonth}
                onBarClick={setSelectedBarMonth}
              />
            )}
          </div>
          <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2">
            <BudgetWidget
              budgeted={cat?.budgeted ?? 0}
              actual={actual}
              remaining={remaining}
              month={selectedMonth}
              isIncome={isIncome}
            />
            {id && cat && !isIncome && !cat.paymentAccountId && (
              <div className="mt-4">
                <TargetCard categoryId={id} target={cat.target} />
              </div>
            )}
          </div>
          <div className="lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:row-span-2 bg-surface rounded-lg shadow-card border border-border-light overflow-hidden">
            {id && (
              <TransactionTable
                key={filters.generation}
                initialFilters={filters.initialFilters}
                onFiltersChange={filters.onFiltersChange}
                categoryId={id}
                month={txMonth}
                onClearMonth={() => setSelectedBarMonth(null)}
                overlayDetail
              />
            )}
          </div>
          <div className="lg:col-start-3 lg:row-start-3 space-y-4">
            <SummaryWidget transactions={transactions} categoryId={id ?? ''} isIncome={isIncome} />
            {id && (
              <div className="bg-surface rounded-lg shadow-card border border-border-light p-4">
                <FilesSection kind="category" targetId={id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
