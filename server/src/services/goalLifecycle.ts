import { asc, eq, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { goals, goalStatusEvents } from '../db/schema.js';
import { fundingRevision } from './budgetService.js';
import { BudgetError, moveWithinTransaction } from './budgetMoves.js';
import { todayIso } from './mainAmountService.js';

// Goals can change (phase 7D). A goal that is not active keeps its funding and its category
// claim, but its category's target asks for nothing and payday rules propose nothing for it.
// Releasing money is a money move in the same confirmed action; see docs/RESILIENCE.md.

export const GOAL_STATUSES = ['active', 'paused', 'completed', 'retired'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const statusChangeSchema = z.object({
  status: z.enum(GOAL_STATUSES),
  reason: z.string().trim().max(500).nullable().default(null),
  replacementGoalId: z.string().min(1).max(64).nullable().default(null),
  /** The goal's updatedAt the user saw; a stale edit is refused. */
  expectedUpdatedAt: z.string().min(1).max(64),
  move: z
    .object({
      destinationId: z.string().min(1).max(64),
      amount: z.number().int().min(1).max(1e13),
      revision: z.string().min(1).max(200),
    })
    .nullable()
    .default(null),
});
export type StatusChange = z.infer<typeof statusChangeSchema>;

/** Categories whose goal is paused, completed or retired: no new funding suggestions. */
export function inactiveGoalCategories() {
  return new Set(
    db
      .select({ categoryId: goals.categoryId })
      .from(goals)
      .where(ne(goals.status, 'active'))
      .all()
      .map((g) => g.categoryId)
      .filter((id): id is string => !!id),
  );
}

export function changeGoalStatus(id: string, change: StatusChange, today = todayIso()) {
  return db.transaction(() => {
    const goal = db.select().from(goals).where(eq(goals.id, id)).get();
    if (!goal) throw new BudgetError('Goal not found', 404);
    if (goal.updatedAt !== change.expectedUpdatedAt)
      throw new BudgetError('This goal changed. Reload it before changing its status.');
    if (goal.status === change.status)
      throw new BudgetError(`This goal is already ${goal.status}`, 400);
    if (change.replacementGoalId) {
      if (change.status === 'active')
        throw new BudgetError('Only a goal that is not active has a replacement', 400);
      const replacement = db
        .select()
        .from(goals)
        .where(eq(goals.id, change.replacementGoalId))
        .get();
      if (!replacement || replacement.id === id || replacement.status === 'retired')
        throw new BudgetError('Choose another goal that is not retired as the replacement', 400);
    }
    // Check the funding revision the user previewed before anything changes; the goal
    // update below bumps it, so the move then records the revision after both.
    if (change.move) {
      if (!goal.categoryId)
        throw new BudgetError('Only a category-funded goal has money to move', 400);
      if (change.move.revision !== fundingRevision())
        throw new BudgetError('Your budget changed. Refresh the preview.');
    }
    const now = new Date().toISOString();
    db.update(goals)
      .set({
        status: change.status,
        statusReason: change.reason,
        replacedByGoalId: change.status === 'active' ? null : change.replacementGoalId,
        statusChangedAt: now,
        updatedAt: now,
      })
      .where(eq(goals.id, id))
      .run();
    const move = change.move
      ? moveWithinTransaction(today.slice(0, 7), {
          sourceId: goal.categoryId!,
          destinationId: change.move.destinationId,
          amount: change.move.amount,
        })
      : null;
    db.insert(goalStatusEvents)
      .values({
        id: nanoid(),
        goalId: id,
        fromStatus: goal.status,
        toStatus: change.status,
        reason: change.reason,
        replacementGoalId: change.replacementGoalId,
        moveId: move?.id ?? null,
        createdAt: now,
      })
      .run();
    return { goal: db.select().from(goals).where(eq(goals.id, id)).get()!, move };
  });
}

export function goalHistory(id: string) {
  return db
    .select()
    .from(goalStatusEvents)
    .where(eq(goalStatusEvents.goalId, id))
    .orderBy(asc(goalStatusEvents.createdAt))
    .all();
}
