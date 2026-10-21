import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { forecastRequestSchema } from '../services/forecastConfig.js';
import { buildForecast, ForecastError } from '../services/forecastService.js';

export const forecastRouter = Router();
// Read-only: POST only carries the scenario assumptions. Nothing is stored or allocated.
forecastRouter.post(
  '/',
  action((req, res) => {
    res.json(buildForecast(forecastRequestSchema.parse(req.body ?? {})));
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
      if (error instanceof ForecastError)
        return res.status(error.status).json({ error: error.message });
      next(error);
    }
  };
}
