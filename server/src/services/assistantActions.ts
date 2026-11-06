// Audit decision I-11 (docs/ASSISTANT-ENDPOINTS.md): an access token never writes through the
// app's own routes directly. Every write goes to /api/assistant/do/<path>, where requireSession
// (routes/auth.ts) checks it against the policy table (auth/assistantPolicy.ts) and logs it
// (services/assistantLog.ts); the target route still applies its own checks. Changes the owner
// must approve (depreciating assets, household corrections) are proposals instead: kept here,
// applied only by the owner.
import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accessTokens, accounts, assistantProposals, transactions } from '../db/schema.js';
import {
  AssetError,
  assetInputSchema,
  createAsset,
  updateAsset,
} from './depreciatingAssetService.js';
import { poolGroupOf, recordEvent, removeEvent, snapshot } from './householdService.js';
import { todayIso } from './mainAmountService.js';
import { TransferError, unlinkTransfer } from './transferService.js';

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

/** Most items one household proposal carries */
export const MAX_PROPOSAL_ITEMS = 50;
const id = z.string().min(1).max(64);
const note = z.string().trim().max(1000).optional();
const ids = z.array(id).min(1).max(MAX_PROPOSAL_ITEMS);

export const proposalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('asset.create'), asset: assetInputSchema, note }),
  z.object({ kind: z.literal('asset.update'), assetId: id, asset: assetInputSchema, note }),
  // Household corrections (owner-requested on 6 November 2026): each is one batch the owner
  // applies or declines whole
  z.object({ kind: z.literal('household.remove_entries'), householdId: id, eventIds: ids, note }),
  z.object({
    kind: z.literal('household.share_bills'),
    householdId: id,
    bills: z
      .array(
        z.object({
          transactionId: id,
          description: z.string().trim().min(1).max(200).optional(),
          /** Each person's exact share in cents; equal between everyone when left out */
          shares: z
            .array(z.object({ personId: id, amount: z.number().int().min(0) }))
            .min(1)
            .max(50)
            .optional(),
        }),
      )
      .min(1)
      .max(MAX_PROPOSAL_ITEMS),
    note,
  }),
  z.object({ kind: z.literal('household.unlink_transfers'), transactionIds: ids, note }),
]);
export type ProposalInput = z.infer<typeof proposalSchema>;

/** At most this many pending at once, so a runaway assistant can't flood the owner */
const MAX_PENDING = 50;

export function createAssistantProposal(tokenId: string, input: ProposalInput) {
  // Counted in the transaction that inserts, so the cap holds (docs/ASSISTANT-PHASE-3.md)
  return db.transaction(() => {
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
    const { targetId, payload } = proposalContent(input);
    const proposalId = nanoid();
    const row = {
      id: proposalId,
      tokenId,
      tokenName: tokenName(tokenId),
      kind: input.kind,
      targetId,
      payload: JSON.stringify(payload),
      note: input.note ?? null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.insert(assistantProposals).values(row).run();
    return getProposal(proposalId);
  });
}

// ─── Household corrections ───────────────────────────────────────────────────

type HouseholdState = ReturnType<typeof snapshot>;

function household(householdId: string): HouseholdState {
  try {
    return snapshot(householdId);
  } catch {
    throw new ProposalError('Household not found', 404);
  }
}
const personName = (state: HouseholdState, personId: string | null) =>
  personId === null
    ? 'The household account'
    : (state.people.find((p) => p.id === personId)?.name ?? 'Someone else');
const transactionRow = (transactionId: string) =>
  db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
const accountName = (accountId: string) =>
  db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, accountId)).get()?.name ??
  'Unknown account';
function unique(values: string[], what: string) {
  if (new Set(values).size !== values.length) throw new ProposalError(`Name each ${what} once`);
}

/**
 * What a proposal stores: the request, checked now so the assistant hears about a mistake at
 * once, and what the owner reads before applying (dates, amounts, people). Applying checks
 * everything again through the household and transfer services.
 */
