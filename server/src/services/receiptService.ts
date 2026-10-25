// Receipts (docs/RECEIPTS-AND-TAX.md): files kept with the budget, matched to the transaction
// they prove. A file is stored once per content in receipt_files; a receipt row says what it
// is and which transaction it belongs to. Matching and what it adds to a transaction (a tag,
// notes, a split by category; never a new amount) are in receiptMatching.ts.
import { createHash } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { addDays, format, parseISO } from 'date-fns';
import { db } from '../db/index.js';
import { accounts, receiptFiles, receipts, transactions } from '../db/schema.js';
import { extensionOf } from './receiptMeta.js';
import {
  attachReceipt,
  detachReceipt,
  findAutoMatch,
  lineItems,
  setLineItems,
  type LineItemInput,
} from './receiptMatching.js';
import { insertNewTransaction } from './ruleService.js';

export class ReceiptError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Largest file accepted. Photos are shrunk in the browser before upload, so this is for PDFs. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const MAX_RECEIPTS = 20_000;

/**
 * The file's real type from its first bytes, never from its name or the browser's claim:
 * JPEG, PNG, WebP, HEIC photos and PDFs only.
 */
export function sniffReceiptType(bytes: Buffer): string | null {
  const at = (offset: number, text: string) =>
    bytes.subarray(offset, offset + text.length).toString('latin1') === text;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (at(0, '\x89PNG\r\n\x1a\n')) return 'image/png';
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'image/webp';
  if (at(0, '%PDF-')) return 'application/pdf';
  if (at(4, 'ftyp') && ['heic', 'heix', 'mif1', 'msf1'].some((b) => at(8, b))) return 'image/heic';
  return null;
}

/** A file name safe to store and to offer back in a download */
function cleanName(name: string | undefined, mimeType: string) {
  const base = (name ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return base || `receipt.${extensionOf(mimeType)}`;
}

const now = () => new Date().toISOString();

function receiptRow(id: string) {
  const row = db.select().from(receipts).where(eq(receipts.id, id)).get();
  if (!row) throw new ReceiptError('Receipt not found', 404);
  return row;
}

function assertTransaction(id: string) {
  const row = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.id, id))
    .get();
  if (!row) throw new ReceiptError('Transaction not found', 404);
}

