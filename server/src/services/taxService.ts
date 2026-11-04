// Tax deductions (docs/RECEIPTS-AND-TAX.md): transactions you claim on your Australian tax
// return, by return label, for one financial year (1 July to 30 June), with the receipts that
// prove them. Claims never change a transaction or the budget. This is record keeping, not tax
// advice: what is deductible is the owner's (or their tax agent's) call.
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, notInArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  depreciatingAssets,
  documentLinks,
  documents,
  accounts,
  categories,
  receiptFiles,
  receipts,
  taxClaims,
  transactions,
} from '../db/schema.js';
import { mainAmount } from './balances.js';
import { extensionOf } from './receiptMeta.js';
import { zip } from '../utils/zip.js';
import {
  assetPurchaseIds,
  assetScheduleRows,
  assetYears,
  assetsForYear,
  poolForYear,
} from './depreciatingAssetService.js';

export class TaxError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Deduction labels on the individual tax return (and myTax), with what each one covers */
export const TAX_LABELS = {
  D1: { name: 'Work-related car expenses', workRelated: true },
  D2: { name: 'Work-related travel expenses', workRelated: true },
  D3: { name: 'Work-related clothing, laundry and dry-cleaning', workRelated: true },
  D4: { name: 'Work-related self-education expenses', workRelated: true },
  D5: { name: 'Other work-related expenses', workRelated: true },
  D6: { name: 'Low-value pool deduction', workRelated: false },
  D7: { name: 'Interest deductions', workRelated: false },
  D8: { name: 'Dividend deductions', workRelated: false },
  D9: { name: 'Gifts or donations', workRelated: false },
  D10: { name: 'Cost of managing tax affairs', workRelated: false },
  D15: { name: 'Other deductions (e.g. income protection insurance)', workRelated: false },
} as const;
export type TaxLabel = keyof typeof TAX_LABELS;
export const TAX_LABEL_KEYS = Object.keys(TAX_LABELS) as TaxLabel[];

/** Total work-related expenses up to which written evidence is not needed (D1 car excluded) */
export const WRITTEN_EVIDENCE_THRESHOLD = 30_000;
/** A work item costing more than this is usually depreciated, not deducted at once */
export const IMMEDIATE_DEDUCTION_LIMIT = 30_000;

/** The financial year a date falls in, named by the year it starts: 2026 = 1 July 2026–30 June 2027 */
export function financialYearOf(date: string): number {
  const year = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 7 ? year : year - 1;
}
export const financialYearRange = (fy: number) => ({ from: `${fy}-07-01`, to: `${fy + 1}-06-30` });
export const financialYearName = (fy: number) => `${fy}–${String(fy + 1).slice(2)}`;

const now = () => new Date().toISOString();

/** Claim a transaction (or part of one, by work-use share). Replaces an earlier claim. */
export function setClaim(
  transactionId: string,
  input: { label: TaxLabel; workUseBps?: number; notes?: string | null },
) {
  const tx = db
    .select({
      id: transactions.id,
      isParent: transactions.isParent,
      transfer: transactions.transferTransactionId,
    })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .get();
  if (!tx) throw new TaxError('Transaction not found', 404);
  if (tx.isParent) throw new TaxError('Claim the parts of a split transaction, not the whole');
  if (tx.transfer) throw new TaxError('A transfer between your accounts is not an expense');
  // Never claimed outright and depreciated as well (DEPRECIATING-ASSETS-PLAN.md §3.3)
  const asset = db
    .select({ name: depreciatingAssets.name })
    .from(depreciatingAssets)
    .where(eq(depreciatingAssets.transactionId, transactionId))
    .get();
  if (asset) throw new TaxError(`This is depreciated as “${asset.name}”`, 409);
  if (!TAX_LABEL_KEYS.includes(input.label)) throw new TaxError('Unknown tax return label');
  const workUseBps = input.workUseBps ?? 10_000;
  if (!Number.isInteger(workUseBps) || workUseBps < 1 || workUseBps > 10_000)
    throw new TaxError('The work-use share must be between 0.01% and 100%');
  const stamp = now();
  db.insert(taxClaims)
    .values({
      transactionId,
      label: input.label,
      workUseBps,
      notes: input.notes ?? null,
      createdAt: stamp,
      updatedAt: stamp,
    })
    .onConflictDoUpdate({
      target: taxClaims.transactionId,
      set: { label: input.label, workUseBps, notes: input.notes ?? null, updatedAt: stamp },
    })
    .run();
  return getClaim(transactionId);
}

