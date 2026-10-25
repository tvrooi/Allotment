import express, { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  MAX_RECEIPT_BYTES,
  ReceiptError,
  addReceipt,
  deleteReceipt,
  listReceipts,
  receiptCounts,
  receiptFile,
  suggestMatches,
  updateReceipt,
} from '../services/receiptService.js';
import { isoDate } from '../utils/validation.js';
import { disposition } from '../utils/contentDisposition.js';

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
      if (error instanceof ReceiptError)
        return res.status(error.status).json({ error: error.message });
      next(error);
    }
  };
}

receiptsRouter.get(
  '/',
  action((req, res) => {
    const q = z
      .object({ transactionId: id.optional(), inbox: z.enum(['1', 'true']).optional() })
      .parse(req.query);
    res.json(listReceipts({ transactionId: q.transactionId, inbox: !!q.inbox }));
  }),
);

receiptsRouter.get(
  '/counts',
  action((_req, res) => res.json(receiptCounts())),
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
    res
      .status(201)
      .json(addReceipt({ bytes, fileName: q.fileName, transactionId: q.transactionId }));
  }),
);

const edit = z
  .object({
    transactionId: id.nullable(),
    merchant: z.string().trim().max(200).nullable(),
    receiptDate: isoDate.nullable(),
    total: z.number().int().min(0).max(1_000_000_000_00).nullable(),
    notes: z.string().max(5_000).nullable(),
  })
  .partial()
  .strict();

receiptsRouter.patch(
  '/:id',
  action((req, res) => res.json(updateReceipt(String(req.params.id), edit.parse(req.body)))),
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
  action((req, res) => res.json(suggestMatches(String(req.params.id)))),
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
