import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, transactions, upSourceRecords, upAccountMappings } from '../db/schema.js';
import { cleanUpText, upObservationSchema, type UpTransaction } from './upTransactions.js';

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
          ? 'new'
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

const needsReview = inArray(upSourceRecords.reviewState, ['new', 'changed', 'missing']);
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
      current: view(r.sourceJson),
      previous: r.previousJson ? view(r.previousJson) : null,
    })),
  };
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