/** A claim a rule makes on import: never replaces one you set, and skips what can't be claimed */
export function claimByRule(transactionId: string, label: string) {
  if (!TAX_LABEL_KEYS.includes(label as TaxLabel)) return;
  if (db.select().from(taxClaims).where(eq(taxClaims.transactionId, transactionId)).get()) return;
  try {
    setClaim(transactionId, { label: label as TaxLabel });
  } catch (error) {
    if (!(error instanceof TaxError)) throw error;
  }
}

export function getClaim(transactionId: string) {
  return (
    db.select().from(taxClaims).where(eq(taxClaims.transactionId, transactionId)).get() ?? null
  );
}

export function removeClaim(transactionId: string) {
  db.delete(taxClaims).where(eq(taxClaims.transactionId, transactionId)).run();
}

/**
 * A claim counts only while its transaction can still be claimed: one split or made a transfer
 * after it was claimed keeps its claim row (undo the split and it is back) but is left out, so
 * a split's parts are never counted twice.
 */
const claimable = and(eq(transactions.isParent, 0), isNull(transactions.transferTransactionId));

/** Transaction ids with a claim that counts, for the register's markers */
export function claimedIds(): string[] {
  return db
    .select({ id: taxClaims.transactionId })
    .from(taxClaims)
    .innerJoin(transactions, eq(transactions.id, taxClaims.transactionId))
    .where(claimable)
    .all()
    .map((r) => r.id);
}

/**
 * One financial year's claims, by label, with what each claim is worth (the expense in the
 * budget's currency × the work-use share) and the checks a tax agent would ask about.
 */
