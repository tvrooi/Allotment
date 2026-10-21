import { todayIso } from '../services/mainAmountService.js';
import { cardAccounts, previewCardSetup, applyCardSetup } from '../services/cardFundingSetup.js';
import { previewMove, applyMove, undoMove, BudgetError } from '../services/budgetMoves.js';
import {
  budgetGroups,
  budgetSummary,
  fundingRevision,
  fundingState,
} from '../services/budgetService.js';
import { Router } from 'express';
import { db } from '../db/index.js';
import {
  budgetMonths,
  budgetMoves,
  categories,
  categoryGroups,
  transactions,
} from '../db/schema.js';
import { eq, and, gte, lt, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { budgetActivity, mainAmount } from '../services/balances.js';
import { isMonth } from '../utils/validation.js';

export const budgetRouter = Router();

const cents = z.number().int().min(-1e13).max(1e13);
const upsertSchema = z.object({ budgeted: cents, revision: z.string().optional() });

// Every route here takes a YYYY-MM month
budgetRouter.param('month', (_req, res, next, month) => {
  if (!isMonth(month)) return res.status(400).json({ error: 'Expected a month as YYYY-MM' });
  next();
});

budgetRouter.get('/card-funding/accounts', (_req, res) =>
  res.json({ asOf: todayIso(), accounts: cardAccounts(), cards: fundingState().cards }),
);
const cardSetupSchema = z.object({
  initialFunding: z.number().int().min(0).max(1e13),
  revision: z.string().optional(),
});
for (const action of ['preview', 'apply'])
  budgetRouter.post(`/card-funding/:accountId/${action}`, (req, res, next) => {
    const parsed = cardSetupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      if (action === 'apply' && !parsed.data.revision)
        return res.status(400).json({ error: 'Preview this setup before applying' });
      res.json(
        action === 'preview'
          ? previewCardSetup(req.params.accountId, parsed.data.initialFunding)
          : applyCardSetup(req.params.accountId, parsed.data.initialFunding, parsed.data.revision!),
      );
    } catch (error) {
      if (error instanceof BudgetError)
        return res.status(error.status).json({ error: error.message });
      next(error);
    }
  });

budgetRouter.get('/:month', (req, res) => res.json(budgetGroups(req.params.month)));

