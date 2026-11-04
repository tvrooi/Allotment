import { createHash, randomBytes } from 'crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { accessTokens } from '../db/schema.js';
import { gatewayPersonId } from '../config.js';

// Read-only access tokens (docs/READ-ONLY-ACCESS.md). A token is 256 random bits with a
// recognisable prefix. Its scope is 'read'; 'categorise': read, plus setting the category of
// past transactions and creating and editing categories; or 'organise': categorise, plus the
// owner-approved organising writes. Every write goes through the assistant endpoints and their
// policy table (auth/assistantPolicy.ts, audit decision I-11), never straight to a route. Only
// its SHA-256 is stored, like login sessions, so a leaked database doesn't leak usable tokens.
// Tokens expire, can be revoked, and changing the password revokes them all.

export const TOKEN_PREFIX = 'fbro_';
export const MAX_ACTIVE_TOKENS = 10;
export const MAX_TOKEN_DAYS = 90;
/** last_used_at is updated at most this often, so reading doesn't mean a write per request */
const TOUCH_MS = 5 * 60 * 1000;

export const TOKEN_SCOPES = ['read', 'categorise', 'organise'] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

/** A stored scope, read as the narrowest one if it isn't known */
export const asScope = (value: unknown): TokenScope =>
  TOKEN_SCOPES.includes(value as TokenScope) ? (value as TokenScope) : 'read';
/** Scopes that may set categories and edit categories (organise includes categorise) */
export const canCategorise = (scope: TokenScope) => scope === 'categorise' || scope === 'organise';

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
  // Behind the multi-user gateway, the token names its budget so the gateway can route it
  const owner = gatewayPersonId ? `${gatewayPersonId}_` : '';
  const token = `${TOKEN_PREFIX}${owner}${randomBytes(32).toString('base64url')}`;
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
  return { id: row.id, scope: asScope(row.scope) };
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
  '/change-sets',
  '/budget-proposals',
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

// ─── Tax reads an organise token may make ─────────────────────────────────────

const TAX_READ = [
  /^\/tax\/labels$/,
  /^\/tax\/years$/,
  /^\/tax\/years\/\d{4}$/,
  /^\/tax\/years\/\d{4}\/candidates$/,
  /^\/tax\/claims(\/[^/]+)?$/,
  // Depreciating assets, read only (owner decision 2, DEPRECIATING-ASSETS-PLAN.md §7): changes
  // are the owner's, or later an assistant's proposal the owner approves (audit I-11)
  /^\/tax\/assets(\/[^/]+)?$/,
  /^\/tax\/pool$/,
];

/** Whether an organise token may read this tax path (labels, years, claims, assets, the pool) */
export function taxReadAllows(method: string, rawPath: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  const path = rawPath.toLowerCase().replace(/\/+$/, '');
  return TAX_READ.some((p) => p.test(path));
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Where a token's writes go (audit decision I-11, docs/ASSISTANT-ENDPOINTS.md): only the
 * assistant endpoints, which check each one against the policy table (auth/assistantPolicy.ts),
 * log it, and pass an allowed one on to its route. No general route takes a token's write.
 */
export const ASSISTANT_PREFIX = '/assistant/';

/**
 * Whether a token with this scope may make this request (path relative to /api). A write
 * passes here only into the assistant endpoints, which decide it.
 */
export function tokenAllows(scope: TokenScope, method: string, path: string, _body?: unknown) {
  if (readOnlyAllows(method, path)) return true;
  if (!canCategorise(scope)) return false;
  if (scope === 'organise' && taxReadAllows(method, path)) return true;
  return (method === 'POST' || method === 'PUT') && path.toLowerCase().startsWith(ASSISTANT_PREFIX);
}
