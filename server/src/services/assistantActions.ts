// Audit decision I-11 (docs/AUDIT-2026-11.md; docs/READ-ONLY-ACCESS.md, "Assistant endpoint"):
// an access token never writes through the app's own routes directly. Every write goes to
// /api/assistant/do/<path>, where it must be one of the named actions below. The token's
// scope rules (auth/accessTokens.ts) still decide whether it is allowed, the target route still
// applies its own checks, and each one is logged here for the owner. Changes the owner must
// approve (depreciating assets) are proposals instead: kept here and applied only by the owner.
import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accessTokens, assistantActions, assistantProposals } from '../db/schema.js';
import {
  AssetError,
  assetInputSchema,
  createAsset,
  updateAsset,
} from './depreciatingAssetService.js';

/** The prefix a token's writes must use; the rest of the path is the app route it reaches */
export const ASSISTANT_DO = '/api/assistant/do';

/**
 * Every write an assistant can make, by name. Anything not listed is refused before the scope
 * rules are even asked. The name is what the owner sees in the activity log.
 */
const ACTIONS: { name: string; label: string; method: string; path: RegExp }[] = [
  { name: 'set-category', label: 'Set a category', method: 'PUT', path: /^\/transactions\/[^/]+$/ },
  { name: 'create-category', label: 'Create a category', method: 'POST', path: /^\/categories$/ },
  { name: 'edit-category', label: 'Edit a category', method: 'PUT', path: /^\/categories\/[^/]+$/ },
  {
    name: 'create-category-group',
    label: 'Create a category group',
    method: 'POST',
    path: /^\/categories\/groups$/,
  },
  {
    name: 'edit-category-group',
    label: 'Rename a category group',
    method: 'PUT',
    path: /^\/categories\/groups\/[^/]+$/,
  },
  { name: 'test-rule', label: 'Test a rule', method: 'POST', path: /^\/rules\/(test|preview)$/ },
  { name: 'propose-rule', label: 'Propose a rule', method: 'POST', path: /^\/rules$/ },
  {
    name: 'edit-proposed-rule',
    label: 'Edit a proposed rule',
    method: 'PUT',
    path: /^\/rules\/[^/]+$/,
  },
  { name: 'apply-rule', label: 'Apply a category rule', method: 'POST', path: /^\/rules\/apply$/ },
  { name: 'edit-payee', label: 'Payee default or logo', method: 'PUT', path: /^\/payees\/[^/]+$/ },
  {
    name: 'undo-change-set',
    label: 'Undo its own change',
    method: 'POST',
    path: /^\/change-sets\/[^/]+\/undo$/,
  },
  {
    name: 'link-transfer',
    label: 'Link a suggested transfer',
    method: 'POST',
    path: /^\/transactions\/transfers\/link$/,
  },
  {
    name: 'suggest-assignment',
    label: 'Suggest assignments',
    method: 'POST',
    path: /^\/budget-proposals$/,
  },
  {
    name: 'claim-tax',
    label: 'Claim a tax deduction',
    method: 'PUT',
    path: /^\/tax\/claims\/[^/]+$/,
  },
  {
    name: 'household-contribution',
    label: 'Record a household contribution',
    method: 'POST',
    path: /^\/households\/[^/]+\/events$/,
  },
  { name: 'propose', label: 'Propose a change', method: 'POST', path: /^\/assistant\/proposals$/ },
];

/** The named action for a write, or null; paths compare as the router does (case, trailing /) */
export function assistantAction(method: string, rawPath: string) {
  const path = rawPath.toLowerCase().replace(/\/+$/, '');
  return ACTIONS.find((a) => a.method === method && a.path.test(path)) ?? null;
}

export const actionLabel = (name: string) => ACTIONS.find((a) => a.name === name)?.label ?? name;

/** A request body for the log: long strings (a logo, a note) shortened, at most 2 KB */
export function logDetail(body: unknown) {
  if (body === undefined || body === null) return null;
  const text = JSON.stringify(body, (_k, v) =>
    typeof v === 'string' && v.length > 120 ? `${v.slice(0, 40)}… (${v.length} characters)` : v,
  );
  return text.length > 2048 ? `${text.slice(0, 2045)}...` : text;
}

function tokenName(tokenId: string) {
  return (
    db
      .select({ name: accessTokens.name })
      .from(accessTokens)
      .where(eq(accessTokens.id, tokenId))
      .get()?.name ?? 'Deleted token'
  );
}

