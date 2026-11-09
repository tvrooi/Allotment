import type { BudgetSummary } from '../../types';
import { CashBridge } from './CashBridge';
import { unresolvedReason } from '../../utils/fundingStatus';
import { useState } from 'react';
import { CategoryPicker } from '../transactions/CategoryPicker';
import { HelpTip } from '../ui/HelpTip';
import type { CategoryGroup } from '../../types';
import { formatCurrency, formatMoney } from '../../utils/currency';
import { Link } from 'react-router-dom';
import { formatAsOfDay } from '../../utils/dates';
import { useIsPhone } from '../../hooks/useIsPhone';
import { HoldMoney } from './HoldMoney';
import { AlertCircle, ChevronRight } from 'lucide-react';

interface ExpenseBreakdown {
  planned: number;
  spent: number;
}

interface BudgetSummaryWidgetProps {
  funding?: BudgetSummary;
  expenseAvailable?: number;
  toBeBudgeted: number;
  carryOver: number;
  incomePlanned: number;
  incomeEarned: number;
  expensesPlanned: number;
  expensesSpent: number;
  savingsPlanned: number;
  savingsContributed: number;
  fixedExpenses?: ExpenseBreakdown;
  flexibleExpenses?: ExpenseBreakdown;
  nonMonthlyExpenses?: ExpenseBreakdown;
  /** "Put the rest in…": pick an expense category and it gets all of Ready to assign */
  putRest?: {
    groups: CategoryGroup[];
    disabled: boolean;
    onPick: (categoryId: string, categoryName: string) => void;
  };
  /** Hold money for next month (the current month only) */
  canHold?: boolean;
}

/** The working behind Ready to assign folds away (on a phone with Hold, so the envelopes come sooner) */
const READY_HELP =
  "Ready to assign is the money in your accounts that you haven't given a job yet. Give it to categories (envelopes) until this reaches $0, so every dollar is planned. Spending takes money out of its envelope, not out of here.";

