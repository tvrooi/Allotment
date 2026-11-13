import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAnnualOverview, type AnnualOverview } from '../api/budget';
import { useAppStore } from '../store/appStore';
import { formatCurrency } from '../utils/currency';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Input';
import { StatCard } from '../components/ui/StatCard';
import { PAGE_GUTTER } from '../components/ui/pageGutter';

// The annual budget overview (phase 8): each month's assignments and activity from the
// monthly budget, summed across the year. Balances are shown once, at the latest month that
// has started, never added up. Later months are plans and add nothing to money today.

const monthLabel = (m: string) => format(parseISO(`${m}-01`), 'MMM');
const signed = (cents: number) => (cents === 0 ? '–' : formatCurrency(cents));
// Columns that stay put while the months scroll sideways. On a phone the Category column has
// a set width, so the Assigned/Activity labels beside it can stay too (left-28 = its width).
const CATEGORY_COL = 'sticky left-0 max-md:w-28 max-md:min-w-28 max-md:max-w-28 break-words';
const MEASURE_COL = 'max-md:sticky max-md:left-28';

/**
 * How far from the scroller's left edge the columns that stay put reach. Read from their boxes:
 * a stuck cell's offsetLeft moves with the scroll position.
 */
function stickyEdge(scroller: HTMLElement) {
  const start = scroller.getBoundingClientRect().left + scroller.clientLeft;
  return Array.from(scroller.querySelectorAll<HTMLElement>('thead th'))
    .filter((th) => getComputedStyle(th).position === 'sticky')
    .reduce((edge, th) => Math.max(edge, th.getBoundingClientRect().right - start), 0);
}

