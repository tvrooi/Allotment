import { createHash, randomBytes } from 'crypto';
import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { accessTokens, householdGroups, rules, taxClaims, transactions } from '../db/schema.js';
import { listTransferSuggestions } from '../services/transferService.js';
import {
  poolAccountsOf,
  poolGroupOf,
  snapshot as householdSnapshot,
} from '../services/householdService.js';
import { todayIso } from '../services/mainAmountService.js';
import { gatewayPersonId } from '../config.js';
import { logoSchema } from '../utils/logo.js';

// Read-only access tokens (docs/READ-ONLY-ACCESS.md). A token is 256 random bits with a
// recognisable prefix. Its scope is 'read'; 'categorise': read, plus setting the category of
// past transactions and creating and editing categories (categoriseAllows,
// categoryManageAllows); or 'organise': categorise, plus proposing rules the owner enables,
// payee default categories and logos (never removing one), linking suggested transfers
// (organiseAllows), claiming past transactions as tax deductions (taxClaimAllows), recording
// household contributions linked to a deposit into a household account
// (householdContributionAllows) and your own unlinked contribution up to what you owe
// (ownContributionAllows), and, temporarily, past expenses and repayments between a
// household's people (householdEntryAllows). Only its SHA-256 is stored, like login sessions, so a leaked database doesn't leak usable tokens. Tokens expire, can be revoked, and changing the password
// revokes them all.

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

const CATEGORY_FIELDS = ['groupId', 'name', 'icon', 'budgetType', 'hidden'];
const hasOnly = (body: unknown, allowed: string[]) =>
  !!body &&
  typeof body === 'object' &&
  !Array.isArray(body) &&
  Object.keys(body).every((k) => allowed.includes(k));

/**
 * Whether a categorise token may create or edit categories and groups: create a category or
 * group, edit a category's name, group, icon, budget type or hidden flag, rename a group. Never delete or
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

// ─── What an organise token may change ────────────────────────────────────────

/** Undoing a change set: the route checks it is this token's own (routes/changeSets.ts) */
const UNDO_PATH = /^\/change-sets\/[^/]+\/undo$/;
const RULE_PATH = /^\/rules\/([^/]+)$/;
const PAYEE_PATH = /^\/payees\/([^/]+)$/;
const isObject = (body: unknown): body is Record<string, unknown> =>
  !!body && typeof body === 'object' && !Array.isArray(body);

/** Every action of the rule only sets a category */
function categoryOnlyRule(ruleId: unknown) {
  if (typeof ruleId !== 'string') return false;
  const row = db.select({ actions: rules.actions }).from(rules).where(eq(rules.id, ruleId)).get();
  if (!row) return false;
  try {
    const actions = JSON.parse(row.actions) as { type?: unknown }[];
    return actions.length > 0 && actions.every((a) => a.type === 'set_category');
  } catch {
    return false;
  }
}

/**
 * Whether an organise token may make this write (owner-approved, docs/READ-ONLY-ACCESS.md):
 * - dry runs of rules (POST /rules/test, /rules/preview);
 * - propose a rule: POST /rules with enabled false (the owner enables it), or edit a rule that
 *   is still disabled, without enabling it. Never delete, reorder or enable a rule;
 * - apply one category-only rule to uncategorised past transactions (POST /rules/apply);
 * - set a payee's default category, and nothing else about the payee;
 * - set or replace a payee's logo (a brand icon); never remove one;
 * - link a pair of transactions the server itself suggests as a transfer;
 * - suggest assignments for the owner to apply (POST /budget-proposals).
 */
