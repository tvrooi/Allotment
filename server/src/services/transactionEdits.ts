import { and, eq, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accounts,
  cardFunding,
  categories,
  householdEvents,
  incomeReviews,
  paydayFundingReceipts,
  payees,
  tags,
  transactions,
  transactionTags,
} from '../db/schema.js';
import { unlinkOccurrenceByTransactionId } from './matchingEngine.js';
import { refreshMainAmounts } from './mainAmountService.js';
import { resolvePayee } from './transactionHelpers.js';
import { MarkError, tagsByTransaction } from './transactionMarks.js';
import { registerCondition, type Selection } from './transactionSelection.js';

// Splitting a transaction after it arrives, and editing many at once
// (docs/research/monarch-flybudget-seamless-ux.md, recommendations 1 and 2).

// ─── Split an existing transaction ────────────────────────────────────────────

export interface SplitPart {
  categoryId: string | null;
  amount: number;
  notes?: string | null;
}

/** A split's parts' links that would be lost: occurrences they paid go back to pending */
function removeParts(parentId: string) {
  const parts = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.parentTransactionId, parentId))
    .all();
  for (const p of parts) unlinkOccurrenceByTransactionId(p.id);
  db.delete(transactions).where(eq(transactions.parentTransactionId, parentId)).run();
}

function isPaymentEnvelope(categoryId: string) {
  return !!db.select().from(cardFunding).where(eq(cardFunding.categoryId, categoryId)).get();
}

/**
 * Split a transaction into parts, change its parts, or (with no parts) put it back together.
 * The transaction keeps its id, bank identity, amount, review state and tags; the parts share
 * its account, date and payee and, unless given their own, its notes.
 */
export function splitTransaction(id: string, parts: SplitPart[]) {
  const row = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!row) throw new MarkError('Transaction not found', 404);
  if (row.parentTransactionId) throw new MarkError('Split the whole transaction, not one part');
  if (row.reconciled === 1) throw new MarkError('Cannot modify a reconciled transaction', 403);
  if (row.transferTransactionId) throw new MarkError('A transfer cannot be split');
  if (row.isAdjustment === 1) throw new MarkError('A balance adjustment cannot be split');
  const ids = [
    id,
    ...db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.parentTransactionId, id))
      .all()
      .map((p) => p.id),
  ];
  const funded =
    db
      .select()
      .from(paydayFundingReceipts)
      .where(inArray(paydayFundingReceipts.transactionId, ids))
      .get() ??
    db.select().from(incomeReviews).where(inArray(incomeReviews.transactionId, ids)).get();
  if (funded) {
    throw new MarkError('This pay is part of a payday funding review; undo that before splitting');
  }
  if (db.select().from(householdEvents).where(inArray(householdEvents.transactionId, ids)).get()) {
    throw new MarkError('Remove the linked household entry before splitting this payment', 409);
  }

  if (parts.length === 1) throw new MarkError('A split needs at least two parts');
  if (parts.some((p) => p.amount === 0)) throw new MarkError('Every part needs an amount');
  if (parts.length && parts.reduce((sum, p) => sum + p.amount, 0) !== row.amount) {
    throw new MarkError('The parts must add up to the transaction amount');
  }
  const categoryIds = [...new Set(parts.map((p) => p.categoryId).filter((c) => c !== null))];
  if (categoryIds.length) {
    const known = db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.id, categoryIds))
      .all();
    if (known.length !== categoryIds.length) throw new MarkError('Unknown category');
    if (categoryIds.some(isPaymentEnvelope)) {
      throw new MarkError(
        'Payment envelopes hold funding; record card repayments as linked transfers',
      );
    }
  }

  // Back together: one category if every part had the same one, else uncategorized
  const partCategories = new Set(
    row.isParent === 1
      ? db
          .select({ categoryId: transactions.categoryId })
          .from(transactions)
          .where(eq(transactions.parentTransactionId, id))
          .all()
          .map((p) => p.categoryId)
      : [row.categoryId],
  );

  db.transaction((tx) => {
    if (row.isParent === 1) removeParts(id);
    if (!parts.length) {
      tx.update(transactions)
        .set({
          isParent: 0,
          categoryId: partCategories.size === 1 ? [...partCategories][0] : null,
        })
        .where(eq(transactions.id, id))
        .run();
      return;
    }
    // A parent holds no category of its own: its parts do
    tx.update(transactions)
      .set({ isParent: 1, categoryId: null })
      .where(eq(transactions.id, id))
      .run();
    const createdAt = new Date().toISOString();
    for (const p of parts) {
      tx.insert(transactions)
        .values({
          id: nanoid(),
          accountId: row.accountId,
          date: row.date,
          amount: p.amount,
          payeeId: row.payeeId,
          payeeName: row.payeeName,
          importedPayee: row.importedPayee,
          categoryId: p.categoryId,
          notes: p.notes === undefined ? row.notes : p.notes,
          reconciled: 0,
          isParent: 0,
          transferTransactionId: null,
          parentTransactionId: id,
          importedId: null,
          createdAt,
        })
        .run();
    }
  });
  refreshMainAmounts([id]);
  const result = db.select().from(transactions).where(eq(transactions.id, id)).get()!;
  const children = db
    .select()
    .from(transactions)
    .where(eq(transactions.parentTransactionId, id))
    .all();
  return children.length ? { ...result, children } : result;
}