export function taxYear(fy: number) {
  const { from, to } = financialYearRange(fy);
  const rows = db
    .select({
      transactionId: taxClaims.transactionId,
      label: taxClaims.label,
      workUseBps: taxClaims.workUseBps,
      notes: taxClaims.notes,
      date: transactions.date,
      amount: mainAmount,
      payeeName: transactions.payeeName,
      transactionNotes: transactions.notes,
      parentTransactionId: transactions.parentTransactionId,
      categoryName: categories.name,
      accountName: accounts.name,
    })
    .from(taxClaims)
    .innerJoin(transactions, eq(transactions.id, taxClaims.transactionId))
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(gte(transactions.date, from), lte(transactions.date, to), claimable))
    .orderBy(asc(transactions.date))
    .all();

  // A split part's receipts are on its parent
  const owners = [...new Set(rows.map((r) => r.parentTransactionId ?? r.transactionId))];
  const attached = owners.length
    ? db
        .select({
          id: receipts.id,
          transactionId: receipts.transactionId,
          fileName: receipts.fileName,
          fileId: receipts.fileId,
        })
        .from(receipts)
        .where(inArray(receipts.transactionId, owners))
        .all()
    : [];
  // Other files in Files linked to the transaction (an invoice, a warranty) are evidence too
  const linkedFiles = owners.length
    ? db
        .select({
          id: documents.id,
          transactionId: documentLinks.transactionId,
          fileName: documents.fileName,
        })
        .from(documentLinks)
        .innerJoin(documents, eq(documents.id, documentLinks.documentId))
        .where(inArray(documentLinks.transactionId, owners))
        .all()
    : [];
  const byOwner = new Map<string, typeof attached>();
  for (const r of attached) {
    const list = byOwner.get(r.transactionId!) ?? [];
    list.push(r);
    byOwner.set(r.transactionId!, list);
  }

  const claims = rows.map((r) => {
    const cost = -r.amount;
    // Rounded once, half away from zero, like every other share in Allotment
    const claim = Math.sign(cost) * Math.round((Math.abs(cost) * r.workUseBps) / 10_000);
    const label = r.label as TaxLabel;
    const own = byOwner.get(r.parentTransactionId ?? r.transactionId) ?? [];
    return {
      ...r,
      label,
      cost,
      claim,
      receipts: own.map(({ id, fileName }) => ({ id, fileName })),
      files: linkedFiles
        .filter((f) => f.transactionId === (r.parentTransactionId ?? r.transactionId))
        .map(({ id, fileName }) => ({ id, fileName })),
      overImmediateLimit:
        TAX_LABELS[label]?.workRelated === true &&
        label !== 'D1' &&
        cost > IMMEDIATE_DEDUCTION_LIMIT,
    };
  });
  // Decline in value of depreciating assets (DEPRECIATING-ASSETS-PLAN.md): on their own labels
  const assets = assetsForYear(fy);
  // The low-value pool's decline is D6, as one amount for every asset in it
  const pool = poolForYear(fy);
  const totals = TAX_LABEL_KEYS.map((label) => {
    const mine = claims.filter((c) => c.label === label);
    const mineAssets = assets.filter((a) => a.label === label);
    const pooled = label === 'D6' && pool ? pool : null;
    return {
      label,
      name: TAX_LABELS[label].name,
      count: mine.length + mineAssets.length + (pooled?.assets.length ?? 0),
      total:
        mine.reduce((s, c) => s + c.claim, 0) +
        mineAssets.reduce((s, a) => s + a.deduction, 0) +
        (pooled?.row.decline ?? 0),
    };
  }).filter((t) => t.count > 0);
  const workRelated = claims
    .filter((c) => TAX_LABELS[c.label]?.workRelated && c.label !== 'D1')
    .reduce((s, c) => s + c.claim, 0);
  const missing = [
    ...claims.filter((c) => c.receipts.length === 0 && c.files.length === 0),
    ...assets.filter((a) => a.receipts.length === 0 && a.files.length === 0),
    ...(pool?.assets ?? [])
      .filter((a) => a.receipts.length === 0 && a.files.length === 0)
      .map(() => ({ label: 'D6' as const })),
  ];
  const notes: string[] = [];
  if (
    workRelated > WRITTEN_EVIDENCE_THRESHOLD &&
    missing.some((c) => TAX_LABELS[c.label]?.workRelated)
  )
    notes.push(
      'Work-related expenses are over $300 in total, so the ATO expects written evidence (a receipt) for each of them.',
    );
  if (claims.some((c) => c.overImmediateLimit))
    notes.push(
      'Items costing more than $300 are usually claimed as decline in value over several years, not all at once.',
    );
  const assetIncome = assets.reduce((s, a) => s + a.income, 0) + (pool?.row.income ?? 0);
  if (assetIncome > 0)
    notes.push(
      `Disposing of assets for more than their adjustable value brought in $${(assetIncome / 100).toFixed(2)} of assessable income (a balancing adjustment). It is income, not a deduction.`,
    );
  if (assets.some((a) => a.disposedDate && a.row.workUseBps < 10_000))
    notes.push(
      'A disposed asset was partly for private use: any capital gain or loss on the private share is outside what Allotment works out.',
    );
  return {
    financialYear: fy,
    name: financialYearName(fy),
    from,
    to,
    claims,
    assets,
    pool,
    totals,
    total:
      claims.reduce((s, c) => s + c.claim, 0) +
      assets.reduce((s, a) => s + a.deduction, 0) +
      (pool?.row.decline ?? 0),
    assetIncome,
    workRelatedTotal: workRelated,
    missingReceipts: missing.length,
    notes,
  };
}

/** Unclaimed transactions listed by claimCandidates at most */
const MAX_CANDIDATES = 500;

/**
 * Past money out in a financial year with no claim, from a payee (or, failing that, a category)
 * that already has a claim this year or last: likely repeats of something claimed, such as the
 * months of a subscription. Each carries the label and work-use share of the latest such claim.
 * A suggestion for the owner to confirm, not a judgement of what is deductible.
 */