export function organiseAllows(method: string, rawPath: string, body: unknown): boolean {
  const path = rawPath.toLowerCase();
  if (method !== 'POST' && method !== 'PUT') return false;
  if (method === 'POST' && (path === '/rules/test' || path === '/rules/preview')) return true;
  // Suggest assignments; applying one is the owner's (routes/budgetProposals.ts)
  if (method === 'POST' && path === '/budget-proposals') return true;
  if (method === 'POST' && path === '/rules') return isObject(body) && body.enabled === false;
  if (method === 'POST' && path === '/rules/apply') {
    if (!isObject(body) || body.scope !== 'uncategorized') return false;
    const ids = body.ruleIds;
    if (!Array.isArray(ids) || ids.length !== 1 || !categoryOnlyRule(ids[0])) return false;
    const txIds = body.transactionIds;
    if (!Array.isArray(txIds) || txIds.some((t) => typeof t !== 'string')) return false;
    if (!txIds.length) return true;
    const today = todayIso();
    const rows = db
      .select({ date: transactions.date })
      .from(transactions)
      .where(inArray(transactions.id, txIds as string[]))
      .all();
    return rows.every((r) => r.date <= today);
  }
  if (method === 'PUT') {
    const rule = RULE_PATH.exec(rawPath);
    if (rule && rule[1].toLowerCase() !== 'reorder') {
      if (!isObject(body) || 'enabled' in body || 'sortOrder' in body) return false;
      let id: string;
      try {
        id = decodeURIComponent(rule[1]);
      } catch {
        return false;
      }
      const row = db.select({ enabled: rules.enabled }).from(rules).where(eq(rules.id, id)).get();
      return !!row && row.enabled === 0;
    }
    if (PAYEE_PATH.test(path)) {
      if (!isObject(body) || Object.keys(body).length !== 1) return false;
      if (typeof body.defaultCategoryId === 'string' || body.defaultCategoryId === null)
        return true;
      // A logo can be set or replaced, never removed
      return typeof body.logo === 'string' && logoSchema.safeParse(body.logo).success;
    }
    return false;
  }
  if (path === '/transactions/transfers/link') {
    if (!isObject(body)) return false;
    const { transactionId: a, otherTransactionId: b } = body;
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    return listTransferSuggestions().some(
      (s) => (s.outflow.id === a && s.inflow.id === b) || (s.outflow.id === b && s.inflow.id === a),
    );
  }
  return false;
}

// ─── Tax deductions an organise token may record ──────────────────────────────

const TAX_READ = [
  /^\/tax\/labels$/,
  /^\/tax\/years$/,
  /^\/tax\/years\/\d{4}$/,
  /^\/tax\/years\/\d{4}\/candidates$/,
  /^\/tax\/claims(\/[^/]+)?$/,
];
const TAX_CLAIM_PATH = /^\/tax\/claims\/([^/]+)$/i;
/** A claim's label, work-use share and notes, as the tax route takes them */
const taxClaimBody = z
  .object({
    label: z.string().min(1).max(8),
    workUseBps: z.number().int().optional(),
    notes: z.string().max(2_000).nullable().optional(),
  })
  .strict();

/**
 * Whether an organise token may read or add tax deduction claims (owner-approved,
 * docs/READ-ONLY-ACCESS.md): read the labels, years, a year's claims (not its CSV or receipt
 * archive) and claims; claim a past transaction that has no claim yet. Never replace or remove
 * a claim: those are the owner's. The tax route still validates the label and share and
 * refuses split parents and transfers.
 */
export function taxClaimAllows(method: string, rawPath: string, body: unknown): boolean {
  const path = rawPath.toLowerCase().replace(/\/+$/, '');
  if (method === 'GET' || method === 'HEAD') return TAX_READ.some((p) => p.test(path));
  const match = TAX_CLAIM_PATH.exec(rawPath.replace(/\/+$/, ''));
  if (method !== 'PUT' || !match || !taxClaimBody.safeParse(body).success) return false;
  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return false;
  }
  if (db.select().from(taxClaims).where(eq(taxClaims.transactionId, id)).get()) return false;
  const row = db
    .select({ date: transactions.date })
    .from(transactions)
    .where(eq(transactions.id, id))
    .get();
  // A missing transaction is the route's 404, not a refusal
  return !row || row.date <= todayIso();
}

// ─── Household contributions an organise token may record ────────────────────

