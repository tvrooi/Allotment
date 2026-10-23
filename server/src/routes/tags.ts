import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  MarkError,
  createTag,
  createView,
  deleteTag,
  deleteView,
  listTags,
  listViews,
  updateTag,
  updateView,
} from '../services/transactionMarks.js';

// Phase 9 tags and saved views (services/transactionMarks.ts)

export const tagsRouter = Router();
export const savedViewsRouter = Router();

const clientId = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const tagName = z.string().trim().min(1).max(60);
const viewName = z.string().trim().min(1).max(80);

function send(res: Response, run: () => unknown, status = 200) {
  try {
    const body = run();
    return body === undefined ? res.status(204).end() : res.status(status).json(body);
  } catch (error) {
    if (error instanceof MarkError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
}

tagsRouter.get('/', (_req, res) => res.json(listTags()));

tagsRouter.post('/', (req, res) => {
  const parsed = z
    .object({ id: clientId.optional(), name: tagName, color: color.optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  send(res, () => createTag(parsed.data), 201);
});

tagsRouter.put('/:id', (req, res) => {
  const parsed = z
    .object({ name: tagName.optional(), color: color.optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  send(res, () => updateTag(req.params.id, parsed.data));
});

tagsRouter.delete('/:id', (req, res) => send(res, () => deleteTag(req.params.id)));

savedViewsRouter.get('/', (_req, res) => res.json(listViews()));

savedViewsRouter.post('/', (req, res) => {
  const parsed = z
    .object({ id: clientId.optional(), name: viewName, query: z.string().max(20_000) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  send(res, () => createView(parsed.data), 201);
});

savedViewsRouter.put('/:id', (req, res) => {
  const parsed = z
    .object({ name: viewName.optional(), query: z.string().max(20_000).optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  send(res, () => updateView(req.params.id, parsed.data));
});

savedViewsRouter.delete('/:id', (req, res) => send(res, () => deleteView(req.params.id)));
