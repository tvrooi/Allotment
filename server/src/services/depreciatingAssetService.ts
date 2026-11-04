// Depreciating assets on Tax time (docs/DEPRECIATING-ASSETS-PLAN.md §3.3): records for the tax
// return. The purchase stays an expense in its category; nothing here changes a transaction or
// the budget. Figures come from depreciation.ts; this file stores, checks and gathers evidence.
import { z } from 'zod';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  depreciatingAssetYears,
  depreciatingAssets,
  documentLinks,
  documents,
  receipts,
  taxClaims,
  taxLodgedYears,
  transactions,
} from '../db/schema.js';
import {
  EARLIEST_START,
  poolEntryFor,
  poolEntryOf,
  poolSchedule,
  schedule,
  type PoolEntry,
  type PoolRow,
  type AssetTerms,
  type DepreciationMethod,
  type ScheduleRow,
} from './depreciation.js';
import { isoDate } from '../utils/validation.js';

export class AssetError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const ASSET_LABELS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D15'] as const;
export const ASSET_METHODS = ['prime_cost', 'diminishing_value'] as const;
/** At or under this, an item used for non-business income is claimed at once (taxService.ts) */
const IMMEDIATE_LIMIT = 30_000;
const fyOf = (date: string) => {
  const year = Number(date.slice(0, 4));
  return date.slice(5) >= '07-01' ? year : year - 1;
};
const now = () => new Date().toISOString();

const terms = {
  cost: z.number().int().positive().max(100_000_000_000),
  startDate: isoDate,
  method: z.enum(ASSET_METHODS),
  effectiveLifeHundredths: z.number().int().min(1).max(100_000),
  workUseBps: z.number().int().min(1).max(10_000),
  openingFy: z.number().int().min(2005).max(2200).nullable(),
  openingAdjustableValue: z.number().int().min(0).max(100_000_000_000).nullable(),
};
export const assetInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    notes: z.string().max(5_000).nullable(),
    label: z.enum(ASSET_LABELS),
    purchaseDate: isoDate.nullable(),
    partOfSet: z.boolean(),
    transactionId: z.string().min(1).max(64).nullable(),
    /** "Depreciate instead": the purchase's outright claim is removed in the same step */
    replaceClaim: z.boolean(),
    ...terms,
  })
  .partial()
  .strict();
export type AssetInput = z.infer<typeof assetInputSchema>;
/** What a preview needs: the figures alone */
export const previewSchema = z
  .object({
    cost: terms.cost,
    startDate: terms.startDate,
    effectiveLifeHundredths: terms.effectiveLifeHundredths,
    workUseBps: terms.workUseBps,
    openingFy: terms.openingFy.optional(),
    openingAdjustableValue: terms.openingAdjustableValue.optional(),
  })
  .strict();
export const disposeSchema = z
  .object({ date: isoDate, terminationValue: z.number().int().min(0).max(100_000_000_000) })
  .strict();

type AssetRow = typeof depreciatingAssets.$inferSelect;

export function lodgedYears(): number[] {
  return db
    .select({ fy: taxLodgedYears.financialYear })
    .from(taxLodgedYears)
    .orderBy(asc(taxLodgedYears.financialYear))
    .all()
    .map((r) => r.fy);
}

function yearShares(assetId: string): Record<number, number> {
  return Object.fromEntries(
    db
      .select()
      .from(depreciatingAssetYears)
      .where(eq(depreciatingAssetYears.assetId, assetId))
      .all()
      .map((y) => [y.financialYear, y.workUseBps]),
  );
}

export function termsOf(row: AssetRow): AssetTerms {
  return {
    cost: row.cost,
    startDate: row.startDate,
    method: row.method as DepreciationMethod,
    effectiveLifeHundredths: row.effectiveLifeHundredths,
    workUseBps: row.workUseBps,
    yearWorkUse: yearShares(row.id),
    openingFy: row.openingFy,
    openingAdjustableValue: row.openingAdjustableValue,
    disposedDate: row.disposedDate,
    terminationValue: row.terminationValue,
    pooledFy: row.pooledFy,
  };
}