// ─── Edit many transactions at once ───────────────────────────────────────────

/** Only the fields the user changed; anything left out stays as it is */
export interface BulkChanges {
  categoryId?: string | null;
  payeeName?: string;
  /** null removes the notes */
  notes?: string | null;
  hiddenFromReports?: boolean;
  reviewed?: boolean;
  addTagIds?: string[];
  removeTagIds?: string[];
}

export interface BulkTarget {
  selection: Selection;
  /** Hand-picked rows: only these, if they are in the selection */
  ids?: string[];
  /** Rows unticked after "select all" */
  excludeIds?: string[];
}

export type SkipReason = 'reconciled' | 'transfer' | 'split' | 'household';

/** Each changed row's previous values, enough to put it back exactly */
export interface BulkRestore {
  id: string;
  categoryId?: string | null;
  payeeId?: string | null;
  payeeName?: string | null;
  notes?: string | null;
  hiddenFromReports?: number;
  reviewedAt?: string | null;
  tagIds?: string[];
}

export interface BulkPreview {
  matched: number;
  /** Rows that will change in at least one field */
  changing: number;
  /** Rows (or fields of rows) left alone, by reason */
  skipped: Record<SkipReason, number>;
  accounts: { id: string; name: string }[];
}

/** Stands in for a payee the apply would create: no row has its id yet */
const NEW_PAYEE = '\u0000new';

/** Category, payee and notes: what a reconciled, transfer, split or household row can't take */
const LEDGER_FIELDS = ['categoryId', 'payeeName', 'notes'] as const;

function targetRows(target: BulkTarget) {
  const conditions = [registerCondition(target.selection)];
  if (target.ids) conditions.push(inArray(transactions.id, target.ids.length ? target.ids : ['']));
  if (target.excludeIds?.length) conditions.push(notInArray(transactions.id, target.excludeIds));
  return db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .all();
}

/** Why a row can't take ledger edits (category, payee, notes), or null when it can */
function ledgerBlock(
  row: typeof transactions.$inferSelect,
  household: Set<string>,
  changes: BulkChanges,
): SkipReason | null {
  if (row.reconciled === 1) return 'reconciled';
  if (household.has(row.id)) return 'household';
  // A transfer's payee names the other account and its category is the budget boundary's
  if (
    (changes.categoryId !== undefined || changes.payeeName !== undefined) &&
    row.transferTransactionId
  )
    return 'transfer';
  if (changes.categoryId !== undefined && row.isParent === 1) return 'split';
  return null;
}

function validateChanges(changes: BulkChanges) {
  if (changes.categoryId) {
    if (!db.select().from(categories).where(eq(categories.id, changes.categoryId)).get())
      throw new MarkError('Unknown category');
    if (isPaymentEnvelope(changes.categoryId))
      throw new MarkError(
        'Payment envelopes hold funding; record card repayments as linked transfers',
      );
  }
  const tagIds = [...new Set([...(changes.addTagIds ?? []), ...(changes.removeTagIds ?? [])])];
  if (tagIds.length) {
    const known = db.select({ id: tags.id }).from(tags).where(inArray(tags.id, tagIds)).all();
    if (known.length !== tagIds.length) throw new MarkError('Unknown tag');
  }
}

type Row = typeof transactions.$inferSelect;

