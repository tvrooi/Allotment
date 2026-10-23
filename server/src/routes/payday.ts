import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { paydayPlans, paydayFundingEvents } from '../db/schema.js';
import { dateInZone, paydayConfigSchema, paydayRequestSchema } from '../services/paydayConfig.js';
import {
  applyPayday,
  expenseCategories,
  incomeOptions,
  loadPlan,
  PaydayError,
  paydays,
  previewPayday,
  validateCategories,
} from '../services/paydayService.js';
import { addMonths, format, parseISO } from 'date-fns';

export const paydayRouter = Router();
// This router is mounted behind the same session/host/origin guards as the budget.
paydayRouter.get(
  '/',
  action((_req, res) => {
    res.json(
      db
        .select()
        .from(paydayPlans)
        .all()
        .map((p) => loadPlan(p.id)),
    );
  }),
);
paydayRouter.get('/categories', (_req, res) => res.json(expenseCategories()));
paydayRouter.post(
  '/',
  action((req, res) => {
    const config = paydayConfigSchema.parse(req.body);
    validateCategories(config);
    const id = nanoid();
    db.insert(paydayPlans)
      .values({ id, configJson: JSON.stringify(config) })
      .run();
    res.status(201).json(loadPlan(id));
  }),
);
paydayRouter.put(
  '/:id',
  action((req, res) => {
    loadPlan(req.params.id);
    const config = paydayConfigSchema.parse(req.body);
    validateCategories(config);
    db.update(paydayPlans)
      .set({ configJson: JSON.stringify(config) })
      .where(eq(paydayPlans.id, req.params.id))
      .run();
    res.json(loadPlan(req.params.id));
  }),
);
paydayRouter.post(
  '/:id/archive',
  action((req, res) => {
    loadPlan(req.params.id);
    db.update(paydayPlans).set({ archived: 1 }).where(eq(paydayPlans.id, req.params.id)).run();
    res.status(204).send();
  }),
);
paydayRouter.get(
  '/:id/context',
  action((req, res) => {
    const plan = loadPlan(req.params.id);
    const today = dateInZone(plan.timeZone);
    const from = format(addMonths(parseISO(today), -1), 'yyyy-MM-dd');
    const to = format(addMonths(parseISO(today), 12), 'yyyy-MM-dd');
    res.json({
      today,
      paydays: paydays(plan, from, to),
      income: incomeOptions(today),
      history: db
        .select()
        .from(paydayFundingEvents)
        .where(eq(paydayFundingEvents.planId, plan.id))
        .all()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  }),
);
paydayRouter.post(
  '/:id/preview',
  action((req, res) => {
    const request = paydayRequestSchema.parse(req.body);
    const preview = previewPayday(req.params.id, request);
    res.json({ ...preview, previewKey: JSON.stringify(preview) });
  }),
);
paydayRouter.post(
  '/:id/apply',
  action((req, res) => {
    const request = paydayRequestSchema
      .extend({ previewKey: z.string().max(250_000) })
      .parse(req.body);
    res.json(applyPayday(req.params.id, request, request.previewKey));
  }),
);

// Catch locally as well as in Express: the offline demo's router runs the same
// handlers and intentionally does not implement Express error middleware.
function action(handler: RequestHandler<{ id: string }>): RequestHandler<{ id: string }> {
  return (req, res, next) => {
    try {
      return handler(req, res, next);
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ error: error.issues.map((i) => i.message).join('; ') });
      if (error instanceof PaydayError)
        return res.status(error.status).json({ error: error.message });
      next(error);
    }
  };
}
