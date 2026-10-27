import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { budgetMonths, budgetMoves, categoryPurposes, financialPriorities } from '../db/schema.js';
import { budgetGroups, fundingRevision, fundingState } from './budgetService.js';
import { todayIso } from './mainAmountService.js';
import { monthBounds } from '../utils/date.js';

export class BudgetError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
function assignment(month: string, categoryId: string) {
  return (
    db
      .select()
      .from(budgetMonths)
      .where(and(eq(budgetMonths.month, month), eq(budgetMonths.categoryId, categoryId)))
      .get()?.budgeted ?? 0
  );
}
function write(month: string, categoryId: string, budgeted: number) {
  if (!Number.isSafeInteger(budgeted) || Math.abs(budgeted) > 1e13)
    throw new BudgetError('Assignment is too large', 400);
  db.insert(budgetMonths)
    .values({ id: nanoid(), month, categoryId, budgeted })
    .onConflictDoUpdate({
      target: [budgetMonths.month, budgetMonths.categoryId],
      set: { budgeted },
    })
    .run();
}
export interface MoveRequest {
  sourceId: string;
  destinationId: string;
  amount: number;
}
export function previewMove(month: string, request: MoveRequest) {
  const { sourceId, destinationId, amount } = request;
  if (sourceId === destinationId || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1e13)
    throw new BudgetError('Choose distinct expense categories and a positive amount', 400);
  const today = todayIso();
  if (month > today.slice(0, 7))
    throw new BudgetError('Move existing money in the current or a historical month', 400);
  const cats = budgetGroups(month, today)
    .filter((g) => !g.isIncome)
    .flatMap((g) => g.categories);
  const source = cats.find((c) => c.id === sourceId);
  const destination = cats.find((c) => c.id === destinationId);
  if (!source || !destination) throw new BudgetError('Choose existing expense categories', 400);
  if (!fundingState(today).complete)
    throw new BudgetError('Add missing exchange rates before moving money');
  // A historical move also changes every subsequent month. Never take money already
  // spent later, or rely on future positive assignments to supply the source.
  const months = [
    ...new Set([
      month,
      today.slice(0, 7),
      ...db
        .select()
        .from(budgetMonths)
        .all()
        .map((r) => r.month),
    ]),
  ].filter((m) => m >= month && m <= today.slice(0, 7));
  // Include activity-only months in the check, via the running category history.
  const start = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
  const end = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1;
  if (end - start > 1200) throw new BudgetError('Move money within the last 100 years', 400);
  for (let i = start; i <= end; i++)
    months.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
  for (const m of new Set(months)) {
    const balance = budgetGroups(m, today)
      .flatMap((g) => g.categories)
      .find((c) => c.id === sourceId)!.balance;
    if (balance < amount)
      throw new BudgetError('Source has insufficient availability; refresh the preview');
  }
  const sourceBefore = assignment(month, sourceId);
  const destinationBefore = assignment(month, destinationId);
  return {
    month,
    ...request,
    revision: fundingRevision(),
    sourceBefore,
    destinationBefore,
    sourceAvailable: source.balance,
    destinationAvailable: destination.balance,
    sourceAfter: source.balance - amount,
    destinationAfter: destination.balance + amount,
    // Targets will consume these same balances when category targets ship in 6C–6D.
    targetNotice: 'Moving money changes the funds available for these purposes.',
    reserveNotice: reserveNotice(month, request, today),
  };
}
export function applyMove(month: string, request: MoveRequest, revision: string) {
  return db.transaction(() => {
    if (revision !== fundingRevision())
      throw new BudgetError('Your budget changed. Refresh the preview.');
    return moveWithinTransaction(month, request);
  });
}
/** The move itself, for a caller that already holds a transaction and checked the revision
 * (sql.js, used by the demo, cannot nest top-level transactions). */
export function moveWithinTransaction(month: string, request: MoveRequest) {
  const preview = previewMove(month, request);
  write(month, request.sourceId, preview.sourceBefore - request.amount);
  write(month, request.destinationId, preview.destinationBefore + request.amount);
  const operation = {
    id: nanoid(),
    month,
    ...request,
    sourceBefore: preview.sourceBefore,
    destinationBefore: preview.destinationBefore,
    afterRevision: fundingRevision(),
    undone: 0,
    createdAt: new Date().toISOString(),
  };
  db.insert(budgetMoves).values(operation).run();
  return operation;
}

