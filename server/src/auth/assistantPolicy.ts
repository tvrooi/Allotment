import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { householdGroups, rules, taxClaims, transactions } from '../db/schema.js';
import { listTransferSuggestions } from '../services/transferService.js';
import { poolAccountsOf, snapshot as householdSnapshot } from '../services/householdService.js';
import { todayIso } from '../services/mainAmountService.js';
import { logoSchema } from '../utils/logo.js';
import type { TokenScope } from './accessTokens.js';
import { AssistantRefusal, CHANGED_BEFORE_SAVING } from './assistantRefusal.js';

// The assistant policy (audit decision I-11, docs/ASSISTANT-ENDPOINTS.md): every write an access
// token may make, one row each in ASSISTANT_ACTIONS. A token's write reaches a route only through
// the assistant endpoints (routes/assistant.ts), which find its row here, log it and pass it on
// once; the route then applies its own rules as it does for the owner. Each row is an
// owner-approved exception (docs/READ-ONLY-ACCESS.md, CLAUDE.md): never add a writing, settings,
// backup, auth or bank one. assistantPolicy.test.ts holds an allowed case and the nearest refusal
// for every row.
//
// A row's `matches` decides from the request alone. A row whose rule depends on the budget (a
// date, an existing claim, a rule's state) also has a `check`, which runs twice: in
// requireSession, and again inside the write's own database transaction through
// assistantGuard, so the budget can't change between the check and the write
// (docs/ASSISTANT-PHASE-3.md).

/** Method and path relative to /api, and the parsed body */
export interface AssistantRequest {
  method: string;
  path: string;
  body: unknown;
}