export function claimCandidates(fy: number, today: string) {
  const { from, to } = financialYearRange(fy);
  const until = to < today ? to : today;
  const precedents = db
    .select({
      transactionId: taxClaims.transactionId,
      label: taxClaims.label,
      workUseBps: taxClaims.workUseBps,
      date: transactions.date,
      payeeId: transactions.payeeId,
      categoryId: transactions.categoryId,
    })
    .from(taxClaims)
    .innerJoin(transactions, eq(transactions.id, taxClaims.transactionId))
    .where(
      and(
        gte(transactions.date, financialYearRange(fy - 1).from),
        lte(transactions.date, to),
        claimable,
      ),
    )
    .all()
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!precedents.length || from > until)
    return { financialYear: fy, name: financialYearName(fy), candidates: [], more: false };
  const byPayee = new Map<string, (typeof precedents)[number]>();
  const byCategory = new Map<string, (typeof precedents)[number]>();
  for (const p of precedents) {
    if (p.payeeId && !byPayee.has(p.payeeId)) byPayee.set(p.payeeId, p);
    if (p.categoryId && !byCategory.has(p.categoryId)) byCategory.set(p.categoryId, p);
  }
  const claimed = db.select({ id: taxClaims.transactionId }).from(taxClaims);
  const rows = db
    .select({
      transactionId: transactions.id,
      date: transactions.date,
      amount: mainAmount,
      payeeId: transactions.payeeId,
      payeeName: transactions.payeeName,
      notes: transactions.notes,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      accountName: accounts.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        gte(transactions.date, from),
        lte(transactions.date, until),
        lt(transactions.amount, 0),
        claimable,
        notInArray(transactions.id, claimed),
        notInArray(transactions.id, assetPurchaseIds),
      ),
    )
    .orderBy(asc(transactions.date))
    .all();
  const candidates = rows.flatMap((r) => {
    const payee = r.payeeId ? byPayee.get(r.payeeId) : undefined;
    const precedent = payee ?? (r.categoryId ? byCategory.get(r.categoryId) : undefined);
    if (!precedent) return [];
    const { payeeId: _p, categoryId: _c, ...row } = r;
    return [
      {
        ...row,
        cost: -r.amount,
        basis: payee ? ('payee' as const) : ('category' as const),
        suggestedLabel: precedent.label as TaxLabel,
        suggestedWorkUsePercent: precedent.workUseBps / 100,
        likeClaim: precedent.transactionId,
      },
    ];
  });
  return {
    financialYear: fy,
    name: financialYearName(fy),
    candidates: candidates.slice(0, MAX_CANDIDATES),
    more: candidates.length > MAX_CANDIDATES,
  };
}

/** Financial years with claims, and the current one, newest first */
export function taxYears(today: string) {
  const years = new Set([financialYearOf(today), ...assetYears(today)]);
  for (const r of db
    .select({ date: transactions.date })
    .from(taxClaims)
    .innerJoin(transactions, eq(transactions.id, taxClaims.transactionId))
    .all())
    years.add(financialYearOf(r.date));
  return [...years]
    .sort((a, b) => b - a)
    .map((fy) => ({ financialYear: fy, name: financialYearName(fy) }));
}

export const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v);
  // A leading = + - @ would run as a formula in a spreadsheet
  // Only a whole number (an amount) may start with a minus sign as it is
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const dollars = (cents: number) => (cents / 100).toFixed(2);

