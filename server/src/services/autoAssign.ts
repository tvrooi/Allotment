import { budgetGroups } from './budgetService.js';
import { applyFundingPlan, planFunding } from './fundingPlan.js';
import { addMonthsTo } from './fundingMath.js';
import { todayIso } from './mainAmountService.js';
import { budgetWithTargets } from './targetService.js';

// Auto-assign, like YNAB's: one previewed action that moves each expense envelope towards an
// amount chosen by strategy, in budget order, capped at money that is unassigned today. By default
// it only ever adds to an assignment; "replace" mode (ACT-05) also takes money back, to a level
// copied from last month or an average, or to zero. Either way it goes through the same
// funded-write guard as a manual assignment, and can be limited to chosen categories (BUD-07).
// Target funding is the "underfunded" strategy.

export const AUTO_ASSIGN_STRATEGIES = [
  'underfunded',
  'overspent',
  'assigned_last_month',
  'spent_last_month',
  'average_spent',
  'zero',
] as const;
export type AutoAssignStrategy = (typeof AUTO_ASSIGN_STRATEGIES)[number];

/** Add tops an envelope up to the level; replace sets it to the level, lowering it if need be */
export const AUTO_ASSIGN_MODES = ['add', 'replace'] as const;
export type AutoAssignMode = (typeof AUTO_ASSIGN_MODES)[number];

/** Months "average spent" can look back over, not counting the month being assigned; zero-spending
 * months count in the average */
export const AVERAGE_MONTH_CHOICES = [3, 6, 12] as const;
export type AverageMonths = (typeof AVERAGE_MONTH_CHOICES)[number];

/** Strategies that name a level for each envelope, so they can be added to or replace what is there */
const LEVEL_STRATEGIES: AutoAssignStrategy[] = [
  'assigned_last_month',
  'spent_last_month',
  'average_spent',
  'zero',
];

export interface AutoAssignOptions {
  strategy: AutoAssignStrategy;
  mode?: AutoAssignMode;
  /** For `average_spent` (default 3) */
  months?: AverageMonths;
  /** Limit the plan to these categories; all expense categories when omitted */
  categoryIds?: string[];
}

/** The mode a strategy really runs in: `zero` only makes sense as a replace, and the others
 * (cover overspending, fund targets) can only add */
export function effectiveMode(options: AutoAssignOptions): AutoAssignMode {
  if (!LEVEL_STRATEGIES.includes(options.strategy)) return 'add';
  return options.strategy === 'zero' || options.mode === 'replace' ? 'replace' : 'add';
}

/** How much each expense category needs changed this month under `options` */
function needs(month: string, options: AutoAssignOptions, today: string) {
  const { strategy } = options;
  const replace = effectiveMode(options) === 'replace';
  const averageMonths = options.months ?? 3;
  const expense = <C extends { paymentAccountId: string | null; hidden: number }>(
    groups: { isIncome: number; categories: C[] }[],
  ) =>
    groups
      .filter((g) => !g.isIncome)
      .flatMap((g) => g.categories)
      .filter((c) => !c.paymentAccountId && !c.hidden);
  const current = expense(budgetWithTargets(month, today));
  const previous = (n: number) =>
    new Map(expense(budgetGroups(addMonthsTo(month, -n), today)).map((c) => [c.id, c]));
  // What a month already put in: assignments plus transfers into a linked account
  const funded = (c?: { budgeted: number; transferred: number }) =>
    (c?.budgeted ?? 0) + (c?.transferred ?? 0);
  let level: ((c: (typeof current)[number]) => number) | null = null;
  let need: (c: (typeof current)[number]) => number = () => 0;
  if (strategy === 'underfunded') need = (c) => c.target?.underfunded ?? 0;
  else if (strategy === 'overspent') need = (c) => -c.balance;
  else if (strategy === 'assigned_last_month') {
    const last = previous(1);
    level = (c) => funded(last.get(c.id));
  } else if (strategy === 'spent_last_month') {
    const last = previous(1);
    level = (c) => last.get(c.id)?.spent ?? 0;
  } else if (strategy === 'average_spent') {
    const months = Array.from({ length: averageMonths }, (_, i) => previous(i + 1));
    level = (c) =>
      Math.round(months.reduce((s, m) => s + (m.get(c.id)?.spent ?? 0), 0) / averageMonths);
  } else need = (c) => -Math.max(c.budgeted, 0); // zero clears the assignment itself, not transfers
  if (level) {
    const want = level;
    // Taking money back never lowers an assignment below zero
    need = (c) => Math.max(want(c) - funded(c), -Math.max(c.budgeted, 0));
  }
  return current
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      assigned: c.budgeted,
      balance: c.balance,
      need: need(c),
    }))
    .filter((r) => (replace ? r.need !== 0 : r.need > 0));
}

/** Proposed changes for `options`, capped at money actually unassigned today. Expected income
 * never counts. */
export function previewAutoAssign(month: string, options: AutoAssignOptions, today = todayIso()) {
  return {
    strategy: options.strategy,
    mode: effectiveMode(options),
    ...planFunding(month, needs(month, options, today), today, options.categoryIds),
  };
}

/** Applies exactly the previewed amounts to the month's assignments, once, in one transaction. */
export function applyAutoAssign(
  month: string,
  options: AutoAssignOptions,
  revision: string,
  expected: { categoryId: string; proposed: number }[],
  fundedWrite: (action: () => void) => void,
) {
  return applyFundingPlan(
    () => previewAutoAssign(month, options),
    revision,
    expected,
    'Your budget changed. Review auto-assign again.',
    fundedWrite,
  );
}