/** The low-value pool from every pooled asset's terms */
function poolFrom(terms: AssetTerms[], throughFy: number) {
  return poolSchedule(
    terms.map(poolEntryOf).filter((e): e is PoolEntry => e !== null),
    throughFy,
  );
}
const allTerms = () =>
  db
    .select()
    .from(depreciatingAssets)
    .all()
    .map((row) => ({ id: row.id, terms: termsOf(row) }));

/** The pool year by year, through this financial year (or `throughFy`) */
export function poolRows(throughFy = fyOf(now().slice(0, 10))) {
  return poolFrom(
    allTerms().map((a) => a.terms),
    throughFy,
  );
}

/** The schedule as far as it goes: to disposal, to zero, or a little past this year */
function fullSchedule(row: AssetRow, today = now().slice(0, 10)) {
  const until = Math.max(fyOf(today) + 1, row.disposedDate ? fyOf(row.disposedDate) : 0);
  return schedule(termsOf(row), Math.max(until, (row.openingFy ?? fyOf(row.startDate)) + 50));
}

/**
 * Lodged years whose figures differ when this asset's terms change (null: it's removed): its
 * own schedule, and the low-value pool, which every pooled asset shares
 */
function lodgedChanges(id: string, before: AssetTerms, after: AssetTerms | null): number[] {
  const lodged = lodgedYears();
  if (!lodged.length) return [];
  const through = Math.max(...lodged);
  const rowOf = (rows: { financialYear: number }[], fy: number) =>
    JSON.stringify(rows.find((r) => r.financialYear === fy) ?? null);
  const was = schedule(before, through);
  const will = after ? schedule(after, through) : [];
  const others = allTerms()
    .filter((a) => a.id !== id)
    .map((a) => a.terms);
  const poolWas = poolFrom([...others, before], through);
  const poolWill = poolFrom(after ? [...others, after] : others, through);
  return lodged.filter(
    (fy) => rowOf(was, fy) !== rowOf(will, fy) || rowOf(poolWas, fy) !== rowOf(poolWill, fy),
  );
}
function refuseLodgedChanges(id: string, before: AssetTerms, after: AssetTerms | null) {
  const changed = lodgedChanges(id, before, after);
  if (changed.length)
    throw new AssetError(
      `That would change ${changed.map(fyName).join(', ')}, already lodged. Unlock the year first.`,
      409,
    );
}

/** Lodged years this asset's figures appear in */
function lodgedIn(row: AssetRow) {
  const years = new Set(fullSchedule(row).map((r) => r.financialYear));
  // In the pool, its figures are part of every pool year from then on, to its disposal
  if (row.pooledFy != null) {
    const end = row.disposedDate ? fyOf(row.disposedDate) : Infinity;
    for (const fy of lodgedYears()) if (fy >= row.pooledFy && fy <= end) years.add(fy);
  }
  return lodgedYears().filter((fy) => years.has(fy));
}

function checkPurchase(transactionId: string, assetId: string | null, replaceClaim: boolean) {
  const tx = db
    .select({
      id: transactions.id,
      isParent: transactions.isParent,
      transfer: transactions.transferTransactionId,
      date: transactions.date,
    })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .get();
  if (!tx) throw new AssetError('Transaction not found', 404);
  if (tx.isParent) throw new AssetError('Choose the part of the split that is the asset');
  if (tx.transfer) throw new AssetError('A transfer between your accounts is not a purchase');
  const other = db
    .select({ id: depreciatingAssets.id, name: depreciatingAssets.name })
    .from(depreciatingAssets)
    .where(eq(depreciatingAssets.transactionId, transactionId))
    .get();
  if (other && other.id !== assetId)
    throw new AssetError(`That purchase is already the asset “${other.name}”`, 409);
  const claimed = db
    .select({ id: taxClaims.transactionId })
    .from(taxClaims)
    .where(eq(taxClaims.transactionId, transactionId))
    .get();
  if (claimed && !replaceClaim)
    throw new AssetError(
      'That purchase is already claimed as a deduction. Depreciate instead removes the claim.',
      409,
    );
  return tx;
}

