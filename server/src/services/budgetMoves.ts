import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { budgetMonths, budgetMoves } from '../db/schema.js';
import { budgetGroups, fundingRevision, fundingState } from './budgetService.js';
import { todayIso } from './mainAmountService.js';

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
  };
}
export function applyMove(month: string, request: MoveRequest, revision: string) {
  return db.transaction(() => {
    if (revision !== fundingRevision())
      throw new BudgetError('Your budget changed. Refresh the preview.');
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
  });
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
