import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { budgetMonths } from '../db/schema.js';
import { budgetGroups, fundingRevision, fundingState } from './budgetService.js';
import { BudgetError } from './budgetMoves.js';
import { addMonthsTo } from './fundingMath.js';
import { todayIso } from './mainAmountService.js';
import { budgetWithTargets } from './targetService.js';

// Auto-assign, like YNAB's: one previewed action that tops up each expense envelope towards an
// amount chosen by strategy, in budget order, capped at money that is unassigned today. It only
// ever adds to an assignment (never lowers one) and goes through the same funded-write guard as
// a manual assignment. Target funding is the "underfunded" strategy.

export const AUTO_ASSIGN_STRATEGIES = [
  'underfunded',
  'overspent',
  'assigned_last_month',
  'spent_last_month',
  'average_spent',
] as const;
export type AutoAssignStrategy = (typeof AUTO_ASSIGN_STRATEGIES)[number];

/** Months "average spent" looks back over, not counting the month being assigned */
export const AVERAGE_MONTHS = 3;

/** How much each expense category needs added this month under `strategy` */
function needs(month: string, strategy: AutoAssignStrategy, today: string) {
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
  let need: (c: (typeof current)[number]) => number;
  if (strategy === 'underfunded') need = (c) => c.target?.underfunded ?? 0;
  else if (strategy === 'overspent') need = (c) => -c.balance;
  else if (strategy === 'assigned_last_month') {
    const last = previous(1);
    need = (c) => (last.get(c.id)?.budgeted ?? 0) - c.budgeted;
  } else if (strategy === 'spent_last_month') {
    const last = previous(1);
    need = (c) => (last.get(c.id)?.spent ?? 0) - c.budgeted;
  } else {
    const months = Array.from({ length: AVERAGE_MONTHS }, (_, i) => previous(i + 1));
    need = (c) =>
      Math.round(months.reduce((s, m) => s + (m.get(c.id)?.spent ?? 0), 0) / AVERAGE_MONTHS) -
      c.budgeted;
  }
  return current
    .map((c) => ({ categoryId: c.id, name: c.name, assigned: c.budgeted, need: need(c) }))
    .filter((r) => r.need > 0);
}

/** Proposed additions for `strategy`, capped at money actually unassigned today. Expected
 * income never counts. */
export function previewAutoAssign(month: string, strategy: AutoAssignStrategy, today = todayIso()) {
  const state = fundingState(today);
  let remaining = state.available;
  const rows = needs(month, strategy, today).map((r) => {
    const proposed = Math.min(r.need, remaining);
    remaining -= proposed;
    return { ...r, proposed, shortfall: r.need - proposed };
  });
  return {
    month,
    strategy,
    complete: state.complete,
    available: state.available,
    total: rows.reduce((s, r) => s + r.proposed, 0),
    shortfall: rows.reduce((s, r) => s + r.shortfall, 0),
    rows,
    revision: fundingRevision(),
  };
}

/** Adds exactly the previewed amounts to the month's assignments, once, in one transaction. */
export function applyAutoAssign(
  month: string,
  strategy: AutoAssignStrategy,
  revision: string,
  expected: { categoryId: string; proposed: number }[],
  fundedWrite: (action: () => void) => void,
) {
  let applied = 0;
  fundedWrite(() => {
    const preview = previewAutoAssign(month, strategy);
    if (
      revision !== preview.revision ||
      JSON.stringify(preview.rows.map((r) => [r.categoryId, r.proposed])) !==
        JSON.stringify(expected.map((r) => [r.categoryId, r.proposed]))
    )
      throw new BudgetError('Your budget changed. Review auto-assign again.', 409);
    if (!preview.complete)
      throw new BudgetError('Add missing exchange rates before assigning money.');
    for (const row of preview.rows) {
      if (!row.proposed) continue;
      const existing = db
        .select()
        .from(budgetMonths)
        .where(and(eq(budgetMonths.month, month), eq(budgetMonths.categoryId, row.categoryId)))
        .get();
      const budgeted = (existing?.budgeted ?? 0) + row.proposed;
      db.insert(budgetMonths)
        .values({ id: nanoid(), month, categoryId: row.categoryId, budgeted })
        .onConflictDoUpdate({
          target: [budgetMonths.month, budgetMonths.categoryId],
          set: { budgeted },
        })
        .run();
      applied += row.proposed;
    }
  });
  return { month, applied, revision: fundingRevision() };
}