function checkTerms(row: Omit<AssetRow, 'id' | 'createdAt' | 'updatedAt'>) {
  if (row.startDate < EARLIEST_START)
    throw new AssetError(
      'Assets first used before 10 May 2006 use an older rate that Allotment doesn’t handle',
    );
  if (row.cost <= IMMEDIATE_LIMIT && !row.partOfSet)
    throw new AssetError(
      'Items costing $300 or less are claimed at once, unless they are part of a set or identical items costing more than $300 in total this year',
    );
  if ((row.openingFy == null) !== (row.openingAdjustableValue == null))
    throw new AssetError('Give both the year and the adjustable value it was brought in at');
  if (row.openingFy != null && row.openingFy < fyOf(row.startDate))
    throw new AssetError('It can’t be brought in before its start date');
  if (row.disposedDate && row.disposedDate < row.startDate)
    throw new AssetError('It can’t be disposed of before its start date');
}

function insertOrThrow(fn: () => void) {
  try {
    fn();
  } catch (e) {
    if (e instanceof AssetError) throw e;
    if (e instanceof Error && /CHECK constraint/.test(e.message))
      throw new AssetError('Those figures can’t be saved');
    throw e;
  }
}

export function createAsset(input: AssetInput) {
  const parsed = assetInputSchema
    .required({
      name: true,
      label: true,
      method: true,
      cost: true,
      startDate: true,
      effectiveLifeHundredths: true,
      workUseBps: true,
    })
    .parse(input);
  const id = nanoid();
  const stamp = now();
  db.transaction(() => {
    const tx = parsed.transactionId
      ? checkPurchase(parsed.transactionId, null, parsed.replaceClaim ?? false)
      : null;
    const row = {
      name: parsed.name,
      notes: parsed.notes ?? null,
      label: parsed.label,
      method: parsed.method,
      cost: parsed.cost,
      startDate: parsed.startDate,
      purchaseDate: parsed.purchaseDate ?? tx?.date ?? null,
      effectiveLifeHundredths: parsed.effectiveLifeHundredths,
      workUseBps: parsed.workUseBps,
      partOfSet: parsed.partOfSet ? 1 : 0,
      transactionId: parsed.transactionId ?? null,
      openingFy: parsed.openingFy ?? null,
      openingAdjustableValue: parsed.openingAdjustableValue ?? null,
      disposedDate: null,
      terminationValue: null,
      pooledFy: null,
    };
    checkTerms(row);
    if (tx && parsed.replaceClaim)
      db.delete(taxClaims).where(eq(taxClaims.transactionId, tx.id)).run();
    insertOrThrow(() =>
      db
        .insert(depreciatingAssets)
        .values({ id, ...row, createdAt: stamp, updatedAt: stamp })
        .run(),
    );
  });
  return getAsset(id);
}

/** Fields that change a lodged year's figures */
const LOCKED: (keyof AssetRow)[] = [
  'cost',
  'startDate',
  'method',
  'effectiveLifeHundredths',
  'workUseBps',
  'openingFy',
  'openingAdjustableValue',
];

function assetRow(id: string) {
  const row = db.select().from(depreciatingAssets).where(eq(depreciatingAssets.id, id)).get();
  if (!row) throw new AssetError('Asset not found', 404);
  return row;
}

function refuseIfLodged(row: AssetRow, what: string) {
  const lodged = lodgedIn(row);
  if (lodged.length)
    throw new AssetError(
      `${what} would change ${lodged.map(fyName).join(', ')}, already lodged. Unlock the year first.`,
      409,
    );
}

