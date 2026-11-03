// Files (docs/FILES.md): the budget's document library. A document is a stored file with a name,
// a description, labels (the budget's tags), an important flag and a star, and links to any
// number of transactions, categories, goals and accounts. Removing a link never removes the
// document; deleting a document removes its links, and its file once nothing else uses it.
// A receipt is a document too (receipts.document_id): its matched transaction shows as a link.
import { and, desc, eq, inArray, isNotNull, sql, type SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  documentLinks,
  documents,
  documentTags,
  goals,
  receipts,
  tags,
  transactions,
} from '../db/schema.js';
import { getBudgetSettings, updateBudgetSettings } from './mainAmountService.js';
import { FILE_TYPES, kindOf, RECEIPT_TYPES, type FileKind } from './receiptMeta.js';
import { sniffFileType, sniffMediaType } from './fileTypes.js';
import {
  discardUpload,
  MAX_FILE_BYTES,
  MAX_VIDEO_BYTES,
  presentFiles,
  releaseFiles,
  storageCapExceeded,
  storageUsed,
  storeUpload,
  type Upload,
} from './fileStore.js';
import { cleanName, deleteReceipt, receiptForDocument, updateReceipt } from './receiptService.js';

export class DocumentError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const MAX_DOCUMENTS = 50_000;

/** What the page shows for a link's target (a transaction also says when, how much and where) */
type TargetLabel = { label: string; date?: string; amount?: number; accountName?: string };

/** A target that is a row with a name: exists, and its name */
function named(table: typeof categories | typeof goals | typeof accounts) {
  return {
    resolve: (id: string) =>
      db.select({ id: table.id }).from(table).where(eq(table.id, id)).get()?.id ?? null,
    describe: (ids: string[]) =>
      new Map(
        db
          .select({ id: table.id, name: table.name })
          .from(table)
          .where(inArray(table.id, ids))
          .all()
          .map((r): [string, TargetLabel] => [r.id, { label: r.name }]),
      ),
  };
}

/**
 * What a document can be linked to. Each kind is one nullable foreign-key column on
 * document_links (`<kind>_id`, ON DELETE CASCADE, with a partial unique index); adding a kind is
 * that column, in an additive migration and schema.ts, and an entry here. Routes, search, counts,
 * backups and the export follow from this list.
 */
const LINK_TARGETS = {
  transaction: {
    column: documentLinks.transactionId,
    noun: 'Transaction',
    /** A file belongs to the whole transaction, never one part of a split */
    resolve: (id: string) => {
      const row = db
        .select({ id: transactions.id, parent: transactions.parentTransactionId })
        .from(transactions)
        .where(eq(transactions.id, id))
        .get();
      return row ? (row.parent ?? row.id) : null;
    },
    describe: (ids: string[]) =>
      new Map(
        db
          .select({
            id: transactions.id,
            date: transactions.date,
            amount: transactions.amount,
            payeeName: transactions.payeeName,
            importedPayee: transactions.importedPayee,
            accountName: accounts.name,
          })
          .from(transactions)
          .innerJoin(accounts, eq(accounts.id, transactions.accountId))
          .where(inArray(transactions.id, ids))
          .all()
          .map((t): [string, TargetLabel] => [
            t.id,
            {
              label: t.payeeName || t.importedPayee || 'Transaction',
              date: t.date,
              amount: t.amount,
              accountName: t.accountName,
            },
          ]),
      ),
  },
  category: { column: documentLinks.categoryId, noun: 'Category', ...named(categories) },
  goal: { column: documentLinks.goalId, noun: 'Goal', ...named(goals) },
  account: { column: documentLinks.accountId, noun: 'Account', ...named(accounts) },
} as const;

export type LinkKind = keyof typeof LINK_TARGETS;
export const LINK_KINDS = Object.keys(LINK_TARGETS) as LinkKind[];

/** A link as the page shows it */
export type DocumentLink = TargetLabel & {
  kind: LinkKind;
  id: string;
  /** The receipt's matched transaction (managed as the receipt's match) */
  viaReceipt?: boolean;
};

