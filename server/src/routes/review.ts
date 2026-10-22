import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import { bufferState, guideState, reviewState } from '../services/reviewService.js';
import { BudgetError } from '../services/budgetMoves.js';
import {
  applyIncomeReview,
  completeReview,
  incomeCandidates,
  previewIncomeReview,
  resilienceState,
  resumeState,
  snoozeReminder,
} from '../services/resilienceService.js';
import { incomeReviewSchema, snoozeSchema } from '../services/resilienceConfig.js';

export const reviewRouter = Router();
// Read-only: the review, buffer and guided setup only describe the shared funding figures.
reviewRouter.get('/', (_req, res) => res.json(reviewState()));
reviewRouter.get('/buffer', (_req, res) => res.json(bufferState()));
reviewRouter.get('/guide', (_req, res) => res.json(guideState()));

// Phase 7. The resilience and resume views are read-only. Completing a review stores only
// what it saw; snoozing stores a date; the income split is previewed and applied once.
reviewRouter.get('/resilience', (_req, res) => res.json(resilienceState()));
reviewRouter.get('/resume', (_req, res) => res.json(resumeState()));
reviewRouter.post('/complete', (_req, res) => res.json(completeReview()));
reviewRouter.post('/snooze', (req, res) => {
  const parsed = snoozeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a date, or none' });
  res.json(snoozeReminder(parsed.data.until));
});
reviewRouter.get('/income', (_req, res) => res.json(incomeCandidates()));
reviewRouter.post('/income/preview', (req, res, next) => {
  const parsed = incomeReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a deposit and a split' });
  handle(res, next, () => previewIncomeReview(parsed.data));
});
reviewRouter.post('/income/apply', (req, res, next) => {
  const parsed = incomeReviewSchema
    .extend({ revision: z.string().min(1).max(200), proposed: z.number().int().min(0) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Preview the split first' });
  const { revision, proposed, ...input } = parsed.data;
  handle(res, next, () => applyIncomeReview(input, { revision, proposed }));
});

function handle(res: Response, next: NextFunction, action: () => unknown) {
  try {
    res.json(action());
  } catch (error) {
    if (error instanceof BudgetError)
      return res.status(error.status).json({ error: error.message });
    next(error);
  }
}