/** Log a write as it starts; finishAction records how it ended */
export function startAction(
  tokenId: string,
  action: string,
  method: string,
  path: string,
  body: unknown,
) {
  const id = nanoid();
  db.insert(assistantActions)
    .values({
      id,
      tokenId,
      tokenName: tokenName(tokenId),
      action,
      method,
      path: path.slice(0, 300),
      detail: logDetail(body),
      status: null,
      createdAt: new Date().toISOString(),
    })
    .run();
  return id;
}

export function finishAction(id: string, status: number) {
  db.update(assistantActions).set({ status }).where(eq(assistantActions.id, id)).run();
}

/** The newest first */
export function listActions(limit = 200) {
  return db
    .select()
    .from(assistantActions)
    .orderBy(desc(assistantActions.createdAt))
    .limit(Math.min(Math.max(limit, 1), 1000))
    .all()
    .map((a) => ({ ...a, label: actionLabel(a.action) }));
}

// ─── Proposals: changes only the owner applies ───────────────────────────────

export class ProposalError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const proposalSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('asset.create'),
    asset: assetInputSchema,
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({
    kind: z.literal('asset.update'),
    assetId: z.string().min(1).max(64),
    asset: assetInputSchema,
    note: z.string().trim().max(1000).optional(),
  }),
]);
export type ProposalInput = z.infer<typeof proposalSchema>;

/** At most this many pending at once, so a runaway assistant can't flood the owner */
const MAX_PENDING = 50;

export function createAssistantProposal(tokenId: string, input: ProposalInput) {
  const pending = db
    .select({ id: assistantProposals.id })
    .from(assistantProposals)
    .where(eq(assistantProposals.status, 'pending'))
    .all().length;
  if (pending >= MAX_PENDING)
    throw new ProposalError(
      `There are already ${MAX_PENDING} proposals waiting for the owner`,
      409,
    );
  const id = nanoid();
  const row = {
    id,
    tokenId,
    tokenName: tokenName(tokenId),
    kind: input.kind,
    targetId: input.kind === 'asset.update' ? input.assetId : null,
    payload: JSON.stringify(input.asset),
    note: input.note ?? null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.insert(assistantProposals).values(row).run();
  return getProposal(id);
}

function getProposal(id: string) {
  const p = db.select().from(assistantProposals).where(eq(assistantProposals.id, id)).get();
  if (!p) throw new ProposalError('Proposal not found', 404);
  return { ...p, payload: JSON.parse(p.payload) as unknown };
}

export function listAssistantProposals(status?: 'pending') {
  const q = db.select().from(assistantProposals);
  return (status ? q.where(eq(assistantProposals.status, status)) : q)
    .orderBy(desc(assistantProposals.createdAt))
    .limit(500)
    .all()
    .map((p) => ({ ...p, payload: JSON.parse(p.payload) as unknown }));
}

/**
 * The owner applies a proposal: it runs as if the owner had made the change, through the same
 * service and its checks (lodged-year locks included). A refusal leaves it pending, with why.
 */
export function applyAssistantProposal(id: string) {
  const p = getProposal(id);
  if (p.status !== 'pending') throw new ProposalError('This proposal was already decided', 409);
  const asset = assetInputSchema.parse(p.payload);
  let resultId: string;
  try {
    resultId =
      p.kind === 'asset.create'
        ? (createAsset(asset) as { id: string }).id
        : (updateAsset(p.targetId!, asset), p.targetId!);
  } catch (e) {
    const message =
      e instanceof AssetError
        ? e.message
        : e instanceof z.ZodError
          ? `The proposal is incomplete: ${e.issues.map((i) => i.path.join('.') || i.message).join(', ')}`
          : null;
    if (message === null) throw e;
    db.update(assistantProposals)
      .set({ error: message })
      .where(eq(assistantProposals.id, id))
      .run();
    throw new ProposalError(message, e instanceof AssetError ? e.status : 400);
  }
  db.update(assistantProposals)
    .set({ status: 'applied', resultId, error: null, decidedAt: new Date().toISOString() })
    .where(eq(assistantProposals.id, id))
    .run();
  return getProposal(id);
}

export function declineAssistantProposal(id: string) {
  const p = getProposal(id);
  if (p.status !== 'pending') throw new ProposalError('This proposal was already decided', 409);
  db.update(assistantProposals)
    .set({ status: 'declined', decidedAt: new Date().toISOString() })
    .where(eq(assistantProposals.id, id))
    .run();
  return getProposal(id);
}