function MonthHeader({
  months,
  current,
  onOpen,
}: {
  months: AnnualOverview['months'];
  /** This month (YYYY-MM), marked as today's */
  current: string;
  onOpen: (month: string) => void;
}) {
  return (
    <>
      {months.map((m) => (
        <th
          key={m.month}
          scope="col"
          data-month={m.month}
          className="px-2 py-2 text-right font-medium"
        >
          <button
            type="button"
            onClick={() => onOpen(m.month)}
            aria-current={m.month === current ? 'date' : undefined}
            title={`Open ${format(parseISO(`${m.month}-01`), 'MMMM yyyy')} in the budget`}
            className={`hover:text-brand-600 max-md:min-h-11 max-md:min-w-11 ${m.planned ? 'italic text-text-tertiary' : ''} ${m.month === current ? 'font-semibold text-text' : ''}`}
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
  const selectedMonth = useAppStore((s) => s.selectedMonth);
  const setSelectedMonth = useAppStore((s) => s.setSelectedMonth);
  const { data, isLoading, error } = useQuery({
    queryKey: ['budget', 'year', year],
    queryFn: () => getAnnualOverview(year),
  });
  const openMonth = (month: string) => {
    setSelectedMonth(month);
    navigate('/budget');
  };
  const current = format(new Date(), 'yyyy-MM');

  // On a phone the table is wider than the screen (UX audit AU-011). It opens at the month
  // chosen in the monthly budget, else this month, rather than January; "Jump to month"
  // moves along it and follows the scrolling; an edge cue says more months are to the right.
  const scroller = useRef<HTMLDivElement>(null);
  const [shownMonth, setShownMonth] = useState('');
  // The month last jumped to: it stays chosen while fully in view (December can't scroll to
  // the first column)
  const jumped = useRef('');
  const [moreRight, setMoreRight] = useState(false);
  const anchor = selectedMonth.startsWith(`${year}-`)
    ? selectedMonth
    : current.startsWith(`${year}-`)
      ? current
      : `${year}-01`;
  const scrollToMonth = useCallback((month: string) => {
    const el = scroller.current;
    const cell = el?.querySelector<HTMLElement>(`th[data-month="${month}"]`);
    if (!el || !cell) return;
    // The first column clear of the ones that stay put, as "Jump to month" reads it
    el.scrollLeft = Math.max(0, cell.offsetLeft - stickyEdge(el));
    jumped.current = month;
    setShownMonth(month);
  }, []);
  const loaded = !!data;
  // Read only when a year's table first appears: later scrolling is the person's
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  useLayoutEffect(() => {
    if (loaded) scrollToMonth(anchorRef.current);
  }, [loaded, year, scrollToMonth]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
      // The first month whose column starts clear of the columns that stay put
      const sticky = stickyEdge(el);
      const columns = Array.from(el.querySelectorAll<HTMLElement>('th[data-month]'));
      const inView = (th: HTMLElement) =>
        th.offsetLeft >= el.scrollLeft + sticky - 1 &&
        th.offsetLeft + th.offsetWidth <= el.scrollLeft + el.clientWidth + 1;
      const chosen = columns.find((th) => th.dataset.month === jumped.current);
      if (chosen && inView(chosen)) return;
      jumped.current = '';
      const first = columns.find(
        (th) => th.offsetLeft + th.offsetWidth / 2 >= el.scrollLeft + sticky,
      );
      if (first?.dataset.month) setShownMonth(first.dataset.month);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [loaded, year]);

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className={`py-4 border-b border-border shrink-0 ${PAGE_GUTTER}`}>
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
            {year} budget
          </h1>
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

            <label className="md:hidden mt-6 flex items-center gap-2 text-xs font-medium text-text-secondary">
              Jump to month
              <Select
                value={shownMonth}
                onChange={(e) => scrollToMonth(e.target.value)}
                className="flex-1"
              >
                {data.months.map((m) => (
                  <option key={m.month} value={m.month}>
                    {format(parseISO(`${m.month}-01`), 'MMMM')}
                    {m.month === current ? ' (this month)' : ''}
                  </option>
                ))}
              </Select>
            </label>
            <div className="relative mt-6 max-md:mt-3">
              <div
                ref={scroller}
                data-testid="annual-table-scroller"
                className="overflow-x-auto rounded-lg border border-border-light"
              >
                <table className="w-full text-xs tabular-nums">
                  <thead className="bg-surface-alt text-text-secondary">
                    <tr>
                      <th
                        scope="col"
                        className={`px-3 py-2 text-left font-medium bg-surface-alt ${CATEGORY_COL}`}
                      >
                        Category
                      </th>
                      <th
                        scope="col"
                        className={`px-3 py-2 text-left font-medium bg-surface-alt ${MEASURE_COL}`}
                      >
                        <span className="sr-only">Measure</span>
                      </th>
                      <MonthHeader months={data.months} current={current} onOpen={openMonth} />
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
                              className="p-0 text-left font-semibold text-text"
                            >
                              {/* The cell spans the row, wider than a phone: its text stays put */}
                              <span className="sticky left-0 inline-block px-3 py-1.5">
                                {g.name}
                              </span>
                            </th>
                          </tr>
                          {g.categories.map((c) => (
                            <Fragment key={c.id}>
                              <tr className="border-t border-border-light">
                                <th
                                  scope="row"
                                  rowSpan={2}
                                  className={`px-3 py-1.5 text-left font-normal text-text bg-surface ${CATEGORY_COL}`}
                                >
                                  <Link
                                    to={`/budget/category/${c.id}`}
                                    className="hover:text-brand-600"
                                  >
                                    {c.name}
                                  </Link>
                                </th>
                                <td
                                  className={`px-3 py-1 text-text-tertiary bg-surface ${MEASURE_COL}`}
                                >
                                  Assigned
                                </td>
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
                                <td
                                  className={`px-3 py-1 text-text-tertiary bg-surface ${MEASURE_COL}`}
                                >
                                  Activity
                                </td>
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
                        className={`px-3 py-1.5 text-left bg-surface ${CATEGORY_COL}`}
                      >
                        Total
                      </th>
                      <td className={`px-3 py-1 text-text-tertiary bg-surface ${MEASURE_COL}`}>
                        Assigned
                      </td>
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
                      <td className={`px-3 py-1 text-text-tertiary bg-surface ${MEASURE_COL}`}>
                        Spending
                      </td>
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
                      <td className={`px-3 py-1 text-text-tertiary bg-surface ${MEASURE_COL}`}>
                        Income
                      </td>
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
              {moreRight && (
                <span
                  aria-hidden
                  data-testid="annual-more-right"
                  className="pointer-events-none absolute inset-y-0 right-0 w-8 flex items-center justify-end text-text-tertiary bg-gradient-to-l from-surface to-transparent rounded-r-lg"
                >
                  <ChevronRight size={16} />
                </span>
              )}
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
