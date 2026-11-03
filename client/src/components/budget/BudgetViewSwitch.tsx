import { Link } from 'react-router-dom';

type View = 'month' | 'year' | 'payday';

/**
 * Month, Year or Until payday: the three ways to look at the budget, as one segmented control
 * so it reads as a choice of view rather than three more buttons.
 */
export function BudgetViewSwitch({
  current,
  year,
  onMonth,
  onPayday,
}: {
  current: View;
  year: string;
  onMonth: () => void;
  onPayday: () => void;
}) {
  const base =
    'px-3 py-1.5 text-xs font-medium rounded-full transition-colors max-md:min-h-11 inline-flex items-center';
  const style = (view: View) =>
    `${base} ${current === view ? 'bg-surface text-text shadow-xs' : 'text-text-secondary hover:text-text'}`;
  return (
    <div
      role="group"
      aria-label="Budget view"
      className="inline-flex rounded-full bg-surface-alt p-0.5"
    >
      <button
        type="button"
        aria-label="Monthly budget"
        aria-pressed={current === 'month'}
        onClick={onMonth}
        className={style('month')}
      >
        Month
      </button>
      <Link
        to={`/budget/year/${year}`}
        aria-current={current === 'year' ? 'page' : undefined}
        className={style('year')}
      >
        Year
      </Link>
      <button
        type="button"
        aria-label="Until next payday"
        aria-pressed={current === 'payday'}
        onClick={onPayday}
        className={style('payday')}
      >
        Until payday
      </button>
    </div>
  );
}
