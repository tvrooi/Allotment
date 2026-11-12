import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronRight, Store, Wand2 } from 'lucide-react';
import { barY, defineChart } from '@tanstack/charts';
import { usePayees, useUpdatePayee } from '../hooks/usePayees';
import { useRules } from '../hooks/useRules';
import { useTransactions, useTransactionSummary } from '../hooks/useTransactions';
import { useScrollMemory } from '../hooks/useScrollMemory';
import { useFilterSearch } from '../hooks/useFilterSearch';
import { useCanSave } from '../hooks/useConnection';
import { useRuleLookups } from '../components/rules/useRuleLookups';
import { PayeeIcon } from '../components/payees/PayeeIcon';
import { DefaultCategoryButton } from '../components/payees/DefaultCategoryButton';
import { TransactionTable } from '../components/transactions/TransactionTable';
import { FillChart } from '../components/charts/FillChart';
import {
  bandScale,
  currencyTooltip,
  INCOME_EXPENSE_COLORS,
  valueScale,
} from '../components/charts/kit';
import { EmptyState } from '../components/ui/EmptyState';
import { QueryProblem, loadFailed } from '../components/ui/QueryProblem';
import { ButtonLink } from '../components/ui/Button';
import { PAGE_GUTTER } from '../components/ui/pageGutter';
import { formatCurrency } from '../utils/currency';
import { formatDay } from '../utils/dates';
import { todayIso } from '../utils/calendarDay';
import { spendByMonth } from '../utils/payeeSpend';
import { actionText, conditionText, ruleMentionsPayee } from '../utils/ruleFormat';

const card = 'bg-surface rounded-lg shadow-card border border-border-light p-4';

/** Stands in for figures still loading: never a zero that could be read as a result */
const Loading = ({ className = 'h-5 w-24' }: { className?: string }) => (
  <span aria-hidden className={`block rounded bg-surface-alt animate-pulse ${className}`} />
);

/** Money out by month over the last year, drawn like a category's spending history */
function SpendChart({ payeeId }: { payeeId: string }) {
  const query = useTransactions({ payeeIds: [payeeId] });
  const months = useMemo(
    () => (query.data ? spendByMonth(query.data, todayIso()) : []),
    [query.data],
  );
  const rows = months.map((m) => ({
    label: format(parseISO(`${m.month}-01`), 'MMM'),
    amount: m.amount,
  }));
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          barY(rows, {
            x: 'label',
            y: 'amount',
            fill: INCOME_EXPENSE_COLORS.Expenses,
            radius: [3, 3, 0, 0],
            maxThickness: 36,
            inset: 1,
          }),
        ],
        scales: { x: bandScale(), y: valueScale() },
        margin: { top: 16 },
        focus: 'nearest-x',
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip: currencyTooltip({}),
      }),
    [rows],
  );
  return (
    <section aria-label="Spending by month" className={card}>
      <h2 className="text-sm font-semibold text-text mb-3">Spending by month</h2>
      {/* A failed or unfinished read is not "no spending" */}
      <QueryProblem what="spending" query={query} className="py-6" />
      {loadFailed(query) ? null : query.data === undefined ? (
        <Loading className="h-[200px] w-full" />
      ) : months.some((m) => m.amount > 0) ? (
        <FillChart definition={definition} height={200} ariaLabel="Spending by month" />
      ) : (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-text-tertiary">No spending in the last 12 months</p>
        </div>
      )}
    </section>
  );
}

