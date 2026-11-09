import { createContext, useContext } from 'react';
import type { BudgetCategory } from '../../types';
import { plotOf, type PlotState } from '../../utils/budgetFigures';

/** On for the /budget/plots design variant only; the Budget page is unchanged without it */
export const PlotsContext = createContext(false);

const TITLES: Record<PlotState, string> = {
  bare: 'Bare: nothing in this envelope yet',
  used: 'Used: all of this month’s money has gone',
  growing: 'Growing: short of its target',
  planted: 'Planted: money in it',
  overspent: 'Overspent',
};

/**
 * A small plot beside an envelope's name, in place of the spending bar: Sprout fills it with
 * the money still in the envelope, so spending empties it; a dashed outline marks one that was
 * given nothing, red one that is overspent. It repeats the figures beside it, so it is hidden
 * from screen readers.
 */
export function Plot({ cat }: { cat: BudgetCategory }) {
  const on = useContext(PlotsContext);
  if (!on) return null;
  const { state, fill } = plotOf(cat);
  if (state === 'bare')
    return (
      <span
        aria-hidden
        title={TITLES.bare}
        className="inline-block shrink-0 size-3.5 rounded-[3px] border border-dashed border-text-disabled align-[-2px]"
      />
    );
  return (
    <span
      aria-hidden
      title={TITLES[state]}
      className="relative inline-block shrink-0 size-3.5 rounded-[3px] bg-surface-alt ring-1 ring-inset ring-border overflow-hidden align-[-2px]"
    >
      <span
        className={`absolute inset-x-0 bottom-0 ${state === 'overspent' ? 'bg-negative' : 'bg-positive'}`}
        // A sliver stays visible for a little money; used plots are empty soil
        style={{
          height: `${state === 'used' ? 0 : Math.round(Math.min(Math.max(fill, 0.15), 1) * 100)}%`,
        }}
      />
    </span>
  );
}

/** Whether the plots variant is on (the plot then stands in for the spending bar) */
export const usePlots = () => useContext(PlotsContext);

/** Whether a row's name reads as bare (muted), in the plots variant */
export function useBareName(cat: BudgetCategory): boolean {
  const on = useContext(PlotsContext);
  return on && plotOf(cat).state === 'bare';
}
