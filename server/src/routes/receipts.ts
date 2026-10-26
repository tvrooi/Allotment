import express, { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  MAX_RECEIPT_BYTES,
  ReceiptError,
  addReceipt,
  createTransactionFromReceipt,
  deleteReceipt,
  getReceipt,
  listReceipts,
  receiptCounts,
  receiptFile,
  suggestMatches,
  updateReceipt,
} from '../services/receiptService.js';
import { isoDate } from '../utils/validation.js';
import {
  ReceiptMatchError,
  matchPendingReceipts,
  receiptSettings,
  splitByItems,
  updateReceiptSettings,
} from '../services/receiptMatching.js';
import { disposition } from '../utils/contentDisposition.js';
import {
  listOllamaModels,
  queueRead,
  readIfEnabled,
  readerSettings,
  sampleRead,
  startSampleRead,
  updateReaderSettings,
} from '../services/receiptReader.js';

// Receipts (docs/RECEIPTS-AND-TAX.md). Not on the read-only token allowlist: a token never
// sees a receipt.

export const receiptsRouter = Router();

const id = z.string().min(1).max(64);

/** Bad input is a 400 and a receipt problem its own status, here as well as in Express */
function action(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      return handler(req, res, next);
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ error: error.issues.map((i) => i.message).join('; ') });
      if (error instanceof ReceiptError || error instanceof ReceiptMatchError)
        return res.status(error.status).json({ error: error.message });
      next(error);
    }
  };
}

receiptsRouter.get(
  '/',
  action((req, res) => {
    const q = z
      .object({
        transactionId: id.optional(),
        inbox: z.enum(['1', 'true']).optional(),
        status: z.enum(['matched', 'unmatched']).optional(),
      })
      .parse(req.query);
    res.json(
      listReceipts({
        transactionId: q.transactionId,
        inbox: !!q.inbox,
        matched: q.status === undefined ? undefined : q.status === 'matched',
      }),
    );
  }),
);

receiptsRouter.get(
  '/counts',
  action((_req, res) => res.json(receiptCounts())),
);

receiptsRouter.get(
  '/settings',
  action((_req, res) => res.json(receiptSettings())),
);
receiptsRouter.put(
  '/settings',
  action((req, res) =>
    res.json(
      updateReceiptSettings(
        z
          .object({ autoSplit: z.boolean(), addNotes: z.boolean(), addTag: z.boolean() })
          .partial()
          .strict()
          .parse(req.body),
      ),
    ),
  ),
);

// Reading receipts with a local Ollama model: its address, model and whether it is on
receiptsRouter.get(
  '/reader',
  action((_req, res) => res.json(readerSettings())),
);
receiptsRouter.put(
  '/reader',
  action((req, res) =>
    res.json(
      updateReaderSettings(
        z
          .object({
            enabled: z.boolean(),
            url: z.string().trim().max(300).nullable(),
            model: z
              .string()
              .trim()
              .max(120)
              .regex(/^[\w.\-:/]+$/, 'That is not an Ollama model name')
              .nullable(),
          })
          .partial()
          .strict()
          .parse(req.body),
      ),
    ),
  ),
);
// The models on an Ollama server, to check the address and choose one
receiptsRouter.post('/reader/models', async (req, res, next) => {
  try {
    const { url } = z
      .object({ url: z.string().trim().min(1).max(300) })
      .strict()
      .parse(req.body);
    res.json(await listOllamaModels(url));
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(400).json({ error: error.issues.map((i) => i.message).join('; ') });
    if (error instanceof ReceiptError)
      return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// Try the chosen model on a made-up receipt, in the background; the budget is not touched
receiptsRouter.post(
  '/reader/sample',
  action((_req, res) => res.status(202).json(startSampleRead())),
);
receiptsRouter.get(
  '/reader/sample',
  action((_req, res) => res.json(sampleRead())),
);

// Try every unmatched receipt now (matching also runs as new transactions arrive)
receiptsRouter.post(
  '/match',
  action((_req, res) => res.json({ matched: matchPendingReceipts() })),
);

// The file is the body, as sent by the browser; its type is read from its first bytes
receiptsRouter.post(
  '/',
  express.raw({ type: () => true, limit: MAX_RECEIPT_BYTES + 1024 }),
  action((req, res) => {
    const q = z
      .object({ transactionId: id.optional(), fileName: z.string().max(200).optional() })
      .parse(req.query);
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const added = addReceipt({ bytes, fileName: q.fileName, transactionId: q.transactionId });
    // Read in the background when reading is on; the page shows it as being read
    readIfEnabled(added.id, added.mimeType);
    res.status(201).json(getReceipt(added.id));
  }),
);

const cents = z.number().int().min(0).max(1_000_000_000_00);
const edit = z
  .object({
    transactionId: id.nullable(),
    merchant: z.string().trim().max(200).nullable(),
    receiptDate: isoDate.nullable(),
    total: cents.nullable(),
    subtotal: cents.nullable(),
    tax: cents.nullable(),
    tip: cents.nullable(),
    notes: z.string().max(5_000).nullable(),
    lineItems: z
      .array(
        z
          .object({
            description: z.string().trim().min(1).max(200),
            amount: cents,
            categoryId: id.nullable(),
          })
          .strict(),
      )
      .max(200),
  })
  .partial()
  .strict();

receiptsRouter.patch(
  '/:id',
  action((req, res) => res.json(updateReceipt(String(req.params.id), edit.parse(req.body)))),
);

receiptsRouter.get(
  '/:id',
  action((req, res) => res.json(getReceipt(String(req.params.id)))),
);

receiptsRouter.post(
  '/:id/transaction',
  action((req, res) => {
    const body = z
      .object({ accountId: id, categoryId: id.nullable().optional() })
      .strict()
      .parse(req.body);
    res.status(201).json(createTransactionFromReceipt(String(req.params.id), body));
  }),
);

// Read (or read again) this receipt in the background
receiptsRouter.post(
  '/:id/read',
  action((req, res) => {
    const receiptId = String(req.params.id);
    const r = getReceipt(receiptId);
    if (!readerSettings().enabled)
      throw new ReceiptError('Turn on reading receipts in the settings');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(r.mimeType))
      throw new ReceiptError('Only photos (JPEG, PNG, WebP) can be read, not PDFs or HEIC');
    queueRead(receiptId);
    res.status(202).json(getReceipt(receiptId));
  }),
);

receiptsRouter.post(
  '/:id/split',
  action((req, res) => res.json(splitByItems(String(req.params.id)))),
);

receiptsRouter.delete(
  '/:id',
  action((req, res) => {
    deleteReceipt(String(req.params.id));
    res.status(204).end();
  }),
);

receiptsRouter.get(
  '/:id/matches',
  action((req, res) => {
    const { q } = z.object({ q: z.string().max(100).optional() }).parse(req.query);
    res.json(suggestMatches(String(req.params.id), q ? { q, limit: 20 } : {}));
  }),
);

receiptsRouter.get(
  '/:id/file',
  action((req, res) => {
    const file = receiptFile(String(req.params.id));
    // Photos show in the page; anything else is a download, never a document that runs
    const inline = file.mimeType.startsWith('image/') && file.mimeType !== 'image/heic';
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', disposition(inline, file.fileName));
    res.end(file.data);
  }),
);