/** Store a file and add a receipt for it, attached to a transaction or left in the inbox */
export function addReceipt(input: {
  bytes: Buffer;
  fileName?: string;
  transactionId?: string | null;
}) {
  if (!input.bytes.length) throw new ReceiptError('The file is empty');
  if (input.bytes.length > MAX_RECEIPT_BYTES)
    throw new ReceiptError('Receipts can be up to 10 MB', 413);
  const mimeType = sniffReceiptType(input.bytes);
  if (!mimeType)
    throw new ReceiptError('Receipts must be a photo (JPEG, PNG, WebP, HEIC) or a PDF');
  if (input.transactionId) assertTransaction(input.transactionId);
  const count =
    db
      .select({ n: sql<number>`count(*)` })
      .from(receipts)
      .get()?.n ?? 0;
  if (count >= MAX_RECEIPTS) throw new ReceiptError('There are too many receipts already', 409);

  const fileId = createHash('sha256').update(input.bytes).digest('hex');
  const stamp = now();
  const row = {
    id: nanoid(),
    transactionId: input.transactionId ?? null,
    fileId,
    fileName: cleanName(input.fileName, mimeType),
    mimeType,
    size: input.bytes.length,
    merchant: null,
    receiptDate: null,
    total: null,
    subtotal: null,
    tax: null,
    tip: null,
    matchedBy: input.transactionId ? 'manual' : null,
    notes: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.transaction((tx) => {
    tx.insert(receiptFiles)
      .values({
        id: fileId,
        mimeType,
        size: input.bytes.length,
        data: input.bytes,
        createdAt: stamp,
      })
      .onConflictDoNothing()
      .run();
    tx.insert(receipts).values(row).run();
  });
  // Added to a transaction: attached the same way as any match (its tag; no details yet)
  if (input.transactionId) attachReceipt(row.id, input.transactionId, 'manual');
  return withFile(receiptRow(row.id));
}

/** A receipt with whether its file is on this installation (a backup carries no files) */
function withFile<T extends { fileId: string }>(row: T) {
  return {
    ...row,
    hasFile: !!db
      .select({ id: receiptFiles.id })
      .from(receiptFiles)
      .where(eq(receiptFiles.id, row.fileId))
      .get(),
  };
}

export function listReceipts(
  filter: { transactionId?: string; inbox?: boolean; matched?: boolean } = {},
) {
  const where = filter.transactionId
    ? eq(receipts.transactionId, filter.transactionId)
    : filter.inbox || filter.matched === false
      ? isNull(receipts.transactionId)
      : filter.matched
        ? isNotNull(receipts.transactionId)
        : undefined;
  const rows = db.select().from(receipts).where(where).orderBy(desc(receipts.createdAt)).all();
  // The transaction each matched receipt belongs to, for the Receipts tab
  const txIds = [...new Set(rows.map((r) => r.transactionId).filter((t): t is string => !!t))];
  const matched = new Map(
    txIds.length
      ? db
          .select({
            id: transactions.id,
            date: transactions.date,
            amount: transactions.amount,
            payeeName: transactions.payeeName,
            accountName: accounts.name,
          })
          .from(transactions)
          .innerJoin(accounts, eq(accounts.id, transactions.accountId))
          .where(inArray(transactions.id, txIds))
          .all()
          .map((t) => [t.id, t])
      : [],
  );
  const present = new Set(
    rows.length
      ? db
          .select({ id: receiptFiles.id })
          .from(receiptFiles)
          .where(inArray(receiptFiles.id, [...new Set(rows.map((r) => r.fileId))]))
          .all()
          .map((f) => f.id)
      : [],
  );
  return rows.map((r) => ({
    ...r,
    hasFile: present.has(r.fileId),
    transaction: r.transactionId ? (matched.get(r.transactionId) ?? null) : null,
  }));
}

/** One receipt with its line items and the transaction it is matched to */
export function getReceipt(id: string) {
  const row = withFile(receiptRow(id));
  const transaction = row.transactionId
    ? (db
        .select({
          id: transactions.id,
          date: transactions.date,
          amount: transactions.amount,
          payeeName: transactions.payeeName,
          accountName: accounts.name,
        })
        .from(transactions)
        .innerJoin(accounts, eq(accounts.id, transactions.accountId))
        .where(eq(transactions.id, row.transactionId))
        .get() ?? null)
    : null;
  return { ...row, transaction, lineItems: lineItems(id) };
}

/** How many receipts each transaction has, for the register's paperclips */
export function receiptCounts() {
  return db
    .select({ transactionId: receipts.transactionId, count: sql<number>`count(*)` })
    .from(receipts)
    .where(isNotNull(receipts.transactionId))
    .groupBy(receipts.transactionId)
    .all() as { transactionId: string; count: number }[];
}

export function updateReceipt(
  id: string,
  change: {
    transactionId?: string | null;
    merchant?: string | null;
    receiptDate?: string | null;
    total?: number | null;
    subtotal?: number | null;
    tax?: number | null;
    tip?: number | null;
    notes?: string | null;
    lineItems?: LineItemInput[];
  },
) {
  const before = receiptRow(id);
  const { transactionId, lineItems: items, ...fields } = change;
  if (transactionId) assertTransaction(transactionId);
  if (Object.keys(fields).length)
    db.update(receipts)
      .set({ ...fields, updatedAt: now() })
      .where(eq(receipts.id, id))
      .run();
  if (items) setLineItems(id, items);
  // Matching goes through one path, so a match by hand is enriched like an automatic one
  let outcome = null;
  if (transactionId === null && before.transactionId) detachReceipt(id);
  else if (transactionId && transactionId !== before.transactionId)
    outcome = attachReceipt(id, transactionId, 'manual');
  else if (!before.transactionId && transactionId === undefined) {
    // Its details may now match a transaction: try at once, so the page can say so
    const match = findAutoMatch(id);
    if (match) outcome = attachReceipt(id, match, 'auto');
  }
  return { ...getReceipt(id), outcome };
}

/**
 * Make the transaction a receipt is for, when it will never arrive from a bank (cash, or an
 * account without bank sync), and attach the receipt. Rules run on it as on any new transaction.
 */
export function createTransactionFromReceipt(
  id: string,
  input: { accountId: string; categoryId?: string | null },
) {
  const r = receiptRow(id);
  if (r.transactionId) throw new ReceiptError('This receipt is already matched');
  if (r.total === null || r.total <= 0 || !r.receiptDate || !r.merchant)
    throw new ReceiptError('Add the merchant, date and amount first');
  if (!db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, input.accountId)).get())
    throw new ReceiptError('Account not found', 404);
  const { transaction } = insertNewTransaction({
    accountId: input.accountId,
    date: r.receiptDate,
    amount: -r.total,
    payeeId: null,
    payeeName: r.merchant,
    importedPayee: null,
    notes: null,
    categoryId: input.categoryId ?? null,
    importedId: null,
  });
  const outcome = attachReceipt(id, transaction.id, 'created');
  return { ...getReceipt(id), outcome };
}