/** The decoded id a path pattern captures, or null */
function pathId(pattern: RegExp, path: string): string | null {
  const match = pattern.exec(path.replace(/\/+$/, ''));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

const past = (date: string) => date <= todayIso();
const PAST_ONLY = 'An access token changes only transactions dated today or earlier';

// ─── What a categorise token may change ───────────────────────────────────────

const TRANSACTION_PATH = /^\/transactions\/([^/]+)$/i;
/** Exactly a category, never clearing it or anything else */
const categoriseBody = z.object({ categoryId: z.string().min(1).max(64) }).strict();

/** PUT /transactions/:id whose body sets only the category */
function categoriseMatches(method: string, path: string, body: unknown): boolean {
  return (
    method === 'PUT' &&
    pathId(TRANSACTION_PATH, path) !== null &&
    categoriseBody.safeParse(body).success
  );
}

/**
 * A categorise token sets the category of a transaction dated today or earlier that isn't
 * reconciled. The transactions route still applies its own rules (split parents, transfers,
 * household links, payment envelopes).
 */
function categoriseCheck({ path }: AssistantRequest): string | null {
  const row = db
    .select({ date: transactions.date, reconciled: transactions.reconciled })
    .from(transactions)
    .where(eq(transactions.id, pathId(TRANSACTION_PATH, path)!))
    .get();
  // A missing transaction is the route's 404, not a refusal
  if (!row) return null;
  if (row.reconciled === 1) return 'Cannot modify a reconciled transaction';
  return past(row.date) ? null : PAST_ONLY;
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
function categoryManageAllows(method: string, rawPath: string, body: unknown): boolean {
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
function categoryOnlyRule(ruleId: string) {
  const row = db.select({ actions: rules.actions }).from(rules).where(eq(rules.id, ruleId)).get();
  if (!row) return false;
  try {
    const actions = JSON.parse(row.actions) as { type?: unknown }[];
    return actions.length > 0 && actions.every((a) => a.type === 'set_category');
  } catch {
    return false;
  }
}

/** Dry runs of rules: change nothing (POST /rules/test, /rules/preview) */
function ruleDryRunAllows(method: string, rawPath: string): boolean {
  const path = rawPath.toLowerCase();
  return method === 'POST' && (path === '/rules/test' || path === '/rules/preview');
}

/** Suggest assignments; applying one is the owner's (routes/budgetProposals.ts) */
function budgetProposalAllows(method: string, rawPath: string): boolean {
  return method === 'POST' && rawPath.toLowerCase() === '/budget-proposals';
}

/** Propose a rule: saved disabled, the owner enables it */
function proposeRuleAllows(method: string, rawPath: string, body: unknown): boolean {
  return (
    method === 'POST' &&
    rawPath.toLowerCase() === '/rules' &&
    isObject(body) &&
    body.enabled === false
  );
}

/** Edit a rule without enabling or reordering it */
function editProposedRuleMatches(method: string, rawPath: string, body: unknown): boolean {
  const id = pathId(RULE_PATH, rawPath);
  if (method !== 'PUT' || id === null || id.toLowerCase() === 'reorder') return false;
  return isObject(body) && !('enabled' in body) && !('sortOrder' in body);
}

/** Only a rule that is still disabled: a proposal the owner hasn't accepted */
function editProposedRuleCheck({ path }: AssistantRequest): string | null {
  const row = db
    .select({ enabled: rules.enabled })
    .from(rules)
    .where(eq(rules.id, pathId(RULE_PATH, path)!))
    .get();
  return row?.enabled === 0 ? null : 'An access token edits only rules that are still disabled';
}

/** Apply one rule to the uncategorised transactions it names */
function applyRuleMatches(method: string, rawPath: string, body: unknown): boolean {
  if (method !== 'POST' || rawPath.toLowerCase() !== '/rules/apply') return false;
  if (!isObject(body) || body.scope !== 'uncategorized') return false;
  const ids = body.ruleIds;
  if (!Array.isArray(ids) || ids.length !== 1 || typeof ids[0] !== 'string') return false;
  const txIds = body.transactionIds;
  return Array.isArray(txIds) && txIds.every((t) => typeof t === 'string');
}

/** The rule only sets a category, and every transaction is dated today or earlier */
function applyRuleCheck({ body }: AssistantRequest): string | null {
  const { ruleIds, transactionIds } = body as { ruleIds: string[]; transactionIds: string[] };
  if (!categoryOnlyRule(ruleIds[0]))
    return 'An access token applies only a rule that sets a category and nothing else';
  if (!transactionIds.length) return null;
  const rows = db
    .select({ date: transactions.date })
    .from(transactions)
    .where(inArray(transactions.id, transactionIds))
    .all();
  return rows.every((r) => past(r.date)) ? null : PAST_ONLY;
}

/** Set a payee's default category, and nothing else about the payee */
function payeeDefaultCategoryAllows(method: string, rawPath: string, body: unknown): boolean {
  if (method !== 'PUT' || !PAYEE_PATH.test(rawPath.toLowerCase())) return false;
  if (!isObject(body) || Object.keys(body).length !== 1) return false;
  return typeof body.defaultCategoryId === 'string' || body.defaultCategoryId === null;
}

/** Set or replace a payee's logo (a brand icon); never remove one */
function payeeLogoAllows(method: string, rawPath: string, body: unknown): boolean {
  if (method !== 'PUT' || !PAYEE_PATH.test(rawPath.toLowerCase())) return false;
  if (!isObject(body) || Object.keys(body).length !== 1) return false;
  return typeof body.logo === 'string' && logoSchema.safeParse(body.logo).success;
}

/** Link a pair of transactions as a transfer */
function transferLinkMatches(method: string, rawPath: string, body: unknown): boolean {
  if (method !== 'POST' || rawPath.toLowerCase() !== '/transactions/transfers/link') return false;
  return (
    isObject(body) &&
    typeof body.transactionId === 'string' &&
    typeof body.otherTransactionId === 'string'
  );
}

/** Only a pair the server itself suggests */
function transferLinkCheck({ body }: AssistantRequest): string | null {
  const { transactionId: a, otherTransactionId: b } = body as Record<string, string>;
  return listTransferSuggestions().some(
    (s) => (s.outflow.id === a && s.inflow.id === b) || (s.outflow.id === b && s.inflow.id === a),
  )
    ? null
    : 'An access token links only a transfer the server suggests';
}

/** Undo a change set: the route checks it is this token's own (routes/changeSets.ts) */
function undoChangeSetAllows(method: string, rawPath: string): boolean {
  return method === 'POST' && UNDO_PATH.test(rawPath.toLowerCase());
}

// ─── Tax deductions an organise token may record ──────────────────────────────

const TAX_CLAIM_PATH = /^\/tax\/claims\/([^/]+)$/i;
/** A claim's label, work-use share and notes, as the tax route takes them */
const taxClaimBody = z
  .object({
    label: z.string().min(1).max(8),
    workUseBps: z.number().int().optional(),
    notes: z.string().max(2_000).nullable().optional(),
  })
  .strict();

/** PUT /tax/claims/:transactionId with a claim's label, share and notes */
function taxClaimMatches(method: string, rawPath: string, body: unknown): boolean {
  return (
    method === 'PUT' &&
    pathId(TAX_CLAIM_PATH, rawPath) !== null &&
    taxClaimBody.safeParse(body).success
  );
}

/**
 * An organise token may add a tax deduction claim (owner-approved, docs/READ-ONLY-ACCESS.md):
 * claim a past transaction that has no claim yet. Never replace or remove a claim: those are the
 * owner's (setClaim also only inserts for a token). The tax route still validates the label and
 * share and refuses split parents and transfers.
 */
function taxClaimCheck({ path }: AssistantRequest): string | null {
  const id = pathId(TAX_CLAIM_PATH, path)!;
  if (db.select().from(taxClaims).where(eq(taxClaims.transactionId, id)).get())
    return 'This transaction is already claimed; only the owner changes a claim';
  const row = db
    .select({ date: transactions.date })
    .from(transactions)
    .where(eq(transactions.id, id))
    .get();
  // A missing transaction is the route's 404, not a refusal
  return !row || past(row.date) ? null : PAST_ONLY;
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

/** POST /households/:id/events with a contribution linked to one bank deposit */
function householdContributionMatches(method: string, rawPath: string, body: unknown): boolean {
  return (
    method === 'POST' &&
    pathId(HOUSEHOLD_EVENTS_PATH, rawPath) !== null &&
    contributionBody.safeParse(body).success
  );
}

/**
 * An organise token may record this household entry (owner-approved on 2 November 2026,
 * docs/READ-ONLY-ACCESS.md): a contribution linked to a past deposit into one of that
 * household's accounts, for exactly the deposit's amount and date, that isn't a move from
 * another of its accounts. Never an expense, settlement, refund, bill, unlinked amount, edit or
 * removal: those stay the owner's. The household route still checks the person, that the
 * deposit (or its other transfer leg) isn't linked already, and the rest of the ledger's rules.
 */
function householdContributionCheck({ path, body }: AssistantRequest): string | null {
  const refusal =
    'An access token records only a contribution matching a past deposit into this household’s accounts, for its exact amount and date';
  const data = contributionBody.parse(body);
  const groupId = pathId(HOUSEHOLD_EVENTS_PATH, path)!;
  const group = db.select().from(householdGroups).where(eq(householdGroups.id, groupId)).get();
  if (!group) return refusal;
  const tx = db
    .select({
      accountId: transactions.accountId,
      date: transactions.date,
      amount: transactions.amount,
      transferTransactionId: transactions.transferTransactionId,
    })
    .from(transactions)
    .where(eq(transactions.id, data.transactionId))
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
  return !!tx &&
    !(otherLeg && pool.includes(otherLeg.accountId)) &&
    tx.amount > 0 &&
    tx.amount === data.amount &&
    tx.date === data.date &&
    past(tx.date) &&
    pool.includes(tx.accountId)
    ? null
    : refusal;
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

/** POST /households/:id/events with a contribution that has no bank link */
function ownContributionMatches(method: string, rawPath: string, body: unknown): boolean {
  return (
    method === 'POST' &&
    pathId(HOUSEHOLD_EVENTS_PATH, rawPath) !== null &&
    ownContributionBody.safeParse(body).success
  );
}

/**
 * An organise token may record the owner's own contribution without a bank link
 * (owner-approved on 2 November 2026, docs/READ-ONLY-ACCESS.md): for money the owner put
 * towards the household some other way, such as through a shared saver that isn't one of its
 * accounts. Only the household's "you" person, dated today or earlier, and at most what you
 * owe the household account now, so it can bring you to zero but never into credit. Never for
 * anyone else: their contributions need a linked deposit (householdContributionCheck).
 */
function ownContributionCheck({ path, body }: AssistantRequest): string | null {
  const data = ownContributionBody.parse(body);
  if (!past(data.date)) return 'An access token records contributions dated today or earlier';
  let state: ReturnType<typeof householdSnapshot>;
  try {
    state = householdSnapshot(pathId(HOUSEHOLD_EVENTS_PATH, path)!);
  } catch {
    return 'Household not found';
  }
  const self = state.people.find((p) => p.isSelf);
  if (!self || data.payerId !== self.id)
    return 'An access token records an unlinked contribution only for you';
  const owes = -(state.toPool[self.id] ?? 0);
  return owes > 0 && data.amount <= owes
    ? null
    : 'An access token records your own contribution only up to what you owe the household account';
}

// ─── The policy table ─────────────────────────────────────────────────────────

export interface AssistantAction {
  /** Stored in the audit log: never rename one */
  name: string;
  /** The narrowest scope that may use it: categorise (and organise), or organise only */
  scope: 'categorise' | 'organise';
  /** What it lets an assistant do, for the owner's activity list */
  summary: string;
  /** Whether the request is this row's: method, path (relative to /api) and body; reads nothing */
  matches: (method: string, path: string, body: unknown) => boolean;
  /**
   * For a row whose rule depends on the budget: why the write is refused now, or null. It runs in
   * requireSession and again inside the write's transaction (assistantGuard).
   */
  check?: (request: AssistantRequest) => string | null;
}

export const ASSISTANT_ACTIONS: readonly AssistantAction[] = [
  {
    name: 'categorise_transaction',
    scope: 'categorise',
    summary: 'Set the category of a past transaction',
    matches: categoriseMatches,
    check: categoriseCheck,
  },
  {
    name: 'manage_categories',
    scope: 'categorise',
    summary: 'Create or edit a category or group (never delete or reorder)',
    matches: categoryManageAllows,
  },
  {
    name: 'undo_change_set',
    scope: 'categorise',
    summary: 'Undo its own category changes',
    matches: undoChangeSetAllows,
  },
  {
    name: 'rule_dry_run',
    scope: 'organise',
    summary: 'Test or preview a rule (changes nothing)',
    matches: ruleDryRunAllows,
  },
  {
    name: 'propose_rule',
    scope: 'organise',
    summary: 'Propose a rule, saved disabled',
    matches: proposeRuleAllows,
  },
  {
    name: 'edit_proposed_rule',
    scope: 'organise',
    summary: 'Edit a rule that is still disabled',
    matches: editProposedRuleMatches,
    check: editProposedRuleCheck,
  },
  {
    name: 'apply_rule',
    scope: 'organise',
    summary: 'Apply a category-only rule to uncategorised past transactions',
    matches: applyRuleMatches,
    check: applyRuleCheck,
  },
  {
    name: 'payee_default_category',
    scope: 'organise',
    summary: 'Set a payee’s default category',
    matches: payeeDefaultCategoryAllows,
  },
  {
    name: 'payee_logo',
    scope: 'organise',
    summary: 'Set or replace a payee’s logo',
    matches: payeeLogoAllows,
  },
  {
    name: 'link_transfer',
    scope: 'organise',
    summary: 'Link a transfer the server suggests',
    matches: transferLinkMatches,
    check: transferLinkCheck,
  },
  {
    name: 'suggest_assignments',
    scope: 'organise',
    summary: 'Suggest budget assignments for the owner to apply',
    matches: budgetProposalAllows,
  },
  {
    name: 'claim_tax_deduction',
    scope: 'organise',
    summary: 'Claim an unclaimed past transaction as a tax deduction',
    matches: taxClaimMatches,
    check: taxClaimCheck,
  },
  {
    name: 'household_contribution',
    scope: 'organise',
    summary: 'Record a household contribution linked to its deposit',
    matches: householdContributionMatches,
    check: householdContributionCheck,
  },
  {
    name: 'own_household_contribution',
    scope: 'organise',
    summary: 'Record your own contribution, up to what you owe',
    matches: ownContributionMatches,
    check: ownContributionCheck,
  },
  {
    name: 'propose_change',
    scope: 'organise',
    summary: 'Propose a depreciating asset or a change to one, for the owner to apply',
    // The proposals route validates the proposal; applying one is the owner's
    matches: (method, path) =>
      method === 'POST' && path.toLowerCase().replace(/\/+$/, '') === '/assistant/proposals',
  },
];

export const scopeMay = (scope: TokenScope, action: AssistantAction) =>
  action.scope === 'organise'
    ? scope === 'organise'
    : scope === 'categorise' || scope === 'organise';

/** The row a request matched, and the check's reason when it refused */
export interface AssistantDecision {
  action: AssistantAction;
  refusal?: string;
}

/**
 * The row that allows this write for this scope (path relative to /api). A request that matches
 * a row whose check refuses it gets that row and the check's reason; one that matches no row gets
 * undefined, and the caller words the refusal.
 */
export function assistantActionFor(
  scope: TokenScope,
  method: string,
  path: string,
  body: unknown,
): AssistantDecision | undefined {
  let refused: AssistantDecision | undefined;
  for (const action of ASSISTANT_ACTIONS) {
    if (!scopeMay(scope, action) || !action.matches(method, path, body)) continue;
    const refusal = action.check?.({ method, path, body }) ?? null;
    if (refusal === null) return { action };
    refused ??= { action, refusal };
  }
  return refused;
}

/** What requireSession keeps for a row with a check, so the write can run it again */
export interface AssistantPending {
  action: AssistantAction;
  request: AssistantRequest;
}

/**
 * For a write that an access token asked for through a row with a check: a function the service
 * calls first inside its database transaction, which runs the row's check again on the budget
 * as the transaction sees it and throws AssistantRefusal (403) if it now refuses. Undefined for
 * the owner and for rows without a check. `locals` is the response's res.locals.
 */
export function assistantGuard(locals: Record<string, unknown>): (() => void) | undefined {
  const pending = locals.assistantPending as AssistantPending | undefined;
  if (!pending?.action.check) return undefined;
  return () => {
    const reason = pending.action.check!(pending.request);
    if (reason === null) return;
    const message = CHANGED_BEFORE_SAVING + reason[0].toLowerCase() + reason.slice(1);
    locals.assistantRefusal = message;
    throw new AssistantRefusal(message);
  };
}