/**
 * What would change on one row, from the same comparisons for the preview and the apply:
 * the column updates, the previous values for undo, and the tags it would end up with
 * (null when its tags stay as they are).
 */
function rowDiff(
  row: Row,
  ledgerAllowed: boolean,
  changes: BulkChanges,
  payee: { payeeId: string | null; payeeName: string | null } | null,
  currentTags: string[],
  at: string,
) {
  const update: Partial<typeof transactions.$inferInsert> = {};
  const before: BulkRestore = { id: row.id };
  if (ledgerAllowed) {
    if (changes.categoryId !== undefined && changes.categoryId !== row.categoryId) {
      update.categoryId = changes.categoryId;
      before.categoryId = row.categoryId;
    }
    if (payee && (payee.payeeId !== row.payeeId || payee.payeeName !== row.payeeName)) {
      update.payeeId = payee.payeeId;
      update.payeeName = payee.payeeName;
      before.payeeId = row.payeeId;
      before.payeeName = row.payeeName;
    }
    if (changes.notes !== undefined && changes.notes !== row.notes) {
      update.notes = changes.notes;
      before.notes = row.notes;
    }
  }
  if (
    changes.hiddenFromReports !== undefined &&
    (row.hiddenFromReports === 1) !== changes.hiddenFromReports
  ) {
    update.hiddenFromReports = changes.hiddenFromReports ? 1 : 0;
    before.hiddenFromReports = row.hiddenFromReports;
  }
  if (changes.reviewed !== undefined && (row.reviewedAt !== null) !== changes.reviewed) {
    update.reviewedAt = changes.reviewed ? at : null;
    before.reviewedAt = row.reviewedAt;
  }
  let nextTags: string[] | null = null;
  if (changes.addTagIds?.length || changes.removeTagIds?.length) {
    const next = new Set(currentTags);
    for (const t of changes.addTagIds ?? []) next.add(t);
    for (const t of changes.removeTagIds ?? []) next.delete(t);
    const same = next.size === currentTags.length && currentTags.every((t) => next.has(t));
    if (!same) {
      before.tagIds = currentTags;
      nextTags = [...next];
    }
  }
  return { update, before, nextTags, changes: Object.keys(before).length > 1 };
}

function plan(target: BulkTarget, changes: BulkChanges) {
  validateChanges(changes);
  const rows = targetRows(target);
  const ids = rows.map((r) => r.id);
  const household = new Set(
    ids.length
      ? db
          .select({ id: householdEvents.transactionId })
          .from(householdEvents)
          .where(
            and(
              isNotNull(householdEvents.transactionId),
              inArray(householdEvents.transactionId, ids),
            ),
          )
          .all()
          .map((h) => h.id!)
      : [],
  );
  const ledger = LEDGER_FIELDS.some((f) => changes[f] !== undefined);
  const skipped: Record<SkipReason, number> = {
    reconciled: 0,
    transfer: 0,
    split: 0,
    household: 0,
  };
  const items = rows.map((row) => {
    const block = ledger ? ledgerBlock(row, household, changes) : null;
    if (block) skipped[block] += 1;
    return { row, ledgerAllowed: !block };
  });
  return { items, skipped };
}

/** The payee a bulk edit would set, without creating it: a new one matches no row's id */
function plannedPayee(changes: BulkChanges) {
  if (changes.payeeName === undefined) return null;
  const name = changes.payeeName.trim();
  const existing = db.select({ id: payees.id }).from(payees).where(eq(payees.name, name)).get();
  return { payeeId: existing?.id ?? NEW_PAYEE, payeeName: name };
}

/** What a bulk edit would do, without changing anything: for the confirmation */
export function previewBulkEdit(target: BulkTarget, changes: BulkChanges): BulkPreview {
  const { items, skipped } = plan(target, changes);
  const payee = plannedPayee(changes);
  const tagsOf = tagsByTransaction(items.map((i) => i.row.id));
  const at = new Date().toISOString();
  const changing = items.filter(
    (i) => rowDiff(i.row, i.ledgerAllowed, changes, payee, tagsOf.get(i.row.id) ?? [], at).changes,
  ).length;
  const accountIds = [...new Set(items.map((i) => i.row.accountId))];
  return {
    matched: items.length,
    changing,
    skipped,
    accounts: accountIds.length
      ? db
          .select({ id: accounts.id, name: accounts.name })
          .from(accounts)
          .where(inArray(accounts.id, accountIds))
          .orderBy(sql`${accounts.name} collate nocase`)
          .all()
      : [],
  };
}