/** Delete a receipt, and its file once no receipt uses it */
export function deleteReceipt(id: string) {
  const row = receiptRow(id);
  db.transaction((tx) => {
    tx.delete(receipts).where(eq(receipts.id, id)).run();
    const still = tx
      .select({ id: receipts.id })
      .from(receipts)
      .where(eq(receipts.fileId, row.fileId))
      .get();
    if (!still) tx.delete(receiptFiles).where(eq(receiptFiles.id, row.fileId)).run();
  });
}

export function receiptFile(id: string) {
  const row = receiptRow(id);
  const file = db.select().from(receiptFiles).where(eq(receiptFiles.id, row.fileId)).get();
  if (!file)
    throw new ReceiptError(
      "This receipt's file is not on this installation (backups carry receipts' details, not their files)",
      404,
    );
  return { fileName: row.fileName, mimeType: file.mimeType, data: file.data as Buffer };
}

/**
 * Transactions a receipt probably belongs to: money out within 10 days of its date (or of when
 * it was added), closest first, and an exact match on its total first of all.
 */
export function suggestMatches(id: string, opts: { q?: string; limit?: number } = {}) {
  const row = receiptRow(id);
  const limit = opts.limit ?? 5;
  const q = opts.q?.trim().toLowerCase();
  const day = row.receiptDate ?? row.createdAt.slice(0, 10);
  // Searching by name looks further: 60 days either side
  const reach = q ? 60 : 10;
  const shift = (n: number) => format(addDays(parseISO(day), n), 'yyyy-MM-dd');
  const candidates = db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      payeeName: transactions.payeeName,
      accountName: accounts.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        gte(transactions.date, shift(-reach)),
        lte(transactions.date, shift(reach)),
        isNull(transactions.parentTransactionId),
        isNull(transactions.transferTransactionId),
        sql`${transactions.amount} < 0`,
        q
          ? sql`lower(coalesce(${transactions.payeeName}, '') || ' ' || coalesce(${transactions.importedPayee}, '') || ' ' || coalesce(${transactions.notes}, '')) like ${`%${q}%`}`
          : undefined,
      ),
    )
    .all();
  const days = (d: string) =>
    Math.abs(parseISO(d).getTime() - parseISO(day).getTime()) / 86_400_000;
  const exact = (amount: number) => row.total !== null && -amount === row.total;
  return candidates
    .filter(
      (c) =>
        !!q ||
        row.total === null ||
        Math.abs(-c.amount - row.total) <= Math.max(100, row.total / 5),
    )
    .map((c) => ({ ...c, exactAmount: exact(c.amount), daysApart: Math.round(days(c.date)) }))
    .sort(
      (a, b) =>
        Number(b.exactAmount) - Number(a.exactAmount) ||
        a.daysApart - b.daysApart ||
        b.date.localeCompare(a.date),
    )
    .slice(0, limit);
}
