import { Router } from 'express';
import { db } from '../db/index.js';
import {
  categories,
  categoryGroups,
  transactions,
  budgetMonths,
  cardFunding,
  payees,
  receiptLineItems,
  rules,
  schedules,
  incomeReviews,
} from '../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const categoriesRouter = Router();

const groupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  isIncome: z.number().int().min(0).max(1),
});

const categorySchema = z.object({
  groupId: z.string().max(64),
  name: z.string().trim().min(1).max(200),
  icon: z.string().max(32).optional(),
  budgetType: z.enum(['fixed', 'flexible', 'non_monthly', 'savings']).nullable().optional(),
  /** 1 tucks it away from pickers and the budget while it holds no money */
  hidden: z.union([z.literal(0), z.literal(1)]).optional(),
});

/** Per category: transactions (split parts included), the latest one, and whether money was ever assigned */
function categoryUsage() {
  const used = new Map(
    db
      .select({
        id: transactions.categoryId,
        count: sql<number>`count(*)`,
        lastDate: sql<string>`max(${transactions.date})`,
      })
      .from(transactions)
      .where(sql`${transactions.categoryId} is not null`)
      .groupBy(transactions.categoryId)
      .all()
      .map((r) => [r.id!, r]),
  );
  const assigned = new Set(
    db
      .select({ id: budgetMonths.categoryId })
      .from(budgetMonths)
      .where(sql`${budgetMonths.budgeted} != 0`)
      .all()
      .map((r) => r.id),
  );
  return (id: string) => ({
    transactionCount: used.get(id)?.count ?? 0,
    lastUsedDate: used.get(id)?.lastDate ?? null,
    everAssigned: assigned.has(id),
  });
}

categoriesRouter.get('/', (req, res) => {
  const groups = db.select().from(categoryGroups).orderBy(categoryGroups.sortOrder).all();
  const paymentIds = new Set(
    db
      .select()
      .from(cardFunding)
      .all()
      .map((m) => m.categoryId),
  );
  const cats = db
    .select()
    .from(categories)
    .orderBy(categories.sortOrder)
    .all()
    .filter((c) => !paymentIds.has(c.id));
  // ?usage=1 adds how much each category is used (for cleaning up, and for assistants)
  const usage = req.query.usage === '1' ? categoryUsage() : null;
  const result = groups.map((g) => ({
    ...g,
    categories: cats
      .filter((c) => c.groupId === g.id)
      .map((c) => (usage ? { ...c, ...usage(c.id) } : c)),
  }));
  res.json(result);
});

categoriesRouter.post('/groups', (req, res) => {
  const parsed = groupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const countRow = db
    .select({ count: sql<number>`count(*)` })
    .from(categoryGroups)
    .get();
  const group = {
    id: nanoid(),
    ...parsed.data,
    sortOrder: countRow?.count ?? 0,
    createdAt: new Date().toISOString(),
  };
  db.insert(categoryGroups).values(group).run();
  res.status(201).json({ ...group, categories: [] });
});