export function updateAsset(id: string, input: AssetInput) {
  const parsed = assetInputSchema.parse(input);
  db.transaction(() => {
    const old = assetRow(id);
    const next = { ...old };
    for (const [key, value] of Object.entries(parsed))
      if (key !== 'replaceClaim' && value !== undefined)
        (next as Record<string, unknown>)[key] = key === 'partOfSet' ? (value ? 1 : 0) : value;
    if (LOCKED.some((k) => next[k] !== old[k])) {
      refuseIfLodged(old, 'That change');
      refuseLodgedChanges(id, termsOf(old), termsOf(next));
    }
    if (next.transactionId && next.transactionId !== old.transactionId) {
      checkPurchase(next.transactionId, id, parsed.replaceClaim ?? false);
      if (parsed.replaceClaim)
        db.delete(taxClaims).where(eq(taxClaims.transactionId, next.transactionId)).run();
    }
    checkTerms(next);
    if (next.pooledFy != null) {
      const entry = poolEntryFor({ ...termsOf(next), pooledFy: null }, next.pooledFy);
      if ('refused' in entry)
        throw new AssetError(`It would no longer fit the low-value pool: ${entry.refused}`);
    }
    insertOrThrow(() =>
      db
        .update(depreciatingAssets)
        .set({ ...next, id: old.id, createdAt: old.createdAt, updatedAt: now() })
        .where(eq(depreciatingAssets.id, id))
        .run(),
    );
  });
  return getAsset(id);
}

/** A year's own taxable-use share (null goes back to the asset's) */
export function setYearWorkUse(id: string, fy: number, workUseBps: number | null) {
  const row = assetRow(id);
  if (lodgedYears().includes(fy))
    throw new AssetError(`${fyName(fy)} is lodged. Unlock the year first.`, 409);
  // A pooled asset's share in its allocation year carries through the pool's later years
  const before = termsOf(row);
  const shares = { ...before.yearWorkUse };
  if (workUseBps === null) delete shares[fy];
  else shares[fy] = workUseBps;
  refuseLodgedChanges(id, before, { ...before, yearWorkUse: shares });
  if (workUseBps === null)
    db.delete(depreciatingAssetYears)
      .where(
        and(eq(depreciatingAssetYears.assetId, id), eq(depreciatingAssetYears.financialYear, fy)),
      )
      .run();
  else
    db.insert(depreciatingAssetYears)
      .values({ assetId: row.id, financialYear: fy, workUseBps })
      .onConflictDoUpdate({
        target: [depreciatingAssetYears.assetId, depreciatingAssetYears.financialYear],
        set: { workUseBps },
      })
      .run();
  return getAsset(id);
}

export function disposeAsset(id: string, date: string, terminationValue: number) {
  const row = assetRow(id);
  if (date < row.startDate) throw new AssetError('It can’t be disposed of before its start date');
  // Compared year by year, so moving a disposal out of (or into) a lodged year is refused too
  const before = termsOf(row);
  refuseLodgedChanges(id, before, { ...before, disposedDate: date, terminationValue });
  if (row.pooledFy != null && fyOf(date) < row.pooledFy)
    throw new AssetError('It joined the low-value pool after that date: take it out first');
  db.update(depreciatingAssets)
    .set({ disposedDate: date, terminationValue, updatedAt: now() })
    .where(eq(depreciatingAssets.id, id))
    .run();
  return getAsset(id);
}

export function undisposeAsset(id: string) {
  const row = assetRow(id);
  const before = termsOf(row);
  refuseLodgedChanges(id, before, { ...before, disposedDate: null, terminationValue: null });
  db.update(depreciatingAssets)
    .set({ disposedDate: null, terminationValue: null, updatedAt: now() })
    .where(eq(depreciatingAssets.id, id))
    .run();
  return getAsset(id);
}

/**
 * Allocates the asset to the low-value pool from `fy` (D6): a low-cost asset (under $1,000) in
 * its first year, or a diminishing value asset whose opening adjustable value is under $1,000.
 * Its own schedule stops there; the pool carries it from then on.
 */
