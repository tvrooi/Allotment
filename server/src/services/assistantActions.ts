// Audit decision I-11 (docs/ASSISTANT-ENDPOINTS.md): an access token never writes through the
// app's own routes directly. Every write goes to /api/assistant/do/<path>, where requireSession
// (routes/auth.ts) checks it against the policy table (auth/assistantPolicy.ts) and logs it
// (services/assistantLog.ts); the target route still applies its own checks. Changes the owner
// must approve (depreciating assets) are proposals instead: kept here, applied only by the owner.
import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accessTokens, assistantProposals } from '../db/schema.js';
import {
  AssetError,
  assetInputSchema,
  createAsset,
  updateAsset,
} from './depreciatingAssetService.js';

/** The prefix a token's writes must use; the rest of the path is the app route it reaches */
export const ASSISTANT_DO = '/api/assistant/do';

// ─── Proposals: changes only the owner applies ───────────────────────────────

function tokenName(tokenId: string) {
  return (
    db
      .select({ name: accessTokens.name })
      .from(accessTokens)
      .where(eq(accessTokens.id, tokenId))
      .get()?.name ?? 'Deleted token'
  );
}

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
