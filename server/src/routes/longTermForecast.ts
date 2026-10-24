import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ForecastError } from '../services/forecastService.js';
import { compareResults, inTodaysDollars } from '../services/longTermCompare.js';
import {
  ACCOUNT_CLASSES,
  DEFAULT_CLASS_GROWTH_BPS,
  defaultSettings,
  MAX_EVENTS,
  MAX_PLANS,
  planSchema,
} from '../services/longTermConfig.js';
import { LongTermForecastError } from '../services/longTermForecast.js';
import { runPlan, startingPoint } from '../services/longTermInputs.js';
import {
  createPlan,
  deletePlan,
  duplicatePlan,
  getPlan,
  listPlans,
  PlanConflict,
  updatePlan,
} from '../services/longTermPlans.js';
import {
  deleteLoanDetails,
  listLoanDetails,
  loanDetailsSchema,
  setLoanDetails,
} from '../services/loanDetails.js';

// Long-term forecast (docs/LONG-TERM-FORECAST.md). Mounted at /api/forecast/long-term. Plans
// and results are read with GET, so a read-only token can reach them; every write below is a
// POST, PUT or DELETE and is refused for a token. Nothing here writes to the ledger.
export const longTermRouter = Router();

const version = z.number().int().min(1);
const nameBody = z.object({ name: planSchema.shape.name });

longTermRouter.get(
  '/defaults',
  action((req, res) => {
    const birthYear = z.coerce
      .number()
      .int()
      .min(1900)
      .max(2100)
      .default(1985)
      .parse(req.query.birthYear);
    res.json({
      settings: defaultSettings(birthYear),
      classGrowthBps: DEFAULT_CLASS_GROWTH_BPS,
      classes: ACCOUNT_CLASSES,
      limits: { plans: MAX_PLANS, events: MAX_EVENTS },
    });
  }),
);

longTermRouter.get(
  '/starting-point',
  action((_req, res) => {
    res.json(startingPoint());
  }),
);

longTermRouter.get(
  '/plans',
  action((_req, res) => {
    res.json(listPlans());
  }),
);

longTermRouter.post(
  '/plans',
  action((req, res) => {
    const { plan } = z.object({ plan: planSchema }).parse(req.body ?? {});
    res.status(201).json(createPlan(plan));
  }),
);

longTermRouter.get(
  '/plans/:id',
  action((req, res) => {
    res.json(getPlan(String(req.params.id)));
  }),
);

longTermRouter.put(
  '/plans/:id',
  action((req, res) => {
    const { plan, expectedVersion } = z
      .object({ plan: planSchema, expectedVersion: version })
      .parse(req.body ?? {});
    res.json(updatePlan(String(req.params.id), plan, expectedVersion));
  }),
);

longTermRouter.delete(
  '/plans/:id',
  action((req, res) => {
    const expectedVersion = version.parse(Number(req.query.expectedVersion));
    deletePlan(String(req.params.id), expectedVersion);
    res.status(204).end();
  }),
);

longTermRouter.post(
  '/plans/:id/duplicate',
  action((req, res) => {
    const { name } = nameBody.parse(req.body ?? {});
    res.status(201).json(duplicatePlan(String(req.params.id), name));
  }),
);

longTermRouter.get(
  '/plans/:id/result',
  action((req, res) => {
    const view = z.enum(['full', 'summary']).default('full').parse(req.query.view);
    const saved = getPlan(String(req.params.id));
    const result = runPlan(saved.plan);
    const head = { id: saved.id, version: saved.version, name: saved.plan.name };
    if (view === 'full') return res.json({ ...head, ...result });
    // A compact series for readers with limited room (the MCP tool): one row per year
    const { years, ...rest } = result;
    res.json({
      ...head,
      ...rest,
      years: years.map((y) => ({
        index: y.index,
        calendarYear: y.calendarYear,
        age: y.age,
        closingNetWorth: y.closingNetWorth,
        income: y.income.reduce((sum, r) => sum + r.amount, 0) + y.agePension,
        spending: y.spending,
        netCashFlow: y.netCashFlow,
        loanPayments: y.loanPayments,
        superNet: y.superNet,
        growthTotal: y.growthTotal,
        unfundedBalance: y.unfundedBalance,
      })),
    });
  }),
);

// One starting point for both plans, so a difference is only ever the plans' own
longTermRouter.get(
  '/plans/:id/compare',
  action((req, res) => {
    const referenceId = z.string().min(1).max(64).parse(req.query.reference);
    const dollars = z.enum(['future', 'today']).default('future').parse(req.query.dollars);
    const active = getPlan(String(req.params.id));
    const reference = getPlan(referenceId);
    const point = startingPoint();
    const a = runPlan(active.plan, point);
    const r = runPlan(reference.plan, point);
    res.json({
      active: { id: active.id, version: active.version, name: active.plan.name },
      reference: { id: reference.id, version: reference.version, name: reference.plan.name },
      dollars,
      ...compareResults(
        dollars === 'today' ? inTodaysDollars({ ...a, result: a }) : { ...a, result: a },
        dollars === 'today' ? inTodaysDollars({ ...r, result: r }) : { ...r, result: r },
      ),
    });
  }),
);

longTermRouter.get(
  '/loans',
  action((_req, res) => {
    res.json(listLoanDetails());
  }),
);

longTermRouter.put(
  '/loans/:accountId',
  action((req, res) => {
    res.json(setLoanDetails(String(req.params.accountId), loanDetailsSchema.parse(req.body ?? {})));
  }),
);

longTermRouter.delete(
  '/loans/:accountId',
  action((req, res) => {
    deleteLoanDetails(String(req.params.accountId));
    res.status(204).end();
  }),
);

// Catch locally as well as in Express: the offline demo's router has no error middleware.
function action(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      return handler(req, res, next);
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ error: error.issues.map((i) => i.message).join('; ') });
      if (error instanceof PlanConflict)
        return res.status(409).json({ error: error.message, current: error.current });
      if (error instanceof ForecastError)
        return res.status(error.status).json({ error: error.message });
      if (error instanceof LongTermForecastError)
        return res.status(422).json({ error: error.message });
      next(error);
    }
  };
}
