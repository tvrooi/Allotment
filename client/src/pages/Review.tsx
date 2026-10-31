import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, AlertTriangle, Info } from 'lucide-react';
import * as api from '../api/review';
import { updateTransaction } from '../api/transactions';
import { useBudget } from '../hooks/useBudget';
import { useCanSave } from '../hooks/useConnection';
import { Card } from '../components/ui/Card';
import { ButtonLink } from '../components/ui/Button';
import { Select } from '../components/ui/Input';
import { MoneyMoves } from '../components/budget/MoneyMoves';
import { FundTargets } from '../components/budget/FundTargets';
import { formatCurrency } from '../utils/currency';
import { useHideBalances } from '../utils/safeMode';
import { Private } from '../components/ui/Private';
import { formatDay } from '../utils/dates';
import { FUNDING_VIEWS } from '../utils/fundingViews';
import {
  ExtraIncome,
  ReminderBanner,
  ResilienceCard,
  ResumeCard,
} from '../components/review/Resilience';
import { Housekeeping } from '../components/review/Housekeeping';
import { PaymentMatches } from '../components/plans/PaymentMatches';

// Phases 6F–6G: a read-only review of everything the budget has not resolved, a guided
// setup, and next month's commitments with an optional runway. Every figure comes from the
// shared funding service, so totals agree with the monthly budget.

const STEP_TITLES: Record<api.GuideStepId, string> = {
  balances: 'Confirm your balances',
  'before-income': 'Cover what is due before your next income',
  assign: 'Assign the money you already have',
  irregular: 'Prepare for irregular expenses',
  'before-spending': 'Check categories before spending',
  priorities: 'Move money when priorities change',
};
const monthLabel = (month: string) => format(parseISO(`${month}-01`), 'MMMM yyyy');

