// Audit F-13: the one way money is added to envelopes by a planned action. Auto-assign, target
// funding, payday plans and assistant suggestions each decide what to add; this caps it at
// money actually unassigned today (planFunding, one preview format, optionally for chosen
// categories only), applies exactly what was previewed (applyFundingPlan) and makes the write (addAssigned). Manual assignment and Move
// money stay in budgetMoves.ts, behind the same funded-write guard.
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { budgetMonths } from '../db/schema.js';
import { fundingRevision, fundingState } from './budgetService.js';
import { BudgetError, refuseLinked } from './budgetMoves.js';
import { todayIso } from './mainAmountService.js';

export type PlannedRow<T> = T & { proposed: number; shortfall: number };

/** A previewed plan: what each envelope gets (or gives back, when negative), capped at unassigned
 * money, in the given order */
export interface FundingPlan<T> {
  month: string;
  /** False while an exchange rate is missing: nothing can be assigned then */
  complete: boolean;
  available: number;
  total: number;
  shortfall: number;
  rows: PlannedRow<T>[];
  /** Changes whenever the ledger or budget does; apply refuses a stale preview */
  revision: string;
}

/**
 * Proposed changes for `needs` (in order, each wanting `need` cents), capped at money actually
 * unassigned today. Expected income never counts. `only` limits the plan to chosen categories
 * (BUD-07): the rest are left out before money is shared out, so the cap goes to the chosen ones.
 * A negative `need` takes money back from an envelope (a replace-mode quick fill); those are
 * applied first and the money they free can fund the additions in the same plan.
 */
export function planFunding<T extends { categoryId: string; need: number }>(
  month: string,
  needs: T[],
  today = todayIso(),
  only?: readonly string[],
): FundingPlan<T> {
  const state = fundingState(today);
  const chosen = only ? new Set(only) : null;
  const scoped = chosen ? needs.filter((r) => chosen.has(r.categoryId)) : needs;
  let remaining = state.available - scoped.reduce((s, r) => s + Math.min(0, r.need), 0);
  const rows = scoped.map((r) => {
    if (r.need < 0) return { ...r, proposed: r.need, shortfall: 0 };
    const proposed = Math.max(0, Math.min(r.need, remaining));
    remaining -= proposed;
    return { ...r, proposed, shortfall: r.need - proposed };
  });
  return {
    month,
    complete: state.complete,
    available: state.available,
    total: rows.reduce((s, r) => s + r.proposed, 0),
    shortfall: rows.reduce((s, r) => s + r.shortfall, 0),
    rows,
    revision: fundingRevision(),
  };
}

/**
 * Adds `amount` to a month's assignment for a category. The single write every planned action
 * uses; callers run it inside fundedWrite (or their own guarded transaction).
 */
export function addAssigned(month: string, categoryId: string, amount: number) {
  // An envelope linked to an account mirrors it: payday plans and suggestions can't fund it
  if (amount > 0) refuseLinked([categoryId]);
  const existing = db
    .select()
    .from(budgetMonths)
    .where(and(eq(budgetMonths.month, month), eq(budgetMonths.categoryId, categoryId)))
    .get();
  const budgeted = (existing?.budgeted ?? 0) + amount;
  if (!Number.isSafeInteger(budgeted) || Math.abs(budgeted) > 1e13)
    throw new BudgetError('That assignment is too large');
  db.insert(budgetMonths)
    .values({ id: nanoid(), month, categoryId, budgeted })
    .onConflictDoUpdate({
      target: [budgetMonths.month, budgetMonths.categoryId],
      set: { budgeted },
    })
    .run();
}

/**
 * Applies exactly the previewed plan, once, in one funded write: `rebuild` makes the plan again
 * inside the transaction, and anything different from what the owner saw is refused.
 */
export function applyFundingPlan<T extends { categoryId: string }>(
  rebuild: () => FundingPlan<T>,
  revision: string,
  expected: { categoryId: string; proposed: number }[],
  changedMessage: string,
  fundedWrite: (action: () => void) => void,
) {
  let applied = 0;
  let month = '';
  fundedWrite(() => {
    const plan = rebuild();
    month = plan.month;
    if (
      revision !== plan.revision ||
      JSON.stringify(plan.rows.map((r) => [r.categoryId, r.proposed])) !==
        JSON.stringify(expected.map((r) => [r.categoryId, r.proposed]))
    )
      throw new BudgetError(changedMessage, 409);
    if (!plan.complete) throw new BudgetError('Add missing exchange rates before assigning money.');
    for (const row of plan.rows) {
      if (!row.proposed) continue;
      addAssigned(plan.month, row.categoryId, row.proposed);
      applied += row.proposed;
    }
  });
  return { month, applied, revision: fundingRevision() };
}
