import { Router } from 'express';
import { db } from '../db/index.js';
import { goals, categories, categoryGroups, cardFunding } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { isoDate } from '../utils/validation.js';

import { budgetGroups, fundingState } from '../services/budgetService.js';
import { todayIso } from '../services/mainAmountService.js';

export const goalsRouter = Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  targetAmount: z.number().int().min(0).max(1e13),
  currentAmount: z.number().int().min(-1e13).max(1e13).optional(),
  targetDate: isoDate.nullable().optional(),
  categoryId: z.string().min(1).max(64).nullable().optional(),
  accountId: z.string().max(64).nullable().optional(),
  icon: z.string().max(32).optional(),
  // Used in inline styles on the client
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

function present(rows: (typeof goals.$inferSelect)[]) {
  if (!rows.some((g) => g.categoryId)) return rows;
  const today = todayIso();
  const state = fundingState(today);
  const cats = budgetGroups(today.slice(0, 7), today).flatMap((g) => g.categories);
  return rows.map((g) => {
    if (!g.categoryId) return g;
    const cat = cats.find((c) => c.id === g.categoryId);
    return {
      ...g,
      categoryName: cat?.name,
      fundingComplete: state.complete,
      fundedAmount: state.complete ? Math.max(0, cat?.balance ?? 0) : null,
      assignedThisMonth: cat?.budgeted ?? 0,
      activity: cat?.activity ?? 0,
      available: state.complete ? (cat?.balance ?? 0) : null,
      asOf: today,
    };
  });
}

function linkageError(categoryId: string | null | undefined, id?: string) {
  if (!categoryId) return null;
  const cat = db.select().from(categories).where(eq(categories.id, categoryId)).get();
  const group =
    cat && db.select().from(categoryGroups).where(eq(categoryGroups.id, cat.groupId)).get();
  if (!group || group.isIncome) return 'Choose an expense category';
  if (db.select().from(cardFunding).where(eq(cardFunding.categoryId, categoryId)).get())
    return 'Card payment reserves cannot fund savings goals';
  const owner = db.select().from(goals).where(eq(goals.categoryId, categoryId)).get();
  return owner && owner.id !== id ? 'This category already funds another goal' : null;
}

goalsRouter.get('/', (_req, res) => {
  const rows = db.select().from(goals).orderBy(goals.sortOrder).all();
  res.json(present(rows));
});

goalsRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const error = linkageError(parsed.data.categoryId);
  if (error) return res.status(400).json({ error });
  if (parsed.data.categoryId && parsed.data.currentAmount !== undefined)
    return res.status(400).json({ error: 'Category-funded progress cannot be edited' });
  const now = new Date().toISOString();
  const row = {
    id: nanoid(),
    name: parsed.data.name,
    targetAmount: parsed.data.targetAmount,
    currentAmount: parsed.data.currentAmount ?? 0,
    targetDate: parsed.data.targetDate ?? null,
    accountId: parsed.data.accountId ?? null,
    categoryId: parsed.data.categoryId ?? null,
    icon: parsed.data.icon ?? '🎯',
    color: parsed.data.color ?? '#2563EB',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(goals).values(row).run();
  res.status(201).json(present([row])[0]);
});

goalsRouter.put('/:id', (req, res) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = db.select().from(goals).where(eq(goals.id, req.params.id)).get();
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const categoryId =
    parsed.data.categoryId === undefined ? existing.categoryId : parsed.data.categoryId;
  const error = linkageError(categoryId, existing.id);
  if (error) return res.status(400).json({ error });
  if (categoryId && parsed.data.currentAmount !== undefined)
    return res.status(400).json({ error: 'Category-funded progress cannot be edited' });
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (parsed.data.categoryId !== undefined) update.categoryId = parsed.data.categoryId;
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.targetAmount !== undefined) update.targetAmount = parsed.data.targetAmount;
  if (parsed.data.currentAmount !== undefined) update.currentAmount = parsed.data.currentAmount;
  if (parsed.data.targetDate !== undefined) update.targetDate = parsed.data.targetDate;
  if (parsed.data.accountId !== undefined) update.accountId = parsed.data.accountId;
  if (parsed.data.icon !== undefined) update.icon = parsed.data.icon;
  if (parsed.data.color !== undefined) update.color = parsed.data.color;

  db.update(goals).set(update).where(eq(goals.id, req.params.id)).run();
  const updated = db.select().from(goals).where(eq(goals.id, req.params.id)).get();
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(present([updated])[0]);
});

goalsRouter.delete('/:id', (req, res) => {
  db.delete(goals).where(eq(goals.id, req.params.id)).run();
  res.status(204).send();
});