function StatusIcon({ status }: { status: api.GuideState['steps'][number]['status'] }) {
  if (status === 'done')
    return <CheckCircle2 size={18} className="text-positive shrink-0" aria-label="Done" />;
  if (status === 'attention')
    return (
      <AlertTriangle size={18} className="text-caution shrink-0" aria-label="Needs attention" />
    );
  if (status === 'info')
    return <Info size={18} className="text-text-tertiary shrink-0" aria-label="Tip" />;
  return <Circle size={18} className="text-text-tertiary shrink-0" aria-label="To do" />;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'neg' | 'pos' }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span
        className={`tabular-nums font-medium ${
          tone === 'neg' ? 'text-negative' : tone === 'pos' ? 'text-positive' : 'text-text'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-label={title} className="space-y-2">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {children}
    </section>
  );
}

function GuideStep({
  step,
  guide,
}: {
  step: api.GuideState['steps'][number];
  guide: api.GuideState;
}) {
  const [open, setOpen] = useState(step.status === 'todo' || step.status === 'attention');
  return (
    <li className="border-t border-border-light first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-start gap-3 py-3 text-left max-md:min-h-11"
      >
        <StatusIcon status={step.status} />
        <span className="flex-1">
          <span className="block text-sm font-medium text-text">{STEP_TITLES[step.id]}</span>
          <span className="block text-xs text-text-secondary">{step.summary}</span>
        </span>
      </button>
      {open && (
        <div className="pl-8 pb-3 text-sm text-text-secondary space-y-2">
          <StepDetail id={step.id} guide={guide} />
        </div>
      )}
    </li>
  );
}

function StepDetail({ id, guide }: { id: api.GuideStepId; guide: api.GuideState }) {
  if (id === 'balances')
    return (
      <>
        <p>Compare each balance with your bank, then reconcile it.</p>
        {guide.balances.length === 0 && <p>No cash or card accounts in the budget yet.</p>}
        <ul className="space-y-1">
          {guide.balances.map((b) => (
            <li key={b.accountId} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-text">{b.name}</span>
              <span className="flex items-center gap-2 tabular-nums">
                <Private>
                  {formatCurrency(b.balance)}
                  {b.currency ? ` ${b.currency}` : ''}
                </Private>
                {b.unreconciled > 0 && (
                  <Link
                    to={`/accounts/${b.accountId}/reconcile`}
                    className="text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Reconcile ({b.unreconciled})
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  if (id === 'before-income')
    return (
      <>
        <p>
          {guide.nextIncome
            ? `Bills due before your next expected pay on ${formatDay(guide.nextIncome)}.`
            : `No payday plan or scheduled income yet, so this shows bills in the next 14 days, until ${formatDay(guide.needsUntil)}.`}{' '}
          Expected pay is only a date here; it is not money you can assign.
        </p>
        {guide.needs.length === 0 && guide.billsComplete && <p>No unpaid scheduled bills.</p>}
        <ul className="space-y-1">
          {guide.needs.map((n) => (
            <li key={n.categoryId} className="flex flex-wrap justify-between gap-2 tabular-nums">
              <Link
                to={`/budget/category/${n.categoryId}`}
                className="text-text hover:text-brand-700"
              >
                {n.name}
              </Link>
              <span>
                {formatCurrency(n.due)} due · {formatCurrency(n.available)} available
                {n.uncovered > 0 && (
                  <span className="text-negative"> · {formatCurrency(n.uncovered)} short</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  if (id === 'assign')
    return (
      <>
        <p>
          {guide.accountIssues?.length
            ? 'Account balances need reconciliation before unassigned money can be relied on.'
            : guide.complete
              ? `${formatCurrency(guide.unassigned)} is unassigned today. Give every dollar you already have a job; money you expect later is assigned when it arrives.`
              : 'Some exchange rates are missing, so unassigned money is unknown.'}
        </p>
        <ButtonLink size="sm" variant="secondary" to="/budget">
          Open the budget
        </ButtonLink>
      </>
    );
  if (id === 'irregular')
    return (
      <>
        <p>
          Non-monthly categories and categories with quarterly, half-yearly or yearly bills. A
          target spreads each bill over the months before it is due.
        </p>
        <ul className="space-y-1">
          {guide.irregular.map((c) => (
            <li key={c.categoryId} className="flex justify-between gap-2">
              <span className="text-text">{c.name}</span>
              <Link
                to={`/budget/category/${c.categoryId}`}
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                {c.hasTarget ? 'View target' : 'Set a target'}
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  if (id === 'before-spending')
    return (
      <p>
        Before you spend, check the category has enough available. Overspending and uncategorised
        spending are listed under <a href="#needs-attention">Needs attention</a>.
      </p>
    );
  return (
    <p>
      Use <strong>Move money</strong> under Needs attention or on the budget to take money from one
      category and give it to another. Both balances are previewed first.
    </p>
  );
}

function Uncategorised({
  review,
  categories,
}: {
  review: api.BudgetReview;
  categories: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const [error, setError] = useState<string | null>(null);
  async function categorise(id: string, categoryId: string) {
    setError(null);
    try {
      await updateTransaction(id, { categoryId });
      for (const key of [...FUNDING_VIEWS, 'transactions', 'accounts'])
        await qc.invalidateQueries({ queryKey: [key] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not categorise the transaction.');
    }
  }
  return (
    <Section title={`Uncategorised spending (${review.uncategorisedCount})`}>
      <ul className="space-y-2">
        {review.uncategorised.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex-1 min-w-40">
              <span className="text-text">{t.payee ?? 'No payee'}</span>
              <span className="block text-xs text-text-tertiary">
                {formatDay(t.date)} · {t.accountName}
              </span>
            </span>
            <span className="tabular-nums text-negative">{formatCurrency(t.amount)}</span>
            <span className="w-48 max-md:w-full">
              <Select
                aria-label={`Category for ${t.payee ?? 'transaction'} on ${t.date}`}
                value=""
                disabled={!canSave}
                onChange={(e) => e.target.value && categorise(t.id, e.target.value)}
              >
                <option value="">Choose a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </span>
          </li>
        ))}
      </ul>
      {review.uncategorisedCount > review.uncategorised.length && (
        <p className="text-xs text-text-tertiary">
          Showing the latest {review.uncategorised.length}.{' '}
          <Link to="/transactions" className="text-brand-600">
            Open transactions
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </Section>
  );
}

function NeedsAttention({ review, group }: { review: api.BudgetReview; group: string }) {
  const budget = useBudget(review.month);
  const groups = budget.data ?? [];
  const expense = groups.filter((g) => !g.isIncome).flatMap((g) => g.categories);
  const inGroup = <T extends { groupId: string }>(items: T[]) =>
    group ? items.filter((i) => i.groupId === group) : items;
  const deficits = inGroup(review.deficits);
  const shortfalls = inGroup(review.targetShortfalls);
  const commitments = review.commitments
    .map((c) => ({ ...c, categories: inGroup(c.categories) }))
    .filter((c) => c.categories.length);
  const nothing =
    !review.accountIssues?.length &&
    !review.uncategorisedCount &&
    !deficits.length &&
    !shortfalls.length &&
    !review.cards.length &&
    review.unassigned >= 0;
  return (
    <Card>
      <div id="needs-attention" className="space-y-4">
        <h2 className="text-base font-semibold text-text">Needs attention</h2>
        {!!review.accountIssues?.length && (
          <p role="alert" className="text-sm text-caution">
            Account balances need reconciliation.{' '}
            <Link to="/budget" className="underline">
              Review the balance discrepancies
            </Link>{' '}
            before assigning more money.
          </p>
        )}
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-x-6">
          <Row label="Uncategorised spending" value={formatCurrency(review.totals.uncategorised)} />
          <Row label="Overspent" value={formatCurrency(review.totals.deficits)} />
          <Row label="Targets underfunded" value={formatCurrency(review.totals.targetShortfalls)} />
          <Row
            label="Assigned to later months"
            value={formatCurrency(review.totals.futureCommitments)}
          />
          <Row
            label="Unassigned"
            value={
              review.accountIssues?.length
                ? 'Check account balances'
                : review.complete
                  ? formatCurrency(review.unassigned)
                  : 'Unknown'
            }
            tone={review.unassigned < 0 ? 'neg' : undefined}
          />
          {(review.totals.cardShortfall > 0 || review.totals.uncoveredCardPayments > 0) && (
            <Row
              label="Card debt without a payment reserve"
              value={formatCurrency(
                review.totals.cardShortfall + review.totals.uncoveredCardPayments,
              )}
              tone="neg"
            />
          )}
        </div>
        {!review.complete && (
          <p className="text-sm text-negative">
            Some exchange rates are missing, so this review is incomplete.{' '}
            <Link to="/settings?tab=currencies" className="font-medium">
              Add rates
            </Link>
          </p>
        )}
        {nothing && review.complete && (
          <p className="text-sm text-positive">Nothing needs attention. Your budget is resolved.</p>
        )}
        {review.uncategorisedCount > 0 && <Uncategorised review={review} categories={expense} />}
        {deficits.length > 0 && (
          <Section title="Overspent categories">
            <ul className="space-y-1 text-sm">
              {deficits.map((d) => (
                <li key={d.categoryId} className="flex justify-between gap-2">
                  <Link to={`/budget/category/${d.categoryId}`} className="text-text">
                    {d.name} <span className="text-xs text-text-tertiary">{d.groupName}</span>
                  </Link>
                  <span className="tabular-nums text-negative">{formatCurrency(-d.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-secondary">
              Cover overspending by moving money from a category that has some.
            </p>
            <MoneyMoves month={review.month} categories={expense} />
          </Section>
        )}
        {shortfalls.length > 0 && (
          <Section title="Targets underfunded this month">
            <ul className="space-y-1 text-sm">
              {shortfalls.map((t) => (
                <li key={t.categoryId} className="flex justify-between gap-2">
                  <Link to={`/budget/category/${t.categoryId}`} className="text-text">
                    {t.name} <span className="text-xs text-text-tertiary">{t.groupName}</span>
                  </Link>
                  <span className="tabular-nums">
                    {formatCurrency(t.amount)} needed
                    {t.dueDate ? ` · due ${formatDay(t.dueDate)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <FundTargets month={review.month} groups={groups} />
          </Section>
        )}
        {review.cards.length > 0 && (
          <Section title="Card payments">
            <ul className="space-y-1 text-sm">
              {review.cards.map((c) => (
                <li key={c.accountId} className="flex justify-between gap-2">
                  <span className="text-text">{c.name}</span>
                  <span className="tabular-nums text-negative">
                    {formatCurrency(c.shortfall + c.uncoveredPayments)} without a reserve
                  </span>
                </li>
              ))}
            </ul>
            <ButtonLink size="sm" variant="secondary" to="/budget">
              Fund card payments on the budget
            </ButtonLink>
          </Section>
        )}
        {commitments.length > 0 && (
          <Section title="Already assigned to later months">
            <ul className="space-y-1 text-sm">
              {commitments.map((c) => (
                <li key={c.month}>
                  <div className="flex justify-between gap-2 font-medium text-text">
                    <span>{monthLabel(c.month)}</span>
                    <span className="tabular-nums">
                      {formatCurrency(c.categories.reduce((s, x) => s + x.amount, 0))}
                    </span>
                  </div>
                  <div className="text-xs text-text-tertiary">
                    {c.categories.map((x) => `${x.name} ${formatCurrency(x.amount)}`).join(' · ')}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-secondary">
              This money is reserved now, so it is not offered again for this month.
            </p>
          </Section>
        )}
      </div>
    </Card>
  );
}

function Buffer({ buffer }: { buffer: api.BufferState }) {
  const r = buffer.runway;
  const u = buffer.unresolved;
  const unresolved =
    u.overspent + u.uncategorised + u.cardShortfall + u.uncoveredCardPayments + u.overAssigned;
  const hideBalances = useHideBalances();
  return (
    <Card>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-text">Next month and buffer</h2>
        <Section title={monthLabel(buffer.nextMonth)}>
          <Row label="Already assigned" value={formatCurrency(buffer.nextAssigned)} tone="pos" />
          <Row label="Assigned to months after that" value={formatCurrency(buffer.laterAssigned)} />
          <Row
            label="Targets still need"
            value={formatCurrency(buffer.nextUnderfunded)}
            tone={buffer.nextUnderfunded > 0 ? 'neg' : undefined}
          />
          <Row
            label="Unresolved this month"
            value={formatCurrency(unresolved)}
            tone={unresolved > 0 ? 'neg' : undefined}
          />
          {buffer.nextNeeds.length > 0 && (
            <ul className="text-xs text-text-secondary space-y-0.5">
              {buffer.nextNeeds.map((n) => (
                <li key={n.categoryId} className="flex justify-between gap-2 tabular-nums">
                  <span>{n.name}</span>
                  <span>
                    {formatCurrency(n.assigned)} of {formatCurrency(n.required)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-text-tertiary">
            Next month's targets assume nothing more is spent or assigned this month.
          </p>
        </Section>
        {/* What your cash after debts would cover: balances, so Safe mode hides it */}
        {!hideBalances && (
          <Section title="Cash runway (optional)">
            {r.unrestricted !== null && (
              <>
                <Row label="Cash after debts" value={formatCurrency(r.resources ?? 0)} />
                <Row
                  label="Restricted: bill reserves and card payments"
                  value={formatCurrency(-r.restricted)}
                />
                {r.cardDebtWithoutReserve > 0 && (
                  <Row
                    label="Card debt without a reserve"
                    value={formatCurrency(-r.cardDebtWithoutReserve)}
                    tone="neg"
                  />
                )}
                <Row label="Unrestricted" value={formatCurrency(r.unrestricted)} tone="pos" />
                <Row label="Average monthly spending" value={formatCurrency(r.monthlySpending)} />
              </>
            )}
            {r.days !== null ? (
              <p className="text-sm text-text">
                Unrestricted money would cover about{' '}
                <strong>{(r.days / (365 / 12)).toFixed(1)} months</strong> ({r.days} days) of
                everyday spending.
              </p>
            ) : (
              <div role="status" className="text-sm text-caution space-y-1">
                <p className="font-medium">Runway incomplete</p>
                <ul className="list-disc pl-5">
                  {r.incomplete.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <details className="text-xs text-text-secondary">
              <summary className="cursor-pointer select-none">Assumptions</summary>
              <ul className="list-disc pl-5 pt-1 space-y-0.5">
                {r.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
                <li>
                  Spending history: {formatDay(r.spending.from)} to {formatDay(r.spending.to)} (
                  {r.spending.days} days, {formatCurrency(r.spending.total)}).
                </li>
              </ul>
            </details>
          </Section>
        )}
      </div>
    </Card>
  );
}

export default function ReviewPage() {
  const [group, setGroup] = useState('');
  const review = useQuery({ queryKey: ['review'], queryFn: api.getReview });
  const buffer = useQuery({ queryKey: ['review', 'buffer'], queryFn: api.getBuffer });
  const guide = useQuery({ queryKey: ['review', 'guide'], queryFn: api.getGuide });
  const resilience = useQuery({ queryKey: ['review', 'resilience'], queryFn: api.getResilience });
  const resume = useQuery({ queryKey: ['review', 'resume'], queryFn: api.getResume });
  const hideBalances = useHideBalances();
  const error = review.error ?? buffer.error ?? guide.error ?? resilience.error ?? resume.error;
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 max-md:px-4 py-4 border-b border-border shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div data-guide="review.header">
          <h1 className="font-display text-[28px] max-md:text-2xl leading-tight tracking-tight text-text">
            Review
          </h1>
          <p className="text-xs text-text-tertiary">
            {review.data ? `As of ${formatDay(review.data.asOf)}` : 'Loading…'} · Read-only; changes
            happen only when you act.
          </p>
        </div>
        {review.data && review.data.groups.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            Category group
            <span className="w-48">
              <Select value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">All groups</option>
                {review.data.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </span>
          </label>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6 max-md:p-4">
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error instanceof Error ? error.message : 'Could not load the review.'}
          </p>
        )}
        {resume.data && (
          <div className="mb-4">
            <ReminderBanner resume={resume.data} />
          </div>
        )}
        {/* Afterpay-style payments waiting to be linked to their purchase */}
        <div className="mb-4 empty:hidden">
          <PaymentMatches compact />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-lg:grid-cols-1 gap-4 items-start">
          <div className="space-y-4">
            {resume.data && <ResumeCard resume={resume.data} />}
            {review.data && <NeedsAttention review={review.data} group={group} />}
            {/* Emergency fund and what you could live on: savings, so Safe mode hides them */}
            {resilience.data && !hideBalances && <ResilienceCard data={resilience.data} />}
            {buffer.data && <Buffer buffer={buffer.data} />}
          </div>
          <div className="space-y-4">
            {guide.data && (
              <Card>
                <h2 className="text-base font-semibold text-text">Guided setup</h2>
                <p className="text-xs text-text-secondary">
                  Each step is checked against your budget as it is now.
                </p>
                <ol className="mt-2">
                  {guide.data.steps.map((s) => (
                    <GuideStep key={s.id} step={s} guide={guide.data} />
                  ))}
                </ol>
              </Card>
            )}
            {resilience.data && <ExtraIncome resilience={resilience.data} />}
            <Housekeeping />
          </div>
        </div>
      </div>
    </div>
  );
}
