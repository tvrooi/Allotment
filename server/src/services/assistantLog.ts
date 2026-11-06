import { desc, eq, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { accessTokens, assistantActions } from '../db/schema.js';
import { ASSISTANT_ACTIONS } from '../auth/assistantPolicy.js';

// The assistant audit log (audit decision I-11, docs/ASSISTANT-ENDPOINTS.md): one row for every
// write an access token asked for, allowed or refused. The owner reads it in Settings → Server →
// Read-only access. A security log: never in backups, and no token can read it.

/** Rows kept; older ones are removed as new ones arrive */
export const MAX_LOG_ROWS = 5_000;
const REASON_CHARS = 300;

export type AssistantOutcome = 'refused' | 'applied' | 'failed';

export interface AssistantLogEntry {
  tokenId: string;
  scope: string;
  action: string | null;
  tool: string | null;
  method: string;
  path: string;
  outcome: AssistantOutcome;
  status?: number;
  reason?: string | null;
}

/** Records a request; returns its id so the outcome can be filled in when the route answers */
export function logAssistantAction(entry: AssistantLogEntry, now = new Date()): string {
  const tokenName =
    db
      .select({ name: accessTokens.name })
      .from(accessTokens)
      .where(eq(accessTokens.id, entry.tokenId))
      .get()?.name ?? 'Assistant';
  const id = nanoid();
  db.insert(assistantActions)
    .values({
      id,
      createdAt: now.toISOString(),
      tokenId: entry.tokenId,
      tokenName,
      scope: entry.scope,
      // The column predates refusals being logged without a row: '' means none matched
      action: entry.action ?? '',
      tool: entry.tool,
      method: entry.method,
      path: entry.path.slice(0, 500),
      outcome: entry.outcome,
      status: entry.status ?? null,
      reason: entry.reason?.slice(0, REASON_CHARS) ?? null,
    })
    .run();
  prune();
  return id;
}

/**
 * What the route answered for an allowed request. `refused` when the row's check, run again
 * inside the write (assistantGuard), refused it.
 */
export function finishAssistantAction(
  id: string,
  status: number,
  reason?: string | null,
  refused = false,
) {
  db.update(assistantActions)
    .set({
      outcome: refused ? 'refused' : status < 400 ? 'applied' : 'failed',
      status,
      reason: reason?.slice(0, REASON_CHARS) ?? null,
    })
    .where(eq(assistantActions.id, id))
    .run();
}

function prune() {
  const oldest = db
    .select({ createdAt: assistantActions.createdAt })
    .from(assistantActions)
    .orderBy(desc(assistantActions.createdAt))
    .limit(1)
    .offset(MAX_LOG_ROWS - 1)
    .get();
  if (oldest)
    db.delete(assistantActions).where(lt(assistantActions.createdAt, oldest.createdAt)).run();
}

const SUMMARY = new Map(ASSISTANT_ACTIONS.map((a) => [a.name, a.summary]));

/** The newest rows first, each with what its policy row lets an assistant do */
export function listAssistantActions(limit = 100, offset = 0) {
  return db
    .select({
      id: assistantActions.id,
      createdAt: assistantActions.createdAt,
      tokenId: assistantActions.tokenId,
      tokenName: assistantActions.tokenName,
      scope: assistantActions.scope,
      action: assistantActions.action,
      tool: assistantActions.tool,
      method: assistantActions.method,
      path: assistantActions.path,
      outcome: assistantActions.outcome,
      status: assistantActions.status,
      reason: assistantActions.reason,
    })
    .from(assistantActions)
    .orderBy(desc(assistantActions.createdAt), desc(assistantActions.id))
    .limit(Math.min(Math.max(limit, 1), 500))
    .offset(Math.max(offset, 0))
    .all()
    .map((a) => ({
      ...a,
      action: a.action || null,
      summary: (a.action && SUMMARY.get(a.action)) || null,
    }));
}