type Assignment = typeof budgetMonths.$inferSelect;
const assignmentKey = (r: Assignment) => `${r.month}|${r.categoryId}`;
function assignmentRows() {
  return new Map(
    db
      .select()
      .from(budgetMonths)
      .all()
      .map((r) => [assignmentKey(r), r]),
  );
}
/** Puts these assignment rows back exactly as given (absent = no row) */
function restoreRows(keys: string[], rows: Map<string, Assignment>) {
  for (const key of keys) {
    const [month, categoryId] = key.split('|');
    db.delete(budgetMonths)
      .where(and(eq(budgetMonths.month, month), eq(budgetMonths.categoryId, categoryId)))
      .run();
    const row = rows.get(key);
    if (row) db.insert(budgetMonths).values(row).run();
  }
}
const monthAfter = (m: string) => {
  const i = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
};
/** What each month in `months` (consecutive up to next month, then sparse) can still assign.
 * A past month needs the money by its own end; the current and later months also keep every
 * later month's assignments funded. Like YNAB, overspending from the first checked month on
 * doesn't block assigning what Ready to Assign shows: its deduction in the following month is
 * added back, so that month starts negative until the overspending is covered. */
function assignable(months: string[], today: string) {
  const current = today.slice(0, 7);
  const result: { month: string; value: number; complete: boolean }[] = [];
  let deferred = 0;
  for (const m of months) {
    const end = monthBounds(m).to;
    const state = fundingState(end < today ? end : today, m);
    result.push({
      month: m,
      value:
        deferred +
        (m < current
          ? state.unassignedBeforeLater
          : state.unassignedBeforeLater - state.futureAssigned),
      complete: state.complete,
    });
    deferred += state.cashOverspent;
  }
  return result;
}

/** Runs an assignment change in one transaction, refusing it if any month it affects would
 * assign money that month doesn't have (or rates are missing): an inflow funds its own month
 * and later ones, never an earlier one. A shortfall that already existed may stay, but no
 * write may deepen it, except through overspending (see `assignable`). Shared by manual,
 * target and income writes. */
export function fundedWrite(action: () => void) {
  return db.transaction(() => {
    const before = assignmentRows();
    action();
    const after = assignmentRows();
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
      (k) => before.get(k)?.budgeted !== after.get(k)?.budgeted,
    );
    if (!changed.length) return;
    const today = todayIso();
    const current = today.slice(0, 7);
    // Every past month from the earliest change (activity differs each month), this month and
    // next (when this month's deficits reset), then only months holding assignments: with no
    // activity and nothing assigned, a later month's figure equals the month before it.
    const first = changed.map((k) => k.slice(0, 7)).reduce((a, b) => (b < a ? b : a));
    const months = new Set<string>();
    for (let m = first; m < current; m = monthAfter(m)) months.add(m);
    months.add(current).add(monthAfter(current));
    for (const k of [...before.keys(), ...after.keys()])
      if (k.slice(0, 7) > current) months.add(k.slice(0, 7));
    const checked = [...months].sort();
    const now = assignable(checked, today);
    if (now.every((p) => p.complete && p.value >= 0)) return;
    restoreRows(changed, before);
    const was = assignable(checked, today);
    restoreRows(changed, after);
    const worse = now.find((p, i) => p.value < was[i].value && (!p.complete || p.value < 0));
    if (worse)
      throw new BudgetError(
        worse.complete
          ? worse.month < current
            ? `Not enough money had arrived by the end of ${worse.month}. Assign it in a later month, or move existing money.`
            : 'Insufficient unassigned money. Reduce an assignment or move existing money.'
          : 'Add missing exchange rates before assigning money.',
      );
  });
}

/** A minimum on the flexibility reserve is a preference (phase 7B): taking it below the
 * minimum is allowed, with this notice in the preview. */
function reserveNotice(month: string, request: MoveRequest, today: string) {
  const minimum = db.select().from(financialPriorities).get()?.reserveMinimum;
  if (!minimum) return null;
  const flexible = new Set(
    db
      .select()
      .from(categoryPurposes)
      .all()
      .filter((p) => p.purpose === 'flexibility')
      .map((p) => p.categoryId),
  );
  if (!flexible.has(request.sourceId) || flexible.has(request.destinationId)) return null;
  const available = budgetGroups(today.slice(0, 7), today)
    .flatMap((g) => g.categories)
    .filter((c) => flexible.has(c.id))
    .reduce((s, c) => s + Math.max(0, c.balance), 0);
  const after = available - request.amount;
  return after < minimum
    ? { minimum, availableAfter: after, belowBy: minimum - after, month }
    : null;
}
export function undoMove(id: string) {
  return db.transaction(() => {
    const operation = db.select().from(budgetMoves).where(eq(budgetMoves.id, id)).get();
    if (!operation) throw new BudgetError('Money move not found', 404);
    if (operation.undone) throw new BudgetError('This move is already undone');
    if (operation.afterRevision !== fundingRevision())
      throw new BudgetError(
        'Your budget changed after this move. Move money again to adjust it safely.',
      );
    write(operation.month, operation.sourceId, operation.sourceBefore);
    write(operation.month, operation.destinationId, operation.destinationBefore);
    db.update(budgetMoves).set({ undone: 1 }).where(eq(budgetMoves.id, id)).run();
    return { id, undone: true };
  });
}
