import { Router, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { ASSISTANT_ACTIONS } from '../auth/assistantPolicy.js';
import { listAssistantActions } from '../services/assistantLog.js';
import {
  ASSISTANT_DO,
  ProposalError,
  applyAssistantProposal,
  createAssistantProposal,
  declineAssistantProposal,
  listAssistantProposals,
  proposalSchema,
} from '../services/assistantActions.js';

// Audit decision I-11 (docs/ASSISTANT-ENDPOINTS.md). The owner reads the assistant's activity
// and decides its proposals here; an organise token may only create proposals, and only
// through /api/assistant/do (the policy row propose_change, auth/assistantPolicy.ts).

/**
 * Before routing: a request to /api/assistant/do/<path> is handled as /api/<path>, marked as
 * having come through the assistant endpoint. Only this flag (set here, never from a header)
 * lets an access token write; requireSession finds its policy row and logs it.
 */
export const assistantDispatch: RequestHandler = (req, res, next) => {
  if (req.path === ASSISTANT_DO || req.path.startsWith(`${ASSISTANT_DO}/`)) {
    req.url = `/api${req.url.slice(ASSISTANT_DO.length)}`;
    res.locals.viaAssistant = true;
  }
  next();
};

export const assistantRouter = Router();

function answer(res: Response, action: () => unknown, status = 200) {
  try {
    res.status(status).json(action());
  } catch (error) {
    if (error instanceof z.ZodError)
      return void res.status(400).json({ error: error.issues.map((i) => i.message).join('; ') });
    if (!(error instanceof ProposalError)) throw error;
    res.status(error.status).json({ error: error.message });
  }
}

const ownerOnly: RequestHandler = (_req, res, next) =>
  res.locals.accessTokenId
    ? void res.status(403).json({ error: 'Only the owner can do this' })
    : next();

/** The owner's view: recent requests and the policy they were checked against */
assistantRouter.get('/activity', ownerOnly, (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  const offset = Number(req.query.offset ?? 0);
  res.json({
    actions: listAssistantActions(
      Number.isFinite(limit) ? limit : 100,
      Number.isFinite(offset) ? offset : 0,
    ),
    policy: ASSISTANT_ACTIONS.map(({ name, scope, summary }) => ({ name, scope, summary })),
  });
});
assistantRouter.get('/proposals', (req, res) =>
  res.json(listAssistantProposals(req.query.status === 'all' ? undefined : 'pending')),
);
assistantRouter.post('/proposals', (req, res) =>
  answer(
    res,
    () => {
      const tokenId = res.locals.accessTokenId as string | undefined;
      if (!tokenId)
        throw new ProposalError('Proposals come from an assistant; make the change yourself', 400);
      return createAssistantProposal(tokenId, proposalSchema.parse(req.body));
    },
    201,
  ),
);
assistantRouter.post('/proposals/:id/apply', ownerOnly, (req, res) =>
  answer(res, () => applyAssistantProposal(String(req.params.id))),
);
assistantRouter.post('/proposals/:id/decline', ownerOnly, (req, res) =>
  answer(res, () => declineAssistantProposal(String(req.params.id))),
);
