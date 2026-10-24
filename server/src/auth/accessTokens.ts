import { createHash, randomBytes } from 'crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { accessTokens, transactions } from '../db/schema.js';
import { todayIso } from '../services/mainAmountService.js';

// Read-only access tokens (docs/READ-ONLY-ACCESS.md). A token is 256 random bits with a
// recognisable prefix. Its scope is 'read', or 'categorise': read, plus setting the category of
// past transactions and creating and editing categories, nothing else (categoriseAllows,
// categoryManageAllows); only its SHA-256 is stored, like login sessions, so a leaked database
// doesn't leak usable tokens. Tokens expire, can be revoked, and changing the password
// revokes them all.

export const TOKEN_PREFIX = 'fbro_';
export const MAX_ACTIVE_TOKENS = 10;
export const MAX_TOKEN_DAYS = 90;
/** last_used_at is updated at most this often, so reading doesn't mean a write per request */
const TOUCH_MS = 5 * 60 * 1000;

export const TOKEN_SCOPES = ['read', 'categorise'] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export function looksLikeAccessToken(value: string | undefined): value is string {
  return !!value && value.startsWith(TOKEN_PREFIX) && value.length < 200;
}

/** The bearer token in an Authorization header, if any */
export function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return match?.[1];
}

export function listAccessTokens(now = new Date()) {
  return db
    .select({
      id: accessTokens.id,
      name: accessTokens.name,
      scope: accessTokens.scope,
      createdAt: accessTokens.createdAt,
      expiresAt: accessTokens.expiresAt,
      lastUsedAt: accessTokens.lastUsedAt,
      revokedAt: accessTokens.revokedAt,
    })
    .from(accessTokens)
    .all()
    .map((t) => ({ ...t, active: !t.revokedAt && t.expiresAt > now.toISOString() }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export class AccessTokenError extends Error {}

/** Creates a token and returns it once; afterwards only its hash exists */
export function createAccessToken(
  name: string,
  days: number,
  now = new Date(),
  scope: TokenScope = 'read',
) {
  const active = listAccessTokens(now).filter((t) => t.active).length;
  if (active >= MAX_ACTIVE_TOKENS) {
    throw new AccessTokenError(
      `At most ${MAX_ACTIVE_TOKENS} tokens can be active; revoke one first`,
    );
  }
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const row = {
    id: nanoid(),
    tokenHash: digest(token),
    name: name.trim(),
    scope,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
  };
  db.insert(accessTokens).values(row).run();
  return { token, id: row.id, name: row.name, scope, expiresAt: row.expiresAt };
}

export function revokeAccessToken(id: string, now = new Date()) {
  db.update(accessTokens)
    .set({ revokedAt: now.toISOString() })
    .where(and(eq(accessTokens.id, id), isNull(accessTokens.revokedAt)))
    .run();
}

/** Revokes every token (changing the password) */
export function revokeAllAccessTokens(now = new Date()) {
  db.update(accessTokens)
    .set({ revokedAt: now.toISOString() })
    .where(isNull(accessTokens.revokedAt))
    .run();
}

/** The token's id and scope if it is valid now (not expired or revoked), else null */
export function verifyAccessToken(
  token: string,
  now = new Date(),
): { id: string; scope: TokenScope } | null {
  if (!looksLikeAccessToken(token)) return null;
  const row = db
    .select()
    .from(accessTokens)
    .where(
      and(
        eq(accessTokens.tokenHash, digest(token)),
        isNull(accessTokens.revokedAt),
        gt(accessTokens.expiresAt, now.toISOString()),
      ),
    )
    .get();
  if (!row) return null;
  if (!row.lastUsedAt || now.getTime() - Date.parse(row.lastUsedAt) > TOUCH_MS) {
    db.update(accessTokens)
      .set({ lastUsedAt: now.toISOString() })
      .where(eq(accessTokens.id, row.id))
      .run();
  }
  return { id: row.id, scope: row.scope === 'categorise' ? 'categorise' : 'read' };
}

// ─── What a read-only token may reach ─────────────────────────────────────────

/**
 * API paths (under /api) a read-only token may GET. Everything else — login, server
 * settings, backups and restores, bank connections, token management — is refused, and no
 * other method is allowed except the MCP endpoint, which only reads.
 */
const READABLE = [
  '/accounts',
  '/categories',
  '/transactions',
  '/budget',
  '/payees',
  '/rules',
  '/reports',
  '/custom-reports',
  '/schedules',
  '/goals',
  '/payday',
  '/forecast',
  '/review',
  '/priorities',
  '/households',
  '/tags',
  '/saved-views',
  '/currency',
  '/export/transactions/csv',
];
/** Under a readable path, but bank-connection data: never for a token */
const UNREADABLE = [/^\/accounts\/[^/]+\/import-settings$/i];
export const MCP_PATH = '/mcp';

/** Whether a read-only token may make this request (path relative to /api) */
export function readOnlyAllows(method: string, rawPath: string): boolean {
  // The router ignores letter case and a trailing slash, so the allowlist must too
  // ('/accounts/x/Import-Settings/')
  const path = rawPath.toLowerCase().replace(/\/+$/, '');
  // POST carries MCP messages; GET is answered 405 (no server-sent stream), as MCP expects
  if (path === MCP_PATH) return method === 'POST' || method === 'GET';
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (UNREADABLE.some((p) => p.test(path))) return false;
  return READABLE.some((p) => path === p || path.startsWith(`${p}/`));
}

// ─── What a categorise token may change ───────────────────────────────────────

const TRANSACTION_PATH = /^\/transactions\/([^/]+)$/i;
/** Exactly a category, never clearing it or anything else */
const categoriseBody = z.object({ categoryId: z.string().min(1).max(64) }).strict();

/**
 * Whether a categorise token may make this write: PUT /transactions/:id whose body sets only
 * the category, for a transaction dated today or earlier. The transactions route still applies
 * its own rules (reconciled rows, split parents, transfers, household links, payment envelopes).
 */
export function categoriseAllows(method: string, path: string, body: unknown): boolean {
  const match = TRANSACTION_PATH.exec(path);
  if (method !== 'PUT' || !match || !categoriseBody.safeParse(body).success) return false;
  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return false;
  }
  const row = db
    .select({ date: transactions.date })
    .from(transactions)
    .where(eq(transactions.id, id))
    .get();
  // A missing transaction is the route's 404, not a refusal
  return !row || row.date <= todayIso();
}

const CATEGORY_FIELDS = ['groupId', 'name', 'icon', 'budgetType'];
const hasOnly = (body: unknown, allowed: string[]) =>
  !!body &&
  typeof body === 'object' &&
  !Array.isArray(body) &&
  Object.keys(body).every((k) => allowed.includes(k));

/**
 * Whether a categorise token may create or edit categories and groups: create a category or
 * group, edit a category's name, group, icon or budget type, rename a group. Never delete or
 * reorder them, and a group's income flag is set only when it is created. The route still
 * validates the values and refuses payment envelopes.
 */
export function categoryManageAllows(method: string, rawPath: string, body: unknown): boolean {
  const path = rawPath.toLowerCase(); // the router ignores case, and 'reorder' must stay out
  if (method === 'POST' && path === '/categories') return hasOnly(body, CATEGORY_FIELDS);
  if (method === 'POST' && path === '/categories/groups')
    return hasOnly(body, ['name', 'isIncome']);
  if (method !== 'PUT') return false;
  const group = /^\/categories\/groups\/([^/]+)$/.exec(path);
  if (group) return group[1] !== 'reorder' && hasOnly(body, ['name']);
  const category = /^\/categories\/([^/]+)$/.exec(path);
  return (
    !!category && !['reorder', 'groups'].includes(category[1]) && hasOnly(body, CATEGORY_FIELDS)
  );
}

/** Whether a token with this scope may make this request (path relative to /api) */
export function tokenAllows(scope: TokenScope, method: string, path: string, body: unknown) {
  return (
    readOnlyAllows(method, path) ||
    (scope === 'categorise' &&
      (categoriseAllows(method, path, body) || categoryManageAllows(method, path, body)))
  );
}
