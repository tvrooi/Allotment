import { useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { useBudget } from '../../hooks/useBudget';
import { useIncomeVsExpenses } from '../../hooks/useReports';
import { formatCurrency } from '../../utils/currency';
import { StatCard } from '../ui/StatCard';
import { monthsToAverage, periodFlow, savingsRate } from '../../utils/reportSummary';
import { usePreferencesStore } from '../../store/preferencesStore';

interface Props {
  currentMonth: string;
  sixMonthsAgo: string;
}

const GOAL_OPTIONS = [10, 15, 20, 25, 30];

export default function SummaryStats({ currentMonth }: Props) {
  const twelveMonthsAgo = useMemo(() => format(subMonths(new Date(), 11), 'yyyy-MM'), []);
  const savingsGoal = usePreferencesStore((s) => s.savingsGoal);
  const setSavingsGoal = usePreferencesStore((s) => s.setSavingsGoal);

  const { data: budgetData = [], isLoading: budgetLoading } = useBudget(currentMonth);
  const { data: ieData = [], isLoading: ieLoading } = useIncomeVsExpenses(
    twelveMonthsAgo,
    currentMonth,
  );

  const isLoading = budgetLoading || ieLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[72px] bg-surface-alt rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const expenseCats = budgetData.filter((g) => g.isIncome === 0).flatMap((g) => g.categories);

  const totalBudgeted = expenseCats.reduce((sum, c) => sum + c.budgeted, 0);
  const totalSpent = expenseCats.reduce((sum, c) => sum + Math.abs(c.spent), 0);
  const leftToSpend = totalBudgeted - totalSpent;
  const spentPct = totalBudgeted > 0 ? totalSpent / totalBudgeted : 0;

  const ltsColor =
    spentPct > 1 ? 'text-negative' : spentPct >= 0.8 ? 'text-caution' : 'text-positive';

  // Only months since the budget's first income or spending (not the full 12 before it)
  const monthCount = monthsToAverage(ieData);
  // The shared definition over the same months (utils/reportSummary.ts), rounded for display
  const flow = periodFlow(ieData);
  const avgIncome = Math.round(flow.income / monthCount);
  const avgExpenses = Math.round(flow.spending / monthCount);
  const exactRate = savingsRate(flow.income, flow.spending);
  const rate = exactRate === null ? null : Math.round(exactRate);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {totalBudgeted > 0 ? (
        <StatCard label="Left to Spend" value={formatCurrency(leftToSpend)} valueColor={ltsColor} />
      ) : (
        <StatCard label="Left to Spend" value="—" sub="No budget set this month" />
      )}
      <StatCard
        label="Avg Monthly Income"
        value={formatCurrency(avgIncome)}
        valueColor={avgIncome > 0 ? 'text-positive' : undefined}
      />
      <StatCard
        label="Avg Monthly Expenses"
        value={formatCurrency(avgExpenses)}
        valueColor={avgExpenses > 0 ? 'text-negative' : undefined}
      />
      <div className="bg-surface rounded-lg px-5 py-4 border border-border-light shadow-card">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-medium text-text-secondary">Savings Rate</p>
          <select
            aria-label="Savings rate goal"
            value={savingsGoal}
            onChange={(e) => setSavingsGoal(Number(e.target.value))}
            className="text-xs border border-border rounded-md px-2 py-1 bg-surface text-text-secondary cursor-pointer max-md:min-h-11"
          >
            {GOAL_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}% goal
              </option>
            ))}
          </select>
        </div>
        {rate !== null ? (
          <p
            className={`text-xl font-semibold tabular-nums tracking-tight mt-2 ${rate >= savingsGoal ? 'text-positive' : 'text-negative'}`}
          >
            {rate}%
          </p>
        ) : (
          <>
            <p className="text-xl font-semibold tabular-nums mt-2 text-text">—</p>
            <p className="text-xs text-text-tertiary mt-0.5">Shown once you have income</p>
          </>
        )}
      </div>
    </div>
  );
}
