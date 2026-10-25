// Matching receipts to transactions, as Monarch's Receipts tab does (docs/RECEIPTS-AND-TAX.md §6):
// automatically by amount, date and merchant, or by hand, and then enriching the transaction
// with a "Receipt" tag, notes and (when its line items span categories) a split. A receipt never
// changes a transaction's amount. No Node-only imports: the in-browser demo loads this module.
import { and, asc, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { addDays, format, parseISO } from 'date-fns';
import { db } from '../db/index.js';
import {
  categories,
  receiptLineItems,
  receipts,
  tags,
  taxClaims,
  transactions,
} from '../db/schema.js';
import { getBudgetSettings, updateBudgetSettings } from './mainAmountService.js';
import { splitTransaction } from './transactionEdits.js';
import { addTransactionTag, createTag } from './transactionMarks.js';

export class ReceiptMatchError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const RECEIPT_TAG = 'Receipt';

export function receiptSettings() {
  const s = getBudgetSettings();
  return {
    autoSplit: s.receiptAutoSplit === 1,
    addNotes: s.receiptAddNotes === 1,
    addTag: s.receiptAddTag === 1,
  };
}

export function updateReceiptSettings(change: Partial<ReturnType<typeof receiptSettings>>) {
  const flag = (v: boolean | undefined) => (v === undefined ? undefined : v ? 1 : 0);
  const patch = Object.fromEntries(
    Object.entries({
      receiptAutoSplit: flag(change.autoSplit),
      receiptAddNotes: flag(change.addNotes),
      receiptAddTag: flag(change.addTag),
    }).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(patch).length) updateBudgetSettings(patch);
  return receiptSettings();
}

// ─── Line items ──────────────────────────────────────────────────────────────

export interface LineItemInput {
  description: string;
  amount: number;
  categoryId: string | null;
}

export function lineItems(receiptId: string) {
  return db
    .select()
    .from(receiptLineItems)
    .where(eq(receiptLineItems.receiptId, receiptId))
    .orderBy(asc(receiptLineItems.position))
    .all();
}

/** Replace a receipt's line items */
export function setLineItems(receiptId: string, items: LineItemInput[]) {
  const ids = [...new Set(items.map((i) => i.categoryId).filter((c): c is string => !!c))];
  for (const id of ids)
    if (!db.select({ id: categories.id }).from(categories).where(eq(categories.id, id)).get())
      throw new ReceiptMatchError('Unknown category');
  db.transaction((tx) => {
    tx.delete(receiptLineItems).where(eq(receiptLineItems.receiptId, receiptId)).run();
    items.forEach((item, position) =>
      tx
        .insert(receiptLineItems)
        .values({ id: nanoid(), receiptId, position, ...item })
        .run(),
    );
  });
}

// ─── Automatic matching ──────────────────────────────────────────────────────

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** A payee and a receipt's merchant name the same business (either contains the other) */
export function sameMerchant(merchant: string | null, ...names: (string | null)[]) {
  const m = norm(merchant);
  if (m.length < 3) return false;
  return names.some((n) => {
    const p = norm(n);
    return p.length >= 3 && (p.includes(m) || m.includes(p));
  });
}

const shift = (day: string, n: number) => format(addDays(parseISO(day), n), 'yyyy-MM-dd');

/**
 * The one transaction a receipt is for, or null when none, or more than one, fits. Money out of
 * exactly the receipt's total, not a transfer or a split's part, with no receipt of its own; then
 * by date: the same merchant from 2 days before the receipt's date to 7 days after (cards post
 * late), any merchant within a day. Ties are left for the owner: never guess.
 */
export function findAutoMatch(receiptId: string): string | null {
  const r = db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!r || r.transactionId || r.total === null || r.total <= 0 || !r.receiptDate) return null;
  const rows = db
    .select({
      id: transactions.id,
      date: transactions.date,
      payeeName: transactions.payeeName,
      importedPayee: transactions.importedPayee,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.amount, -r.total),
        gte(transactions.date, shift(r.receiptDate, -2)),
        lte(transactions.date, shift(r.receiptDate, 7)),
        isNull(transactions.parentTransactionId),
        isNull(transactions.transferTransactionId),
        sql`not exists (select 1 from receipts x where x.transaction_id = ${transactions.id})`,
      ),
    )
    .all();
  const near = (d: string, before: number, after: number) =>
    d >= shift(r.receiptDate!, -before) && d <= shift(r.receiptDate!, after);
  const named = rows.filter(
    (c) => near(c.date, 2, 7) && sameMerchant(r.merchant, c.payeeName, c.importedPayee),
  );
  if (named.length === 1) return named[0].id;
  if (named.length > 1) return null;
  const close = rows.filter((c) => near(c.date, 1, 1));
  return close.length === 1 ? close[0].id : null;
}

