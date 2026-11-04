import { Router, type Request, type Response, type NextFunction } from 'express';
import { asScope } from '../auth/accessTokens.js';
import { ASSISTANT_ACTIONS, assistantActionFor } from '../auth/assistantPolicy.js';
import {
  finishAssistantAction,
  listAssistantActions,
  logAssistantAction,
} from '../services/assistantLog.js';

// The assistant endpoints (audit decision I-11, docs/ASSISTANT-ENDPOINTS.md). An access token's
// writes come here, never to a general route: POST or PUT /api/assistant/<route path>. Each one
// is checked against the policy table (auth/assistantPolicy.ts) and logged. An allowed one is
// handed to its route in this process with a one-time grant for exactly that method and path
// (routes/auth.ts, requireSession), so the route applies all its own rules as it does for the
// owner. The owner reads the log here; no token can.

export const assistantRouter = Router();

/** Header the MCP endpoint adds to say which tool is asking, for the log */
export const ASSISTANT_TOOL_HEADER = 'x-flybudget-assistant-tool';
const TOOL_NAME = /^[a-z0-9_]{1,64}$/;

/** A write the policy allowed, for requireSession to let through once */
export interface AssistantGrant {
  method: string;
  path: string;
}

/** Express's application dispatch, present at runtime */
interface Dispatcher {
  handle: (req: Request, res: Response, next: NextFunction) => void;
}

const tokenOf = (res: Response) =>
  typeof res.locals.accessTokenId === 'string' ? res.locals.accessTokenId : undefined;

/** The owner's view: recent requests and the policy they were checked against */
assistantRouter.get('/activity', (req, res) => {
  if (tokenOf(res)) return void res.status(403).json({ error: 'Only the owner can see this' });
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

assistantRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'POST' && req.method !== 'PUT') return next();
  const tokenId = tokenOf(res);
  if (!tokenId) {
    return void res
      .status(403)
      .json({ error: 'The assistant endpoints are for access tokens; the owner uses the app' });
  }
  const scope = asScope(res.locals.accessTokenScope);
  const path = req.path;
  const toolHeader = req.headers[ASSISTANT_TOOL_HEADER];
  const tool = typeof toolHeader === 'string' && TOOL_NAME.test(toolHeader) ? toolHeader : null;
  const action = assistantActionFor(scope, req.method, path, req.body);
  if (!action) {
    const error =
      scope === 'categorise'
        ? 'This access token can only read, set the category of past transactions, and create or edit categories'
        : 'An access token cannot make this change';
    logAssistantAction({
      tokenId,
      scope,
      action: null,
      tool,
      method: req.method,
      path,
      outcome: 'refused',
      status: 403,
      reason: error,
    });
    return void res.status(403).json({ error });
  }

  const logId = logAssistantAction({
    tokenId,
    scope,
    action: action.name,
    tool,
    method: req.method,
    path,
    outcome: 'failed',
  });
  // The route's own refusal, if any, for the log
  let reason: string | null = null;
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 400 && body && typeof body === 'object' && 'error' in body)
      reason = String((body as { error: unknown }).error);
    return json(body);
  };
  res.on('finish', () => finishAssistantAction(logId, res.statusCode, reason));

  res.locals.assistantGrant = { method: req.method, path } satisfies AssistantGrant;
  res.locals.assistantAction = action.name;
  req.url = `/api${req.url}`;
  // Express's own dispatch (not in its types): the route runs in this process, no new request
  (req.app as unknown as Dispatcher).handle(req, res, next);
});
