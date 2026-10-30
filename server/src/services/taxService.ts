// Tax deductions (docs/RECEIPTS-AND-TAX.md): transactions you claim on your Australian tax
// return, by return label, for one financial year (1 July to 30 June), with the receipts that
// prove them. Claims never change a transaction or the budget. This is record keeping, not tax
// advice: what is deductible is the owner's (or their tax agent's) call.
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
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
      overImmediateLimit:
        TAX_LABELS[label]?.workRelated === true &&
        label !== 'D1' &&
        cost > IMMEDIATE_DEDUCTION_LIMIT,
    };
  });
  const totals = TAX_LABEL_KEYS.map((label) => {
    const mine = claims.filter((c) => c.label === label);
    return {
      label,
      name: TAX_LABELS[label].name,
      count: mine.length,
      total: mine.reduce((s, c) => s + c.claim, 0),
    };
  }).filter((t) => t.count > 0);
  const workRelated = claims
    .filter((c) => TAX_LABELS[c.label]?.workRelated && c.label !== 'D1')
    .reduce((s, c) => s + c.claim, 0);
  const missing = claims.filter((c) => c.receipts.length === 0);
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
  return {
    financialYear: fy,
    name: financialYearName(fy),
    from,
    to,
    claims,
    totals,
    total: claims.reduce((s, c) => s + c.claim, 0),
    workRelatedTotal: workRelated,
    missingReceipts: missing.length,
    notes,
  };
}

/** Financial years with claims, and the current one, newest first */
export function taxYears(today: string) {
  const years = new Set([financialYearOf(today)]);
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

const csvCell = (v: string | number | null | undefined) => {
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
    ]),
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
  const ids = [...new Set(year.claims.flatMap((c) => c.receipts.map((r) => r.id)))];
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
  for (const c of year.claims) {
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
  return { name, data: zip(files), missingFiles: ids.length - used.size };
}
