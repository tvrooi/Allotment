import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { forecastRequestSchema, scenarioSchema } from '../services/forecastConfig.js';
import { buildForecast, ForecastError } from '../services/forecastService.js';
import {
  createSavedScenario,
  deleteSavedScenario,
  listSavedScenarios,
  ScenarioConflict,
  updateSavedScenario,
} from '../services/forecastScenarios.js';

export const forecastRouter = Router();
// Read-only: POST only carries the scenario assumptions. Nothing is stored or allocated.
forecastRouter.post(
  '/',
  action((req, res) => {
    res.json(buildForecast(forecastRequestSchema.parse(req.body ?? {})));
  }),
);

// Saved scenarios: assumptions only. A save or delete names the version it started from.
const version = z.number().int().min(1);

forecastRouter.get(
  '/scenarios',
  action((_req, res) => {
    res.json(listSavedScenarios());
  }),
);

forecastRouter.post(
  '/scenarios',
  action((req, res) => {
    const { scenario } = z.object({ scenario: scenarioSchema }).parse(req.body ?? {});
    res.status(201).json(createSavedScenario(scenario));
  }),
);

forecastRouter.put(
  '/scenarios/:id',
  action((req, res) => {
    const { scenario, expectedVersion } = z
      .object({ scenario: scenarioSchema, expectedVersion: version })
      .parse(req.body ?? {});
    res.json(updateSavedScenario(String(req.params.id), scenario, expectedVersion));
  }),
);

forecastRouter.delete(
  '/scenarios/:id',
  action((req, res) => {
    const expectedVersion = version.parse(Number(req.query.expectedVersion));
    deleteSavedScenario(String(req.params.id), expectedVersion);
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
      if (error instanceof ScenarioConflict)
        return res.status(409).json({ error: error.message, current: error.current });
      if (error instanceof ForecastError)
        return res.status(error.status).json({ error: error.message });
      next(error);
    }
  };
}
