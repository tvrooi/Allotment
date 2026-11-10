import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import type { HouseholdCoverage } from '../../api/households';

// The Household page's gauge, like Up's Essentials dial: is there enough in the household
// account for the bills due in the next 30 days, and what has each person put in towards them?
// The figures come from the server (householdCoverage.ts); this only shows them.

const card = 'bg-surface rounded-lg shadow-card border border-border-light p-4';

interface Props {
  coverage: HouseholdCoverage;
  currency: string;
  people: { id: string; name: string; isSelf: number }[];
}

export function BillsCoverage({ coverage, currency, people }: Props) {
  const money = (n: number) => formatMoney(n, currency);
  const { needed, covered, shortfall, cash, due, to } = coverage;
  const percent = needed > 0 ? Math.round((covered / needed) * 100) : 100;
  const monthStart = `${coverage.from.slice(0, 7)}-01`;
  return (
    <section className={card} aria-labelledby="bills-coverage">
      <h2 id="bills-coverage" className="text-base font-semibold text-text">
        Bills coverage
      </h2>
      {needed === 0 ? (
        <p className="text-sm text-text-secondary mt-1">
          No bills from the household account in the next 30 days. It holds {money(cash)}.
        </p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text">
            {money(covered)}{' '}
            <span className="text-sm font-normal text-text-secondary">
              of {money(needed)} needed by {formatDay(to)}
            </span>
          </p>
          <div
            role="meter"
            aria-label="Bills covered"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${money(covered)} of ${money(needed)}`}
            className="mt-2 h-2 rounded-full bg-surface-alt overflow-hidden"
          >
            <div
              className={`h-full rounded-full ${shortfall > 0 ? 'bg-caution' : 'bg-positive'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            {shortfall > 0
              ? `${money(shortfall)} still to be paid in before these bills leave.`
              : `Covered, with ${money(cash - needed)} to spare.`}
          </p>
          <ul className="mt-3 divide-y divide-border-light border-t border-border-light text-sm">
            {due.map((d) => (
              <li key={`${d.id}-${d.date}`} className="flex justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate text-text">
                  <span className="text-text-tertiary tabular-nums">{formatDay(d.date)}</span>{' '}
                  {d.name}
                </span>
                <span className="tabular-nums text-text">{money(d.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {needed > 0 && (
        <ul className="mt-3 grid gap-1 text-sm" aria-label="Each person's part">
          {coverage.people.map((p) => {
            const person = people.find((x) => x.id === p.personId);
            return (
              <li key={p.personId} className="flex flex-wrap justify-between gap-x-3">
                <span className="text-text">
                  {person?.name ?? 'Someone'}
                  {person?.isSelf ? ' (me)' : ''}
                </span>
                <span className="text-text-secondary tabular-nums">
                  {money(p.shareDue)} of these bills · paid in {money(p.paidIn)} since{' '}
                  {formatDay(monthStart)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