const HOUSEHOLD_EVENTS_PATH = /^\/households\/([^/]+)\/events$/i;
/** A contribution linked to one bank deposit, and nothing else (no bill, split or reversal) */
const contributionBody = z
  .object({
    kind: z.literal('contribution'),
    date: z.iso.date(),
    description: z.string().min(1).max(200),
    amount: z.number().int().min(1),
    payerId: z.string().min(1).max(64),
    transactionId: z.string().min(1).max(64),
  })
  .strict();

/**
 * Whether an organise token may record this household entry (owner-approved on 2 November
 * 2026, docs/READ-ONLY-ACCESS.md): a contribution linked to a past deposit into one of that
 * household's accounts, for exactly the deposit's amount and date, that isn't a move from
 * another of its accounts. Never an expense,
 * settlement, refund, bill, unlinked amount, edit or removal: those stay the owner's. The
 * household route still checks the person, that the deposit (or its other transfer leg) isn't
 * linked already, and the rest of the ledger's rules.
 */
export function householdContributionAllows(
  method: string,
  rawPath: string,
  body: unknown,
): boolean {
  const match = HOUSEHOLD_EVENTS_PATH.exec(rawPath.replace(/\/+$/, ''));
  if (method !== 'POST' || !match) return false;
  const parsed = contributionBody.safeParse(body);
  if (!parsed.success) return false;
  let groupId: string;
  try {
    groupId = decodeURIComponent(match[1]);
  } catch {
    return false;
  }
  const group = db.select().from(householdGroups).where(eq(householdGroups.id, groupId)).get();
  if (!group) return false;
  const tx = db
    .select({
      accountId: transactions.accountId,
      date: transactions.date,
      amount: transactions.amount,
      transferTransactionId: transactions.transferTransactionId,
    })
    .from(transactions)
    .where(eq(transactions.id, parsed.data.transactionId))
    .get();
  const pool = poolAccountsOf(group);
  // A move between the household's own accounts brings no money in
  const otherLeg = tx?.transferTransactionId
    ? db
        .select({ accountId: transactions.accountId })
        .from(transactions)
        .where(eq(transactions.id, tx.transferTransactionId))
        .get()
    : undefined;
  return (
    !!tx &&
    !(otherLeg && pool.includes(otherLeg.accountId)) &&
    tx.amount > 0 &&
    tx.amount === parsed.data.amount &&
    tx.date === parsed.data.date &&
    tx.date <= todayIso() &&
    pool.includes(tx.accountId)
  );
}

/** Your own contribution with no bank link: only you, and never more than you owe */
const ownContributionBody = z
  .object({
    kind: z.literal('contribution'),
    date: z.iso.date(),
    description: z.string().trim().min(1).max(200),
    amount: z.number().int().min(1),
    payerId: z.string().min(1).max(64),
  })
  .strict();

/**
 * Whether an organise token may record the owner's own contribution without a bank link
 * (owner-approved on 2 November 2026, docs/READ-ONLY-ACCESS.md): for money the owner put
 * towards the household some other way, such as through a shared saver that isn't one of its
 * accounts. Only the household's "you" person, dated today or earlier, and at most what you
 * owe the household account now, so it can bring you to zero but never into credit. Never for
 * anyone else: their contributions need a linked deposit (householdContributionAllows).
 */
export function ownContributionAllows(method: string, rawPath: string, body: unknown): boolean {
  const match = HOUSEHOLD_EVENTS_PATH.exec(rawPath.replace(/\/+$/, ''));
  if (method !== 'POST' || !match) return false;
  const parsed = ownContributionBody.safeParse(body);
  if (!parsed.success || parsed.data.date > todayIso()) return false;
  let groupId: string;
  try {
    groupId = decodeURIComponent(match[1]);
  } catch {
    return false;
  }
  let state: ReturnType<typeof householdSnapshot>;
  try {
    state = householdSnapshot(groupId);
  } catch {
    return false;
  }
  const self = state.people.find((p) => p.isSelf);
  if (!self || parsed.data.payerId !== self.id) return false;
  const owes = -(state.toPool[self.id] ?? 0);
  return owes > 0 && parsed.data.amount <= owes;
}

