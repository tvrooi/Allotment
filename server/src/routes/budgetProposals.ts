import { Router, type Response } from 'express';
import { z } from 'zod';
import { BudgetError } from '../services/budgetMoves.js';
import {
  applyProposal,
  createProposal,
  dismissProposal,
  listProposals,
} from '../services/budgetProposals.js';

// Assignment suggestions (services/budgetProposals.ts). An organise token may list and create
// them (auth/accessTokens.ts); applying and dismissing need the owner's session.

export const budgetProposalsRouter = Router();

const rowSchema = z.object({
  categoryId: z.string().min(1).max(64),
  amount: z.number().int().positive().max(100_000_000_00),
  reason: z.string().trim().max(300).optional(),
});
const createSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  note: z.string().trim().max(1000).optional(),
  rows: z.array(rowSchema).min(1).max(100),
});

function answer(res: Response, action: () => unknown) {
  try {
    res.json(action());
  } catch (error) {
    if (!(error instanceof BudgetError)) throw error;
    res.status(error.status).json({ error: error.message });
  }
}

budgetProposalsRouter.get('/', (req, res) =>
  res.json(listProposals(req.query.status === 'all' ? undefined : 'open')),
);

budgetProposalsRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tokenId =
    typeof res.locals.accessTokenId === 'string' ? res.locals.accessTokenId : undefined;
  answer(res.status(201), () => createProposal(parsed.data, tokenId));
});

budgetProposalsRouter.post('/:id/apply', (req, res) =>
  answer(res, () => applyProposal(req.params.id)),
);
budgetProposalsRouter.post('/:id/dismiss', (req, res) =>
  answer(res, () => dismissProposal(req.params.id)),
);
