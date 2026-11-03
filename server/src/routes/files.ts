import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import {
  DocumentError,
  LINK_KINDS,
  addDocument,
  deleteDocument,
  getDocument,
  linkCounts,
  linkDocument,
  listDocuments,
  makeReceipt,
  setStorageCap,
  storage,
  unlinkDocument,
  updateDocument,
  type LinkKind,
} from '../services/documentService.js';
import { FileStoreError, receiveUpload, storedFile } from '../services/fileStore.js';
import { ReceiptError } from '../services/receiptService.js';
import { ReceiptMatchError } from '../services/receiptMatching.js';
import { readIfEnabled } from '../services/receiptReader.js';
import { indexText } from '../services/fileText.js';
import { exportAllFiles, FilesExportError } from '../services/filesExport.js';
import { showsInline, type FileKind } from '../services/receiptMeta.js';
import { disposition } from '../utils/contentDisposition.js';
import { isoDate } from '../utils/validation.js';

// Files (docs/FILES.md). Not on the read-only token allowlist: a token never sees a file.

export const filesRouter = Router();

const id = z.string().min(1).max(64);
const linkKind = z.enum(LINK_KINDS as [LinkKind, ...LinkKind[]]);
const fileKinds = [
  'image',
  'pdf',
  'document',
  'spreadsheet',
  'presentation',
  'text',
  'video',
] as const satisfies readonly FileKind[];

function fail(res: Response, error: unknown) {
  if (error instanceof z.ZodError)
    return (res.status(400).json({ error: error.issues.map((i) => i.message).join('; ') }), true);
  if (
    error instanceof DocumentError ||
    error instanceof FileStoreError ||
    error instanceof ReceiptError ||
    error instanceof ReceiptMatchError ||
    error instanceof FilesExportError
  )
    return (res.status(error.status).json({ error: error.message }), true);
  return false;
}

function action(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (!fail(res, error)) next(error);
    }
  };
}

const flag = z.enum(['1', '0', 'true', 'false']).transform((v) => v === '1' || v === 'true');

filesRouter.get(
  '/',
  action((req, res) => {
    const q = z
      .object({
        q: z.string().max(200).optional(),
        tag: id.optional(),
        kind: z.enum(fileKinds).optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
        starred: flag.optional(),
        important: flag.optional(),
        linked: flag.optional(),
        receipt: flag.optional(),
        linkKind: linkKind.optional(),
        linkId: id.optional(),
        limit: z.coerce.number().int().min(1).max(500).optional(),
        offset: z.coerce.number().int().min(0).optional(),
      })
      .parse(req.query);
    res.json(
      listDocuments({
        q: q.q,
        tagId: q.tag,
        kind: q.kind,
        from: q.from,
        to: q.to,
        starred: q.starred,
        important: q.important,
        linked: q.linked,
        receipt: q.receipt,
        link: q.linkKind && q.linkId ? { kind: q.linkKind, id: q.linkId } : undefined,
        limit: q.limit,
        offset: q.offset,
      }),
    );
  }),
);

filesRouter.get(
  '/storage',
  action((_req, res) => res.json(storage())),
);
filesRouter.put(
  '/storage',
  action((req, res) => {
    const { capMb } = z
      .object({ capMb: z.number().int().min(1).max(10_000_000).nullable() })
      .strict()
      .parse(req.body);
    res.json(setStorageCap(capMb));
  }),
);

// How many files each transaction (category, goal, account) has, for paperclips and counts
filesRouter.get(
  '/counts',
  action((req, res) => {
    const { kind } = z.object({ kind: linkKind }).parse(req.query);
    res.json(linkCounts(kind));
  }),
);

// Every file, with an index of what each is and belongs to, as one ZIP
filesRouter.get(
  '/export',
  action(async (_req, res) => {
    await exportAllFiles(res);
  }),
);

