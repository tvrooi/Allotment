import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { savedViews, tags, transactions, transactionTags } from '../db/schema.js';
import { parseSelection, registerCondition, type Selection } from './transactionSelection.js';

// Phase 9 (docs/PHASE-9-DEVELOPMENT-PHASE.md): per-transaction review, visibility in reports,
// tags and saved views. All of it lives on register rows (unsplit transactions and split
// parents); split parts follow their parent. None of it writes money.

export class MarkError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** A register row by id, or an error: a split part is changed through its parent */
function registerRow(id: string) {
  const row = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!row) throw new MarkError('Transaction not found', 404);
  if (row.parentTransactionId) throw new MarkError('Change the whole split, not one part');
  return row;
}

/** The detail panel's toggles. Allowed on reconciled rows: they change no amounts */
export function setFlags(id: string, flags: { reviewed?: boolean; hiddenFromReports?: boolean }) {
  registerRow(id);
  const update: Partial<typeof transactions.$inferInsert> = {};
  if (flags.reviewed !== undefined) {
    update.reviewedAt = flags.reviewed ? new Date().toISOString() : null;
  }
  if (flags.hiddenFromReports !== undefined) {
    update.hiddenFromReports = flags.hiddenFromReports ? 1 : 0;
  }
  if (Object.keys(update).length) {
    db.update(transactions).set(update).where(eq(transactions.id, id)).run();
  }
  return db.select().from(transactions).where(eq(transactions.id, id)).get()!;
}

export interface ReviewChange {
  id: string;
  /** What reviewed_at was before, so an undo puts back exactly that */
  previous: string | null;
}

/**
 * Mark the selection's register rows reviewed (or not). `expectedCount` is the count the user
 * confirmed: if the selection now matches a different number of rows, nothing is written.
 */
export function reviewSelection(selection: Selection, reviewed: boolean, expectedCount: number) {
  return db.transaction((tx) => {
    const rows = tx
      .select({ id: transactions.id, reviewedAt: transactions.reviewedAt })
      .from(transactions)
      .where(registerCondition(selection))
      .all();
    if (rows.length !== expectedCount) {
      throw new MarkError(
        `The selection now has ${rows.length} transactions, not ${expectedCount}. Check it and try again.`,
        409,
      );
    }
    const at = reviewed ? new Date().toISOString() : null;
    const changed = rows.filter((r) => (r.reviewedAt !== null) !== reviewed);
    for (const r of changed) {
      tx.update(transactions).set({ reviewedAt: at }).where(eq(transactions.id, r.id)).run();
    }
    return {
      matched: rows.length,
      changes: changed.map((r) => ({ id: r.id, previous: r.reviewedAt })) as ReviewChange[],
    };
  });
}

/** Put review states back exactly (the undo of reviewSelection) */
export function restoreReview(changes: ReviewChange[]) {
  db.transaction((tx) => {
    for (const c of changes) {
      tx.update(transactions)
        .set({ reviewedAt: c.previous })
        .where(and(eq(transactions.id, c.id), isNull(transactions.parentTransactionId)))
        .run();
    }
  });
  return { restored: changes.length };
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export function listTags() {
  return db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      createdAt: tags.createdAt,
      count: sql<number>`(select count(*) from transaction_tags tt where tt.tag_id = ${tags.id})`,
    })
    .from(tags)
    .orderBy(sql`${tags.name} collate nocase`)
    .all();
}

function nameTaken(name: string, exceptId?: string) {
  const other = db
    .select({ id: tags.id })
    .from(tags)
    .where(sql`${tags.name} = ${name} collate nocase`)
    .get();
  return other && other.id !== exceptId;
}

export function createTag(input: { id?: string; name: string; color?: string }) {
  const name = input.name.trim();
  if (nameTaken(name)) throw new MarkError(`There is already a tag called "${name}"`, 409);
  const row = { id: input.id ?? nanoid(), name, ...(input.color ? { color: input.color } : {}) };
  db.insert(tags).values(row).run();
  return db.select().from(tags).where(eq(tags.id, row.id)).get()!;
}

export function updateTag(id: string, input: { name?: string; color?: string }) {
  if (!db.select().from(tags).where(eq(tags.id, id)).get())
    throw new MarkError('Tag not found', 404);
  const name = input.name?.trim();
  if (name && nameTaken(name, id))
    throw new MarkError(`There is already a tag called "${name}"`, 409);
  db.update(tags)
    .set({ ...(name ? { name } : {}), ...(input.color ? { color: input.color } : {}) })
    .where(eq(tags.id, id))
    .run();
  return db.select().from(tags).where(eq(tags.id, id)).get()!;
}

