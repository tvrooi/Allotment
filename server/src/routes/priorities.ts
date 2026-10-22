import { Router } from 'express';
import { BudgetError } from '../services/budgetMoves.js';
import { prioritiesState, savePriorities } from '../services/resilienceService.js';
import { prioritiesSchema } from '../services/resilienceConfig.js';

// The optional financial priorities profile (phase 7A). Labels and preferences only: saving
// it never assigns money, reorders payday rules or changes a household share.
export const prioritiesRouter = Router();

prioritiesRouter.get('/', (_req, res) => res.json(prioritiesState()));
prioritiesRouter.put('/', (req, res, next) => {
  const parsed = prioritiesSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
  try {
    res.json(savePriorities(parsed.data));
  } catch (error) {
    if (error instanceof BudgetError)
      return res.status(error.status).json({ error: error.message });
    next(error);
  }
});