export function poolAsset(id: string, fy: number) {
  const row = assetRow(id);
  const before = termsOf(row);
  const entry = poolEntryFor({ ...before, pooledFy: null }, fy);
  if ('refused' in entry) throw new AssetError(entry.refused);
  if (row.disposedDate && fyOf(row.disposedDate) < fy)
    throw new AssetError('It was disposed of before that year');
  refuseLodgedChanges(id, before, { ...before, pooledFy: fy });
  db.update(depreciatingAssets)
    .set({ pooledFy: fy, updatedAt: now() })
    .where(eq(depreciatingAssets.id, id))
    .run();
  return getAsset(id);
}

/** Takes it back out of the pool (a correction: the ATO keeps a pooled asset pooled) */
export function unpoolAsset(id: string) {
  const row = assetRow(id);
  const before = termsOf(row);
  refuseLodgedChanges(id, before, { ...before, pooledFy: null });
  db.update(depreciatingAssets)
    .set({ pooledFy: null, updatedAt: now() })
    .where(eq(depreciatingAssets.id, id))
    .run();
  return getAsset(id);
}

/** Years an asset could join the pool, through this year, and what it would add */
function poolOptions(terms: AssetTerms, today = now().slice(0, 10)) {
  if (terms.pooledFy != null) return [];
  const firstFy = terms.openingFy ?? fyOf(terms.startDate);
  const options: { financialYear: number; kind: PoolEntry['kind']; amount: number }[] = [];
  for (let fy = firstFy; fy <= fyOf(today); fy++) {
    const entry = poolEntryFor(terms, fy);
    if (!('refused' in entry)) options.push({ financialYear: fy, ...entry });
  }
  return options;
}

/** Removes the asset; its files stay in Files (records are kept for five years) */
export function removeAsset(id: string) {
  const row = assetRow(id);
  refuseIfLodged(row, 'Removing it');
  refuseLodgedChanges(id, termsOf(row), null);
  db.delete(depreciatingAssets).where(eq(depreciatingAssets.id, id)).run();
}

export function lodgeYear(fy: number) {
  db.insert(taxLodgedYears)
    .values({ financialYear: fy, lodgedAt: now() })
    .onConflictDoNothing()
    .run();
  return lodgedYears();
}
export function unlodgeYear(fy: number) {
  db.delete(taxLodgedYears).where(eq(taxLodgedYears.financialYear, fy)).run();
  return lodgedYears();
}

const fyName = (fy: number) => `${fy}–${String(fy + 1).slice(2)}`;

/** Files linked to each asset, and its purchase's receipts and files: the asset's evidence */
function evidence(rows: AssetRow[]) {
  const ids = rows.map((r) => r.id);
  const purchases = rows.map((r) => r.transactionId).filter((t): t is string => !!t);
  const assetFiles = ids.length
    ? db
        .select({ id: documents.id, assetId: documentLinks.assetId, fileName: documents.fileName })
        .from(documentLinks)
        .innerJoin(documents, eq(documents.id, documentLinks.documentId))
        .where(inArray(documentLinks.assetId, ids))
        .all()
    : [];
  const purchaseFiles = purchases.length
    ? db
        .select({
          id: documents.id,
          transactionId: documentLinks.transactionId,
          fileName: documents.fileName,
        })
        .from(documentLinks)
        .innerJoin(documents, eq(documents.id, documentLinks.documentId))
        .where(inArray(documentLinks.transactionId, purchases))
        .all()
    : [];
  const purchaseReceipts = purchases.length
    ? db
        .select({
          id: receipts.id,
          transactionId: receipts.transactionId,
          fileName: receipts.fileName,
        })
        .from(receipts)
        .where(inArray(receipts.transactionId, purchases))
        .all()
    : [];
  return (row: AssetRow) => {
    const files = new Map<string, { id: string; fileName: string }>();
    for (const f of assetFiles)
      if (f.assetId === row.id) files.set(f.id, { id: f.id, fileName: f.fileName });
    for (const f of purchaseFiles)
      if (row.transactionId && f.transactionId === row.transactionId)
        files.set(f.id, { id: f.id, fileName: f.fileName });
    return {
      receipts: purchaseReceipts
        .filter((r) => row.transactionId && r.transactionId === row.transactionId)
        .map(({ id, fileName }) => ({ id, fileName })),
      files: [...files.values()],
    };
  };
}