/**
 * Apply the changes to the selection's register rows. `expectedCount` is the count the user
 * confirmed: if the selection now matches a different number of rows, nothing is written.
 * Rows that can't take a category, payee or notes change are skipped for those fields only.
 */
export function bulkEdit(target: BulkTarget, changes: BulkChanges, expectedCount: number) {
  const { items, skipped } = plan(target, changes);
  if (items.length !== expectedCount) {
    throw new MarkError(
      `The selection now has ${items.length} transactions, not ${expectedCount}. Check it and try again.`,
      409,
    );
  }
  const restore: BulkRestore[] = [];
  const at = new Date().toISOString();
  const tagsOf = tagsByTransaction(items.map((i) => i.row.id));
  const planned = plannedPayee(changes);
  const diffs = items.map(({ row, ledgerAllowed }) => ({
    row,
    diff: rowDiff(row, ledgerAllowed, changes, planned, tagsOf.get(row.id) ?? [], at),
  }));
  // A new payee is created only when a row will actually get it (no junk payees)
  const newPayee =
    planned?.payeeId === NEW_PAYEE && diffs.some((d) => d.diff.update.payeeId === NEW_PAYEE)
      ? resolvePayee(planned.payeeName, null).payeeId
      : null;

  db.transaction((tx) => {
    for (const { row, diff } of diffs) {
      if (!diff.changes) continue;
      const { update } = diff;
      if (update.payeeId === NEW_PAYEE) update.payeeId = newPayee;
      if (Object.keys(update).length) {
        tx.update(transactions).set(update).where(eq(transactions.id, row.id)).run();
        // A split's parts share its payee
        if (row.isParent === 1 && update.payeeId !== undefined) {
          tx.update(transactions)
            .set({ payeeId: update.payeeId, payeeName: update.payeeName })
            .where(eq(transactions.parentTransactionId, row.id))
            .run();
        }
      }
      if (diff.nextTags) {
        tx.delete(transactionTags).where(eq(transactionTags.transactionId, row.id)).run();
        for (const tagId of diff.nextTags)
          tx.insert(transactionTags).values({ transactionId: row.id, tagId }).run();
      }
      restore.push(diff.before);
    }
  });
  return { matched: items.length, changed: restore.length, skipped, restore };
}

/** Put bulk-edited rows back exactly (the undo of bulkEdit) */
export function restoreBulkEdit(changes: BulkRestore[]) {
  db.transaction((tx) => {
    for (const c of changes) {
      const row = tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, c.id), isNull(transactions.parentTransactionId)))
        .get();
      if (!row) continue;
      const update: Partial<typeof transactions.$inferInsert> = {};
      if (c.categoryId !== undefined && row.reconciled !== 1 && row.isParent !== 1)
        update.categoryId = c.categoryId;
      if (c.payeeName !== undefined && row.reconciled !== 1) {
        update.payeeId = c.payeeId ?? null;
        update.payeeName = c.payeeName;
      }
      if (c.notes !== undefined && row.reconciled !== 1) update.notes = c.notes;
      if (c.hiddenFromReports !== undefined) update.hiddenFromReports = c.hiddenFromReports;
      if (c.reviewedAt !== undefined) update.reviewedAt = c.reviewedAt;
      if (Object.keys(update).length) {
        tx.update(transactions).set(update).where(eq(transactions.id, c.id)).run();
        if (row.isParent === 1 && update.payeeName !== undefined) {
          tx.update(transactions)
            .set({ payeeId: update.payeeId, payeeName: update.payeeName })
            .where(eq(transactions.parentTransactionId, c.id))
            .run();
        }
      }
      if (c.tagIds) {
        tx.delete(transactionTags).where(eq(transactionTags.transactionId, c.id)).run();
        const known = c.tagIds.length
          ? new Set(
              tx
                .select({ id: tags.id })
                .from(tags)
                .where(inArray(tags.id, c.tagIds))
                .all()
                .map((t) => t.id),
            )
          : new Set<string>();
        for (const tagId of c.tagIds)
          if (known.has(tagId))
            tx.insert(transactionTags).values({ transactionId: c.id, tagId }).run();
      }
    }
  });
  return { restored: changes.length };
}
