// ACT-03: hold money for next month. A hold sets aside part of this month's Ready to assign
// until the month ends (fundingState subtracts it; docs/ENVELOPE-FUNDING.md, "Holding money for
// next month"). It is not an assignment and touches no envelope, so this is the one place that
// writes it.
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { budgetHolds } from '../db/schema.js';
import { accountIssues, describeIssues } from './accountIntegrity.js';
import { fundingRevision, fundingState } from './budgetService.js';
import { BudgetError } from './budgetMoves.js';
import { todayIso } from './mainAmountService.js';

/**
 * Sets what is held in `month` for the month after it; 0 releases it. Only the current month
 * can be held in, and a hold can only be raised by money that is ready to assign now (after
 * what later months already take), so holding never makes Ready to assign negative. Lowering
 * or releasing a hold is always allowed.
 */
export function setHold(month: string, amount: number, revision?: string) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1e13)
    throw new BudgetError('Enter an amount to hold', 400);
  const today = todayIso();
  if (month !== today.slice(0, 7))
    throw new BudgetError('Hold money in the current month, for the next one', 400);
  return db.transaction(() => {
    if (revision && revision !== fundingRevision())
      throw new BudgetError('Your budget changed. Refresh before holding money.');
    const before = db.select().from(budgetHolds).where(eq(budgetHolds.month, month)).get();
    const previous = before?.amount ?? 0;
    if (amount > previous) {
      const state = fundingState(today, month, today);
      const issues = accountIssues();
      if (issues.length)
        throw new BudgetError(
          `Reconcile account balance discrepancies before holding money. ${describeIssues(issues)}.`,
          409,
          { accountIssues: issues },
        );
      if (!state.complete)
        throw new BudgetError('Add missing exchange rates before holding money.');
      // The most that can be held: Ready to assign without any hold
      const ceiling = state.unassignedBeforeLater - state.laterDeduction;
      if (amount > ceiling)
        throw new BudgetError('Not enough Ready to assign money to hold. Hold less.');
    }
    if (amount === 0) db.delete(budgetHolds).where(eq(budgetHolds.month, month)).run();
    else
      db.insert(budgetHolds)
        .values({ month, amount, createdAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: budgetHolds.month, set: { amount } })
        .run();
    return { month, amount, previous, revision: fundingRevision() };
  });
}
