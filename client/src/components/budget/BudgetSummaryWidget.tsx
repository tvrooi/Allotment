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
import { Button } from '../ui/Button';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { SproutTick } from './SproutTick';
import { reachedZeroNow, type ReadySeen } from './readyReached';

interface ExpenseBreakdown {
  planned: number;
  spent: number;
}

interface BudgetSummaryWidgetProps {
  funding?: BudgetSummary;
  toBeBudgeted: number;
  incomePlanned: number;
  incomeEarned: number;
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
  /** Targets still short: Fund targets becomes the recommended action, "Put the rest in" the other */
  fundTargets?: { count: number; disabled: boolean; onOpen: () => void };
  /** Hold money for next month (the current month only) */
  canHold?: boolean;
}

/** The working behind Ready to assign folds away (on a phone with Hold, so the envelopes come sooner) */
const READY_HELP =
  "Ready to assign is the money in your accounts that you haven't given a job yet. Give it to categories (envelopes) until this reaches $0, so every dollar is planned. Spending takes money out of its envelope, not out of here.";

function PhoneCollapsed({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="px-4 min-h-11 flex items-center gap-1 cursor-pointer select-none text-nav text-text-secondary">
        <ChevronRight
          size={14}
          aria-hidden
          className="shrink-0 transition-transform group-open:rotate-90"
        />
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
}

function SummarySection({ label, planned, actual, actualLabel, type }: SummarySectionProps) {
  const rawRemaining = planned - actual;
  const displayRemaining = type === 'income' ? Math.max(rawRemaining, 0) : rawRemaining;
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
          <span className="text-nav text-text-tertiary">{actualLabel}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-sm font-medium tabular-nums ${remainingColor}`}>
            {displayRemaining === 0 ? '$0' : formatCurrency(displayRemaining)}
          </span>
          <span className="text-nav text-text-tertiary">
            {type === 'income'
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
  toBeBudgeted,
  incomePlanned,
  incomeEarned,
  savingsPlanned,
  savingsContributed,
  fixedExpenses,
  flexibleExpenses,
  nonMonthlyExpenses,
  putRest,
  fundTargets,
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
  const fundFirst = canPutRest && !!fundTargets && fundTargets.count > 0;
  // Only balances that disagree with the bank or missing rates make the figure itself doubtful.
  // Overspending, uncategorised spending and card shortfalls are jobs to do beside a figure that
  // holds, so they get their own line instead of turning the whole of Ready to assign yellow.
  const doubtful = !!funding?.accountIssues?.length || funding?.complete === false;
  const hasMoney =
    !funding || funding.resources !== 0 || (funding.envelopes ?? funding.reserved) !== 0;
  const hero =
    funding && doubtful
      ? {
          bg: 'bg-caution-subtle',
          text: 'text-caution',
          label: unresolvedReason(funding),
        }
      : getHeroStyle(toBeBudgeted, incomePlanned, hasMoney);
  // $0 with money in the budget: every dollar has a job (#241). Unknown until the summary is in.
  const fullyBudgeted = !!funding && !doubtful && toBeBudgeted === 0 && hasMoney;
  // The tick grows in when you bring this month there, and is still when you arrive at it
  const [seen, setSeen] = useState<ReadySeen | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  if (funding && (seen?.month !== funding.month || seen.full !== fullyBudgeted)) {
    setCelebrate(reachedZeroNow(seen, funding.month, fullyBudgeted));
    setSeen({ month: funding.month, full: fullyBudgeted });
  }
  const heroLabel = fullyBudgeted ? (
    <span className="inline-flex items-center gap-1.5">
      <SproutTick animate={celebrate} />
      {hero.label}
    </span>
  ) : (
    hero.label
  );
  // A negative figure already says "Assigned more than you have", so it isn't repeated here
  const todo =
    funding && !doubtful && !funding.resolved
      ? unresolvedReason({ ...funding, toBeBudgeted: Math.max(funding.toBeBudgeted, 0) })
      : null;
  const todoNotice = todo && !(toBeBudgeted < 0 && todo === 'Check the Review page') && (
    <p className="mt-2.5 flex items-start gap-1.5 px-1 text-nav text-text-secondary">
      <AlertCircle size={14} className="text-caution shrink-0 mt-px" aria-hidden />
      <span className="flex-1 min-w-0">{todo}.</span>
      {/* At the end of the line, so it never wraps alone under the reason */}
      <Link
        to="/review"
        className="shrink-0 py-3.5 -my-3.5 font-medium text-brand-700 underline underline-offset-2"
      >
        Review
      </Link>
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
    <div className="px-4 pb-3 text-nav">
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
                className={`tabular-nums ${
                  value <= 0 || SETTING_ASIDE.has(label)
                    ? 'text-text'
                    : label === 'Overspent envelopes'
                      ? 'text-negative font-medium'
                      : 'text-caution font-medium'
                }`}
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
            <div className={`min-w-0 text-left text-nav ${hero.text}`}>
              <p className="font-medium">
                Ready to assign
                <HelpTip label="What is Ready to assign?" inline>
                  {READY_HELP}
                </HelpTip>
              </p>
              <p>{heroLabel}</p>
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
            <p className={`text-sm font-medium ${hero.text}`}>{heroLabel}</p>
            <p className={`text-nav text-pretty ${hero.text} mt-1`}>
              {fullyBudgeted
                ? 'Every dollar has a job.'
                : "Money you have that isn't in a category yet."}
            </p>
          </div>
        )}
        {funding?.pools?.map((p) => (
          <div
            key={p.accountId}
            role="status"
            aria-label={`${p.name}: ready to assign`}
            className={`mt-2 rounded-lg px-4 py-2 text-center ${p.readyToAssign < 0 ? 'bg-caution-subtle text-caution' : 'bg-surface-alt text-text'}`}
          >
            <p className="text-nav font-medium">{p.name}</p>
            <p className="text-base font-semibold tabular-nums">
              {formatCurrency(p.readyToAssign)}
            </p>
            <p className="text-nav text-text-secondary">
              to assign to the bills paid from {p.name}
            </p>
          </div>
        ))}
        {showHold && isPhone && (funding.holdAmount ?? 0) > 0 && (
          <p className="mt-2 text-center text-nav text-text-secondary">
            {formatCurrency(funding.holdAmount ?? 0)} held for next month.
          </p>
        )}
        {canPutRest && (
          <div className="relative mt-2 grid gap-2 text-center">
            {/* Targets still short come first: that is the job the money is for. Otherwise the
                whole of Ready to assign goes to one envelope, chosen from a list. */}
            {fundFirst && (
              <Button
                size="sm"
                className="w-full"
                onClick={fundTargets.onOpen}
                disabled={fundTargets.disabled}
              >
                Fund targets ({fundTargets.count})
              </Button>
            )}
            <Button
              ref={setPickerButton}
              size="sm"
              variant={fundFirst ? 'secondary' : 'primary'}
              className="w-full"
              onClick={() => setPicking((o) => !o)}
              disabled={putRest.disabled}
              aria-haspopup="listbox"
              aria-expanded={picking}
            >
              Put {formatCurrency(toBeBudgeted)} in an envelope…
            </Button>
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
        {/* What is left to sort out, under the action rather than ahead of it */}
        {todoNotice}
        {/* The alternative, quieter: keep some of it for next month */}
        {showHold && !isPhone && <HoldMoney summary={funding} />}
      </div>

      {!!funding?.accountIssues?.length && (
        <div role="alert" className="px-4 pb-3 text-nav text-caution">
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
      {/* On a phone each fold has its own plain label, so the envelopes come sooner */}
      {showHold && isPhone && (
        <PhoneCollapsed label="Hold money for next month">
          <div className="px-4 pb-3">
            <HoldMoney summary={funding} />
          </div>
        </PhoneCollapsed>
      )}
      {isPhone
        ? workings && (
            <PhoneCollapsed label="How Ready to assign is worked out">{workings}</PhoneCollapsed>
          )
        : // Desktop folds the working too, so the rail leads with Ready to assign and its actions
          workings && (
            <details className="group border-t border-border-light">
              <summary className="px-4 min-h-11 md:min-h-9 flex items-center gap-1 cursor-pointer select-none text-nav text-text-secondary hover:text-text">
                <ChevronRight
                  size={14}
                  aria-hidden
                  className="shrink-0 transition-transform group-open:rotate-90"
                />
                How Ready to assign is worked out
              </summary>
              {workings}
            </details>
          )}
      {/* The desktop table already totals income and each budget type, so only phones, with no
          table, keep this summary */}
      {isPhone && (
        <PhoneCollapsed label="Income and expenses">
          <div className="flex justify-center gap-4 px-4 pt-2 pb-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-1.5 max-md:min-h-11 max-md:px-2 text-nav transition-colors border-b-2 ${
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
                {flexibleExpenses &&
                  (flexibleExpenses.planned > 0 || flexibleExpenses.spent > 0) && (
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
                        label="Non-monthly"
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
      )}
    </div>
  );
}
