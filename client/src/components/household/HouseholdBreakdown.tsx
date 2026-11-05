import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getHouseholdStatement } from '../../api/households';
import { formatCentsAxis, formatMoney } from '../../utils/currency';
import { chartColors } from '../../utils/chartColors';
import { CurrencyTooltip, monthLabel } from '../reports/ChartHelpers';

interface Props {
  groupId: string;
  currency: string;
  /** The report's date range; either end can be empty */
  from: string;
  to: string;
  /** What the month chart shows: your share, or the household's gross spending */
  scope: string;
}

const th = 'py-2 pr-3 font-medium';
const td = 'py-2 pr-3 tabular-nums';

/**
 * Household → Breakdown (SPL-05): the report's spending by month, by person (paid against share)
 * and by category, for the same date range. The numbers come from the statement, so they are
 * the ones the statement route and the assistant's `household_statement` return.
 */
export function HouseholdBreakdown({ groupId, currency, from, to, scope }: Props) {
  const [open, setOpen] = useState(false);
  const money = (n: number) => formatMoney(n, currency);
  const { data, error } = useQuery({
    queryKey: ['households', groupId, 'statement', from, to],
    queryFn: () => getHouseholdStatement(groupId, from, to),
    enabled: open && (!from || !to || from <= to),
  });
  const key = scope === 'household' ? 'household' : 'myShare';
  return (
    <section className="bg-surface rounded-lg shadow-card border border-border-light p-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 text-sm font-semibold text-text"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Spending by month, person and category
      </button>
      {open && error && (
        <p role="alert" className="mt-3 text-sm text-negative">
          {error.message}
        </p>
      )}
      {open && data && data.byMonth.length === 0 && (
        <p className="mt-3 text-sm text-text-tertiary">No shared expenses in this period.</p>
      )}
      {open && data && data.byMonth.length > 0 && (
        <div className="mt-3 grid gap-5">
          <div>
            <h3 className="text-xs font-semibold text-text-secondary">By month</h3>
            {data.byMonth.length > 1 && (
              <div
                role="img"
                aria-label={`Chart of ${scope === 'household' ? 'household spending' : 'your share'} by month; the table below has the same figures`}
                className="h-40 mt-1"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartColors.grid}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tickFormatter={monthLabel}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(n: number) => formatCentsAxis(n)}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      content={
                        <CurrencyTooltip labelFormatter={(m: string) => monthLabel(m)} hideZero />
                      }
                    />
                    <Bar
                      dataKey={key}
                      name={scope === 'household' ? 'Household' : 'My share'}
                      fill={chartColors.brand}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-text-tertiary">
                  <tr>
                    <th className={th}>Month</th>
                    <th className={`${th} text-right`}>Household</th>
                    <th className={`${th} text-right`}>My share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byMonth.map((m) => (
                    <tr key={m.month} className="border-t border-border-light">
                      <td className="py-2 pr-3 text-text-secondary">{monthLabel(m.month)}</td>
                      <td className={`${td} text-right`}>{money(m.household)}</td>
                      <td className={`${td} text-right`}>{money(m.myShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-text-secondary">By person</h3>
            <p className="text-xs text-text-tertiary">
              What each person paid for shared expenses, what their share of them came to, and the
              difference. Repayments are not included.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-text-tertiary">
                  <tr>
                    <th className={th}>Person</th>
                    <th className={`${th} text-right`}>Paid</th>
                    <th className={`${th} text-right`}>Share</th>
                    <th className={`${th} text-right`}>Paid less share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byPerson.map((p) => (
                    <tr key={p.personId ?? 'household'} className="border-t border-border-light">
                      <td className="py-2 pr-3 text-text">{p.name}</td>
                      <td className={`${td} text-right`}>{money(p.paid)}</td>
                      <td className={`${td} text-right`}>{money(p.share)}</td>
                      <td className={`${td} text-right`}>{money(p.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-text-secondary">By category</h3>
            <p className="text-xs text-text-tertiary">
              From the category of the bank payment an entry is linked to. Entries with no payment,
              or a payment with no category, are under Uncategorised.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-text-tertiary">
                  <tr>
                    <th className={th}>Category</th>
                    <th className={`${th} text-right`}>Household</th>
                    <th className={`${th} text-right`}>My share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory.map((c) => (
                    <tr key={c.categoryId ?? 'none'} className="border-t border-border-light">
                      <td className="py-2 pr-3 text-text">{c.name}</td>
                      <td className={`${td} text-right`}>{money(c.household)}</td>
                      <td className={`${td} text-right`}>{money(c.myShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
