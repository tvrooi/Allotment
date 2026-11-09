import { ChevronDown } from 'lucide-react';
import { Select } from '../ui/Input';
import { DataFeedback, dataUnavailable } from './DataFeedback';
import { useIsPhone } from '../../hooks/useIsPhone';
import { useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { useBudget } from '../../hooks/useBudget';
import { useIncomeVsExpenses } from '../../hooks/useReports';
import { formatCurrency } from '../../utils/currency';
import { leftToSpend as envelopeLeftToSpend, savingsCategoryIds } from '../../utils/leftToSpend';
import { useGoals } from '../../hooks/useGoals';
import { StatCard, StatGrid } from '../ui/StatCard';
import { monthsToAverage, periodFlow, savingsRate } from '../../utils/reportSummary';
import { formatDateRange, formatMonth } from '../../utils/dateRange';
import { usePreferencesStore } from '../../store/preferencesStore';

interface Props {
  currentMonth: string;
  sixMonthsAgo: string;
  refined?: boolean;
  section?: 'all' | 'current' | 'history';
}

const GOAL_OPTIONS = [10, 15, 20, 25, 30];

export default function SummaryStats({ currentMonth, refined = false, section = 'all' }: Props) {
  const [editingGoal, setEditingGoal] = useState(false);
  const isPhone = useIsPhone();
  const phoneTile = isPhone ? '!border-0 !shadow-none !bg-transparent !p-0' : undefined;
  const desktopHierarchy = refined && !isPhone;
  const currentTile = desktopHierarchy
    ? '!basis-[calc(40%-1rem)] [&>p:nth-child(2)]:text-3xl [&>p:nth-child(2)]:leading-10'
    : phoneTile;
  const historyTile = desktopHierarchy ? '!basis-[calc(20%-1rem)]' : phoneTile;
  const twelveMonthsAgo = useMemo(() => format(subMonths(new Date(), 11), 'yyyy-MM'), []);
  const savingsGoal = usePreferencesStore((s) => s.savingsGoal);
  const setSavingsGoal = usePreferencesStore((s) => s.setSavingsGoal);

  const budgetQuery = useBudget(currentMonth);
  const { data: budgetData = [] } = budgetQuery;
  const goalsQuery = useGoals();
  const { data: goals = [] } = goalsQuery;
  const incomeVsExpensesQuery = useIncomeVsExpenses(twelveMonthsAgo, currentMonth);
  const { data: ieData = [] } = incomeVsExpensesQuery;

  const sources =
    section === 'current'
      ? [budgetQuery, goalsQuery]
      : section === 'history'
        ? [incomeVsExpensesQuery]
        : [budgetQuery, goalsQuery, incomeVsExpensesQuery];
  if (dataUnavailable(sources)) return <DataFeedback title="Summary" sources={sources} />;

  if (sources.some((q) => q.isLoading)) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[72px] bg-surface-alt rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const expenseCats = budgetData.filter((g) => g.isIncome === 0).flatMap((g) => g.categories);

  // The envelopes' Available balances (carry-over and transfers count), like the dashboard's
  // headline and the Budget page, without savings envelopes
  const {
    left: leftToSpend,
    setAside,
    planned,
  } = envelopeLeftToSpend(budgetData, savingsCategoryIds(goals));
  const totalSpent = expenseCats.reduce((sum, c) => sum + Math.abs(c.spent), 0);
  const spentPct = totalSpent / Math.max(totalSpent + leftToSpend, 1);

  const ltsColor =
    leftToSpend < 0 ? 'text-negative' : spentPct >= 0.8 ? 'text-caution' : 'text-positive';

  // Only months since the budget's first income or spending (not the full 12 before it)
  const monthCount = monthsToAverage(ieData);
  // The shared definition over the same months (utils/reportSummary.ts), rounded for display
  const flow = periodFlow(ieData);
  const avgIncome = Math.round(flow.income / monthCount);
  const avgExpenses = Math.round(flow.spending / monthCount);
  const exactRate = savingsRate(flow.income, flow.spending);
  const rate = exactRate === null ? null : Math.round(exactRate);
  const firstMonth = ieData.at(-monthCount)?.month ?? currentMonth;
  const period = formatDateRange({ preset: 'custom', from: firstMonth, to: currentMonth });
  const periodNote = `${period} · includes current month`;

  return (
    <div className="space-y-3">
      <DataFeedback title="Summary" sources={sources} />
      <StatGrid
        className={
          isPhone
            ? 'gap-x-4 gap-y-4 rounded-lg border border-border-light bg-surface p-4 shadow-card [&>*:first-child]:basis-full [&>*:last-child]:basis-full'
            : 'gap-3'
        }
      >
        {section !== 'history' &&
          (planned ? (
            <StatCard
              className={currentTile}
              label={`Left to spend · ${formatMonth(currentMonth)}`}
              value={formatCurrency(leftToSpend)}
              valueColor={ltsColor}
              sub={
                setAside > 0
                  ? `Excludes ${formatCurrency(setAside)} in savings and goal categories`
                  : 'Excludes savings and goal categories'
              }
            />
          ) : (
            <StatCard
              className={currentTile}
              label={`Left to spend · ${formatMonth(currentMonth)}`}
              value="—"
              sub="No budget set this month"
            />
          ))}
        {section !== 'current' && (
          <>
            {isPhone && (
              <p className="!basis-full border-t border-border-light pt-3 text-xs text-text-tertiary">
                Averages &amp; savings · {period}
                <br />
                Includes current month
              </p>
            )}
            <StatCard
              className={historyTile}
              label={isPhone ? 'Income / month' : 'Avg monthly income'}
              value={formatCurrency(avgIncome)}
              sub={isPhone || refined ? undefined : periodNote}
              valueColor={avgIncome > 0 ? 'text-positive' : undefined}
            />
            <StatCard
              className={historyTile}
              label={isPhone ? 'Expenses / month' : 'Avg monthly expenses'}
              value={formatCurrency(avgExpenses)}
              sub={isPhone || refined ? undefined : periodNote}
              // Spending isn't an error: red is kept for overspent and negative balances
            />
            <div
              className={
                isPhone
                  ? 'flex flex-wrap items-center justify-between gap-3 border-t border-border-light pt-3'
                  : desktopHierarchy
                    ? '!basis-[calc(20%-1rem)] flex flex-col bg-surface rounded-lg px-6 py-4 border border-border-light shadow-card'
                    : 'bg-surface rounded-lg px-6 py-4 border border-border-light shadow-card'
              }
            >
              <div
                className={
                  desktopHierarchy
                    ? 'contents'
                    : 'flex items-center justify-between gap-2 flex-wrap'
                }
              >
                <p className="text-xs font-medium text-text-secondary">Savings rate</p>
                {refined && !editingGoal ? (
                  <button
                    type="button"
                    aria-label="Edit savings target"
                    onClick={() => setEditingGoal(true)}
                    className={`inline-flex min-h-11 items-center gap-1 text-xs text-text-secondary underline underline-offset-4 hover:text-text ${desktopHierarchy ? 'order-last self-start' : ''}`}
                  >
                    Target {savingsGoal}% · Edit
                  </button>
                ) : (
                  <Select
                    compact
                    aria-label="Savings rate goal"
                    value={savingsGoal}
                    onChange={(e) => {
                      setSavingsGoal(Number(e.target.value));
                      if (refined) setEditingGoal(false);
                    }}
                    className={`w-auto ${desktopHierarchy ? 'order-last self-start mt-2' : ''}`}
                  >
                    {GOAL_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}% goal
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              {rate !== null ? (
                <p
                  className={`text-xl font-semibold tabular-nums tracking-tight mt-2 whitespace-nowrap ${rate >= savingsGoal ? 'text-positive' : 'text-text'}`}
                >
                  {rate}%
                </p>
              ) : (
                <>
                  <p className="text-xl font-semibold tabular-nums mt-2 text-text">—</p>
                  <p className="text-xs text-text-tertiary mt-0.5">Shown once you have income</p>
                </>
              )}
              {!isPhone && !refined && (
                <p className="text-xs text-text-tertiary mt-0.5">{periodNote}</p>
              )}
            </div>
          </>
        )}
      </StatGrid>
      {refined && !isPhone && section !== 'current' && (
        <p className="text-xs text-text-tertiary">Monthly averages &amp; savings · {periodNote}</p>
      )}
      <details className="group text-xs text-text-secondary">
        <summary className="cursor-pointer min-h-11 inline-flex items-center gap-2 underline underline-offset-4 hover:text-text">
          {section === 'current' ? 'How this is calculated' : 'How these figures are calculated'}
          <ChevronDown
            size={14}
            aria-hidden
            className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <dl className="grid gap-3 rounded-lg border border-border-light bg-surface px-4 py-3 leading-relaxed">
          {section !== 'history' && (
            <div>
              <dt className="font-semibold text-text">Left to spend</dt>
              <dd>
                Available in this month’s spending categories, including money carried over and
                moved between categories. Savings categories are excluded, as are categories used by
                goals that haven’t been retired. This is budget money available to spend, rather
                than your account balance.
              </dd>
            </div>
          )}
          {section !== 'current' && (
            <>
              <div>
                <dt className="font-semibold text-text">Monthly averages</dt>
                <dd>
                  {period}: {monthCount} {monthCount === 1 ? 'month' : 'months'}, including the
                  current month before it ends. We look back up to 12 months and start with the
                  first month with income or spending. Quiet months after that still count. Recorded
                  transactions dated later this month are included too. Income comes from income
                  categories; expenses are spending minus refunds, with a minimum of zero over the
                  period.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-text">Savings rate</dt>
                <dd>
                  Income minus expenses, divided by income, over the same period as the averages. It
                  measures the share of income you haven’t spent, not the balance in your savings
                  accounts or goal categories. Transfers between your budget accounts, borrowing and
                  changes in asset values don’t count as income or expenses. These reports use your
                  personal budget accounts and leave out transactions hidden from reports. The
                  percentage goal is a comparison target; choosing it doesn’t move money. A dash
                  means there is no positive income to compare.
                </dd>
              </div>
            </>
          )}
        </dl>
      </details>
    </div>
  );
}