const now = () => new Date().toISOString();

function documentRow(id: string) {
  const row = db.select().from(documents).where(eq(documents.id, id)).get();
  if (!row) throw new DocumentError('File not found', 404);
  return row;
}

function receiptOf(documentId: string) {
  return db.select().from(receipts).where(eq(receipts.documentId, documentId)).get() ?? null;
}

function resolveTarget(kind: LinkKind, id: string) {
  const target = LINK_TARGETS[kind].resolve(id);
  if (!target) throw new DocumentError(`${LINK_TARGETS[kind].noun} not found`, 404);
  return target;
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/** Labels for the targets of these links, in one query per kind */
function describeTargets(pairs: { kind: LinkKind; id: string }[]) {
  const out = new Map<string, TargetLabel>();
  for (const kind of LINK_KINDS) {
    const ids = [...new Set(pairs.filter((p) => p.kind === kind).map((p) => p.id))];
    if (!ids.length) continue;
    for (const [id, label] of LINK_TARGETS[kind].describe(ids)) out.set(`${kind}:${id}`, label);
  }
  return out;
}

/** Tags, links and receipts for a page of documents */
function decorate(rows: (typeof documents.$inferSelect)[]) {
  const ids = rows.map((r) => r.id);
  const tagRows = ids.length
    ? db
        .select({
          documentId: documentTags.documentId,
          id: tags.id,
          name: tags.name,
          color: tags.color,
        })
        .from(documentTags)
        .innerJoin(tags, eq(tags.id, documentTags.tagId))
        .where(inArray(documentTags.documentId, ids))
        .all()
    : [];
  const linkRows = ids.length
    ? db.select().from(documentLinks).where(inArray(documentLinks.documentId, ids)).all()
    : [];
  const receiptRows = ids.length
    ? db.select().from(receipts).where(inArray(receipts.documentId, ids)).all()
    : [];
  const pairs: { documentId: string; kind: LinkKind; id: string; viaReceipt?: boolean }[] = [];
  for (const l of linkRows)
    for (const kind of LINK_KINDS) {
      const target = l[`${kind}Id` as const];
      if (target) pairs.push({ documentId: l.documentId, kind, id: target });
    }
  for (const r of receiptRows)
    if (r.transactionId && r.documentId)
      pairs.push({
        documentId: r.documentId,
        kind: 'transaction',
        id: r.transactionId,
        viaReceipt: true,
      });
  const described = describeTargets(pairs);
  const present = presentFiles(rows.map((r) => r.fileId));
  return rows.map((r) => {
    const receipt = receiptRows.find((x) => x.documentId === r.id) ?? null;
    const seen = new Set<string>();
    const links: DocumentLink[] = [];
    // The receipt's match first; a plain link to the same transaction is shown once
    for (const p of pairs
      .filter((p) => p.documentId === r.id)
      .sort((a, b) => Number(!!b.viaReceipt) - Number(!!a.viaReceipt))) {
      const key = `${p.kind}:${p.id}`;
      const about = described.get(key);
      if (seen.has(key) || !about) continue;
      seen.add(key);
      links.push({ kind: p.kind, id: p.id, ...about, ...(p.viaReceipt && { viaReceipt: true }) });
    }
    return {
      ...r,
      important: r.important === 1,
      starred: r.starred === 1,
      kind: kindOf(r.mimeType),
      /** The document's date, else its receipt's, else the day it was added */
      date: r.documentDate ?? receipt?.receiptDate ?? r.createdAt.slice(0, 10),
      hasFile: present.has(r.fileId),
      tags: tagRows
        .filter((t) => t.documentId === r.id)
        .map(({ id, name, color }) => ({ id, name, color })),
      links,
      receipt: receipt
        ? {
            id: receipt.id,
            transactionId: receipt.transactionId,
            merchant: receipt.merchant,
            total: receipt.total,
            readStatus: receipt.readStatus,
          }
        : null,
    };
  });
}

export type DocumentFilter = {
  q?: string;
  tagId?: string;
  kind?: FileKind;
  from?: string;
  to?: string;
  starred?: boolean;
  important?: boolean;
  /** true = linked to something, false = linked to nothing */
  linked?: boolean;
  /** true = receipts only, false = no receipts */
  receipt?: boolean;
  /** Only those linked to this target */
  link?: { kind: LinkKind; id: string };
  limit?: number;
  offset?: number;
};

const EFFECTIVE_DATE = sql`coalesce(${documents.documentDate}, (select r.receipt_date from receipts r where r.document_id = ${documents.id}), substr(${documents.createdAt}, 1, 10))`;
const HAS_RECEIPT = sql`exists (select 1 from receipts r where r.document_id = ${documents.id})`;
const LINKED = sql`(exists (select 1 from document_links l where l.document_id = ${documents.id}) or exists (select 1 from receipts r where r.document_id = ${documents.id} and r.transaction_id is not null))`;

/** Search the library, newest first */
export function listDocuments(filter: DocumentFilter = {}) {
  const where: SQL[] = [];
  const q = filter.q?.trim().toLowerCase();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(
      sql`(lower(${documents.fileName} || ' ' || coalesce(${documents.description}, '') || ' ' || coalesce(${documents.searchText}, '')) like ${like} escape '\\'
        or exists (select 1 from receipts r where r.document_id = ${documents.id} and lower(coalesce(r.merchant, '') || ' ' || coalesce(r.notes, '')) like ${like} escape '\\')
        or exists (select 1 from document_tags dt join tags t on t.id = dt.tag_id where dt.document_id = ${documents.id} and lower(t.name) like ${like} escape '\\'))`,
    );
  }
  if (filter.tagId)
    where.push(
      sql`exists (select 1 from document_tags dt where dt.document_id = ${documents.id} and dt.tag_id = ${filter.tagId})`,
    );
  if (filter.kind) {
    const types = TYPES_BY_KIND[filter.kind] ?? [];
    where.push(types.length ? inArray(documents.mimeType, types) : sql`0`);
  }
  if (filter.from) where.push(sql`${EFFECTIVE_DATE} >= ${filter.from}`);
  if (filter.to) where.push(sql`${EFFECTIVE_DATE} <= ${filter.to}`);
  if (filter.starred !== undefined) where.push(eq(documents.starred, filter.starred ? 1 : 0));
  if (filter.important !== undefined) where.push(eq(documents.important, filter.important ? 1 : 0));
  if (filter.linked !== undefined) where.push(filter.linked ? LINKED : sql`not ${LINKED}`);
  if (filter.receipt !== undefined)
    where.push(filter.receipt ? HAS_RECEIPT : sql`not ${HAS_RECEIPT}`);
  if (filter.link) {
    const { kind, id } = filter.link;
    const column = sql.raw(`${kind}_id`);
    where.push(
      kind === 'transaction'
        ? sql`(exists (select 1 from document_links l where l.document_id = ${documents.id} and l.${column} = ${id}) or exists (select 1 from receipts r where r.document_id = ${documents.id} and r.transaction_id = ${id}))`
        : sql`exists (select 1 from document_links l where l.document_id = ${documents.id} and l.${column} = ${id})`,
    );
  }
  const condition = where.length ? and(...where) : undefined;
  const total =
    db
      .select({ n: sql<number>`count(*)` })
      .from(documents)
      .where(condition)
      .get()?.n ?? 0;
  const rows = db
    .select()
    .from(documents)
    .where(condition)
    .orderBy(desc(EFFECTIVE_DATE), desc(documents.createdAt))
    .limit(Math.min(filter.limit ?? 100, 500))
    .offset(filter.offset ?? 0)
    .all();
  return { total, documents: decorate(rows) };
}

