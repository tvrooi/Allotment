import { Router } from 'express';
import { ChangeSetError, listChangeSets, undoChangeSet } from '../services/changeSets.js';

// Category changes made by access tokens (services/changeSets.ts). The owner sees and undoes
// them all; a token sees and undoes only its own (auth/accessTokens.ts lets categorise and
// organise tokens reach the undo).

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