// Existing overcommitments survive; new reservations require existing resources.
function fundedWrite(action: () => void) {
  return db.transaction(() => {
    const before = fundingState();
    action();
    const after = fundingState();
    if (after.reserved > before.reserved && (!after.complete || after.unassigned < 0))
      throw new BudgetError(
        after.complete
          ? 'Insufficient unassigned money. Reduce an assignment or move existing money.'
          : 'Add missing exchange rates before assigning money.',
      );
  });
}
budgetRouter.put('/:month/:categoryId', (req, res, next) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { month, categoryId } = req.params;
  if (!db.select().from(categories).where(eq(categories.id, categoryId)).get())
    return res.status(404).json({ error: 'Category not found' });
  try {
    let previousBudgeted = 0;
    fundedWrite(() => {
      previousBudgeted =
        db
          .select()
          .from(budgetMonths)
          .where(and(eq(budgetMonths.month, month), eq(budgetMonths.categoryId, categoryId)))
          .get()?.budgeted ?? 0;
      if (parsed.data.revision && parsed.data.revision !== fundingRevision())
        throw new BudgetError('Your budget changed. Refresh before editing.');
      db.insert(budgetMonths)
        .values({ id: nanoid(), month, categoryId, budgeted: parsed.data.budgeted })
        .onConflictDoUpdate({
          target: [budgetMonths.month, budgetMonths.categoryId],
          set: { budgeted: parsed.data.budgeted },
        })
        .run();
    });
    res.json({
      month,
      categoryId,
      budgeted: parsed.data.budgeted,
      previousBudgeted,
      revision: fundingRevision(),
    });
  } catch (error) {
    if (error instanceof BudgetError)
      return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

const historyQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional().default(6),
  currentMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

budgetRouter.get('/category/:categoryId/history', (req, res) => {
  const parsed = historyQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { categoryId } = req.params;
  const { months } = parsed.data;

  const now = new Date();
  const currentMonth =
    parsed.data.currentMonth ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const cat = db.select().from(categories).where(eq(categories.id, categoryId)).get();
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  const group = db.select().from(categoryGroups).where(eq(categoryGroups.id, cat.groupId)).get();
  const isIncome = group?.isIncome === 1;

  const endYear = parseInt(currentMonth.slice(0, 4));
  const endMon = parseInt(currentMonth.slice(5, 7)) + 1;
  const adjEndYear = endYear + Math.floor((endMon - 1) / 12);
  const adjEndMonth = ((((endMon - 1) % 12) + 12) % 12) + 1;
  const endDate = `${adjEndYear}-${String(adjEndMonth).padStart(2, '0')}-01`;

  const startYear = parseInt(currentMonth.slice(0, 4));
  const startMon = parseInt(currentMonth.slice(5, 7)) - months + 1;
  const adjustedYear = startYear + Math.floor((startMon - 1) / 12);
  const adjustedMonth = ((((startMon - 1) % 12) + 12) % 12) + 1;
  const startDate = `${adjustedYear}-${String(adjustedMonth).padStart(2, '0')}-01`;

  const amountExpr = isIncome
    ? sql<number>`coalesce(sum(max(${mainAmount}, 0)), 0)`
    : sql<number>`coalesce(sum(abs(min(${mainAmount}, 0))), 0)`;

  const rows = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${transactions.date})`,
      amount: amountExpr,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.categoryId, categoryId),
        gte(transactions.date, startDate),
        lt(transactions.date, endDate),
        budgetActivity,
      ),
    )
    .groupBy(sql`strftime('%Y-%m', ${transactions.date})`)
    .orderBy(sql`strftime('%Y-%m', ${transactions.date})`)
    .all();

  const rowMap = Object.fromEntries(rows.map((r) => [r.month, r.amount]));
  const history: { month: string; amount: number }[] = [];
  let y = adjustedYear;
  let m = adjustedMonth;
  for (let i = 0; i < months; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    history.push({ month: key, amount: rowMap[key] ?? 0 });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  const total = history.reduce((s, h) => s + h.amount, 0);
  const nonZeroCount = history.filter((h) => h.amount > 0).length;
  const average = nonZeroCount > 0 ? Math.round(total / nonZeroCount) : 0;
  const lastMonthKey = history.length >= 2 ? history[history.length - 2]?.month : undefined;
  const lastMonth = lastMonthKey ? (rowMap[lastMonthKey] ?? 0) : 0;

  res.json({ categoryId, isIncome, lastMonth, average, history });
});

const bulkSchema = z.object({
  budgeted: cents,
  fromMonth: z.string().refine(isMonth),
});

budgetRouter.put('/category/:categoryId/bulk', (req, res, next) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { categoryId } = req.params;
  const { budgeted, fromMonth } = parsed.data;

  let y = parseInt(fromMonth.slice(0, 4));
  let m = parseInt(fromMonth.slice(5, 7));
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  try {
    fundedWrite(() => {
      for (const month of months) {
        const existing = db
          .select()
          .from(budgetMonths)
          .where(and(eq(budgetMonths.month, month), eq(budgetMonths.categoryId, categoryId)))
          .get();

        if (existing) {
          db.update(budgetMonths).set({ budgeted }).where(eq(budgetMonths.id, existing.id)).run();
        } else {
          db.insert(budgetMonths)
            .values({
              id: nanoid(),
              month,
              categoryId,
              budgeted,
              notes: null,
            })
            .run();
        }
      }
    });
  } catch (error) {
    if (error instanceof BudgetError)
      return res.status(error.status).json({ error: error.message });
    return next(error);
  }
  res.json({ categoryId, budgeted, months });
});

budgetRouter.get('/:month/summary', (req, res) => res.json(budgetSummary(req.params.month)));

const moveSchema = z.object({
  sourceId: z.string().min(1),
  destinationId: z.string().min(1),
  amount: cents.positive(),
  revision: z.string().optional(),
});
function moveHandler(action: 'preview' | 'apply') {
  return (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    const parsed = moveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      res.json(
        action === 'preview'
          ? previewMove(String(req.params.month), parsed.data)
          : applyMove(String(req.params.month), parsed.data, parsed.data.revision ?? ''),
      );
    } catch (error) {
      if (error instanceof BudgetError)
        return res.status(error.status).json({ error: error.message });
      next(error);
    }
  };
}
budgetRouter.post('/:month/moves/preview', moveHandler('preview'));
budgetRouter.post('/:month/moves', moveHandler('apply'));
budgetRouter.get('/moves/history', (_req, res) =>
  res.json(
    db
      .select()
      .from(budgetMoves)
      .orderBy(sql`${budgetMoves.createdAt} desc`)
      .limit(100)
      .all(),
  ),
);
budgetRouter.post('/moves/:id/undo', (req, res, next) => {
  try {
    res.json(undoMove(req.params.id));
  } catch (error) {
    if (error instanceof BudgetError)
      return res.status(error.status).json({ error: error.message });
    next(error);
  }
});
