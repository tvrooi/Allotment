import { and, desc, eq, inArray, isNotNull, like, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../db/index.js';
import { accountTransactionSum } from './balances.js';
import {
  accounts,
  transactions,
  upDeletedImports,
  upSourceRecords,
  upAccountMappings,
} from '../db/schema.js';
import { cleanUpText, upObservationSchema, type UpTransaction } from './upTransactions.js';
import { linkTransfer, listTransferSuggestions } from './transferService.js';

export function bankObservation(tx: UpTransaction) {
  const a = tx.attributes;
  return {
    status: a.status,
    amount: a.amount.valueInBaseUnits,
    createdAt: a.createdAt,
    settledAt: a.settledAt,
    description: cleanUpText(a.description).slice(0, 200),
    notes: [a.message, a.note?.text]
      .filter(Boolean)
      .map((v) => cleanUpText(v!))
      .join(' · ')
      .slice(0, 5000),
    roundUpAmount: a.roundUp?.amount.valueInBaseUnits ?? null,
    boostAmount: a.roundUp?.boostPortion?.valueInBaseUnits ?? null,
    cashbackAmount: a.cashback?.amount.valueInBaseUnits ?? null,
    cashbackDescription: a.cashback ? cleanUpText(a.cashback.description).slice(0, 200) : null,
    transferAccountId: tx.relationships.transferAccount.data?.id ?? null,
  };
}
type Observation = ReturnType<typeof bankObservation>;
const observation = (json: string): Observation => upObservationSchema.parse(JSON.parse(json));

/** Called only after the complete account response has validated, inside its import transaction. */
export function observeUpAccount(
  accountId: string,
  history: UpTransaction[],
  now: string,
  newIds: Set<string>,
  upAccountId: string,
  /** Up imports that may duplicate an older row (importedId -> that row's id), flagged for review */
  overlaps: Map<string, string> = new Map(),
  /** The account's first sync: what arrives then is the starting history, not a change to review */
  firstSync = false,
  /**
   * An incremental sync fetched only rows created from this day on (plus open holds): an older
   * record it didn't see is just outside the window, not gone from Up. Null = a full sweep.
   */
  coveredFrom: string | null = null,
) {
  const seen = new Set<string>();
  for (const tx of history) {
    const importedId = `up:${upAccountId}:${tx.id}`;
    seen.add(importedId);
    const sourceJson = JSON.stringify(bankObservation(tx));
    const old = db
      .select()
      .from(upSourceRecords)
      .where(eq(upSourceRecords.importedId, importedId))
      .get();
    const local = db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), eq(transactions.importedId, importedId)))
      .get();
    const changed = old && (old.sourceJson !== sourceJson || !old.seenInLatest);
    const wasHeld = old?.reviewState === 'pending' && observation(old.sourceJson).status === 'HELD';
    const reviewState =
      tx.attributes.status === 'HELD'
        ? !old
          ? 'pending'
          : changed
            ? wasHeld && !old.transactionId
              ? 'pending'
              : 'changed'
            : old.reviewState
        : newIds.has(importedId)
          ? overlaps.has(importedId)
            ? 'overlap'
            : firstSync
              ? 'reviewed'
              : 'new'
          : changed && !wasHeld
            ? 'changed'
            : old?.reviewState === 'pending'
              ? 'reviewed'
              : (old?.reviewState ?? 'reviewed');
    db.insert(upSourceRecords)
      .values({
        importedId,
        accountId,
        transactionId: local?.id ?? null,
        sourceJson,
        reviewState,
        overlapTransactionId: overlaps.get(importedId) ?? null,
        upCategory: tx.relationships.category?.data?.id ?? null,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: upSourceRecords.importedId,
        set: {
          transactionId: local?.id ?? null,
          sourceJson,
          reviewState,
          previousJson: changed ? (old?.previousJson ?? old?.sourceJson) : old?.previousJson,
          revision: (old?.revision ?? 1) + (changed ? 1 : 0),
          seenInLatest: 1,
          upCategory: tx.relationships.category?.data?.id ?? null,
          lastSeenAt: now,
        },
      })
      .run();
  }
  for (const old of db
    .select()
    .from(upSourceRecords)
    .where(eq(upSourceRecords.accountId, accountId))
    .all()) {
    if (seen.has(old.importedId) || !old.seenInLatest) continue;
    if (coveredFrom && observation(old.sourceJson).createdAt.slice(0, 10) < coveredFrom) continue;
    db.update(upSourceRecords)
      .set({
        seenInLatest: 0,
        reviewState: 'missing',
        revision: old.revision + 1,
        previousJson: old.previousJson ?? old.sourceJson,
        lastSeenAt: now,
      })
      .where(eq(upSourceRecords.importedId, old.importedId))
      .run();
  }
}

