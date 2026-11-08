import { Router, type Response } from 'express';
import { z } from 'zod';
import { currencySchema, isoDate } from '../utils/validation.js';
import { InvestmentError } from '../services/investmentError.js';
import {
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
import { previewSale } from '../services/investmentSales.js';
import {
  recordIncome,
  recordSale,
  removeIncome,
  removeSale,
  setCarriedInLosses,
  updateIncome,
  updateSale,
} from '../services/investmentTax.js';
import {
  depositSuggestions,
  investmentForTransaction,
  linkDeposit,
} from '../services/investmentLinks.js';
import { INCOME_KINDS } from '../services/investmentIncome.js';

// P3 investments (services/investmentService.ts), D3a sales and D3b income
// (services/investmentTax.ts). Positions only: nothing here writes to the ledger, so no route
// changes an account's balance. Owner session only, except that an organise token may read the
// overview (GET /, auth/accessTokens.ts); no token reaches any other route here.

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

// ─── Sales (D3a) ──────────────────────────────────────────────────────────────

const sale = z
  .object({
    soldOn: isoDate,
    quantity: lotQuantity,
    proceeds: money,
    fees: money,
    /** Omitted: first in, first out */
    parcels: z
      .array(z.object({ lotId: id, quantity: lotQuantity }).strict())
      .max(500)
      .optional(),
    notes: notes.optional(),
  })
  .strict();

investmentsRouter.post('/holdings/:id/sales/preview', (req, res) => {
  const data = parse(sale.extend({ saleId: id.optional() }), req.body, res);
  if (data) {
    const { saleId, ...input } = data;
    send(res, () => previewSale(req.params.id, input, saleId));
  }
});

investmentsRouter.post('/holdings/:id/sales', (req, res) => {
  const data = parse(sale, req.body, res);
  if (data) send(res, () => recordSale(req.params.id, data), 201);
});

investmentsRouter.put('/holdings/:id/sales/:saleId', (req, res) => {
  const data = parse(sale, req.body, res);
  if (data) send(res, () => updateSale(req.params.id, req.params.saleId, data));
});

investmentsRouter.delete('/holdings/:id/sales/:saleId', (req, res) =>
  send(res, () => removeSale(req.params.id, req.params.saleId)),
);

// Net capital losses from years before Allotment's records, carried into one financial year
investmentsRouter.put('/carried-losses', (req, res) => {
  const data = parse(
    z
      .object({
        financialYear: z.number().int().min(2000).max(2200).nullable(),
        amount: money,
      })
      .strict(),
    req.body,
    res,
  );
  if (data) send(res, () => setCarriedInLosses(data.financialYear, data.amount));
});

// ─── Income (D3b) ─────────────────────────────────────────────────────────────

const payment = z
  .object({
    paidOn: isoDate,
    kind: z.enum(INCOME_KINDS),
    amount: money,
    unfranked: money,
    franked: money,
    frankingCredit: money,
    withheld: money,
    reinvested: z.object({ quantity: lotQuantity, cost: money }).strict().nullable().optional(),
    notes: notes.optional(),
  })
  .strict();

investmentsRouter.post('/holdings/:id/income', (req, res) => {
  const data = parse(payment, req.body, res);
  if (data) send(res, () => recordIncome(req.params.id, data), 201);
});

investmentsRouter.put('/holdings/:id/income/:incomeId', (req, res) => {
  const data = parse(payment, req.body, res);
  if (data) send(res, () => updateIncome(req.params.id, req.params.incomeId, data));
});

investmentsRouter.delete('/holdings/:id/income/:incomeId', (req, res) =>
  send(res, () => removeIncome(req.params.id, req.params.incomeId)),
);

// ─── Deposits in the register (D3b) ───────────────────────────────────────────

const linkedKind = z.enum(['sales', 'income']);
const kindOf = (segment: 'sales' | 'income') => (segment === 'sales' ? 'sale' : 'income');

investmentsRouter.get('/holdings/:id/:kind/:rowId/deposits', (req, res) => {
  const kind = linkedKind.safeParse(req.params.kind);
  if (!kind.success) return res.status(404).json({ error: 'Not found' });
  send(res, () => depositSuggestions(kindOf(kind.data), req.params.id, req.params.rowId));
});

investmentsRouter.put('/holdings/:id/:kind/:rowId/transaction', (req, res) => {
  const kind = linkedKind.safeParse(req.params.kind);
  if (!kind.success) return res.status(404).json({ error: 'Not found' });
  const data = parse(z.object({ transactionId: id.nullable() }).strict(), req.body, res);
  if (data)
    send(res, () =>
      linkDeposit(kindOf(kind.data), req.params.id, req.params.rowId, data.transactionId),
    );
});

// The sale or payment a register row is the deposit of, for the transaction panel
investmentsRouter.get('/transactions/:transactionId', (req, res) =>
  res.json(investmentForTransaction(req.params.transactionId)),
);
