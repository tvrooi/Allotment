import { Router, type Response } from 'express';
import { z } from 'zod';
import { currencySchema, isoDate } from '../utils/validation.js';
import {
  InvestmentError,
  SECURITY_KINDS,
  addLot,
  createHolding,
  createSecurity,
  deleteHolding,
  deleteLot,
  deletePrice,
  deleteSecurity,
  investmentOverview,
  listPrices,
  setPrice,
  updateHolding,
  updateLot,
  updateSecurity,
} from '../services/investmentService.js';

// P3 investments (services/investmentService.ts). Positions only: nothing here writes to the
// ledger, so no route changes an account's balance.

export const investmentsRouter = Router();

const id = z.string().min(1).max(64);
const symbol = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9.\-:^/]+$/, 'Use letters, digits and . - : / ^');
const securityName = z.string().trim().min(1).max(120);
const kind = z.enum(SECURITY_KINDS);
/** Millionths of a unit: up to a trillion units */
const quantity = z
  .number()
  .int()
  .min(0)
  .max(1e18 / 1e3);
const lotQuantity = quantity.min(1);
/** Minor units */
const money = z.number().int().min(0).max(1e15);
const notes = z.string().max(500).nullable();

function send(res: Response, run: () => unknown, status = 200) {
  try {
    const body = run();
    return body === undefined ? res.status(204).end() : res.status(status).json(body);
  } catch (error) {
    if (error instanceof InvestmentError) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
}

function parse<T extends z.ZodType>(schema: T, body: unknown, res: Response): z.infer<T> | null {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  res.status(400).json({ error: parsed.error.flatten() });
  return null;
}

investmentsRouter.get('/', (req, res) => {
  const asOf = req.query.asOf === undefined ? undefined : isoDate.safeParse(req.query.asOf);
  if (asOf && !asOf.success) return res.status(400).json({ error: 'Expected asOf as YYYY-MM-DD' });
  res.json(investmentOverview(asOf?.data));
});

investmentsRouter.post('/securities', (req, res) => {
  const data = parse(
    z.object({ symbol, name: securityName, kind: kind.default('other'), currency: currencySchema }),
    req.body,
    res,
  );
  if (data) send(res, () => createSecurity(data), 201);
});

investmentsRouter.put('/securities/:id', (req, res) => {
  const data = parse(
    z.object({ symbol, name: securityName, kind, currency: currencySchema }).partial(),
    req.body,
    res,
  );
  if (data) send(res, () => updateSecurity(req.params.id, data));
});

investmentsRouter.delete('/securities/:id', (req, res) =>
  send(res, () => deleteSecurity(req.params.id)),
);

investmentsRouter.get('/securities/:id/prices', (req, res) =>
  send(res, () => listPrices(req.params.id)),
);

investmentsRouter.put('/securities/:id/prices', (req, res) => {
  const data = parse(z.object({ date: isoDate, price: money }), req.body, res);
  if (data) send(res, () => setPrice(req.params.id, data.date, data.price));
});

investmentsRouter.delete('/securities/:id/prices/:date', (req, res) =>
  send(res, () => deletePrice(req.params.id, req.params.date)),
);

investmentsRouter.post('/holdings', (req, res) => {
  const data = parse(
    z.object({ accountId: id, securityId: id, quantity, notes: notes.optional() }),
    req.body,
    res,
  );
  if (data) send(res, () => createHolding(data), 201);
});

investmentsRouter.put('/holdings/:id', (req, res) => {
  const data = parse(z.object({ quantity, notes }).partial(), req.body, res);
  if (data) send(res, () => updateHolding(req.params.id, data));
});

investmentsRouter.delete('/holdings/:id', (req, res) =>
  send(res, () => deleteHolding(req.params.id)),
);

investmentsRouter.post('/holdings/:id/lots', (req, res) => {
  const data = parse(
    z.object({ acquiredOn: isoDate, quantity: lotQuantity, costBasis: money.nullable() }),
    req.body,
    res,
  );
  if (data) send(res, () => addLot(req.params.id, data), 201);
});

investmentsRouter.put('/lots/:id', (req, res) => {
  const data = parse(
    z.object({ acquiredOn: isoDate, quantity: lotQuantity, costBasis: money.nullable() }).partial(),
    req.body,
    res,
  );
  if (data) send(res, () => updateLot(req.params.id, data));
});

investmentsRouter.delete('/lots/:id', (req, res) => send(res, () => deleteLot(req.params.id)));