// ─── Past household expenses and repayments (TEMPORARY) ──────────────────────

const personId = z.string().min(1).max(64);
const entryFields = {
  date: z.iso.date(),
  description: z.string().trim().min(1).max(200),
  amount: z.number().int().min(1),
  payerId: personId,
  transactionId: personId.optional(),
};
/** An expense with exact per-person shares, or a repayment, between the household's people */
const householdEntryBody = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('expense'),
      ...entryFields,
      mode: z.literal('exact'),
      shares: z
        .array(z.object({ personId, value: z.number().int().min(0).max(1e12) }).strict())
        .min(1)
        .max(50),
    })
    .strict(),
  z
    .object({
      kind: z.literal('settlement'),
      ...entryFields,
      recipientId: personId,
      advance: z.boolean().optional(),
    })
    .strict(),
]);

/**
 * TEMPORARY, owner-approved on 3 November 2026 to bring one Tricount history into a household;
 * removed once that is recorded (docs/READ-ONLY-ACCESS.md). Whether an organise token may record
 * a past-dated expense or repayment (settlement) between the household's people: paid by a
 * person, never the household account; an expense in exact per-person shares that add up to it;
 * a repayment to another of its people. It may link one of your own unlinked bank payments out
 * of a personal account (not a household account or a transfer) with the same date and amount,
 * and only for something you paid. Never edits, removals, refunds, contributions, bills,
 * settings or bank changes. recordEvent still makes every one of its checks; a repayment must fit
 * what is owed unless it is marked as paid ahead (`advance`, owner-approved the same day).
 */
export function householdEntryAllows(method: string, rawPath: string, body: unknown): boolean {
  const match = HOUSEHOLD_EVENTS_PATH.exec(rawPath.replace(/\/+$/, ''));
  if (method !== 'POST' || !match) return false;
  const parsed = householdEntryBody.safeParse(body);
  if (!parsed.success || parsed.data.date > todayIso()) return false;
  const entry = parsed.data;
  let state: ReturnType<typeof householdSnapshot>;
  try {
    state = householdSnapshot(decodeURIComponent(match[1]));
  } catch {
    return false;
  }
  const member = (id: string) => state.people.some((p) => p.id === id);
  if (!member(entry.payerId)) return false;
  if (entry.kind === 'settlement') {
    if (!member(entry.recipientId) || entry.recipientId === entry.payerId) return false;
  } else if (
    !entry.shares.every((s) => member(s.personId)) ||
    new Set(entry.shares.map((s) => s.personId)).size !== entry.shares.length ||
    entry.shares.reduce((n, s) => n + s.value, 0) !== entry.amount
  )
    return false;
  if (entry.transactionId === undefined) return true;
  // Linked: only your own payment out, for something you paid
  const self = state.people.find((p) => p.isSelf);
  if (!self || entry.payerId !== self.id) return false;
  const tx = db
    .select({
      accountId: transactions.accountId,
      date: transactions.date,
      amount: transactions.amount,
      transferTransactionId: transactions.transferTransactionId,
    })
    .from(transactions)
    .where(eq(transactions.id, entry.transactionId))
    .get();
  return (
    !!tx &&
    !tx.transferTransactionId &&
    tx.amount === -entry.amount &&
    tx.date === entry.date &&
    !poolGroupOf(tx.accountId)
  );
}

/** Whether a token with this scope may make this request (path relative to /api) */
export function tokenAllows(scope: TokenScope, method: string, path: string, body: unknown) {
  if (readOnlyAllows(method, path)) return true;
  if (!canCategorise(scope)) return false;
  if (method === 'POST' && UNDO_PATH.test(path.toLowerCase())) return true;
  return (
    categoriseAllows(method, path, body) ||
    categoryManageAllows(method, path, body) ||
    (scope === 'organise' &&
      (organiseAllows(method, path, body) ||
        taxClaimAllows(method, path, body) ||
        householdContributionAllows(method, path, body) ||
        ownContributionAllows(method, path, body) ||
        householdEntryAllows(method, path, body)))
  );
}
