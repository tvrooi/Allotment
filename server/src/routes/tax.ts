import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  TAX_LABELS,
  TAX_LABEL_KEYS,
  TaxError,
  claimedIds,
  getClaim,
  removeClaim,
  setClaim,
  taxYear,
  taxYearArchive,
  taxYearCsv,
  taxYears,
  type TaxLabel,
} from '../services/taxService.js';
import { todayIso } from '../services/mainAmountService.js';
import { disposition } from '../utils/contentDisposition.js';

// Tax deductions (docs/RECEIPTS-AND-TAX.md). Record keeping for an Australian return, not tax
// advice. Not on the read-only token allowlist.

export const taxRouter = Router();

const id = z.string().min(1).max(64);
const fy = z.coerce.number().int().min(1990).max(2200);

function action(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      return handler(req, res, next);
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ error: error.issues.map((i) => i.message).join('; ') });
      if (error instanceof TaxError) return res.status(error.status).json({ error: error.message });
      next(error);
    }
  };
}

/** File names use a plain hyphen: 2026-27 */
const fileYear = (name: string) => name.replace('–', '-');

taxRouter.get(
  '/labels',
  action((_req, res) => res.json(TAX_LABEL_KEYS.map((label) => ({ label, ...TAX_LABELS[label] })))),
);
taxRouter.get(
  '/years',
  action((_req, res) => res.json(taxYears(todayIso()))),
);
taxRouter.get(
  '/years/:fy',
  action((req, res) => res.json(taxYear(fy.parse(req.params.fy)))),
);

taxRouter.get(
  '/years/:fy/csv',
  action((req, res) => {
    const { name, csv } = taxYearCsv(fy.parse(req.params.fy));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', disposition(false, `deductions-${fileYear(name)}.csv`));
    res.send(csv);
  }),
);

taxRouter.get(
  '/years/:fy/archive',
  action((req, res) => {
    const { name, data, missingFiles } = taxYearArchive(fy.parse(req.params.fy));
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', disposition(false, `deductions-${fileYear(name)}.zip`));
    res.setHeader('X-Missing-Receipt-Files', String(missingFiles));
    res.end(data);
  }),
);

taxRouter.get(
  '/claims',
  action((_req, res) => res.json(claimedIds())),
);
taxRouter.get(
  '/claims/:transactionId',
  action((req, res) => res.json(getClaim(id.parse(req.params.transactionId)))),
);

const claim = z
  .object({
    label: z.enum(TAX_LABEL_KEYS as [TaxLabel, ...TaxLabel[]]),
    workUseBps: z.number().int().min(1).max(10_000).default(10_000),
    notes: z.string().max(2_000).nullable().default(null),
  })
  .strict();

taxRouter.put(
  '/claims/:transactionId',
  action((req, res) =>
    res.json(setClaim(id.parse(req.params.transactionId), claim.parse(req.body))),
  ),
);

taxRouter.delete(
  '/claims/:transactionId',
  action((req, res) => {
    removeClaim(id.parse(req.params.transactionId));
    res.status(204).end();
  }),
);
