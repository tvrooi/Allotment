import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import {
  cardContext,
  previewCardSetup,
  applyCardSetup,
  previewCardFunding,
  applyCardFunding,
} from '../services/creditFundingService.js';
import { isMonth } from '../utils/validation.js';
import { BudgetError } from '../services/budgetMoves.js';
export const creditFundingRouter = Router();
const schema = z.object({
  amount: z
    .number()
    .int()
    .min(-1e13)
    .max(1e13)
    .refine((v) => v !== 0)
    .optional(),
  revision: z.string().optional(),
});
creditFundingRouter.get('/', (req, res) => {
  const month = req.query.month;
  if (month !== undefined && (typeof month !== 'string' || !isMonth(month)))
    return res.status(400).json({ error: 'Expected a month as YYYY-MM' });
  res.json(cardContext(month as string | undefined));
});
for (const action of [
  'setup/preview',
  'setup/apply',
  'funding/preview',
  'funding/apply',
] as const) {
  creditFundingRouter.post(
    `/:accountId/${action}`,
    (req: Request, res: Response, next: NextFunction) => {
      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const accountId = String(req.params.accountId);
      try {
        if (action.startsWith('funding') && parsed.data.amount === undefined)
          throw new BudgetError('Enter a funding amount', 400);
        res.json(
          action === 'setup/preview'
            ? previewCardSetup(accountId)
            : action === 'setup/apply'
              ? applyCardSetup(accountId, parsed.data.revision ?? '')
              : action === 'funding/preview'
                ? previewCardFunding(accountId, parsed.data.amount!)
                : applyCardFunding(accountId, parsed.data.amount!, parsed.data.revision ?? ''),
        );
      } catch (error) {
        if (error instanceof BudgetError)
          return res.status(error.status).json({ error: error.message });
        next(error);
      }
    },
  );
}