export default function PayeeDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const payeesQuery = usePayees();
  const payee = payeesQuery.data?.find((p) => p.id === id);
  const summaryQuery = useTransactionSummary({ payeeIds: [id] }, !!payee);
  const summary = summaryQuery.data;
  const rulesQuery = useRules();
  const { lookups } = useRuleLookups();
  const updatePayee = useUpdatePayee();
  const canSave = useCanSave();
  // Back and Forward return to where the page was, with the list's filters (#245)
  const scrollMemory = useScrollMemory('payee');
  const filters = useFilterSearch();

  const payeeRules = useMemo(
    () =>
      payee && rulesQuery.data ? rulesQuery.data.filter((r) => ruleMentionsPayee(r, payee)) : [],
    [rulesQuery.data, payee],
  );

  if (!payee) {
    if (payeesQuery.isLoading) return null;
    // Unavailable is not "not found"
    if (loadFailed(payeesQuery)) return <QueryProblem what="payees" query={payeesQuery} />;
    return (
      <EmptyState
        icon={<Store size={26} />}
        title="Payee not found"
        description="It may have been merged or deleted, or the link is out of date."
        actions={<ButtonLink to="/payees">Go to payees</ButtonLink>}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className={`${PAGE_GUTTER} py-3 border-b border-border bg-surface shrink-0`}>
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary mb-1">
          <Link to="/payees" className="hover:text-brand-600 transition-colors">
            Payees
          </Link>
          <ChevronRight size={11} />
          <span className="text-text-secondary truncate">{payee.name}</span>
        </div>
        <div className="flex items-center gap-2.5 min-w-0">
          <PayeeIcon
            name={payee.name}
            logo={payee.logo}
            size="md"
            force
            onLogoChange={
              canSave ? (logo) => updatePayee.mutate({ id: payee.id, logo }) : undefined
            }
          />
          <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text truncate">
            {payee.name}
          </h1>
        </div>
      </div>

      <div ref={scrollMemory} className={`flex-1 overflow-y-auto ${PAGE_GUTTER} py-6`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
          <div className="lg:col-span-2">
            <SpendChart payeeId={payee.id} />
          </div>
          <div className="space-y-4">
            <section aria-label="Summary" className={card}>
              <h2 className="text-sm font-semibold text-text">Total spent</h2>
              <QueryProblem what="totals" query={summaryQuery} className="py-6" />
              {loadFailed(summaryQuery) ? null : !summary ? (
                <Loading className="mt-2 h-7 w-32" />
              ) : (
                <>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-text">
                    {formatCurrency(summary.moneyOut)}
                  </p>
                  <dl className="mt-3 border-t border-border-light pt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-secondary">Money in</dt>
                      <dd className="tabular-nums text-text">{formatCurrency(summary.moneyIn)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-secondary">Transactions</dt>
                      <dd className="tabular-nums text-text">{summary.count}</dd>
                    </div>
                    {summary.firstDate && summary.lastDate && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-text-secondary">Dates</dt>
                        <dd className="text-text text-right">
                          {formatDay(summary.firstDate)} to {formatDay(summary.lastDate)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </>
              )}
            </section>
            <section aria-label="Default category" className={card}>
              <h2 className="text-sm font-semibold text-text">Default category</h2>
              <p className="text-xs text-text-tertiary mt-0.5 mb-2">
                New transactions from {payee.name} start in it.
              </p>
              <DefaultCategoryButton payee={payee} className="w-full" />
            </section>
            <section aria-label="Rules" className={card}>
              <h2 className="text-sm font-semibold text-text">Rules</h2>
              <QueryProblem what="rules" query={rulesQuery} className="py-6" />
              {loadFailed(rulesQuery) ? null : !rulesQuery.data ? (
                <Loading className="mt-2 h-4 w-40" />
              ) : payeeRules.length === 0 ? (
                <p className="mt-1 text-sm text-text-tertiary">No rules mention {payee.name}.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {payeeRules.map((r) => (
                    <li key={r.id}>
                      <Link
                        to="/rules"
                        className="flex gap-2 text-sm text-text hover:text-brand-600 max-md:min-h-11"
                      >
                        <Wand2 size={14} className="mt-0.5 shrink-0 text-text-tertiary" />
                        <span>
                          {r.conditions.map((c) => conditionText(c, lookups)).join(', ')}:{' '}
                          {r.actions.map((a) => actionText(a, lookups)).join(', ')}
                          {!r.enabled && <span className="text-text-tertiary"> (off)</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <section
            aria-label={`${payee.name} transactions`}
            className="lg:col-span-3 bg-surface rounded-lg shadow-card border border-border-light overflow-hidden"
          >
            <TransactionTable
              key={filters.generation}
              payeeIds={[payee.id]}
              initialFilters={filters.initialFilters}
              onFiltersChange={filters.onFiltersChange}
              overlayDetail
            />
          </section>
        </div>
      </div>
    </div>
  );
}