export function taxYearCsv(fy: number) {
  const year = taxYear(fy);
  const lines = [
    [
      'Date',
      'Label',
      'Label name',
      'Payee',
      'Category',
      'Account',
      'Cost',
      'Work use %',
      'Claim',
      'Claim notes',
      'Transaction notes',
      'Receipts',
      'Other files',
    ],
    ...year.claims.map((c) => [
      c.date,
      c.label,
      TAX_LABELS[c.label]?.name ?? c.label,
      c.payeeName,
      c.categoryName,
      c.accountName,
      dollars(c.cost),
      (c.workUseBps / 100).toFixed(2),
      dollars(c.claim),
      c.notes,
      c.transactionNotes,
      c.receipts.map((r) => r.fileName).join('; '),
      c.files.map((f) => f.fileName).join('; '),
    ]),
    ...year.assets.map((a) => [
      a.startDate,
      a.label,
      TAX_LABELS[a.label]?.name ?? a.label,
      `Decline in value: ${a.name}`,
      null,
      null,
      dollars(a.row.decline),
      (a.row.workUseBps / 100).toFixed(2),
      dollars(a.deduction),
      a.row.balancingAdjustment === undefined
        ? null
        : `Disposed ${a.disposedDate}; balancing adjustment ${dollars(a.row.balancingAdjustment)}`,
      null,
      a.receipts.map((r) => r.fileName).join('; '),
      a.files.map((f) => f.fileName).join('; '),
    ]),
    ...(year.pool
      ? [
          [
            null,
            'D6',
            TAX_LABELS.D6.name,
            `Low-value pool: ${year.pool.assets.map((a) => a.name).join('; ')}`,
            null,
            null,
            dollars(year.pool.row.decline),
            null,
            dollars(year.pool.row.decline),
            year.pool.row.income
              ? `Termination values over the pool balance: ${dollars(year.pool.row.income)} assessable income`
              : null,
            null,
            year.pool.assets.flatMap((a) => a.receipts.map((r) => r.fileName)).join('; '),
            year.pool.assets.flatMap((a) => a.files.map((f) => f.fileName)).join('; '),
          ],
        ]
      : []),
  ];
  return { name: year.name, csv: lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n' };
}

/** The year's claims as CSV plus every receipt file they have, in one archive for a tax agent */
export function taxYearArchive(fy: number) {
  const { csv, name } = taxYearCsv(fy);
  const year = taxYear(fy);
  const files: { name: string; data: Uint8Array }[] = [
    { name: `deductions-${name.replace('–', '-')}.csv`, data: Buffer.from(csv, 'utf8') },
  ];
  if (year.assets.length || year.pool) {
    const schedule =
      assetScheduleRows(fy)
        .map((l) => l.map(csvCell).join(','))
        .join('\r\n') + '\r\n';
    files.push({
      name: `depreciation-${name.replace('–', '-')}.csv`,
      data: Buffer.from(schedule, 'utf8'),
    });
  }
  // Assets' evidence goes in with the claims': the purchase's receipts, the asset's files
  const owners = [
    ...year.claims,
    ...year.assets.map((a) => ({
      date: a.startDate,
      label: a.label,
      payeeName: a.name,
      receipts: a.receipts,
      files: a.files,
    })),
    ...(year.pool?.assets ?? []).map((a) => ({
      date: `${fy}-07-01`,
      label: 'D6',
      payeeName: a.name,
      receipts: a.receipts,
      files: a.files,
    })),
  ];
  const ids = [...new Set(owners.flatMap((c) => c.receipts.map((r) => r.id)))];
  const rows = ids.length
    ? db
        .select({
          id: receipts.id,
          fileId: receipts.fileId,
          mimeType: receipts.mimeType,
          data: receiptFiles.data,
        })
        .from(receipts)
        .innerJoin(receiptFiles, eq(receiptFiles.id, receipts.fileId))
        .where(and(inArray(receipts.id, ids), isNotNull(receipts.fileId)))
        .all()
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const used = new Set<string>();
  const names = new Set<string>();
  for (const c of owners) {
    c.receipts.forEach((r) => {
      const file = byId.get(r.id);
      if (!file || used.has(r.id)) return;
      used.add(r.id);
      const payee =
        (c.payeeName ?? 'receipt')
          .replace(/[^A-Za-z0-9 ._-]+/g, '')
          .trim()
          .slice(0, 40) || 'receipt';
      // Unique across the whole archive, so unzipping never overwrites one receipt with another
      const stem = `receipts/${c.date} ${c.label} ${payee}`;
      const ext = extensionOf(file.mimeType);
      let name = `${stem}.${ext}`;
      for (let n = 2; names.has(name); n++) name = `${stem} ${n}.${ext}`;
      names.add(name);
      files.push({
        name,
        data: file.data as Buffer,
      });
    });
  }
  // Files linked to claimed transactions, from the database (a video on disk is left out)
  const docIds = [...new Set(owners.flatMap((c) => c.files.map((f) => f.id)))];
  const docRows = docIds.length
    ? db
        .select({ id: documents.id, mimeType: documents.mimeType, data: receiptFiles.data })
        .from(documents)
        .innerJoin(receiptFiles, eq(receiptFiles.id, documents.fileId))
        .where(and(inArray(documents.id, docIds), eq(receiptFiles.onDisk, 0)))
        .all()
    : [];
  const docById = new Map(docRows.map((d) => [d.id, d]));
  const usedDocs = new Set<string>();
  for (const c of owners)
    for (const f of c.files) {
      const file = docById.get(f.id);
      if (!file || usedDocs.has(f.id)) continue;
      usedDocs.add(f.id);
      const title = f.fileName
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^A-Za-z0-9 ._-]+/g, '')
        .trim()
        .slice(0, 40);
      const stem = `files/${c.date} ${c.label} ${title || 'file'}`;
      const ext = extensionOf(file.mimeType);
      let fileName = `${stem}.${ext}`;
      for (let n = 2; names.has(fileName); n++) fileName = `${stem} ${n}.${ext}`;
      names.add(fileName);
      files.push({ name: fileName, data: file.data as Buffer });
    }
  return {
    name,
    data: zip(files),
    missingFiles: ids.length - used.size + docIds.length - usedDocs.size,
  };
}