/** Try every unmatched receipt; returns how many were matched */
export function matchPendingReceipts(): number {
  const open = db
    .select({ id: receipts.id })
    .from(receipts)
    .where(
      and(
        isNull(receipts.transactionId),
        isNotNull(receipts.total),
        isNotNull(receipts.receiptDate),
      ),
    )
    .all();
  let matched = 0;
  for (const { id } of open) {
    const txId = findAutoMatch(id);
    if (!txId) continue;
    attachReceipt(id, txId, 'auto');
    matched += 1;
  }
  return matched;
}

let scheduled = false;
/**
 * Match receipts once the work in hand is done: new transactions arrive inside an import's own
 * database transaction, and a split can't start inside it.
 */
export function scheduleReceiptMatching() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    try {
      matchPendingReceipts();
    } catch (error) {
      console.warn(
        `Receipt matching failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, 0);
}

// ─── Attaching and enriching ─────────────────────────────────────────────────

/**
 * Split an amount into parts by weight, exactly: each part is rounded towards zero and the
 * cents left over go to the largest remainders, so the parts always add up to the amount.
 */
export function apportion(amount: number, weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + BigInt(w), 0n);
  if (total <= 0n) return weights.map(() => 0);
  const abs = BigInt(Math.abs(amount));
  const shares = weights.map((w, i) => {
    const n = abs * BigInt(w);
    return { i, part: n / total, rest: n % total };
  });
  let left = abs - shares.reduce((s, x) => s + x.part, 0n);
  for (const x of [...shares].sort((a, b) =>
    b.rest > a.rest ? 1 : b.rest < a.rest ? -1 : a.i - b.i,
  )) {
    if (left <= 0n) break;
    x.part += 1n;
    left -= 1n;
  }
  const sign = amount < 0 ? -1 : 1;
  return shares.map((x) => sign * Number(x.part));
}

/**
 * The parts a receipt splits a transaction into: one per category its items name, each its
 * items' total plus its share of tax (in proportion to those items) and of tip and fees (shared
 * evenly per item), scaled to the transaction's own amount. Null when the items name fewer than
 * two categories.
 */
export function splitPlan(
  amount: number,
  items: { description: string; amount: number; categoryId: string | null }[],
  tax: number | null,
  tip: number | null,
) {
  const groups = new Map<string | null, { sum: number; count: number; names: string[] }>();
  for (const item of items) {
    const g = groups.get(item.categoryId) ?? { sum: 0, count: 0, names: [] };
    g.sum += item.amount;
    g.count += 1;
    g.names.push(item.description);
    groups.set(item.categoryId, g);
  }
  const named = [...groups.keys()].filter((k) => k !== null);
  if (named.length < 2) return null;
  const itemsTotal = items.reduce((s, i) => s + i.amount, 0);
  if (itemsTotal <= 0) return null;
  const entries = [...groups.entries()];
  // Weights in hundred-thousandths of a cent keep the shares exact enough to round once, at the end
  const weights = entries.map(([, g]) =>
    Math.round(
      (g.sum + ((tax ?? 0) * g.sum) / itemsTotal + ((tip ?? 0) * g.count) / items.length) * 1e5,
    ),
  );
  const amounts = apportion(amount, weights);
  return entries
    .map(([categoryId, g], i) => ({
      categoryId,
      amount: amounts[i],
      notes: g.names.join(', ').slice(0, 500),
    }))
    .filter((p) => p.amount !== 0);
}

function receiptTagId() {
  const existing = db
    .select({ id: tags.id })
    .from(tags)
    .where(sql`${tags.name} = ${RECEIPT_TAG} collate nocase`)
    .get();
  return existing?.id ?? createTag({ name: RECEIPT_TAG, color: '#64748b' }).id;
}

/** What happened when a receipt was attached, for the page to say */
export interface AttachOutcome {
  transactionId: string;
  tagged: boolean;
  notesAdded: boolean;
  split: number;
  categorised: boolean;
  /** Why a split or category wasn't applied, when it wasn't */
  skipped: string | null;
}

/** Attach a receipt to a transaction, then enrich the transaction from it */
export function attachReceipt(
  receiptId: string,
  transactionId: string,
  how: 'auto' | 'manual' | 'created',
): AttachOutcome {
  if (!db.select({ id: receipts.id }).from(receipts).where(eq(receipts.id, receiptId)).get())
    throw new ReceiptMatchError('Receipt not found', 404);
  const tx = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
  if (!tx) throw new ReceiptMatchError('Transaction not found', 404);
  // A receipt belongs to the whole transaction, never one part of a split
  const targetId = tx.parentTransactionId ?? tx.id;
  db.update(receipts)
    .set({ transactionId: targetId, matchedBy: how, updatedAt: new Date().toISOString() })
    .where(eq(receipts.id, receiptId))
    .run();
  return enrichFromReceipt(receiptId);
}

/** Why a transaction can't be split from its receipt, or null when it can */
function splitBlocker(target: typeof transactions.$inferSelect): string | null {
  if (target.reconciled === 1) return 'The transaction is reconciled, so it was not split';
  if (target.isParent === 1) return 'The transaction is already split';
  if (target.transferTransactionId) return 'A transfer cannot be split';
  // A split's parent is no longer a deduction, so splitting would lose the claim
  if (db.select().from(taxClaims).where(eq(taxClaims.transactionId, target.id)).get())
    return 'The transaction is claimed as a tax deduction, so it was not split';
  return null;
}

/**
 * Enrich a receipt's transaction from it, per the receipt settings: tag it, add the receipt's
 * notes, and split it by its items' categories, or use their one category. Run when a receipt is
 * matched and again when a matched receipt's details change; every step is safe to repeat. The
 * amount is never changed, and an owner's choices are kept: a transaction that already has a
 * category, a tax claim, or is reconciled or split, is not split automatically (Split by items
 * does it on request), and a chosen category is never replaced.
 */
export function enrichFromReceipt(receiptId: string): AttachOutcome {
  const r = db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!r?.transactionId) throw new ReceiptMatchError('The receipt is not matched');
  const target = db.select().from(transactions).where(eq(transactions.id, r.transactionId)).get()!;
  const settings = receiptSettings();
  const outcome: AttachOutcome = {
    transactionId: target.id,
    tagged: false,
    notesAdded: false,
    split: 0,
    categorised: false,
    skipped: null,
  };
  if (settings.addTag) {
    addTransactionTag(target.id, receiptTagId());
    outcome.tagged = true;
  }
  const items = lineItems(receiptId);
  const reconciled = target.reconciled === 1;
  if (settings.addNotes && !reconciled) {
    const note = [r.notes, items.length ? items.map((i) => i.description).join(', ') : null]
      .filter((n): n is string => !!n && !!n.trim())
      .join(' · ');
    if (note && !(target.notes ?? '').includes(note)) {
      const notes = target.notes ? `${target.notes}\n${note}` : note;
      db.update(transactions)
        .set({ notes: notes.slice(0, 5_000) })
        .where(eq(transactions.id, target.id))
        .run();
      outcome.notesAdded = true;
    }
  }
  const categoryIds = [...new Set(items.map((i) => i.categoryId))];
  if (settings.autoSplit && categoryIds.filter((c) => c !== null).length >= 2) {
    const blocked =
      splitBlocker(target) ??
      (target.categoryId !== null
        ? 'The transaction already has a category, so it was not split: use Split by items to split it'
        : null);
    if (blocked) outcome.skipped = blocked;
    else outcome.split = applySplit(target, r, items, outcome);
  } else if (
    categoryIds.length === 1 &&
    categoryIds[0] !== null &&
    target.categoryId === null &&
    target.isParent === 0 &&
    !target.transferTransactionId &&
    !reconciled
  ) {
    // One category and none chosen yet: use it. A category already chosen is never changed.
    db.update(transactions)
      .set({ categoryId: categoryIds[0] })
      .where(eq(transactions.id, target.id))
      .run();
    outcome.categorised = true;
  }
  return outcome;
}

function applySplit(
  target: typeof transactions.$inferSelect,
  r: typeof receipts.$inferSelect,
  items: ReturnType<typeof lineItems>,
  outcome: AttachOutcome,
): number {
  const parts = splitPlan(target.amount, items, r.tax, r.tip);
  if (!parts || parts.length < 2) return 0;
  try {
    splitTransaction(target.id, parts);
    return parts.length;
  } catch (error) {
    outcome.skipped = error instanceof Error ? error.message : String(error);
    return 0;
  }
}

/**
 * Split by items, on request: split a matched transaction by its receipt's item categories even
 * though it already has a category (the owner chose to). Still never a reconciled, already split,
 * transfer or claimed one.
 */
export function splitByItems(receiptId: string): AttachOutcome {
  const r = db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!r?.transactionId) throw new ReceiptMatchError('Match the receipt to a transaction first');
  const target = db.select().from(transactions).where(eq(transactions.id, r.transactionId)).get()!;
  const blocked = splitBlocker(target);
  if (blocked) throw new ReceiptMatchError(blocked.replace(', so it was not split', ''), 409);
  const items = lineItems(receiptId);
  if (new Set(items.map((i) => i.categoryId).filter((c) => c !== null)).size < 2)
    throw new ReceiptMatchError('Give the items at least two categories first');
  const outcome: AttachOutcome = {
    transactionId: target.id,
    tagged: false,
    notesAdded: false,
    split: 0,
    categorised: false,
    skipped: null,
  };
  outcome.split = applySplit(target, r, items, outcome);
  if (!outcome.split)
    throw new ReceiptMatchError(outcome.skipped ?? 'The items could not split it');
  return outcome;
}

/** Unmatch: the receipt goes back to unmatched; the transaction keeps what was added to it */
export function detachReceipt(receiptId: string) {
  const r = db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!r) throw new ReceiptMatchError('Receipt not found', 404);
  db.update(receipts)
    .set({ transactionId: null, matchedBy: null, updatedAt: new Date().toISOString() })
    .where(eq(receipts.id, receiptId))
    .run();
}