/** The types of each kind of file, for the kind filter */
const TYPES_BY_KIND = Object.keys(FILE_TYPES).reduce(
  (out, type) => {
    const kind = kindOf(type)!;
    (out[kind] ??= []).push(type);
    return out;
  },
  {} as Partial<Record<FileKind, string[]>>,
);

export function getDocument(id: string) {
  return decorate([documentRow(id)])[0];
}

export type DocumentDetail = ReturnType<typeof getDocument>;

/** How many documents each target of a kind has, for paperclips and counts */
export function linkCounts(kind: LinkKind) {
  const column = sql.raw(`${kind}_id`);
  const query =
    kind === 'transaction'
      ? sql`select target as id, count(*) as count from (
          select ${column} as target, document_id from document_links where ${column} is not null
          union
          select transaction_id as target, document_id from receipts where transaction_id is not null and document_id is not null
        ) group by target`
      : sql`select ${column} as id, count(distinct document_id) as count from document_links where ${column} is not null group by ${column}`;
  return db.all(query) as { id: string; count: number }[];
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export function storage() {
  const used = storageUsed();
  const capMb = getBudgetSettings().filesCapMb ?? null;
  return {
    ...used,
    documents:
      db
        .select({ n: sql<number>`count(*)` })
        .from(documents)
        .get()?.n ?? 0,
    capMb,
    maxFileBytes: MAX_FILE_BYTES,
    maxVideoBytes: MAX_VIDEO_BYTES,
  };
}

export function setStorageCap(capMb: number | null) {
  updateBudgetSettings({ filesCapMb: capMb });
  return storage();
}

// ─── Changing ────────────────────────────────────────────────────────────────

/** Store an upload as a new document, optionally linked to one target */
export function addDocument(input: {
  upload: Upload;
  fileName?: string;
  description?: string | null;
  link?: { kind: LinkKind; id: string };
  tagIds?: string[];
}) {
  const { upload } = input;
  try {
    if (!upload.size) throw new DocumentError('The file is empty');
    const mimeType = upload.tempPath
      ? sniffMediaType(upload.head)
      : sniffFileType(upload.bytes!, input.fileName);
    if (!mimeType || (upload.tempPath && kindOf(mimeType) !== 'video'))
      throw new DocumentError(
        'Files can be photos, PDFs, Word, Excel, PowerPoint or OpenDocument files, CSV, Markdown, text or videos (MP4, MOV)',
        415,
      );
    const count =
      db
        .select({ n: sql<number>`count(*)` })
        .from(documents)
        .get()?.n ?? 0;
    if (count >= MAX_DOCUMENTS) throw new DocumentError('There are too many files already', 409);
    const capMb = storageCapExceeded(upload.sha256, upload.size);
    if (capMb != null)
      throw new DocumentError(
        `Files are limited to ${capMb} MB (Files → Storage). Delete some, or raise the limit.`,
        413,
      );
    const link = input.link
      ? { kind: input.link.kind, id: resolveTarget(input.link.kind, input.link.id) }
      : null;
    const tagIds = checkTags(input.tagIds ?? []);
    const stamp = now();
    const id = nanoid();
    db.transaction(() => {
      const fileId = storeUpload(upload, mimeType, stamp);
      db.insert(documents)
        .values({
          id,
          fileId,
          fileName: cleanName(input.fileName, mimeType, 'file'),
          mimeType,
          size: upload.size,
          description: input.description?.trim() || null,
          createdAt: stamp,
          updatedAt: stamp,
        })
        .run();
      if (link) insertLink(id, link.kind, link.id, stamp);
      for (const tagId of tagIds) db.insert(documentTags).values({ documentId: id, tagId }).run();
    });
    return getDocument(id);
  } catch (e) {
    discardUpload(upload);
    throw e;
  }
}

function checkTags(tagIds: string[]) {
  const unique = [...new Set(tagIds)];
  if (unique.length > 50) throw new DocumentError('A file can have up to 50 labels');
  if (!unique.length) return unique;
  const found = db.select({ id: tags.id }).from(tags).where(inArray(tags.id, unique)).all();
  if (found.length !== unique.length) throw new DocumentError('Label not found', 404);
  return unique;
}

function insertLink(documentId: string, kind: LinkKind, targetId: string, stamp = now()) {
  db.insert(documentLinks)
    .values({ id: nanoid(), documentId, [`${kind}Id`]: targetId, createdAt: stamp })
    .onConflictDoNothing()
    .run();
}

export function updateDocument(
  id: string,
  change: {
    fileName?: string;
    description?: string | null;
    documentDate?: string | null;
    important?: boolean;
    starred?: boolean;
    tagIds?: string[];
  },
) {
  const row = documentRow(id);
  const patch: Partial<typeof documents.$inferInsert> = {};
  if (change.fileName !== undefined) {
    patch.fileName = cleanName(change.fileName, row.mimeType, 'file');
    // A receipt shows the same name in Receipts
    db.update(receipts).set({ fileName: patch.fileName }).where(eq(receipts.documentId, id)).run();
  }
  if (change.description !== undefined) patch.description = change.description?.trim() || null;
  if (change.documentDate !== undefined) patch.documentDate = change.documentDate;
  if (change.important !== undefined) patch.important = change.important ? 1 : 0;
  if (change.starred !== undefined) patch.starred = change.starred ? 1 : 0;
  const tagIds = change.tagIds === undefined ? undefined : checkTags(change.tagIds);
  db.transaction(() => {
    db.update(documents)
      .set({ ...patch, updatedAt: now() })
      .where(eq(documents.id, id))
      .run();
    if (tagIds) {
      db.delete(documentTags).where(eq(documentTags.documentId, id)).run();
      for (const tagId of tagIds) db.insert(documentTags).values({ documentId: id, tagId }).run();
    }
  });
  return getDocument(id);
}

export function linkDocument(id: string, kind: LinkKind, targetId: string) {
  documentRow(id);
  const target = resolveTarget(kind, targetId);
  const receipt = receiptOf(id);
  // Already its receipt's match: nothing to add
  if (!(kind === 'transaction' && receipt?.transactionId === target)) insertLink(id, kind, target);
  return getDocument(id);
}

/**
 * Remove a link (never the document). For a receipt's matched transaction this unmatches the
 * receipt, which goes back to the Receipts inbox.
 */
export function unlinkDocument(id: string, kind: LinkKind, targetId: string) {
  documentRow(id);
  const receipt = receiptOf(id);
  if (kind === 'transaction' && receipt?.transactionId === targetId)
    updateReceipt(receipt.id, { transactionId: null });
  db.delete(documentLinks)
    .where(and(eq(documentLinks.documentId, id), eq(LINK_TARGETS[kind].column, targetId)))
    .run();
  return getDocument(id);
}

/** Make a photo or PDF in Files a receipt (Receipts reads, matches and splits it) */
export function makeReceipt(id: string) {
  const row = documentRow(id);
  if (!RECEIPT_TYPES.includes(row.mimeType))
    throw new DocumentError('Only a photo (JPEG, PNG, WebP, HEIC) or a PDF can be a receipt');
  // Linked to exactly one transaction: the receipt is that transaction's
  const linked = db
    .select({ transactionId: documentLinks.transactionId })
    .from(documentLinks)
    .where(and(eq(documentLinks.documentId, id), isNotNull(documentLinks.transactionId)))
    .all();
  const transactionId = linked.length === 1 ? linked[0].transactionId : null;
  const receipt = receiptForDocument(id, transactionId);
  if (transactionId && receipt.transactionId)
    db.delete(documentLinks)
      .where(and(eq(documentLinks.documentId, id), eq(documentLinks.transactionId, transactionId)))
      .run();
  return { receipt, document: getDocument(id) };
}

/** Delete a document (and its receipt), and its file once nothing uses it */
export function deleteDocument(id: string) {
  const row = documentRow(id);
  const receipt = receiptOf(id);
  if (receipt) {
    deleteReceipt(receipt.id);
    // deleteReceipt removed the document with it
    if (!db.select({ id: documents.id }).from(documents).where(eq(documents.id, id)).get()) return;
  }
  db.delete(documents).where(eq(documents.id, id)).run();
  releaseFiles([row.fileId]);
}
