import { Check } from 'lucide-react';
import type { YearResult } from '../../api/longTerm';
import { formatCurrency } from '../../utils/currency';
import { bridge, mulDiv, PPB, type Dollars, type BridgeRow } from '../../utils/longTerm';

const GROUP_LABEL: Record<BridgeRow['group'], string> = {
  income: 'Money in',
  events: 'Life events',
  spending: 'Spending',
  loans: 'Loans',
  assets: 'Assets opened',
  super: 'Super',
  growth: 'Growth',
  inflation: 'Inflation',
};

const signed = (cents: number) =>
  `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${formatCurrency(Math.abs(cents))}`;

function Moves({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { id: string; name: string; amount: number }[];
  empty?: string;
}) {
  if (!rows.length && !empty) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-text-secondary mb-1">{title}</h4>
      {rows.length ? (
        <ul className="text-sm space-y-0.5">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-3">
              <span>{r.name}</span>
              <span className="tabular-nums">{formatCurrency(r.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-tertiary">{empty}</p>
      )}
    </div>
  );
}

/**
 * What made up one year's change in net worth: every part, with the parts adding up to the
 * cent. Money moved between accounts (withdrawals, savings) changes the mix, not the total, so
 * it is listed apart.
 */
const SUPER_PHASE_TEXT: Record<YearResult['superPhase'], string> = {
  preserved: 'Super was preserved this year: it grew but could not pay for anything.',
  accessible:
    'Super was released this year (you had reached 65), so it could cover a shortfall after cash and investments.',
  pension: 'Super was paying a pension this year: released, with tax-free earnings.',
};

export function YearBreakdown({
  year,
  previousIndexPpb,
  mode,
}: {
  year: YearResult;
  previousIndexPpb: number;
  mode: Dollars;
}) {
  const b = bridge(year, previousIndexPpb, mode);
  const change = b.closing - b.opening;
  // Money moved between accounts, in the same dollars as the table
  const real = (cents: number) =>
    mode === 'today' ? mulDiv(cents, PPB, year.inflationIndexPpb) : cents;
  const convert = (rows: { id: string; name: string; amount: number }[]) =>
    rows.map((r) => ({ ...r, amount: real(r.amount) }));
  return (
    <section aria-label={`What changed in ${year.calendarYear}`} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl text-text">
          What changed in {year.calendarYear}
          <span className="ml-2 text-sm font-sans text-text-tertiary">
            age {year.age} to {year.age + 1} ·{' '}
            {mode === 'today' ? "today's dollars" : 'future dollars'}
          </span>
        </h3>
        <p
          className={`text-sm flex items-center gap-1 ${b.difference === 0 ? 'text-positive' : 'text-negative'}`}
          role="status"
        >
          <Check size={14} />
          {b.difference === 0
            ? 'The parts add up to the change, to the cent'
            : `Does not add up: off by ${formatCurrency(b.difference)}`}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[22rem]">
          <tbody>
            <tr className="border-b border-border-light">
              <th scope="row" className="text-left py-1.5 font-semibold">
                Net worth at the start of the year
              </th>
              <td className="text-right tabular-nums font-semibold">{formatCurrency(b.opening)}</td>
            </tr>
            {b.rows
              .filter((r) => r.amount !== 0 || r.key === 'spending')
              .map((r) => (
                <tr key={r.key} className="border-b border-border-light/60">
                  <th scope="row" className="text-left py-1.5 font-normal">
                    <span>{r.label}</span>
                    <span className="ml-2 text-xs text-text-tertiary">{GROUP_LABEL[r.group]}</span>
                  </th>
                  <td className={`text-right tabular-nums ${r.amount < 0 ? 'text-negative' : ''}`}>
                    {signed(r.amount)}
                  </td>
                </tr>
              ))}
            <tr className="border-b border-border-light">
              <th scope="row" className="text-left py-1.5">
                Total change
              </th>
              <td className="text-right tabular-nums" aria-label="Total change">
                {signed(change)}
              </td>
            </tr>
            <tr>
              <th scope="row" className="text-left py-1.5 font-semibold">
                Net worth at the end of the year
              </th>
              <td className="text-right tabular-nums font-semibold">{formatCurrency(b.closing)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Moves title="Savings added" rows={convert(year.allocations)} />
        <Moves title="Taken out to cover a shortfall" rows={convert(year.withdrawals)} />
        {year.unfundedAdded > 0 && (
          <p role="alert" className="text-sm text-negative sm:col-span-2">
            Unfunded spending this year: {formatCurrency(real(year.unfundedAdded))} could not be
            paid from your accounts.
          </p>
        )}
        {year.unfundedRepaid > 0 && (
          <p className="text-sm text-text-secondary sm:col-span-2">
            {formatCurrency(real(year.unfundedRepaid))} of earlier unfunded spending was repaid
            first.
          </p>
        )}
        {year.loanPayments > 0 && (
          <p className="text-xs text-text-tertiary sm:col-span-2">
            Loan payments of {formatCurrency(year.loanPayments)} include{' '}
            {formatCurrency(year.loanInterest)} of interest; the rest reduced what you owe.
          </p>
        )}
        {year.superContribution > 0 && (
          <p className="text-xs text-text-tertiary sm:col-span-2">
            {year.superSalarySacrifice > 0
              ? `Employer super and ${formatCurrency(real(year.superSalarySacrifice))} of salary sacrifice`
              : 'Employer super'}{' '}
            of {formatCurrency(real(year.superContribution))}, less{' '}
            {formatCurrency(real(year.superTax))} contributions tax, went into your super.
          </p>
        )}
        {year.superPersonal > 0 && (
          <p className="text-xs text-text-tertiary sm:col-span-2">
            {formatCurrency(real(year.superPersonal))} of personal contributions moved from your
            surplus into super, where it is preserved.
          </p>
        )}
        {year.superDrawdown > 0 && (
          <p className="text-xs text-text-tertiary sm:col-span-2">
            Your super pension paid its minimum of {formatCurrency(real(year.superDrawdown))} into
            spendable cash.
          </p>
        )}
        <p className="text-xs text-text-tertiary sm:col-span-2">
          {SUPER_PHASE_TEXT[year.superPhase]}
        </p>
      </div>
      <p className="text-xs text-text-tertiary">
        Money moved between your accounts changes what you hold where, not your net worth.
      </p>
    </section>
  );
}