// The file is the body, as sent by the browser; its type is read from its bytes
filesRouter.post(
  '/',
  action(async (req, res) => {
    const q = z
      .object({
        fileName: z.string().max(200).optional(),
        description: z.string().max(2_000).optional(),
        linkKind: linkKind.optional(),
        linkId: id.optional(),
        tagIds: z.string().max(2_000).optional(),
      })
      .parse(req.query);
    // Something already read the body (it was sent as JSON): there is no file to receive
    if (req.readableEnded) throw new DocumentError('Send the file itself as the request body');
    const upload = await receiveUpload(req);
    const added = addDocument({
      upload,
      fileName: q.fileName,
      description: q.description,
      link: q.linkKind && q.linkId ? { kind: q.linkKind, id: q.linkId } : undefined,
      tagIds: q.tagIds ? q.tagIds.split(',').filter(Boolean) : undefined,
    });
    // Its text, for search, after the answer (a photo waits for the local model)
    setImmediate(() => {
      try {
        indexText(added.id);
      } catch (e) {
        console.error('Finding a file’s text failed:', e);
      }
    });
    res.status(201).json(added);
  }),
);

filesRouter.get(
  '/:id',
  action((req, res) => res.json(getDocument(String(req.params.id)))),
);

filesRouter.patch(
  '/:id',
  action((req, res) => {
    const change = z
      .object({
        fileName: z.string().trim().min(1).max(200),
        description: z.string().max(2_000).nullable(),
        documentDate: isoDate.nullable(),
        important: z.boolean(),
        starred: z.boolean(),
        tagIds: z.array(id).max(50),
      })
      .partial()
      .strict()
      .parse(req.body);
    res.json(updateDocument(String(req.params.id), change));
  }),
);

filesRouter.post(
  '/:id/links',
  action((req, res) => {
    const body = z.object({ kind: linkKind, id }).strict().parse(req.body);
    res.status(201).json(linkDocument(String(req.params.id), body.kind, body.id));
  }),
);

filesRouter.delete(
  '/:id/links/:kind/:targetId',
  action((req, res) => {
    const kind = linkKind.parse(req.params.kind);
    res.json(unlinkDocument(String(req.params.id), kind, id.parse(req.params.targetId)));
  }),
);

// Make a photo or PDF a receipt, which Receipts can read, match and split
filesRouter.post(
  '/:id/receipt',
  action((req, res) => {
    const made = makeReceipt(String(req.params.id));
    readIfEnabled(made.receipt.id, made.receipt.mimeType);
    res.status(201).json(made);
  }),
);

// Look for its text again (a photo is read by the local model, when that is on)
filesRouter.post(
  '/:id/text',
  action((req, res) => {
    const docId = String(req.params.id);
    getDocument(docId);
    indexText(docId, true);
    res.status(202).json(getDocument(docId));
  }),
);

filesRouter.delete(
  '/:id',
  action((req, res) => {
    deleteDocument(String(req.params.id));
    res.status(204).end();
  }),
);

/** One byte range of a file, for video players (Safari plays a video only through ranges) */
function range(req: Request, size: number): { start: number; end: number } | null | 'invalid' {
  const header = req.headers.range;
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return 'invalid';
  let start = m[1] ? Number(m[1]) : size - Number(m[2]);
  let end = m[1] && m[2] ? Number(m[2]) : size - 1;
  start = Math.max(0, start);
  end = Math.min(end, size - 1);
  return start > end || start >= size ? 'invalid' : { start, end };
}

filesRouter.get(
  '/:id/file',
  action((req, res) => {
    const doc = getDocument(String(req.params.id));
    const file = storedFile(doc.fileId);
    if (!file)
      throw new DocumentError(
        "This file is not on this installation (backups carry files' details, not the files)",
        404,
      );
    // Photos and videos show in the page; anything else is a download, never a document that runs
    const inline = showsInline(file.mimeType) && req.query.download === undefined;
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', disposition(inline, doc.fileName));
    res.setHeader('Accept-Ranges', 'bytes');
    if (file.path) {
      // On disk (a video): sent as it is read, with ranges
      res.sendFile(file.path, { lastModified: false, cacheControl: false, etag: false });
      return;
    }
    const data = file.data!;
    const part = range(req, data.length);
    if (part === 'invalid') {
      res.setHeader('Content-Range', `bytes */${data.length}`);
      res.status(416).end();
      return;
    }
    if (part) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${part.start}-${part.end}/${data.length}`);
      res.end(data.subarray(part.start, part.end + 1));
      return;
    }
    res.end(data);
  }),
);