const needsReview = inArray(upSourceRecords.reviewState, ['new', 'changed', 'missing', 'overlap']);
/** The older row a flagged import may duplicate, as it is now (null once it's gone) */
function overlapOf(r: { reviewState: string; overlapTransactionId: string | null }) {
  if (r.reviewState !== 'overlap' || !r.overlapTransactionId) return null;
  const old = db
    .select()
    .from(transactions)
    .where(eq(transactions.id, r.overlapTransactionId))
    .get();
  return old
    ? {
        id: old.id,
        date: old.date,
        amount: old.amount,
        payee: old.payeeName,
        reconciled: old.reconciled === 1,
      }
    : null;
}
export function upReview(offset = 0) {
  const names = new Map(
    db
      .select({ id: upAccountMappings.upAccountId, name: upAccountMappings.name })
      .from(upAccountMappings)
      .all()
      .map((r) => [r.id, r.name]),
  );
  const view = (json: string) => {
    const source = observation(json);
    return {
      ...source,
      transferAccountName: source.transferAccountId
        ? (names.get(source.transferAccountId) ?? 'Unlinked Up account')
        : null,
    };
  };
  const rows = db
    .select({ record: upSourceRecords, accountName: accounts.name })
    .from(upSourceRecords)
    .innerJoin(accounts, eq(accounts.id, upSourceRecords.accountId))
    .where(needsReview)
    .orderBy(desc(upSourceRecords.lastSeenAt), upSourceRecords.importedId)
    .limit(50)
    .offset(offset)
    .all();
  return {
    deleted: deletedUpImports(),
    total: db
      .select({ count: sql<number>`count(*)` })
      .from(upSourceRecords)
      .where(needsReview)
      .get()!.count,
    pending: db
      .select({ count: sql<number>`count(*)` })
      .from(upSourceRecords)
      .where(and(eq(upSourceRecords.reviewState, 'pending'), eq(upSourceRecords.seenInLatest, 1)))
      .get()!.count,
    items: rows.map(({ record: r, accountName }) => ({
      importedId: r.importedId,
      accountId: r.accountId,
      transactionId: r.transactionId,
      accountName,
      reviewState: r.reviewState,
      revision: r.revision,
      overlap: overlapOf(r),
      current: view(r.sourceJson),
      previous: r.previousJson ? view(r.previousJson) : null,
    })),
  };
}

/**
 * Up transactions the owner deleted here that Up still has (`up_deleted_imports`), newest first,
 * with what Up last reported about each. Restoring one lets the next sync import it again.
 * Other providers' deletions are listed by GET /transactions/deleted-imports (audit F-14).
 */
export function deletedUpImports() {
  return db
    .select({
      accountId: upDeletedImports.accountId,
      importedId: upDeletedImports.importedId,
      deletedAt: upDeletedImports.deletedAt,
      accountName: accounts.name,
    })
    .from(upDeletedImports)
    .innerJoin(accounts, eq(accounts.id, upDeletedImports.accountId))
    .where(like(upDeletedImports.importedId, 'up:%'))
    .orderBy(desc(upDeletedImports.deletedAt), upDeletedImports.importedId)
    .limit(200)
    .all()
    .map((d) => {
      // A cashback row shares its purchase's bank record
      const cashback = d.importedId.endsWith(':cashback');
      const record = db
        .select({ sourceJson: upSourceRecords.sourceJson })
        .from(upSourceRecords)
        .where(eq(upSourceRecords.importedId, d.importedId.replace(/:cashback$/, '')))
        .get();
      let source: Observation | null = null;
      try {
        source = record ? observation(record.sourceJson) : null;
      } catch {
        source = null;
      }
      return {
        ...d,
        date: source ? source.createdAt.slice(0, 10) : null,
        description: source
          ? cashback
            ? (source.cashbackDescription ?? 'Up cashback')
            : source.description
          : null,
        amount: source ? (cashback ? source.cashbackAmount : source.amount) : null,
      };
    });
}