/** Removes the tag from its transactions; the transactions stay */
export function deleteTag(id: string) {
  db.delete(tags).where(eq(tags.id, id)).run();
}

/** Replace a register row's tags with exactly these (idempotent) */
export function setTransactionTags(id: string, tagIds: string[]) {
  registerRow(id);
  const unique = [...new Set(tagIds)];
  if (unique.length) {
    const known = db.select({ id: tags.id }).from(tags).where(inArray(tags.id, unique)).all();
    if (known.length !== unique.length) throw new MarkError('Unknown tag');
  }
  db.transaction((tx) => {
    tx.delete(transactionTags).where(eq(transactionTags.transactionId, id)).run();
    for (const tagId of unique)
      tx.insert(transactionTags).values({ transactionId: id, tagId }).run();
  });
  return unique;
}

/** Add a tag (rules): never removes one, and does nothing if it is already there */
export function addTransactionTag(id: string, tagId: string) {
  db.insert(transactionTags).values({ transactionId: id, tagId }).onConflictDoNothing().run();
}

/** Tag ids per register row, for the register and the export */
export function tagsByTransaction(ids: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 500) {
    const rows = db
      .select()
      .from(transactionTags)
      .where(inArray(transactionTags.transactionId, ids.slice(i, i + 500)))
      .all();
    for (const r of rows) map.set(r.transactionId, [...(map.get(r.transactionId) ?? []), r.tagId]);
  }
  return map;
}

// ─── Saved views ──────────────────────────────────────────────────────────────

const RANGES = new Set(['this-month', 'last-3', 'this-year', 'all']);
/** The All Transactions URL keys a view may carry (client: utils/transactionFilters.ts) */
const VIEW_KEYS = new Set([
  'from',
  'to',
  'search',
  'account_ids',
  'category_ids',
  'category_group_id',
  'uncategorized',
  'payee_ids',
  'payee_name',
  'direction',
  'min_amount',
  'max_amount',
  'transfers',
  'budget_report',
  'reviewed',
  'hidden',
  'tag_ids',
]);

/**
 * A saved view's query, checked like a request: only the All Transactions filter keys, each
 * once, a known date preset, and a selection the server accepts. Returns it normalised.
 */
export function validateViewQuery(query: string): string {
  if (query.length > 20_000) throw new MarkError('That view is too long');
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const selection: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key !== 'range' && !VIEW_KEYS.has(key)) throw new MarkError(`Unknown filter "${key}"`);
    if (key === 'range' ? params.getAll(key).length > 1 : key in selection) {
      throw new MarkError(`"${key}" appears twice`);
    }
    if (key === 'range') {
      if (!RANGES.has(value)) throw new MarkError(`Unknown date range "${value}"`);
    } else selection[key] = value;
  }
  if (!parseSelection(selection).success) throw new MarkError('That view has an invalid filter');
  return params.toString();
}

export function listViews() {
  return db.select().from(savedViews).orderBy(savedViews.sortOrder, savedViews.createdAt).all();
}

export function createView(input: { id?: string; name: string; query: string }) {
  const query = validateViewQuery(input.query);
  const sortOrder =
    (db
      .select({ max: sql<number>`coalesce(max(${savedViews.sortOrder}), -1)` })
      .from(savedViews)
      .get()?.max ?? -1) + 1;
  const row = { id: input.id ?? nanoid(), name: input.name.trim(), query, sortOrder };
  db.insert(savedViews).values(row).run();
  return db.select().from(savedViews).where(eq(savedViews.id, row.id)).get()!;
}

export function updateView(id: string, input: { name?: string; query?: string }) {
  if (!db.select().from(savedViews).where(eq(savedViews.id, id)).get())
    throw new MarkError('View not found', 404);
  db.update(savedViews)
    .set({
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.query !== undefined ? { query: validateViewQuery(input.query) } : {}),
    })
    .where(eq(savedViews.id, id))
    .run();
  return db.select().from(savedViews).where(eq(savedViews.id, id)).get()!;
}

export function deleteView(id: string) {
  db.delete(savedViews).where(eq(savedViews.id, id)).run();
}
