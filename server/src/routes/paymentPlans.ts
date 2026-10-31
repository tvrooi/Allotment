import { Router, type Response } from 'express';
import { z } from 'zod';
import { isoDate } from '../utils/validation.js';
import {
  FREQUENCIES,
  PROVIDER_IDS,
  PlanError,
  createPlan,
  createPlanAccount,
  deletePlan,
  dismissMatch,
  findPaymentMatches,
  getPlanView,
  historyGroups,
  linkPayment,
  listPlans,
  planForTransaction,
  recordFee,
  recordRefund,
  unlinkPayment,
  updatePlan,
  type Provider,
} from '../services/paymentPlanService.js';

// Buy now, pay later plans (docs/PAYMENT-PLANS.md); the logic is in paymentPlanService.ts.

export const paymentPlansRouter = Router();

const id = z.string().min(1).max(64);
const money = z.number().int().positive().max(1e12);
const provider = z.enum(PROVIDER_IDS as [Provider, ...Provider[]]);

function run(res: Response, action: () => unknown, status = 200) {
  try {
    const result = action();
    if (result === undefined) return res.status(204).end();
    res.status(status).json(result);
  } catch (error) {
    if (error instanceof PlanError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
}

function invalid(res: Response, error: z.ZodError) {
  return res.status(400).json({ error: error.flatten() });
}

// GET /payment-plans — every plan with its instalments
paymentPlansRouter.get('/', (_req, res) => {
  res.json(listPlans());
});

// GET /payment-plans/matches — bank payments that look like an instalment, to confirm
paymentPlansRouter.get('/matches', (_req, res) => {
  res.json(findPaymentMatches());
});

// GET /payment-plans/history?provider=afterpay&months=12 — earlier payments grouped into
// likely plans, to record each as the purchase it paid for
paymentPlansRouter.get('/history', (req, res) => {
  const parsed = z
    .object({
      provider: provider.default('afterpay'),
      months: z.coerce.number().int().min(1).max(60).default(12),
    })
    .safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);
  res.json(historyGroups(parsed.data.provider, parsed.data.months));
});

// GET /payment-plans/for-transaction/:id — the plan a purchase or payment belongs to
paymentPlansRouter.get('/for-transaction/:id', (req, res) => {
  res.json(planForTransaction(req.params.id));
});

// POST /payment-plans/account — a new Afterpay-style account with payment funding
paymentPlansRouter.post('/account', (req, res) => {
  const parsed = z
    .object({ provider: provider.default('afterpay'), name: z.string().max(100).optional() })
    .safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  run(res, () => createPlanAccount(parsed.data), 201);
});

const createSchema = z.object({
  accountId: id,
  fundingAccountId: id,
  provider: provider.default('afterpay'),
  merchant: z.string().min(1).max(200),
  purchaseDate: isoDate,
  total: money,
  categoryId: id.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  instalmentCount: z.number().int().min(1).max(60),
  frequency: z.enum(FREQUENCIES).default('fortnightly'),
  firstDueDate: isoDate,
  linkTransactionIds: z.array(id).max(60).optional(),
});

// POST /payment-plans — a purchase made with a payment plan
paymentPlansRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  run(res, () => createPlan(parsed.data), 201);
});

// GET /payment-plans/:id
paymentPlansRouter.get('/:id', (req, res) => {
  run(res, () => getPlanView(req.params.id));
});

// PUT /payment-plans/:id — merchant, and dates/amounts of instalments still to pay
paymentPlansRouter.put('/:id', (req, res) => {
  const parsed = z
    .object({
      merchant: z.string().min(1).max(200).optional(),
      instalments: z
        .array(
          z.object({
            id,
            dueDate: isoDate.optional(),
            amount: z.number().int().min(0).max(1e12).optional(),
          }),
        )
        .max(60)
        .optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  run(res, () => updatePlan(req.params.id, parsed.data));
});

// DELETE /payment-plans/:id — removes the plan and what it added; bank rows stay
paymentPlansRouter.delete('/:id', (req, res) => {
  run(res, () => deletePlan(req.params.id));
});

// POST /payment-plans/:id/link — confirm a bank payment as this plan's instalment(s)
paymentPlansRouter.post('/:id/link', (req, res) => {
  const parsed = z
    .object({ transactionId: id, instalmentIds: z.array(id).max(60).optional() })
    .safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  run(res, () => linkPayment(req.params.id, parsed.data.transactionId, parsed.data.instalmentIds));
});

// POST /payment-plans/:id/instalments/:instalmentId/unlink — undo a confirmed payment
paymentPlansRouter.post('/:id/instalments/:instalmentId/unlink', (req, res) => {
  run(res, () => unlinkPayment(req.params.id, req.params.instalmentId));
});

// POST /payment-plans/dismiss — "Not this payment"
paymentPlansRouter.post('/dismiss', (req, res) => {
  const parsed = z.object({ instalmentId: id, transactionId: id }).safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  run(res, () => dismissMatch(parsed.data.instalmentId, parsed.data.transactionId));
});

const adjustment = z.object({
  date: isoDate,
  amount: money,
  categoryId: id.nullable().optional(),
});

// POST /payment-plans/:id/refund
paymentPlansRouter.post('/:id/refund', (req, res) => {
  const parsed = adjustment.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  run(res, () => recordRefund(req.params.id, parsed.data));
});

// POST /payment-plans/:id/fee — a late fee, added to the next instalment
paymentPlansRouter.post('/:id/fee', (req, res) => {
  const parsed = adjustment.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  run(res, () => recordFee(req.params.id, parsed.data));
});
