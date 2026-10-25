import { and, desc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accessTokens,
  assistantChangeEntries,
  assistantChangeSets,
  transactions,
} from '../db/schema.js';

// Category changes an access token made (an MCP categorise or rule tool call), kept so the owner
// or that token can put them back. Undo restores a transaction's previous category only while it
// still has the category the change set gave it and isn't reconciled: a later edit wins.

export interface ChangeEntry {
  transactionId: string;
  previousCategoryId: string | null;
  newCategoryId: string;
}

/** Saves one tool call's changes; returns the change set id, or null when nothing changed */
export function recordChangeSet(
  tokenId: string | undefined,
  tool: string,
  summary: string,
  entries: ChangeEntry[],
): string | null {
  const changed = entries.filter((e) => e.previousCategoryId !== e.newCategoryId);
  if (!changed.length) return null;
  const tokenName =
    (tokenId &&
      db
        .select({ name: accessTokens.name })
        .from(accessTokens)
        .where(eq(accessTokens.id, tokenId))
        .get()?.name) ||
    'Assistant';
  const id = nanoid();
  db.transaction((tx) => {
    tx.insert(assistantChangeSets)
      .values({
        id,
        tokenId: tokenId ?? null,
        tokenName,
        tool,
        summary,
        createdAt: new Date().toISOString(),
      })
      .run();
    for (const e of changed)
      tx.insert(assistantChangeEntries)
        .values({ changeSetId: id, ...e })
        .run();
  });
  return id;
}

/** The latest change sets, newest first; a token sees only its own */
export function listChangeSets(tokenId?: string, limit = 50) {
  const sets = db
    .select()
    .from(assistantChangeSets)
    .where(tokenId ? eq(assistantChangeSets.tokenId, tokenId) : undefined)
    .orderBy(desc(assistantChangeSets.createdAt))
    .limit(limit)
    .all();
  if (!sets.length) return [];
  const counts = new Map<string, number>();
  for (const e of db
    .select({ id: assistantChangeEntries.changeSetId })
    .from(assistantChangeEntries)
    .where(
      inArray(
        assistantChangeEntries.changeSetId,
        sets.map((s) => s.id),
      ),
    )
    .all())
    counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
  return sets.map((s) => ({ ...s, transactionCount: counts.get(s.id) ?? 0 }));
}

export class ChangeSetError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Puts back the previous categories; `tokenId` limits it to that token's own change sets */
export function undoChangeSet(id: string, tokenId?: string) {
  const set = db.select().from(assistantChangeSets).where(eq(assistantChangeSets.id, id)).get();
  if (!set || (tokenId && set.tokenId !== tokenId))
    throw new ChangeSetError('Change set not found', 404);
  if (set.undoneAt) throw new ChangeSetError('This change set was already undone', 409);
  const entries = db
    .select()
    .from(assistantChangeEntries)
    .where(eq(assistantChangeEntries.changeSetId, id))
    .all();
  let restored = 0;
  const skipped: string[] = [];
  db.transaction((tx) => {
    for (const e of entries) {
      const row = tx
        .select({ categoryId: transactions.categoryId, reconciled: transactions.reconciled })
        .from(transactions)
        .where(eq(transactions.id, e.transactionId))
        .get();
      if (!row || row.reconciled === 1 || row.categoryId !== e.newCategoryId) {
        skipped.push(e.transactionId);
        continue;
      }
      tx.update(transactions)
        .set({ categoryId: e.previousCategoryId })
        .where(
          and(eq(transactions.id, e.transactionId), eq(transactions.categoryId, e.newCategoryId)),
        )
        .run();
      restored++;
    }
    tx.update(assistantChangeSets)
      .set({ undoneAt: new Date().toISOString() })
      .where(eq(assistantChangeSets.id, id))
      .run();
  });
  return { restored, skipped };
}