function view(row: AssetRow, evidenceOf: ReturnType<typeof evidence>) {
  const rows = fullSchedule(row);
  return {
    ...row,
    partOfSet: row.partOfSet === 1,
    yearWorkUse: yearShares(row.id),
    schedule: rows,
    lodgedYears: lodgedIn(row),
    poolOptions: poolOptions(termsOf(row)),
    ...evidenceOf(row),
  };
}

export function listAssets() {
  const rows = db
    .select()
    .from(depreciatingAssets)
    .orderBy(asc(depreciatingAssets.startDate))
    .all();
  const evidenceOf = evidence(rows);
  return rows.map((r) => view(r, evidenceOf));
}

export function getAsset(id: string) {
  const row = assetRow(id);
  return view(row, evidence([row]));
}

/** Both methods' schedules for figures not yet saved: the form's comparison */
export function previewAsset(input: z.infer<typeof previewSchema>) {
  if (input.startDate < EARLIEST_START)
    throw new AssetError('Assets first used before 10 May 2006 aren’t handled');
  const through = fyOf(input.startDate) + 60;
  const base = {
    ...input,
    openingFy: input.openingFy ?? null,
    openingAdjustableValue: input.openingAdjustableValue ?? null,
  };
  return {
    prime_cost: schedule({ ...base, method: 'prime_cost' }, through),
    diminishing_value: schedule({ ...base, method: 'diminishing_value' }, through).slice(0, 15),
  };
}

export type YearAsset = {
  assetId: string;
  name: string;
  label: (typeof ASSET_LABELS)[number];
  method: DepreciationMethod;
  cost: number;
  effectiveLifeHundredths: number;
  startDate: string;
  disposedDate: string | null;
  row: ScheduleRow;
  /** What goes on the return: the decline's share, plus a balancing deduction */
  deduction: number;
  /** A balancing adjustment that is assessable income (its taxable share), else 0 */
  income: number;
  receipts: { id: string; fileName: string }[];
  files: { id: string; fileName: string }[];
};

/** Each asset's figures for one financial year (Tax time's Deductions, the CSV and the ZIP) */
export function assetsForYear(fy: number): YearAsset[] {
  const rows = db
    .select()
    .from(depreciatingAssets)
    .orderBy(asc(depreciatingAssets.startDate))
    .all();
  const evidenceOf = evidence(rows);
  return rows.flatMap((asset) => {
    const row = schedule(termsOf(asset), fy).find((r) => r.financialYear === fy);
    if (!row) return [];
    const balancing = row.balancingTaxable ?? 0;
    return [
      {
        assetId: asset.id,
        name: asset.name,
        label: asset.label as YearAsset['label'],
        method: asset.method as DepreciationMethod,
        cost: asset.cost,
        effectiveLifeHundredths: asset.effectiveLifeHundredths,
        startDate: asset.startDate,
        disposedDate: asset.disposedDate,
        row,
        deduction: row.deduction + (balancing < 0 ? -balancing : 0),
        income: balancing > 0 ? balancing : 0,
        ...evidenceOf(asset),
      },
    ];
  });
}

/** Every financial year up to this one with an asset's figures in it, for the year picker */
export function assetYears(today = now().slice(0, 10)): number[] {
  const thisFy = fyOf(today);
  const all = allTerms().map((a) => a.terms);
  return [
    ...all.flatMap((terms) => schedule(terms, thisFy).map((r) => r.financialYear)),
    ...poolFrom(all, thisFy).map((r) => r.financialYear),
  ];
}

export type YearPool = {
  row: PoolRow;
  /** The assets in the pool that year, and what each added (in its allocation year) */
  assets: {
    assetId: string;
    name: string;
    kind: PoolEntry['kind'];
    pooledFy: number;
    added: number;
    disposedDate: string | null;
    receipts: { id: string; fileName: string }[];
    files: { id: string; fileName: string }[];
  }[];
};