/** Forgets a deletion, so the next sync imports the transaction again. False if there was none. */
export function restoreDeletedUpImport(accountId: string, importedId: string) {
  return (
    db
      .delete(upDeletedImports)
      .where(
        and(eq(upDeletedImports.accountId, accountId), eq(upDeletedImports.importedId, importedId)),
      )
      .run().changes > 0
  );
}

export function roundUpDays(since: string) {
  const groups = new Map<
    string,
    {
      date: string;
      accountId: string;
      accountName: string;
      amount: number;
      boost: number;
      purchases: {
        transactionId: string | null;
        description: string;
        amount: number;
        roundUpAmount: number;
        status: string;
      }[];
    }
  >();
  const rows = db
    .select({ record: upSourceRecords, accountName: accounts.name })
    .from(upSourceRecords)
    .innerJoin(accounts, eq(accounts.id, upSourceRecords.accountId))
    .where(
      and(
        eq(upSourceRecords.seenInLatest, 1),
        sql`json_extract(${upSourceRecords.sourceJson}, '$.createdAt') >= ${since}`,
        sql`json_extract(${upSourceRecords.sourceJson}, '$.roundUpAmount') < 0`,
      ),
    )
    .all();
  for (const { record: r, accountName } of rows) {
    const source = observation(r.sourceJson);
    if (source.status !== 'SETTLED') continue;
    const date = source.createdAt.slice(0, 10),
      key = date + ':' + r.accountId;
    const group = groups.get(key) ?? {
      date,
      accountId: r.accountId,
      accountName,
      amount: 0,
      boost: 0,
      purchases: [],
    };
    group.amount -= source.roundUpAmount!;
    group.boost -= source.boostAmount ?? 0;
    if (!Number.isSafeInteger(group.amount) || !Number.isSafeInteger(group.boost))
      throw new Error('Round-up details exceed the supported total.');
    group.purchases.push({
      transactionId: r.transactionId,
      description: source.description,
      amount: source.amount,
      roundUpAmount: -source.roundUpAmount!,
      status: source.status,
    });
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || a.accountName.localeCompare(b.accountName),
  );
}

