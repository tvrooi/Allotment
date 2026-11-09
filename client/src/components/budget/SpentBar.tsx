import type { BudgetCategory } from '../../types';
import { barOf, type BarState } from '../../utils/budgetFigures';

const FILL: Record<BarState, string> = {
  overspent: 'bg-negative',
  empty: 'bg-positive',
  low: 'bg-caution',
  ok: 'bg-positive',
  income: 'bg-positive',
};

/**
 * Money left in an envelope out of what it had this month (carried in plus assigned), so
 * spending empties the bar: the same idea as the plots variant. Amber when under a fifth is
 * left, a full red bar when overspent. Recurring debits still expected follow in grey. Income
 * fills as the plan arrives. The bar carries its meaning as a text label ("$106 left of $288"),
 * so state never rests on colour alone.
 */
export function SpentBar({
  cat,
  isIncome = false,
  className = 'h-1.5 w-[90%] mt-1',
}: {
  cat: BudgetCategory;
  isIncome?: boolean;
  className?: string;
}) {
  const bar = barOf(cat, isIncome);
  if (!bar) return null;
  const { state, fill, expectedFill, label } = bar;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={`${className} bg-surface-alt rounded-full overflow-hidden flex ${
        state === 'overspent' ? 'ring-1 ring-inset ring-negative' : ''
      }`}
    >
      {fill > 0 && (
        <div
          className={`h-full rounded-full transition-all ${FILL[state]}`}
          style={{ width: pct(fill) }}
        />
      )}
      {expectedFill > 0 && (
        <div
          className="h-full rounded-full transition-all bg-expected opacity-70"
          style={{ width: pct(expectedFill) }}
          data-testid="expected-bar"
        />
      )}
    </div>
  );
}