/** The low-value pool's year (D6), or null when there's nothing in it */
export function poolForYear(fy: number): YearPool | null {
  const rows = db.select().from(depreciatingAssets).all();
  const terms = rows.map(termsOf);
  const row = poolFrom(terms, fy).find((r) => r.financialYear === fy);
  if (!row) return null;
  const pooled = rows.flatMap((asset, i) => {
    const entry = poolEntryOf(terms[i]);
    if (!entry || entry.fy > fy || (entry.disposal && entry.disposal.fy < fy)) return [];
    return [{ asset, entry }];
  });
  const evidenceOf = evidence(pooled.map((p) => p.asset));
  return {
    row,
    assets: pooled.map(({ asset, entry }) => ({
      assetId: asset.id,
      name: asset.name,
      kind: entry.kind,
      pooledFy: entry.fy,
      added: entry.fy === fy ? entry.amount : 0,
      disposedDate: asset.disposedDate,
      ...evidenceOf(asset),
    })),
  };
}

/** Purchase transactions that are assets: never claimed outright as well */
export const assetPurchaseIds = db
  .select({ id: depreciatingAssets.transactionId })
  .from(depreciatingAssets)
  .where(isNotNull(depreciatingAssets.transactionId));

const dollars = (cents: number) => (cents / 100).toFixed(2);
/** The year's depreciation schedule, as the ATO's worksheet lays it out, for a tax agent */
export function assetScheduleRows(fy: number) {
  return [
    [
      'Asset',
      'Label',
      'Method',
      'Cost',
      'Start date',
      'Effective life (years)',
      'Opening adjustable value',
      'Days held',
      'Base value',
      'Decline in value',
      'Taxable use %',
      'Deduction',
      'Closing adjustable value',
      'Disposed',
      'Balancing adjustment',
      'Balancing adjustment (taxable share)',
    ],
    ...assetsForYear(fy).map((a) => [
      a.name,
      a.label,
      a.method === 'prime_cost' ? 'Prime cost' : 'Diminishing value',
      dollars(a.cost),
      a.startDate,
      (a.effectiveLifeHundredths / 100).toFixed(2),
      dollars(a.row.opening),
      a.row.daysHeld,
      dollars(a.row.baseValue),
      dollars(a.row.decline),
      (a.row.workUseBps / 100).toFixed(2),
      dollars(a.row.deduction),
      dollars(a.row.closing),
      a.disposedDate ?? '',
      a.row.balancingAdjustment === undefined ? '' : dollars(a.row.balancingAdjustment),
      a.row.balancingTaxable === undefined ? '' : dollars(a.row.balancingTaxable),
    ]),
    ...poolScheduleRows(fy),
  ];
}

/** The low-value pool's lines in the schedule, after the assets' */
function poolScheduleRows(fy: number): (string | number)[][] {
  const pool = poolForYear(fy);
  if (!pool) return [];
  const { row } = pool;
  return [
    [],
    [
      'Low-value pool (D6)',
      'Opening balance',
      'Low-cost assets added (18.75%)',
      'Low-value assets added (37.5%)',
      'Decline in value',
      'Termination values',
      'Closing balance',
      'Assessable income',
    ],
    [
      fyName(fy),
      dollars(row.opening),
      dollars(row.lowCostAdded),
      dollars(row.lowValueAdded),
      dollars(row.decline),
      dollars(row.terminations),
      dollars(row.closing),
      dollars(row.income),
    ],
    ...pool.assets.map((a) => [
      a.name,
      a.kind === 'low_cost' ? 'Low-cost asset' : 'Low-value asset',
      `Pooled ${fyName(a.pooledFy)}`,
      a.added ? dollars(a.added) : '',
      a.disposedDate ? `Disposed ${a.disposedDate}` : '',
    ]),
  ];
}
