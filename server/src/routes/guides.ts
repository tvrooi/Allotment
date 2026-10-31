import { Router } from 'express';
import {
  guideState,
  guideUpdateSchema,
  resetGuides,
  updateGuides,
} from '../services/guideService.js';

// Guides and tips (docs/GUIDES.md): the signed-in person's progress. Presentation only, and
// deliberately not readable or writable with an access token (auth/accessTokens.ts).
export const guidesRouter = Router();

guidesRouter.get('/', (_req, res) => res.json(guideState()));

guidesRouter.put('/', (req, res) => {
  const parsed = guideUpdateSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
  res.json(updateGuides(parsed.data));
});

guidesRouter.post('/reset', (_req, res) => res.json(resetGuides()));
