import { Fragment } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAnnualOverview, type AnnualOverview } from '../api/budget';
import { useAppStore } from '../store/appStore';
import { formatCurrency } from '../utils/currency';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';

// The annual budget overview (phase 8): each month's assignments and activity from the
// monthly budget, summed across the year. Balances are shown once, at the latest month that
// has started, never added up. Later months are plans and add nothing to money today.

const monthLabel = (m: string) => format(parseISO(`${m}-01`), 'MMM');
const signed = (cents: number) => (cents === 0 ? '–' : formatCurrency(cents));

function MonthHeader({
  months,
  onOpen,
}: {
  months: AnnualOverview['months'];
  onOpen: (month: string) => void;
}) {
  return (
    <>
      {months.map((m) => (
        <th key={m.month} scope="col" className="px-2 py-2 text-right font-medium">
          <button
            type="button"
            onClick={() => onOpen(m.month)}
            title={`Open ${format(parseISO(`${m.month}-01`), 'MMMM yyyy')} in the budget`}
            className={`hover:text-brand-600 ${m.planned ? 'italic text-text-tertiary' : ''}`}
          >
            {monthLabel(m.month)}
          </button>
        </th>
      ))}
    </>
  );
}

export default function AnnualBudget() {
  const params = useParams();
  const thisYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(params.year ?? '') ? Number(params.year) : thisYear;
  const navigate = useNavigate();
  const setSelectedMonth = useAppStore((s) => s.setSelectedMonth);
  const { data, isLoading, error } = useQuery({
    queryKey: ['budget', 'year', year],
    queryFn: () => getAnnualOverview(year),
  });
  const openMonth = (month: string) => {
    setSelectedMonth(month);
    navigate('/budget');
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h1 className="text-lg font-semibold text-text">{year} budget</h1>
          <div className="flex items-center gap-2">
            <Link to="/budget" className="text-xs text-brand-600 hover:text-brand-700 mr-2">
              Monthly budget
            </Link>
            <button
              onClick={() => navigate(`/budget/year/${year - 1}`)}
              aria-label="Previous year"
              className="p-1.5 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md hover:bg-surface-alt text-text-tertiary hover:text-text-secondary"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => navigate(`/budget/year/${year + 1}`)}
              aria-label="Next year"
              className="p-1.5 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md hover:bg-surface-alt text-text-tertiary hover:text-text-secondary"
            >
              <ChevronRight size={18} />
            </button>
            {year !== thisYear && (
              <Button variant="secondary" size="sm" onClick={() => navigate('/budget/year')}>
                This year
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 max-md:px-4">
        {error && (
          <p role="alert" className="text-negative text-sm">
            {(error as Error).message}
          </p>
        )}
        {isLoading || !data ? (
          <div className="h-60 bg-surface-alt rounded-lg animate-pulse" />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label={`Income received ${year}`}
                value={formatCurrency(data.totals.income)}
                valueColor="text-positive"
              />
              <StatCard
                label="Assigned to months so far"
                value={formatCurrency(data.totals.assigned - data.totals.plannedAssigned)}
              />
              <StatCard
                label="Planned for later months"
                value={formatCurrency(data.totals.plannedAssigned)}
              />
              <StatCard
                label="Available to assign today"
                value={data.today.complete ? formatCurrency(data.today.available) : '—'}
              />
            </div>
            <p className="text-xs text-text-tertiary mt-2">
              Planned assignments and expected pay never add to money available today. Balances are{' '}
              {data.balanceMonth
                ? `shown at the end of ${format(parseISO(`${data.balanceMonth}-01`), 'MMMM')}`
                : 'shown once the year starts'}
              , not added up across months.
            </p>

            {data.today.cards.length > 0 && (
              <section className="mt-5" aria-labelledby="annual-cards-heading">
                <h2 id="annual-cards-heading" className="text-sm font-semibold text-text mb-2">
                  Credit card debt today
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.today.cards.map((c) => (
                    <li
                      key={c.accountId}
                      className="rounded-md border border-border-light p-3 text-sm flex justify-between gap-3"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="tabular-nums text-right text-xs text-text-secondary">
                        Debt {formatCurrency(c.debt)} · reserved {formatCurrency(c.reserve)}
                        {c.shortfall > 0 && (
                          <span className="block text-negative">
                            Unfunded {formatCurrency(c.shortfall)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-6 overflow-x-auto rounded-lg border border-border-light">
              <table className="w-full text-xs tabular-nums">
                <thead className="bg-surface-alt text-text-secondary">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left font-medium sticky left-0 bg-surface-alt"
                    >
                      Category
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium" />
                    <MonthHeader months={data.months} onOpen={openMonth} />
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Year
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Available
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.groups
                    .filter((g) => !g.isIncome)
                    .map((g) => (
                      <Fragment key={g.id}>
                        <tr className="bg-surface-alt/50">
                          <th
                            colSpan={16}
                            scope="rowgroup"
                            className="px-3 py-1.5 text-left font-semibold text-text sticky left-0"
                          >
                            {g.name}
                          </th>
                        </tr>
                        {g.categories.map((c) => (
                          <Fragment key={c.id}>
                            <tr className="border-t border-border-light">
                              <th
                                scope="row"
                                rowSpan={2}
                                className="px-3 py-1.5 text-left font-normal text-text sticky left-0 bg-surface"
                              >
                                <Link
                                  to={`/budget/category/${c.id}`}
                                  className="hover:text-brand-600"
                                >
                                  {c.name}
                                </Link>
                              </th>
                              <td className="px-3 py-1 text-text-tertiary">Assigned</td>
                              {c.months.map((m) => (
                                <td
                                  key={m.month}
                                  className={`px-2 py-1 text-right ${m.planned ? 'italic text-text-tertiary' : ''}`}
                                >
                                  {signed(m.assigned)}
                                </td>
                              ))}
                              <td className="px-3 py-1 text-right font-medium">
                                {signed(c.assigned)}
                              </td>
                              <td
                                rowSpan={2}
                                className={`px-3 py-1 text-right font-medium ${c.available !== null && c.available < 0 ? 'text-negative' : ''}`}
                              >
                                {c.available === null ? '—' : formatCurrency(c.available)}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-1 text-text-tertiary">Activity</td>
                              {c.months.map((m) => (
                                <td
                                  key={m.month}
                                  className="px-2 py-1 text-right text-text-secondary"
                                >
                                  {m.planned ? '' : signed(m.activity)}
                                </td>
                              ))}
                              <td className="px-3 py-1 text-right text-text-secondary">
                                {signed(c.activity)}
                              </td>
                            </tr>
                          </Fragment>
                        ))}
                      </Fragment>
                    ))}
                </tbody>
                <tfoot className="border-t-2 border-border">
                  <tr>
                    <th
                      scope="row"
                      rowSpan={3}
                      className="px-3 py-1.5 text-left sticky left-0 bg-surface"
                    >
                      Total
                    </th>
                    <td className="px-3 py-1 text-text-tertiary">Assigned</td>
                    {data.months.map((m) => (
                      <td
                        key={m.month}
                        className={`px-2 py-1 text-right font-medium ${m.planned ? 'italic text-text-tertiary' : ''}`}
                      >
                        {signed(m.assigned)}
                      </td>
                    ))}
                    <td className="px-3 py-1 text-right font-semibold">
                      {signed(data.totals.assigned)}
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td className="px-3 py-1 text-text-tertiary">Spending</td>
                    {data.months.map((m) => (
                      <td key={m.month} className="px-2 py-1 text-right">
                        {m.planned ? '' : signed(m.activity)}
                      </td>
                    ))}
                    <td className="px-3 py-1 text-right font-semibold">
                      {signed(data.totals.activity)}
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td className="px-3 py-1 text-text-tertiary">Income</td>
                    {data.months.map((m) => (
                      <td key={m.month} className="px-2 py-1 text-right text-positive">
                        {m.planned ? '' : signed(m.income)}
                      </td>
                    ))}
                    <td className="px-3 py-1 text-right font-semibold text-positive">
                      {signed(data.totals.income)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-text-tertiary mt-2">
              <span className="italic">Italic</span> months haven't started: their assignments are
              plans. Select a month to open it in the monthly budget.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
