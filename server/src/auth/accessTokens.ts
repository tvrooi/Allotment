import { createHash, randomBytes } from 'crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { accessTokens } from '../db/schema.js';

// Access tokens (docs/READ-ONLY-ACCESS.md). A `read` token only reads. A `categorise` token
// reads and may also change categories and the category of transactions, nothing else. A
// token is 256 random bits with a recognisable prefix; only its SHA-256 is stored, like login sessions, so a leaked database
// doesn't leak usable tokens. Tokens expire, can be revoked, and changing the password
// revokes them all.

export type TokenScope = 'read' | 'categorise';
export const TOKEN_PREFIX = 'fbro_';
export const CATEGORISE_PREFIX = 'fbcat_';
const PREFIXES: Record<TokenScope, string> = { read: TOKEN_PREFIX, categorise: CATEGORISE_PREFIX };
export const MAX_ACTIVE_TOKENS = 10;
export const MAX_TOKEN_DAYS = 90;
/** last_used_at is updated at most this often, so reading doesn't mean a write per request */
const TOUCH_MS = 5 * 60 * 1000;

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export function looksLikeAccessToken(value: string | undefined): value is string {
  return (
    !!value &&
    (value.startsWith(TOKEN_PREFIX) || value.startsWith(CATEGORISE_PREFIX)) &&
    value.length < 200
  );
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
  const token = `${PREFIXES[scope]}${randomBytes(32).toString('base64url')}`;
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

// ─── What a token may reach ─────────────────────────────────────────

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
const UNREADABLE = [/^\/accounts\/[^/]+\/import-settings$/];
export const MCP_PATH = '/mcp';

/** Whether a read-only token may make this request (path relative to /api) */
export function readOnlyAllows(method: string, rawPath: string): boolean {
  const path = rawPath.toLowerCase(); // the router ignores case, so the allowlist must too
  // POST carries MCP messages; GET is answered 405 (no server-sent stream), as MCP expects
  if (path === MCP_PATH) return method === 'POST' || method === 'GET';
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (UNREADABLE.some((p) => p.test(path))) return false;
  return READABLE.some((p) => path === p || path.startsWith(`${p}/`));
}

// ─── What a categorise token may also change ──────────────────────────────────

const CATEGORY_WRITES = [
  /^\/categories$/, // create a category
  /^\/categories\/groups$/, // create a group
  /^\/categories\/groups\/(?!reorder$)[^/]+$/, // rename a group
  /^\/categories\/(?!reorder$)(?!groups$)[^/]+$/, // edit a category
];
const GROUP_RENAME = /^\/categories\/groups\/[^/]+$/;
const BULK_PATH = '/transactions/bulk';
/** The only top-level keys of a bulk edit, and of an undo; nothing else may ride along */
const BULK_KEYS = new Set([
  'selection',
  'ids',
  'excludeIds',
  'changes',
  'preview',
  'expectedCount',
]);
const RESTORE_FIELDS = new Set(['id', 'categoryId']);
const MAX_RESTORE = 1000;

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const onlyKeys = (v: Record<string, unknown>, allowed: Iterable<string>) => {
  const ok = new Set(allowed);
  return Object.keys(v).every((k) => ok.has(k));
};

/**
 * Whether a token with this scope may make this request (path relative to /api). A categorise
 * token reads like a read token and may also create and edit categories and groups (never
 * delete or reorder them, and a group only renames) and change transactions' category through
 * the bulk edit, including its preview and undo. Any other field of a transaction, or any
 * other write, is refused. Paths are compared in lower case because the router ignores case.
 */
export function tokenAllows(scope: TokenScope, method: string, rawPath: string, body?: unknown) {
  const path = rawPath.toLowerCase();
  if (readOnlyAllows(method, path)) return true;
  if (scope !== 'categorise') return false;
  if ((method === 'POST' || method === 'PUT') && CATEGORY_WRITES.some((p) => p.test(path))) {
    // A group's income flag isn't a rename; it is set only when the group is created
    return (
      method === 'POST' || !GROUP_RENAME.test(path) || (isObject(body) && onlyKeys(body, ['name']))
    );
  }
  if (method === 'POST' && path === BULK_PATH && isObject(body)) {
    if ('restore' in body) {
      return (
        onlyKeys(body, ['restore']) &&
        Array.isArray(body.restore) &&
        body.restore.length > 0 &&
        body.restore.length <= MAX_RESTORE &&
        body.restore.every((r) => isObject(r) && onlyKeys(r, RESTORE_FIELDS))
      );
    }
    return (
      onlyKeys(body, BULK_KEYS) &&
      isObject(body.changes) &&
      Object.keys(body.changes).length > 0 &&
      onlyKeys(body.changes, ['categoryId'])
    );
  }
  return false;
}
