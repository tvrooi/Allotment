import { Router } from 'express';
import {
  ChangeSetError,
  listChangeSets,
  redoChangeSet,
  undoChangeSet,
} from '../services/changeSets.js';

// Category changes made by access tokens (services/changeSets.ts). The owner sees and undoes
// them all; a token sees and undoes only its own (auth/accessTokens.ts lets categorise and
// organise tokens reach the undo). Redo is the owner's alone.

export const changeSetsRouter = Router();

const tokenOf = (locals: Record<string, unknown>) =>
  typeof locals.accessTokenId === 'string' ? locals.accessTokenId : undefined;

changeSetsRouter.get('/', (_req, res) => res.json(listChangeSets(tokenOf(res.locals))));

changeSetsRouter.post('/:id/undo', (req, res) => {
  try {
    res.json(undoChangeSet(req.params.id, tokenOf(res.locals)));
  } catch (error) {
    if (!(error instanceof ChangeSetError)) throw error;
    res.status(error.status).json({ error: error.message });
  }
});

changeSetsRouter.post('/:id/redo', (req, res) => {
  if (tokenOf(res.locals))
    return void res.status(403).json({ error: 'Only the owner can redo a change set' });
  try {
    res.json(redoChangeSet(req.params.id));
  } catch (error) {
    if (!(error instanceof ChangeSetError)) throw error;
    res.status(error.status).json({ error: error.message });
  }
});
