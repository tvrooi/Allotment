import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  budgetMonths,
  cardFunding,
  categories,
  categoryGroups,
  categoryTargets,
} from '../db/schema.js';
import { budgetGroups, fundingRevision, fundingState } from './budgetService.js';
import { BudgetError } from './budgetMoves.js';
import { addMonthsTo, monthsBetween, perPeriodNeed } from './fundingMath.js';
import { todayIso } from './mainAmountService.js';
import type { TargetInput } from './targetConfig.js';
import { inactiveGoalCategories } from './goalLifecycle.js';
import { categoryPurposes } from '../db/schema.js';

// Category targets (phase 6D) say how much a category needs in a month. They read the
// shared envelope figures and never assign money themselves: funding them is a separate,
// previewed action that goes through the same funded-write guard as manual assignments.

type TargetRow = typeof categoryTargets.$inferSelect;
type Figures = { budgeted: number; carryOver: number };

/** Recurring targets advance by whole cycles to the first due date in or after `month`.
 * Nothing is stored, so activity and reserved balances are never rewritten. */
export function currentDueDate(target: Pick<TargetRow, 'dueDate' | 'cycleMonths'>, month: string) {
  let due = target.dueDate!;
  const cycle = target.cycleMonths ?? 1;
  if (due.slice(0, 7) < month) {
    const behind = monthsBetween(due.slice(0, 7), month) - 1;
    const cycles = Math.ceil(behind / cycle);
    const next = addMonthsTo(due.slice(0, 7), cycles * cycle);
    // A 31st falls back to the month's last day; the original day returns in longer months.
    const last = new Date(Date.UTC(+next.slice(0, 4), +next.slice(5, 7), 0)).getUTCDate();
    due = `${next}-${String(Math.min(+target.dueDate!.slice(8), last)).padStart(2, '0')}`;
  }
  return due;
}

/** What the target needs in `month`, from the balance carried into it. */
export function targetStatus(target: TargetRow, figures: Figures, month: string) {
  const start = figures.carryOver;
  let required = 0;
  let catchUp = 0;
  let dueDate: string | null = null;
  let periodsLeft: number | null = null;
  let ended = false;
  if (target.type === 'monthly') required = target.amount;
  if (target.type === 'refill') required = Math.max(0, target.amount - start);
  if (target.type === 'by-date' || target.type === 'recurring') {
    dueDate = target.type === 'recurring' ? currentDueDate(target, month) : target.dueDate!;
    const dueMonth = dueDate.slice(0, 7);
    if (dueMonth < month) ended = true;
    else {
      periodsLeft = monthsBetween(month, dueMonth);
      required = perPeriodNeed(target.amount, start, periodsLeft);
      // The even rate this cycle started with; anything above it is catching up.
      const cyclePeriods =
        target.type === 'recurring'
          ? (target.cycleMonths ?? 1)
          : Math.max(1, monthsBetween(target.createdMonth, dueMonth));
      catchUp = Math.max(0, required - Math.ceil(target.amount / cyclePeriods));
    }
  }
  const underfunded = Math.max(0, required - figures.budgeted);
  return {
    type: target.type,
    amount: target.amount,
    dueDate,
    cycleMonths: target.cycleMonths,
    periodsLeft,
    required,
    assigned: figures.budgeted,
    underfunded,
    catchUp,
    ended,
    paused: false,
  };
}
export type TargetStatus = ReturnType<typeof targetStatus>;

/** A target whose goal is paused, completed or retired (7D) asks for nothing more. Its
 * funding stays; only the suggestion stops. */
export function pausedStatus(status: TargetStatus): TargetStatus {
  return { ...status, required: 0, underfunded: 0, catchUp: 0, paused: true };
}

/** The month's budget groups, each expense category with its target status (or null). */
export function budgetWithTargets(month: string, today = todayIso()) {
  const targets = new Map(
    db
      .select()
      .from(categoryTargets)
      .all()
      .map((t) => [t.categoryId, t]),
  );
  const inactive = inactiveGoalCategories();
  return budgetGroups(month, today).map((g) => ({
    ...g,
    categories: g.categories.map((c) => {
      const target = targets.get(c.id);
      if (!target || g.isIncome) return { ...c, target: null };
      // Money transferred into a linked account counts toward the target like an assignment
      const status = targetStatus(
        target,
        { budgeted: c.budgeted + c.transferred, carryOver: c.carryOver },
        month,
      );
      return { ...c, target: inactive.has(c.id) ? pausedStatus(status) : status };
    }),
  }));
}

export function saveTarget(categoryId: string, input: TargetInput, today = todayIso()) {
  const category = db.select().from(categories).where(eq(categories.id, categoryId)).get();
  const group =
    category &&
    db.select().from(categoryGroups).where(eq(categoryGroups.id, category.groupId)).get();
  if (!category) throw new BudgetError('Category not found', 404);
  if (!group || group.isIncome) throw new BudgetError('Targets need an expense category', 400);
  if (db.select().from(cardFunding).where(eq(cardFunding.categoryId, categoryId)).get())
    throw new BudgetError('Card payment reserves are funded from card activity, not targets', 400);
  if (
    (input.type === 'by-date' || input.type === 'recurring') &&
    db.select().from(categoryPurposes).where(eq(categoryPurposes.categoryId, categoryId)).get()
      ?.purpose === 'flexibility'
  )
    throw new BudgetError(
      'A flexibility reserve has no deadline. Use a monthly or refill target instead.',
      400,
    );
  const row = {
    categoryId,
    type: input.type,
    amount: input.amount,
    dueDate: 'dueDate' in input ? input.dueDate : null,
    cycleMonths: input.type === 'recurring' ? input.cycleMonths : null,
    createdMonth: today.slice(0, 7),
    updatedAt: new Date().toISOString(),
  };
  db.insert(categoryTargets)
    .values(row)
    .onConflictDoUpdate({
      target: categoryTargets.categoryId,
      set: { ...row, createdMonth: today.slice(0, 7) },
    })
    .run();
  return row;
}

/** Proposed assignments for underfunded targets, in budget order, capped at money that is
 * actually unassigned today. Expected income never counts. */
export function previewTargetFunding(month: string, today = todayIso()) {
  const state = fundingState(today);
  let remaining = state.available;
  const rows = budgetWithTargets(month, today)
    .filter((g) => !g.isIncome)
    .flatMap((g) => g.categories)
    .filter((c) => c.target && c.target.underfunded > 0)
    .map((c) => {
      const proposed = Math.min(c.target!.underfunded, remaining);
      remaining -= proposed;
      return {
        categoryId: c.id,
        name: c.name,
        underfunded: c.target!.underfunded,
        proposed,
        shortfall: c.target!.underfunded - proposed,
      };
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

/** Adds exactly the previewed amounts to the month's assignments, once, in one transaction. */
export function applyTargetFunding(
  month: string,
  revision: string,
  expected: { categoryId: string; proposed: number }[],
  fundedWrite: (action: () => void) => void,
) {
  let applied = 0;
  fundedWrite(() => {
    const preview = previewTargetFunding(month);
    if (
      revision !== preview.revision ||
      JSON.stringify(preview.rows.map((r) => [r.categoryId, r.proposed])) !==
        JSON.stringify(expected.map((r) => [r.categoryId, r.proposed]))
    )
      throw new BudgetError('Your budget changed. Review the target funding again.', 409);
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