function PhoneCollapsed({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (!collapsed) return <>{children}</>;
  return (
    <details>
      <summary className="px-4 min-h-11 flex items-center cursor-pointer select-none text-xs text-text-secondary">
        {label}
      </summary>
      {children}
    </details>
  );
}

function getHeroStyle(tbb: number, incomePlanned: number, hasMoney: boolean) {
  // A new budget: no money yet is nothing to praise
  if (tbb === 0 && !hasMoney)
    return { bg: 'bg-surface-alt', text: 'text-text-secondary', label: 'Nothing to assign yet' };
  if (tbb < 0)
    return {
      bg: 'bg-negative-subtle',
      text: 'text-negative',
      label: 'Assigned more than you have',
    };
  if (tbb === 0)
    return { bg: 'bg-positive-subtle', text: 'text-positive', label: 'Fully budgeted' };
  const threshold = Math.max(incomePlanned * 0.02, 500);
  if (tbb <= threshold)
    return { bg: 'bg-caution-subtle', text: 'text-caution', label: 'Almost budgeted' };
  return { bg: 'bg-positive-subtle', text: 'text-positive', label: 'Give every dollar a job' };
}

function getBarColor(actual: number, planned: number, type: 'income' | 'expenses' | 'savings') {
  if (type === 'income' || type === 'savings') return 'bg-positive';
  if (planned <= 0) return actual > 0 ? 'bg-negative' : 'bg-positive';
  return actual > planned ? 'bg-negative' : 'bg-positive';
}

interface SummarySectionProps {
  label: string;
  planned: number;
  actual: number;
  actualLabel: string;
  type: 'income' | 'expenses' | 'savings';
  available?: number;
}

function SummarySection({
  label,
  planned,
  actual,
  actualLabel,
  type,
  available,
}: SummarySectionProps) {
  const rawRemaining = planned - actual;
  const displayRemaining =
    available ?? (type === 'income' ? Math.max(rawRemaining, 0) : rawRemaining);
  const ratio =
    type === 'income' ? (actual > 0 ? 1 : 0) : planned > 0 ? Math.min(actual / planned, 1) : 0;
  const barColor = getBarColor(actual, planned, type);
  const remainingColor =
    type === 'income'
      ? displayRemaining === 0
        ? 'text-text-tertiary'
        : 'text-positive'
      : displayRemaining >= 0
        ? 'text-positive'
        : 'text-negative';

  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-text">{label}</span>
        <span className="text-sm tabular-nums text-text-tertiary">
          {formatCurrency(planned)} {type === 'income' ? 'expected' : 'assigned'}
        </span>
      </div>

      <div className="h-3 w-full bg-surface-alt rounded-full overflow-hidden mt-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${(ratio * 100).toFixed(1)}%` }}
        />
      </div>

      <div className="flex justify-between mt-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold tabular-nums text-text">
            {formatCurrency(actual)}
          </span>
          <span className="text-xs text-text-tertiary">{actualLabel}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-sm font-medium tabular-nums ${remainingColor}`}>
            {displayRemaining === 0 ? '$0' : formatCurrency(displayRemaining)}
          </span>
          <span className="text-xs text-text-tertiary">
            {available !== undefined
              ? 'Available'
              : type === 'income'
                ? 'expected income remaining'
                : 'monthly spending progress remaining'}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Rows of the working that set money aside on purpose, so a figure there isn't a problem */
const SETTING_ASIDE = new Set(['Assigned in later months', 'Held for next month']);

type Tab = 'summary' | 'income' | 'expenses';

const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'income', label: 'Income' },
  { key: 'expenses', label: 'Expenses' },
];

export function BudgetSummaryWidget({
  funding,
  expenseAvailable,
  toBeBudgeted,
  incomePlanned,
  incomeEarned,
  expensesPlanned,
  expensesSpent,
  savingsPlanned,
  savingsContributed,
  fixedExpenses,
  flexibleExpenses,
  nonMonthlyExpenses,
  putRest,
  canHold,
}: BudgetSummaryWidgetProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const isPhone = useIsPhone();
  const [picking, setPicking] = useState(false);
  const [pickerButton, setPickerButton] = useState<HTMLButtonElement | null>(null);
  const showHold = !!canHold && !!funding && funding.complete && !funding.accountIssues?.length;
  const readyAmount = funding?.accountIssues?.length
    ? 'Check balances'
    : funding?.complete === false
      ? 'Incomplete'
      : formatCurrency(toBeBudgeted);
  const canPutRest =
    !!putRest && toBeBudgeted > 0 && !funding?.accountIssues?.length && funding?.complete !== false;
  // Only balances that disagree with the bank or missing rates make the figure itself doubtful.
  // Overspending, uncategorised spending and card shortfalls are jobs to do beside a figure that
  // holds, so they get their own line instead of turning the whole of Ready to assign yellow.
  const doubtful = !!funding?.accountIssues?.length || funding?.complete === false;
  const hero =
    funding && doubtful
      ? {
          bg: 'bg-caution-subtle',
          text: 'text-caution',
          label: unresolvedReason(funding),
        }
      : getHeroStyle(
          toBeBudgeted,
          incomePlanned,
          !funding || funding.resources !== 0 || (funding.envelopes ?? funding.reserved) !== 0,
        );
  // A negative figure already says "Assigned more than you have", so it isn't repeated here
  const todo =
    funding && !doubtful && !funding.resolved
      ? unresolvedReason({ ...funding, toBeBudgeted: Math.max(funding.toBeBudgeted, 0) })
      : null;
  const todoNotice = todo && !(toBeBudgeted < 0 && todo === 'Check the Review page') && (
    <p className="mt-2 flex items-start gap-1.5 px-1 text-xs text-text-secondary">
      <AlertCircle size={14} className="text-caution shrink-0 mt-px" aria-hidden />
      <span>
        {todo}.{' '}
        <Link to="/review" className="font-medium text-brand-700 underline underline-offset-2">
          Review
        </Link>
      </span>
    </p>
  );

  // Only the rows with something in them: a column of $0 says nothing
  const issueRows = funding
    ? (
        [
          ['Overspent envelopes', funding.overspent],
          ['Uncategorised spending', funding.uncategorized],
          ['Assigned in later months', funding.laterDeduction ?? funding.futureAssigned],
          ['Held for next month', funding.held ?? 0],
          ['Card payment shortfall', funding.paymentShortfall ?? 0],
          ['Payments without funding', funding.uncoveredCardPayments ?? 0],
        ] as const
      ).filter(([, value]) => value !== 0)
    : [];
  const workings = funding && (
    <div className="px-4 pb-3 text-xs">
      <p className="text-text-tertiary mb-1.5">
        Ready to assign as of {formatAsOfDay(funding.asOf)}
      </p>
      <CashBridge
        breakdown={funding.breakdown}
        resources={funding.resources}
        readyToAssign={toBeBudgeted}
      />
      <p className="text-text-tertiary">
        A Saver is still yours to assign: put the money in an envelope to set it aside.
      </p>
      {issueRows.length > 0 && (
        <dl className="grid gap-1 mt-2">
          {issueRows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2">
              <dt className="text-text-secondary">{label}</dt>
              <dd
                className={`tabular-nums ${value > 0 && !SETTING_ASIDE.has(label) ? 'text-negative font-medium' : 'text-text'}`}
              >
                {formatCurrency(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {(funding.cashOverspent ?? 0) > 0 && (
        <p className="text-text-tertiary mt-1.5">
          {`${formatCurrency(funding.cashOverspent ?? 0)} overspent from cash comes out of next month's Ready to assign.`}
        </p>
      )}
    </div>
  );

  return (
    <div className="rounded-lg shadow-card border border-border-light overflow-hidden bg-surface">
      <div className="p-3">
        {isPhone ? (
          // Phones: one compact row, so the envelopes below are in reach (UX audit AU-002)
          <div
            role="status"
            aria-label="Ready to assign"
            data-guide="budget.ready"
            className={`${hero.bg} rounded-lg px-3 py-2 flex items-center justify-between gap-3`}
          >
            <div className={`min-w-0 text-left text-xs ${hero.text}`}>
              <p className="font-medium">
                Ready to assign
                <HelpTip label="What is Ready to assign?" inline>
                  {READY_HELP}
                </HelpTip>
              </p>
              <p>{hero.label}</p>
            </div>
            <p className={`text-lg font-semibold tabular-nums whitespace-nowrap ${hero.text}`}>
              {readyAmount}
            </p>
          </div>
        ) : (
          <div
            role="status"
            aria-label="Ready to assign"
            data-guide="budget.ready"
            className={`${hero.bg} rounded-lg px-4 pt-3 pb-3.5`}
          >
            <p className={`text-sm font-medium ${hero.text}`}>
              Ready to assign
              <HelpTip label="What is Ready to assign?" inline>
                {READY_HELP}
              </HelpTip>
            </p>
            <p
              className={`mt-0.5 text-title font-semibold tracking-tight tabular-nums ${hero.text}`}
            >
              {readyAmount}
            </p>
            <p className={`text-sm font-medium ${hero.text}`}>{hero.label}</p>
            <p className={`text-xs text-pretty ${hero.text} mt-1`}>
              Money you have that isn't in a category yet.
            </p>
          </div>
        )}
        {todoNotice}
        {funding?.pools?.map((p) => (
          <div
            key={p.accountId}
            role="status"
            aria-label={`${p.name}: ready to assign`}
            className={`mt-2 rounded-lg px-4 py-2 text-center ${p.readyToAssign < 0 ? 'bg-caution-subtle text-caution' : 'bg-surface-alt text-text'}`}
          >
            <p className="text-xs font-medium">{p.name}</p>
            <p className="text-base font-semibold tabular-nums">
              {formatCurrency(p.readyToAssign)}
            </p>
            <p className="text-xs text-text-secondary">to assign to the bills paid from {p.name}</p>
          </div>
        ))}
        {showHold && !isPhone && <HoldMoney summary={funding} />}
        {showHold && isPhone && (funding.holdAmount ?? 0) > 0 && (
          <p className="mt-2 text-center text-xs text-text-secondary">
            {formatCurrency(funding.holdAmount ?? 0)} held for next month.
          </p>
        )}
        {canPutRest && (
          <div className="relative mt-2 text-center">
            <button
              ref={setPickerButton}
              type="button"
              onClick={() => setPicking((o) => !o)}
              disabled={putRest.disabled}
              aria-haspopup="listbox"
              aria-expanded={picking}
              className="min-h-11 md:min-h-0 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-surface-alt text-text hover:bg-hover disabled:opacity-50"
            >
              Put the rest in…
            </button>
            {picking && (
              <CategoryPicker
                anchor={pickerButton}
                groups={putRest.groups}
                allowNone={false}
                onClose={() => setPicking(false)}
                onChange={(id) => {
                  setPicking(false);
                  const name = putRest.groups
                    .flatMap((g) => g.categories)
                    .find((c) => c.id === id)?.name;
                  if (id && name) putRest.onPick(id, name);
                }}
              />
            )}
          </div>
        )}
      </div>

      {!!funding?.accountIssues?.length && (
        <div role="alert" className="px-4 pb-3 text-xs text-caution">
          <p>Ready to assign is unverified. Resolve these balances before funding categories.</p>
          <ul className="mt-2 space-y-2">
            {funding.accountIssues.map((issue) => (
              <li key={issue.accountId}>
                <Link className="underline" to={`/accounts/${issue.accountId}/reconcile`}>
                  {issue.accountName}
                </Link>
                {issue.reason === 'closed-balance'
                  ? `: closed with ${formatMoney(issue.registerBalance, issue.currency)} still recorded. Reconcile it to zero.`
                  : issue.bankBalance === null
                    ? ': sync the bank to check its settled balance.'
                    : `: register ${formatMoney(issue.registerBalance, issue.currency)}, bank ${formatMoney(issue.bankBalance, issue.currency)}.`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <PhoneCollapsed
        collapsed={isPhone}
        label={showHold ? 'Hold money, and how this is worked out' : 'How this is worked out'}
      >
        {showHold && isPhone && (
          <div className="px-4 pb-3">
            <HoldMoney summary={funding} />
          </div>
        )}
        {isPhone
          ? workings
          : // Desktop folds the working too, so the rail leads with Ready to assign and its actions
            workings && (
              <details className="group border-t border-border-light">
                <summary className="px-4 min-h-9 flex items-center gap-1 cursor-pointer select-none text-xs text-text-secondary hover:text-text">
                  <ChevronRight
                    size={14}
                    aria-hidden
                    className="shrink-0 transition-transform group-open:rotate-90"
                  />
                  How this is worked out
                </summary>
                {workings}
              </details>
            )}
        <div className="flex justify-center gap-4 px-4 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-1.5 max-md:min-h-11 max-md:px-2 text-xs transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'border-text text-text font-semibold'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="px-4 pb-2">
          {activeTab === 'summary' && (
            <div>
              <SummarySection
                label="Income"
                planned={incomePlanned}
                actual={incomeEarned}
                actualLabel="earned"
                type="income"
              />
              <div className="border-t border-border-light" />
              <SummarySection
                label="Expense envelopes"
                available={expenseAvailable}
                planned={expensesPlanned}
                actual={expensesSpent}
                actualLabel="Spent this month"
                type="expenses"
              />
              {savingsPlanned > 0 && (
                <>
                  <div className="border-t border-border-light" />
                  <SummarySection
                    label="Save up"
                    planned={savingsPlanned}
                    actual={savingsContributed}
                    actualLabel="spent from savings categories"
                    type="savings"
                  />
                </>
              )}
            </div>
          )}
          {activeTab === 'income' && (
            <SummarySection
              label="Income"
              planned={incomePlanned}
              actual={incomeEarned}
              actualLabel="earned"
              type="income"
            />
          )}
          {activeTab === 'expenses' && (
            <div>
              {fixedExpenses && (fixedExpenses.planned > 0 || fixedExpenses.spent > 0) && (
                <SummarySection
                  label="Fixed"
                  planned={fixedExpenses.planned}
                  actual={fixedExpenses.spent}
                  actualLabel="spent"
                  type="expenses"
                />
              )}
              {flexibleExpenses && (flexibleExpenses.planned > 0 || flexibleExpenses.spent > 0) && (
                <>
                  {fixedExpenses && (fixedExpenses.planned > 0 || fixedExpenses.spent > 0) && (
                    <div className="border-t border-border-light" />
                  )}
                  <SummarySection
                    label="Flexible"
                    planned={flexibleExpenses.planned}
                    actual={flexibleExpenses.spent}
                    actualLabel="spent"
                    type="expenses"
                  />
                </>
              )}
              {nonMonthlyExpenses &&
                (nonMonthlyExpenses.planned > 0 || nonMonthlyExpenses.spent > 0) && (
                  <>
                    <div className="border-t border-border-light" />
                    <SummarySection
                      label="Non-Monthly"
                      planned={nonMonthlyExpenses.planned}
                      actual={nonMonthlyExpenses.spent}
                      actualLabel="spent"
                      type="expenses"
                    />
                  </>
                )}
            </div>
          )}
        </div>
      </PhoneCollapsed>
    </div>
  );
}