function proposalContent(input: ProposalInput): { targetId: string | null; payload: unknown } {
  switch (input.kind) {
    case 'asset.create':
      return { targetId: null, payload: input.asset };
    case 'asset.update':
      return { targetId: input.assetId, payload: input.asset };
    case 'household.remove_entries': {
      const state = household(input.householdId);
      unique(input.eventIds, 'entry');
      const entries = input.eventIds.map((eventId) => {
        const e = state.events.find((x) => x.id === eventId);
        if (!e) throw new ProposalError(`Entry ${eventId} is not in this household`);
        return {
          eventId,
          date: e.date,
          kind: e.kind,
          description: e.description,
          amount: e.amount,
          payerId: e.payerId,
          paidBy: personName(state, e.payerId),
        };
      });
      return {
        targetId: input.householdId,
        payload: { householdId: input.householdId, household: state.group.name, entries },
      };
    }
    case 'household.share_bills': {
      const state = household(input.householdId);
      unique(
        input.bills.map((b) => b.transactionId),
        'payment',
      );
      const linked = new Set(state.events.map((e) => e.transactionId).filter(Boolean));
      const bills = input.bills.map((b) => {
        const tx = transactionRow(b.transactionId);
        if (!tx) throw new ProposalError(`Payment ${b.transactionId} not found`, 404);
        if (!state.poolAccountIds.includes(tx.accountId) || tx.amount >= 0)
          throw new ProposalError(`${tx.date}: only a payment out of this household's accounts`);
        if (tx.transferTransactionId)
          throw new ProposalError(`${tx.date}: a transfer is not a bill; unlink it first`);
        if (tx.date > todayIso()) throw new ProposalError(`${tx.date}: only a past payment`);
        if (linked.has(tx.id)) throw new ProposalError(`${tx.date}: already shared`);
        if (b.shares) {
          unique(
            b.shares.map((x) => x.personId),
            'person',
          );
          if (b.shares.some((x) => !state.people.some((p) => p.id === x.personId)))
            throw new ProposalError(`${tx.date}: share for someone outside this household`);
          if (b.shares.reduce((n, x) => n + x.amount, 0) !== -tx.amount)
            throw new ProposalError(`${tx.date}: the shares must add up to the payment`);
        }
        return {
          transactionId: tx.id,
          date: tx.date,
          amount: -tx.amount,
          description: b.description ?? tx.payeeName ?? tx.importedPayee ?? 'Bill',
          shares: (
            b.shares ?? state.people.map((p) => ({ personId: p.id, amount: null as number | null }))
          ).map((x) => ({
            personId: x.personId,
            name: personName(state, x.personId),
            amount: x.amount,
          })),
        };
      });
      return {
        targetId: input.householdId,
        payload: { householdId: input.householdId, household: state.group.name, bills },
      };
    }
    case 'household.unlink_transfers': {
      unique(input.transactionIds, 'transfer');
      const transfers = input.transactionIds.map((transactionId) => {
        const tx = transactionRow(transactionId);
        if (!tx) throw new ProposalError(`Transaction ${transactionId} not found`, 404);
        const other = tx.transferTransactionId ? transactionRow(tx.transferTransactionId) : null;
        if (!other) throw new ProposalError(`${tx.date}: not a transfer`);
        if (tx.date > todayIso()) throw new ProposalError(`${tx.date}: only a past transfer`);
        if (!poolGroupOf(tx.accountId) && !poolGroupOf(other.accountId))
          throw new ProposalError(`${tx.date}: only a transfer with a side in a household account`);
        return {
          transactionId,
          date: tx.date,
          amount: tx.amount,
          account: accountName(tx.accountId),
          bankDescription: tx.importedPayee ?? tx.payeeName ?? '',
          otherTransactionId: other.id,
          otherAccount: accountName(other.accountId),
          otherBankDescription: other.importedPayee ?? other.payeeName ?? '',
        };
      });
      return { targetId: null, payload: { transfers } };
    }
  }
}

/** Applies a household proposal's whole batch; any refusal undoes all of it */
function applyHouseholdProposal(kind: string, payload: unknown): string | null {
  return db.transaction(() => {
    if (kind === 'household.remove_entries') {
      const p = payload as {
        householdId: string;
        entries: {
          eventId: string;
          date: string;
          description: string;
          amount: number;
          payerId: string | null;
        }[];
      };
      const now = snapshot(p.householdId);
      for (const e of p.entries) {
        // Only the entry the owner was shown: one edited since is refused, not removed
        const current = now.events.find((x) => x.id === e.eventId);
        if (
          !current ||
          current.date !== e.date ||
          current.description !== e.description ||
          current.amount !== e.amount ||
          current.payerId !== e.payerId
        )
          throw new ProposalError(
            `${e.date}: “${e.description}” changed or went since this was proposed`,
            409,
          );
        removeEvent(p.householdId, e.eventId);
      }
      return p.householdId;
    }
    if (kind === 'household.share_bills') {
      const p = payload as {
        householdId: string;
        bills: {
          transactionId: string;
          date: string;
          amount: number;
          description: string;
          shares: { personId: string; amount: number | null }[];
        }[];
      };
      for (const b of p.bills) {
        const exact = b.shares.every((x) => x.amount !== null);
        recordEvent(p.householdId, {
          kind: 'expense',
          date: b.date,
          description: b.description,
          amount: b.amount,
          payerId: null,
          transactionId: b.transactionId,
          mode: exact ? 'exact' : 'equal',
          shares: b.shares.map((x) => ({ personId: x.personId, value: exact ? x.amount : 1 })),
        });
      }
      return p.householdId;
    }
    const p = payload as {
      transfers: { transactionId: string; otherTransactionId: string; date: string }[];
    };
    for (const t of p.transfers) {
      // Only the pair the owner was shown: a transaction linked to something else since is refused
      if (transactionRow(t.transactionId)?.transferTransactionId !== t.otherTransactionId)
        throw new ProposalError(`${t.date}: that transfer changed since this was proposed`, 409);
      unlinkTransfer(t.transactionId);
    }
    return null;
  });
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
  let resultId: string | null;
  try {
    if (p.kind.startsWith('household.')) resultId = applyHouseholdProposal(p.kind, p.payload);
    else {
      const asset = assetInputSchema.parse(p.payload);
      resultId =
        p.kind === 'asset.create'
          ? (createAsset(asset) as { id: string }).id
          : (updateAsset(p.targetId!, asset), p.targetId!);
    }
  } catch (e) {
    const message =
      e instanceof AssetError || e instanceof TransferError || e instanceof ProposalError
        ? e.message
        : e instanceof z.ZodError
          ? `The proposal is incomplete: ${e.issues.map((i) => i.path.join('.') || i.message).join(', ')}`
          : // The household service refuses with a plain Error, as its own route reports it
            p.kind.startsWith('household.') && e instanceof Error
            ? e.message
            : null;
    if (message === null) throw e;
    db.update(assistantProposals)
      .set({ error: message })
      .where(eq(assistantProposals.id, id))
      .run();
    throw new ProposalError(
      message,
      e instanceof AssetError || e instanceof TransferError || e instanceof ProposalError
        ? e.status
        : 400,
    );
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
