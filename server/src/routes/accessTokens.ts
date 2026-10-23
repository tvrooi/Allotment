import { Router } from 'express';
import { z } from 'zod';
import { serverMode } from '../config.js';
import {
  AccessTokenError,
  MAX_TOKEN_DAYS,
  createAccessToken,
  listAccessTokens,
  revokeAccessToken,
} from '../auth/accessTokens.js';

// Settings → Server → Read-only access. Managing tokens needs a signed-in session: a read-only
// token can't reach these routes (auth/accessTokens.ts readOnlyAllows).

export const accessTokensRouter = Router();

accessTokensRouter.use((_req, res, next) => {
  // Only a server can be reached by other tools; the desktop app's API is its own
  if (!serverMode) return void res.status(404).json({ error: 'Not found' });
  next();
});

accessTokensRouter.get('/', (_req, res) => res.json(listAccessTokens()));

accessTokensRouter.post('/', (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(60),
      days: z.number().int().min(1).max(MAX_TOKEN_DAYS),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    // The token is in this response only; the server keeps its hash
    res.status(201).json(createAccessToken(parsed.data.name, parsed.data.days));
  } catch (error) {
    if (error instanceof AccessTokenError) return res.status(409).json({ error: error.message });
    throw error;
  }
});

accessTokensRouter.delete('/:id', (req, res) => {
  revokeAccessToken(req.params.id);
  res.status(204).end();
});
