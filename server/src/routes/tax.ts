import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  TAX_LABELS,
  TAX_LABEL_KEYS,
  TaxError,
  claimCandidates,
  csvCell,
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
import {
  AssetError,
  assetScheduleRows,
  createAsset,
  disposeAsset,
  disposeSchema,
  getAsset,
  listAssets,
  lodgeYear,
  lodgedYears,
  previewAsset,
  previewSchema,
  removeAsset,
  setYearWorkUse,
  undisposeAsset,
  unlodgeYear,
  updateAsset,
} from '../services/depreciatingAssetService.js';
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

// Unclaimed past payments like ones already claimed, for the owner to confirm
taxRouter.get(
  '/years/:fy/candidates',
  action((req, res) => res.json(claimCandidates(fy.parse(req.params.fy), todayIso()))),
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

// ─── Depreciating assets (docs/DEPRECIATING-ASSETS-PLAN.md) ────────────────────────────────────

function assetAction(handler: RequestHandler): RequestHandler {
  return action((req, res, next) => {
    try {
      return handler(req, res, next);
    } catch (error) {
      if (error instanceof AssetError)
        return res.status(error.status).json({ error: error.message });
      throw error;
    }
  });
}

taxRouter.get(
  '/assets',
  assetAction((_req, res) => res.json(listAssets())),
);
taxRouter.post(
  '/assets/preview',
  assetAction((req, res) => res.json(previewAsset(previewSchema.parse(req.body)))),
);
taxRouter.get(
  '/assets/:id',
  assetAction((req, res) => res.json(getAsset(id.parse(req.params.id)))),
);
taxRouter.post(
  '/assets',
  assetAction((req, res) => res.status(201).json(createAsset(req.body))),
);
taxRouter.put(
  '/assets/:id',
  assetAction((req, res) => res.json(updateAsset(id.parse(req.params.id), req.body))),
);
taxRouter.delete(
  '/assets/:id',
  assetAction((req, res) => {
    removeAsset(id.parse(req.params.id));
    res.status(204).end();
  }),
);
// A year's own taxable-use share; null goes back to the asset's
taxRouter.put(
  '/assets/:id/years/:fy',
  assetAction((req, res) => {
    const { workUseBps } = z
      .object({ workUseBps: z.number().int().min(0).max(10_000).nullable() })
      .strict()
      .parse(req.body);
    res.json(setYearWorkUse(id.parse(req.params.id), fy.parse(req.params.fy), workUseBps));
  }),
);
taxRouter.post(
  '/assets/:id/dispose',
  assetAction((req, res) => {
    const { date, terminationValue } = disposeSchema.parse(req.body);
    res.json(disposeAsset(id.parse(req.params.id), date, terminationValue));
  }),
);
taxRouter.delete(
  '/assets/:id/dispose',
  assetAction((req, res) => res.json(undisposeAsset(id.parse(req.params.id)))),
);

// Lodged years lock their asset figures (owner only: never on a token's allowlist)
taxRouter.get(
  '/lodged',
  assetAction((_req, res) => res.json(lodgedYears())),
);
taxRouter.put(
  '/lodged/:fy',
  assetAction((req, res) => res.json(lodgeYear(fy.parse(req.params.fy)))),
);
taxRouter.delete(
  '/lodged/:fy',
  assetAction((req, res) => res.json(unlodgeYear(fy.parse(req.params.fy)))),
);

// The year's depreciation schedule for a tax agent, as the ATO's worksheet lays it out
taxRouter.get(
  '/years/:fy/assets/csv',
  assetAction((req, res) => {
    const year = fy.parse(req.params.fy);
    const csv =
      assetScheduleRows(year)
        .map((l) => l.map(csvCell).join(','))
        .join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      disposition(false, `depreciation-${year}-${String(year + 1).slice(2)}.csv`),
    );
    res.send(csv);
  }),
);
