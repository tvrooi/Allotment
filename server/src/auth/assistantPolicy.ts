import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { householdGroups, rules, taxClaims, transactions } from '../db/schema.js';
import { listTransferSuggestions } from '../services/transferService.js';
import { poolAccountsOf, snapshot as householdSnapshot } from '../services/householdService.js';
import { todayIso } from '../services/mainAmountService.js';
import { logoSchema } from '../utils/logo.js';
import type { TokenScope } from './accessTokens.js';

// The assistant policy (audit decision I-11, docs/ASSISTANT-ENDPOINTS.md): every write an access
// token may make, one row each in ASSISTANT_ACTIONS. A token's write reaches a route only through
// the assistant endpoints (routes/assistant.ts), which find its row here, log it and pass it on
// once; the route then applies its own rules as it does for the owner. Each row is an
// owner-approved exception (docs/READ-ONLY-ACCESS.md, CLAUDE.md): never add a writing, settings,
// backup, auth or bank one. assistantPolicy.test.ts holds an allowed case and the nearest refusal
// for every row.

// ─── What a categorise token may change ───────────────────────────────────────

const TRANSACTION_PATH = /^\/transactions\/([^/]+)$/i;
/** Exactly a category, never clearing it or anything else */
const categoriseBody = z.object({ categoryId: z.string().min(1).max(64) }).strict();

/**
 * Whether a categorise token may make this write: PUT /transactions/:id whose body sets only
 * the category, for a transaction dated today or earlier. The transactions route still applies
 * its own rules (reconciled rows, split parents, transfers, household links, payment envelopes).
 */
function categoriseAllows(method: string, path: string, body: unknown): boolean {
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

/** Edit a rule that is still disabled, without enabling or reordering it */
function editProposedRuleAllows(method: string, rawPath: string, body: unknown): boolean {
  const rule = RULE_PATH.exec(rawPath);
  if (method !== 'PUT' || !rule || rule[1].toLowerCase() === 'reorder') return false;
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

/** Apply one category-only rule to uncategorised past transactions */
function applyRuleAllows(method: string, rawPath: string, body: unknown): boolean {
  if (method !== 'POST' || rawPath.toLowerCase() !== '/rules/apply') return false;
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

/** Link a pair of transactions the server itself suggests as a transfer */
function transferLinkAllows(method: string, rawPath: string, body: unknown): boolean {
  if (method !== 'POST' || rawPath.toLowerCase() !== '/transactions/transfers/link') return false;
  if (!isObject(body)) return false;
  const { transactionId: a, otherTransactionId: b } = body;
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return listTransferSuggestions().some(
    (s) => (s.outflow.id === a && s.inflow.id === b) || (s.outflow.id === b && s.inflow.id === a),
  );
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

/**
 * Whether an organise token may add a tax deduction claim (owner-approved,
 * docs/READ-ONLY-ACCESS.md): claim a past transaction that has no claim yet. Never replace or remove
 * a claim: those are the owner's. The tax route still validates the label and share and
 * refuses split parents and transfers.
 */
function taxClaimAllows(method: string, rawPath: string, body: unknown): boolean {
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
function householdContributionAllows(method: string, rawPath: string, body: unknown): boolean {
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
function ownContributionAllows(method: string, rawPath: string, body: unknown): boolean {
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

// ─── The policy table ─────────────────────────────────────────────────────────

export interface AssistantAction {
  /** Stored in the audit log: never rename one */
  name: string;
  /** The narrowest scope that may use it: categorise (and organise), or organise only */
  scope: 'categorise' | 'organise';
  /** What it lets an assistant do, for the owner's activity list */
  summary: string;
  /** Method and path relative to /api, and the parsed body */
  allows: (method: string, path: string, body: unknown) => boolean;
}

export const ASSISTANT_ACTIONS: readonly AssistantAction[] = [
  {
    name: 'categorise_transaction',
    scope: 'categorise',
    summary: 'Set the category of a past transaction',
    allows: categoriseAllows,
  },
  {
    name: 'manage_categories',
    scope: 'categorise',
    summary: 'Create or edit a category or group (never delete or reorder)',
    allows: categoryManageAllows,
  },
  {
    name: 'undo_change_set',
    scope: 'categorise',
    summary: 'Undo its own category changes',
    allows: undoChangeSetAllows,
  },
  {
    name: 'rule_dry_run',
    scope: 'organise',
    summary: 'Test or preview a rule (changes nothing)',
    allows: ruleDryRunAllows,
  },
  {
    name: 'propose_rule',
    scope: 'organise',
    summary: 'Propose a rule, saved disabled',
    allows: proposeRuleAllows,
  },
  {
    name: 'edit_proposed_rule',
    scope: 'organise',
    summary: 'Edit a rule that is still disabled',
    allows: editProposedRuleAllows,
  },
  {
    name: 'apply_rule',
    scope: 'organise',
    summary: 'Apply a category-only rule to uncategorised past transactions',
    allows: applyRuleAllows,
  },
  {
    name: 'payee_default_category',
    scope: 'organise',
    summary: 'Set a payee’s default category',
    allows: payeeDefaultCategoryAllows,
  },
  {
    name: 'payee_logo',
    scope: 'organise',
    summary: 'Set or replace a payee’s logo',
    allows: payeeLogoAllows,
  },
  {
    name: 'link_transfer',
    scope: 'organise',
    summary: 'Link a transfer the server suggests',
    allows: transferLinkAllows,
  },
  {
    name: 'suggest_assignments',
    scope: 'organise',
    summary: 'Suggest budget assignments for the owner to apply',
    allows: budgetProposalAllows,
  },
  {
    name: 'claim_tax_deduction',
    scope: 'organise',
    summary: 'Claim an unclaimed past transaction as a tax deduction',
    allows: taxClaimAllows,
  },
  {
    name: 'household_contribution',
    scope: 'organise',
    summary: 'Record a household contribution linked to its deposit',
    allows: householdContributionAllows,
  },
  {
    name: 'own_household_contribution',
    scope: 'organise',
    summary: 'Record your own contribution, up to what you owe',
    allows: ownContributionAllows,
  },
];

export const scopeMay = (scope: TokenScope, action: AssistantAction) =>
  action.scope === 'organise'
    ? scope === 'organise'
    : scope === 'categorise' || scope === 'organise';

/** The row that allows this write for this scope, if any (path relative to /api) */
export function assistantActionFor(
  scope: TokenScope,
  method: string,
  path: string,
  body: unknown,
): AssistantAction | undefined {
  return ASSISTANT_ACTIONS.find((a) => scopeMay(scope, a) && a.allows(method, path, body));
}