categoriesRouter.put('/groups/reorder', (req, res) => {
  const parsed = z.object({ ids: z.array(z.string()) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  for (let i = 0; i < parsed.data.ids.length; i++) {
    db.update(categoryGroups)
      .set({ sortOrder: i })
      .where(eq(categoryGroups.id, parsed.data.ids[i]))
      .run();
  }
  res.json({ ok: true });
});

function paymentCategory(id: string) {
  return !!db.select().from(cardFunding).where(eq(cardFunding.categoryId, id)).get();
}
function paymentGroup(id: string) {
  return db
    .select()
    .from(cardFunding)
    .all()
    .some(
      (m) =>
        db.select().from(categories).where(eq(categories.id, m.categoryId)).get()?.groupId === id,
    );
}
const managedError = { error: 'Payment envelopes are managed from Budget → Card payments' };

categoriesRouter.put('/groups/:id', (req, res) => {
  if (paymentGroup(req.params.id)) return res.status(409).json(managedError);
  const parsed = groupSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (Object.keys(parsed.data).length) {
    db.update(categoryGroups).set(parsed.data).where(eq(categoryGroups.id, req.params.id)).run();
  }
  const updated = db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.id, req.params.id))
    .get();
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

categoriesRouter.delete('/groups/:id', (req, res) => {
  if (paymentGroup(req.params.id)) return res.status(409).json(managedError);
  db.delete(categoryGroups).where(eq(categoryGroups.id, req.params.id)).run();
  res.status(204).send();
});

categoriesRouter.post('/', (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const countRow = db
    .select({ count: sql<number>`count(*)` })
    .from(categories)
    .where(eq(categories.groupId, parsed.data.groupId))
    .get();
  const category = {
    id: nanoid(),
    ...parsed.data,
    sortOrder: countRow?.count ?? 0,
    createdAt: new Date().toISOString(),
  };
  db.insert(categories).values(category).run();
  res.status(201).json(category);
});

categoriesRouter.put('/reorder', (req, res) => {
  const parsed = z.object({ ids: z.array(z.string()) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  for (let i = 0; i < parsed.data.ids.length; i++) {
    db.update(categories).set({ sortOrder: i }).where(eq(categories.id, parsed.data.ids[i])).run();
  }
  res.json({ ok: true });
});

categoriesRouter.put('/:id', (req, res) => {
  if (paymentCategory(req.params.id)) return res.status(409).json(managedError);
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (Object.keys(parsed.data).length) {
    db.update(categories).set(parsed.data).where(eq(categories.id, req.params.id)).run();
  }
  const updated = db.select().from(categories).where(eq(categories.id, req.params.id)).get();
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

/** Whether any month holds a non-zero assignment for the category */
function hasAssignments(id: string) {
  return !!db
    .select({ id: budgetMonths.id })
    .from(budgetMonths)
    .where(and(eq(budgetMonths.categoryId, id), sql`${budgetMonths.budgeted} != 0`))
    .get();
}

categoriesRouter.get('/:id/transaction-count', (req, res) => {
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(eq(transactions.categoryId, req.params.id))
    .get();
  // `count` is kept for older clients; `hasAssignments` says assigned money would move too
  res.json({ count: row?.count ?? 0, hasAssignments: hasAssignments(req.params.id) });
});

const isIncomeCategory = (id: string) =>
  db
    .select({ isIncome: categoryGroups.isIncome })
    .from(categories)
    .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(eq(categories.id, id))
    .get()?.isIncome === 1;

/** Re-point a rule's stored JSON from one category to another; null when nothing changed */
function repointRule(conditionsJson: string, actionsJson: string, from: string, to: string) {
  let changed = false;
  const swap = (v: unknown) => {
    if (v === from) {
      changed = true;
      return to;
    }
    return v;
  };
  const conditions = (JSON.parse(conditionsJson) as Record<string, unknown>[]).map((c) => {
    if (c.field !== 'category') return c;
    if (Array.isArray(c.value)) return { ...c, value: [...new Set(c.value.map(swap))] };
    return { ...c, value: swap(c.value) };
  });
  const actions = (JSON.parse(actionsJson) as Record<string, unknown>[]).map((a) => {
    if (a.type === 'set_category' || a.field === 'category_id')
      return { ...a, value: swap(a.value) };
    if (a.type === 'split' && Array.isArray(a.parts))
      return {
        ...a,
        parts: (a.parts as Record<string, unknown>[]).map((p) => ({
          ...p,
          categoryId: swap(p.categoryId),
        })),
      };
    return a;
  });
  return changed
    ? { conditions: JSON.stringify(conditions), actions: JSON.stringify(actions) }
    : null;
}

/**
 * Folds a category into another. Budget figures are a ledger (docs/ENVELOPE-FUNDING.md), so the
 * deleted category's assignments are added to the target for every month: the target then carries
 * the spending it inherits together with the money that funded it, and Ready to Assign in every
 * month is unchanged.
 */
function mergeCategory(from: string, to: string) {
  db.transaction(() => {
    for (const row of db
      .select()
      .from(budgetMonths)
      .where(eq(budgetMonths.categoryId, from))
      .all()) {
      if (row.budgeted === 0) continue;
      db.insert(budgetMonths)
        .values({ id: nanoid(), month: row.month, categoryId: to, budgeted: row.budgeted })
        .onConflictDoUpdate({
          target: [budgetMonths.month, budgetMonths.categoryId],
          set: { budgeted: sql`${budgetMonths.budgeted} + ${row.budgeted}` },
        })
        .run();
    }
    db.delete(budgetMonths).where(eq(budgetMonths.categoryId, from)).run();

    db.update(transactions).set({ categoryId: to }).where(eq(transactions.categoryId, from)).run();
    db.update(receiptLineItems)
      .set({ categoryId: to })
      .where(eq(receiptLineItems.categoryId, from))
      .run();
    db.update(schedules).set({ categoryId: to }).where(eq(schedules.categoryId, from)).run();
    db.update(payees)
      .set({ defaultCategoryId: to })
      .where(eq(payees.defaultCategoryId, from))
      .run();
    db.update(incomeReviews)
      .set({ categoryId: to })
      .where(eq(incomeReviews.categoryId, from))
      .run();
    for (const rule of db.select().from(rules).all()) {
      const next = repointRule(rule.conditions, rule.actions, from, to);
      if (next) db.update(rules).set(next).where(eq(rules.id, rule.id)).run();
    }

    db.delete(categories).where(eq(categories.id, from)).run();
  });
}

categoriesRouter.delete('/:id', (req, res) => {
  if (paymentCategory(req.params.id)) return res.status(409).json(managedError);
  const reassignTo = typeof req.query.reassignTo === 'string' ? req.query.reassignTo : undefined;

  if (reassignTo === req.params.id) return res.status(400).json({ error: 'Pick another category' });
  if (reassignTo) {
    if (!db.select().from(categories).where(eq(categories.id, reassignTo)).get())
      return res.status(400).json({ error: 'Unknown category' });
    if (paymentCategory(reassignTo))
      return res.status(400).json({ error: 'Pick a category that is not a card payment envelope' });
    if (isIncomeCategory(reassignTo) !== isIncomeCategory(req.params.id))
      return res.status(400).json({
        error: 'Move income categories into income, and expense categories into expenses',
      });
    mergeCategory(req.params.id, reassignTo);
    return res.status(204).send();
  }

  const used = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.categoryId, req.params.id))
    .get();
  if (used || hasAssignments(req.params.id))
    return res.status(409).json({
      error:
        'This category has transactions or assigned money. Choose a category to move them into (reassignTo).',
    });
  db.delete(categories).where(eq(categories.id, req.params.id)).run();
  res.status(204).send();
});