// Round-up accounting. Up attaches round-up metadata to a settled purchase but supplies no
// link to the Saver credit, so purchases and credits are never paired here. The account's own
// settled balance decides whether the spending-side debit is missing from the register.
export const ROUND_UP_SUFFIX = ':roundup';
const dollars = (cents: number) =>
  `$${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;

/** The debit a settled purchase's round-up implies, for purchases settled after the first
 * sync. Earlier purchases are already part of the bootstrapped opening balance. */
export function roundUpDebit(
  importedId: string,
  source: Observation,
  initializedAt: string | null,
) {
  if (!initializedAt || source.status !== 'SETTLED' || !source.settledAt) return null;
  if (source.roundUpAmount === null || source.roundUpAmount >= 0) return null;
  if (Date.parse(source.settledAt) <= Date.parse(initializedAt)) return null;
  return {
    date: source.createdAt.slice(0, 10),
    amount: source.roundUpAmount,
    payeeName: 'Up round-up',
    notes: [
      `Round-up from ${source.description || 'an Up purchase'}`,
      source.boostAmount ? `includes ${dollars(source.boostAmount)} boost` : null,
      'Up round-up: linked to its Saver credit once Up reports it.',
    ]
      .filter(Boolean)
      .join(' · '),
    importedId: importedId + ROUND_UP_SUFFIX,
  };
}

/**
 * Round-ups belong to their purchase; they aren't a transfer for the owner to confirm
 * (owner-requested on 7 November 2026). Links a suggested pair only when all of this holds:
 * Up reported it (one side names the other's account), both sides are Up's own records, same
 * day and exactly the same amount, and the money out is a round-up: a debit made from a
 * purchase's round-up (ROUND_UP_SUFFIX), or an Up debit for exactly one purchase's round-up or
 * that day's round-ups from that account. Anything else stays a suggestion, and a pair the owner
 * marked "Not a transfer" is never suggested, so never linked. Returns how many were linked.
 */
export function linkRoundUpTransfers(): number {
  const pairs = listTransferSuggestions().filter(
    (s) =>
      s.reported &&
      s.days === 0 &&
      s.outflow.amount < 0 &&
      s.outflow.amount === -s.inflow.amount &&
      !!s.outflow.importedId?.startsWith('up:') &&
      !!s.inflow.importedId?.startsWith('up:'),
  );
  if (!pairs.length) return 0;
  const since = pairs.reduce((d, s) => (s.outflow.date < d ? s.outflow.date : d), '9999-12-31');
  const roundUps = new Map<string, Set<number>>();
  for (const day of roundUpDays(since))
    roundUps.set(
      `${day.date}:${day.accountId}`,
      new Set([day.amount, ...day.purchases.map((p) => p.roundUpAmount)]),
    );
  let linked = 0;
  for (const s of pairs) {
    const isRoundUp =
      s.outflow.importedId!.endsWith(ROUND_UP_SUFFIX) ||
      !!roundUps.get(`${s.outflow.date}:${s.outflow.accountId}`)?.has(-s.outflow.amount);
    if (!isRoundUp) continue;
    try {
      linkTransfer(s.outflow.id, s.inflow.id);
      linked++;
    } catch (err) {
      // A reconciled or edited side refuses the link: it stays a suggestion for the owner
      console.warn(
        `A round-up stays a transfer suggestion: ${err instanceof Error ? err.message : 'could not link'}`,
      );
    }
  }
  return linked;
}

export const upTransactionId = (accountId: string, importedId: string) =>
  createHash('sha256').update(`${accountId}:${importedId}`).digest('base64url');

const hasImport = (accountId: string, importedId: string) =>
  !!db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), eq(transactions.importedId, importedId)))
    .get();

export type RoundUpVerdict = 'unknown' | 'matches' | 'round-ups' | 'unexplained';
/** Compare Up's last settled balance with the register, per linked account. */
export function roundUpCheck() {
  return db
    .select({ mapping: upAccountMappings, account: accounts })
    .from(upAccountMappings)
    .innerJoin(accounts, eq(accounts.id, upAccountMappings.accountId))
    .where(and(isNotNull(upAccountMappings.initializedAt), eq(upAccountMappings.isEnabled, 1)))
    .all()
    .map(({ mapping, account }) => {
      const missing = db
        .select()
        .from(upSourceRecords)
        .where(and(eq(upSourceRecords.accountId, account.id), eq(upSourceRecords.seenInLatest, 1)))
        .all()
        .map((r) => roundUpDebit(r.importedId, observation(r.sourceJson), mapping.initializedAt))
        .filter((row) => row !== null && !hasImport(account.id, row.importedId))
        .map((row) => row!);
      const total = missing.reduce((s, r) => s + r.amount, 0);
      const register = account.startingBalance + accountTransactionSum(account.id);
      const difference = mapping.settledBalance === null ? null : mapping.settledBalance - register;
      const verdict: RoundUpVerdict =
        difference === null
          ? 'unknown'
          : difference === 0
            ? 'matches'
            : total !== 0 && difference === total
              ? 'round-ups'
              : 'unexplained';
      return {
        accountId: account.id,
        accountName: account.name,
        settledBalance: mapping.settledBalance,
        register,
        difference,
        missing: { count: missing.length, total },
        verdict,
        enabledAt: mapping.roundUpDebitsAt,
        rows: missing,
      };
    });
}

export class RoundUpError extends Error {}
/** Owner-approved: add the debits the balance proves missing, and keep adding new ones on sync. */
export function enableRoundUpDebits(
  accountId: string,
  expected: { count: number; total: number },
  insert: (row: NonNullable<ReturnType<typeof roundUpDebit>>) => void,
) {
  return db.transaction(() => {
    const check = roundUpCheck().find((c) => c.accountId === accountId);
    if (!check) throw new RoundUpError('Choose a synced Up account.');
    if (check.enabledAt) return { added: 0, enabledAt: check.enabledAt };
    if (check.verdict !== 'round-ups')
      throw new RoundUpError(
        'The balance difference is not explained by round-ups alone. Nothing was added.',
      );
    if (check.missing.count !== expected.count || check.missing.total !== expected.total)
      throw new RoundUpError('The round-up check changed. Refresh before adding debits.');
    for (const row of check.rows) insert(row);
    const enabledAt = new Date().toISOString();
    db.update(upAccountMappings)
      .set({ roundUpDebitsAt: enabledAt })
      .where(eq(upAccountMappings.accountId, accountId))
      .run();
    return { added: check.rows.length, enabledAt };
  });
}
