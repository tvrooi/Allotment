// D3a investment sales (docs/INVESTMENT-SALES-AND-INCOME.md §5): selling units from a holding
// against its lots, and Tax time's item 18 from those sales. Sales never write a transaction or
// change a balance (the cash is an ordinary register row). Figures come from capitalGains.ts;
// this file stores, checks and gathers. Writes are made through investmentTax.ts, which keeps
// lodged years' figures from moving.
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accounts,
  documentLinks,
  documents,
  holdings,
  investmentSaleParcels,
  investmentSales,
  securities,
  taxLots,
} from '../db/schema.js';
import {
  fifoParcels,
  netCapitalGain,
  saleFigures,
  type ParcelChoice,
  type ParcelLot,
  type SaleFigures,
  type UnknownReason,
} from './capitalGains.js';
import { financialYearName, financialYearOf } from './financialYear.js';
import { InvestmentError } from './investmentError.js';
import { splitsByHolding, splitsOf } from './investmentSplits.js';
import { lotUnitsOn, unitsBetween } from './splitMath.js';
import {
  convertAmount,
  currencyContext,
  getBudgetSettings,
  todayIso,
  type CurrencyContext,
} from './mainAmountService.js';

/** Super is taxed in the fund, not on a personal return: Tax time leaves these accounts out */
export const NOT_ON_PERSONAL_RETURN = 'retirement';

const now = () => new Date().toISOString();

export interface SaleInput {
  soldOn: string;
  quantity: number;
  proceeds: number;
  fees: number;
  /** The lots it drew from; omitted: first in, first out */
  parcels?: ParcelChoice[];
  notes?: string | null;
}

// ─── Reading sales ────────────────────────────────────────────────────────────

/**
 * Units each lot has given to sales (all but `exceptSaleId`'s), counted on `on` (today unless
 * given): a parcel's units are as of its sale's date, so splits since then scale them
 */
function soldUnits(lotIds: string[], exceptSaleId?: string, on = todayIso()): Map<string, number> {
  if (!lotIds.length) return new Map();
  const rows = db
    .select({
      lotId: investmentSaleParcels.lotId,
      saleId: investmentSaleParcels.saleId,
      holdingId: investmentSales.holdingId,
      soldOn: investmentSales.soldOn,
      quantity: investmentSaleParcels.quantity,
    })
    .from(investmentSaleParcels)
    .innerJoin(investmentSales, eq(investmentSales.id, investmentSaleParcels.saleId))
    .where(inArray(investmentSaleParcels.lotId, lotIds))
    .all();
  const splits = splitsByHolding();
  const taken = new Map<string, number>();
  for (const r of rows)
    if (r.saleId !== exceptSaleId) {
      const units = unitsBetween(r.quantity, r.soldOn, on, splits.get(r.holdingId) ?? []).units;
      taken.set(r.lotId, (taken.get(r.lotId) ?? 0) + units);
    }
  return taken;
}

/** Every sale with what it needs for its figures, oldest first */
function saleRecords() {
  const rows = db
    .select({
      sale: investmentSales,
      accountName: accounts.name,
      accountType: accounts.type,
      symbol: securities.symbol,
      securityName: securities.name,
      currency: securities.currency,
    })
    .from(investmentSales)
    .innerJoin(holdings, eq(holdings.id, investmentSales.holdingId))
    .innerJoin(accounts, eq(accounts.id, holdings.accountId))
    .innerJoin(securities, eq(securities.id, holdings.securityId))
    .orderBy(asc(investmentSales.soldOn), asc(investmentSales.createdAt))
    .all();
  const splits = splitsByHolding();
  const sales = new Map(rows.map((r) => [r.sale.id, r.sale]));
  const parcels = new Map<string, { lot: ParcelLot; quantity: number }[]>();
  for (const p of db
    .select({
      saleId: investmentSaleParcels.saleId,
      quantity: investmentSaleParcels.quantity,
      id: taxLots.id,
      acquiredOn: taxLots.acquiredOn,
      lotQuantity: taxLots.quantity,
      costBasis: taxLots.costBasis,
    })
    .from(investmentSaleParcels)
    .innerJoin(taxLots, eq(taxLots.id, investmentSaleParcels.lotId))
    .orderBy(asc(taxLots.acquiredOn), asc(taxLots.createdAt))
    .all()) {
    const list = parcels.get(p.saleId) ?? [];
    const sale = sales.get(p.saleId)!;
    // The parcel's units, and so its share of the cost, are as of the sale's date
    const lotUnits = lotUnitsOn(
      { acquiredOn: p.acquiredOn, quantity: p.lotQuantity },
      splits.get(sale.holdingId) ?? [],
      sale.soldOn,
    ).units;
    list.push({
      lot: { id: p.id, acquiredOn: p.acquiredOn, quantity: lotUnits, costBasis: p.costBasis },
      quantity: p.quantity,
    });
    parcels.set(p.saleId, list);
  }
  return rows.map((r) => ({ ...r, parcels: parcels.get(r.sale.id) ?? [] }));
}

/** An amount in the security's currency in the budget's on a day (as it is with none chosen) */
export const toBudget =
  (currency: string, ctx: CurrencyContext) => (amount: number, date: string) =>
    ctx.budget ? convertAmount(amount, currency, ctx.budget, date, ctx) : amount;

function figuresOf(record: ReturnType<typeof saleRecords>[number], ctx: CurrencyContext) {
  return saleFigures(record.sale, record.parcels, toBudget(record.currency, ctx));
}

/** Whether every, some or none of a sale's gain gets the discount */
function discountShare(f: SaleFigures): 'all' | 'some' | 'none' {
  const gaining = f.parcels.filter((p) => p.gain !== null && p.gain > 0);
  const discounted = gaining.filter((p) => p.discountable).length;
  return !discounted ? 'none' : discounted === gaining.length ? 'all' : 'some';
}

/** The first reason a sale's gain isn't known, if it isn't */
const unknownOf = (f: SaleFigures): UnknownReason | null =>
  f.parcels.find((p) => p.unknown)?.unknown ?? null;

/** A sale as the Investments page and Tax time show it, figures in the budget's currency */
function saleOut(record: ReturnType<typeof saleRecords>[number], f: SaleFigures) {
  const { sale } = record;
  return {
    id: sale.id,
    holdingId: sale.holdingId,
    soldOn: sale.soldOn,
    quantity: sale.quantity,
    /** Gross proceeds and sale brokerage in the security's currency, as entered */
    grossProceeds: sale.proceeds,
    fees: sale.fees,
    notes: sale.notes,
    /** The settlement deposit it's linked to, if any */
    transactionId: sale.transactionId,
    parcels: f.parcels,
    proceeds: f.proceeds,
    cost: f.cost,
    gain: f.gain,
    discountableGain: f.discountableGain,
    discount: discountShare(f),
    unknown: unknownOf(f),
  };
}
export type SaleOut = ReturnType<typeof saleOut>;

/** Each holding's sales, newest first, for the Investments page */
export function salesByHolding(ctx: CurrencyContext = currencyContext()) {
  const out = new Map<string, SaleOut[]>();
  for (const record of saleRecords().reverse()) {
    const list = out.get(record.sale.holdingId) ?? [];
    list.push(saleOut(record, figuresOf(record, ctx)));
    out.set(record.sale.holdingId, list);
  }
  return out;
}

// ─── Tax time: item 18 ────────────────────────────────────────────────────────

/**
 * A financial year's capital gains (item 18) from the sales recorded in Allotment: each sale's
 * figures, the year's total and net gain, and net losses carried forward. Losses carry from
 * year to year through every earlier year with sales, starting with any the owner carried in.
 * Super accounts are left out. Units without a known cost are left out and counted, never zero.
 */
export function capitalGainsYear(fy: number) {
  const ctx = currencyContext();
  const settings = getBudgetSettings();
  const records = saleRecords();
  const byYear = new Map<number, { record: (typeof records)[number]; f: SaleFigures }[]>();
  let superSales = 0;
  for (const record of records) {
    const year = financialYearOf(record.sale.soldOn);
    if (record.accountType === NOT_ON_PERSONAL_RETURN) {
      if (year === fy) superSales += 1;
      continue;
    }
    const list = byYear.get(year) ?? [];
    list.push({ record, f: figuresOf(record, ctx) });
    byYear.set(year, list);
  }

  const openingFy = settings.capitalLossesCarriedIn ? settings.capitalLossesCarriedInFy : null;
  const first = Math.min(fy, ...byYear.keys(), openingFy ?? fy);
  let carry = 0;
  let net = netCapitalGain([], 0);
  for (let year = first; year <= fy; year += 1) {
    const carriedIn = carry + (year === openingFy ? settings.capitalLossesCarriedIn : 0);
    net = netCapitalGain(
      (byYear.get(year) ?? []).flatMap((s) => s.f.parcels),
      carriedIn,
    );
    carry = net.lossesCarriedForward;
  }

  const rows = byYear.get(fy) ?? [];
  const files = linkedFiles(
    documentLinks.investmentSaleId,
    rows.map((r) => r.record.sale.id),
  );
  const sales = rows.map(({ record, f }) => ({
    ...saleOut(record, f),
    symbol: record.symbol,
    securityName: record.securityName,
    accountName: record.accountName,
    /** Its contract note and other files, for the year's ZIP */
    files: files.get(record.sale.id) ?? [],
  }));
  const withoutCost = sales.filter((s) => s.unknown === 'no_cost' || s.unknown === 'no_lot');
  const withoutRate = sales.filter((s) => s.unknown === 'no_rate');
  const notes: string[] = [];
  if (withoutCost.length)
    notes.push(
      `${withoutCost.length === 1 ? 'A sale has' : `${withoutCost.length} sales have`} units without a known cost, so their gain isn't counted. Add the purchases they came from, with their cost, on the Investments page.`,
    );
  if (withoutRate.length)
    notes.push(
      `${withoutRate.length === 1 ? 'A sale needs' : `${withoutRate.length} sales need`} an exchange rate on its purchase or sale date before its gain can be counted. Add one in Settings → Currencies.`,
    );
  if (superSales)
    notes.push(
      'Sales in super (retirement) accounts are left out: the fund pays tax on them, not your return.',
    );
  if (ctx.budget && ctx.budget !== 'AUD')
    notes.push(
      `Capital gains are in your budget's currency (${ctx.budget}); the return needs Australian dollars.`,
    );

  return {
    financialYear: fy,
    name: financialYearName(fy),
    sales,
    ...net,
    /** Net capital losses from before Allotment, as the owner entered them */
    carriedInFromBefore:
      openingFy === null
        ? null
        : { financialYear: openingFy, amount: settings.capitalLossesCarriedIn },
    superSales,
    notes,
  };
}
export type CapitalGainsYear = ReturnType<typeof capitalGainsYear>;

/** Financial years with a sale on a personal return */
export function capitalGainsYears(): number[] {
  const years = new Set<number>();
  for (const r of db
    .select({ soldOn: investmentSales.soldOn, type: accounts.type })
    .from(investmentSales)
    .innerJoin(holdings, eq(holdings.id, investmentSales.holdingId))
    .innerJoin(accounts, eq(accounts.id, holdings.accountId))
    .all())
    if (r.type !== NOT_ON_PERSONAL_RETURN) years.add(financialYearOf(r.soldOn));
  return [...years];
}

/** Files linked to each of these rows through one of document_links' columns */
export function linkedFiles(column: SQLiteColumn, ids: string[]) {
  const out = new Map<string, { id: string; fileName: string }[]>();
  if (!ids.length) return out;
  for (const r of db
    .select({ owner: column, id: documents.id, fileName: documents.fileName })
    .from(documentLinks)
    .innerJoin(documents, eq(documents.id, documentLinks.documentId))
    .where(and(inArray(column, ids), isNotNull(column)))
    .all()) {
    const owner = r.owner as string;
    out.set(owner, [...(out.get(owner) ?? []), { id: r.id, fileName: r.fileName }]);
  }
  return out;
}

// ─── Recording sales ──────────────────────────────────────────────────────────

export function holdingWithSecurity(holdingId: string) {
  const row = db
    .select({ holding: holdings, currency: securities.currency })
    .from(holdings)
    .innerJoin(securities, eq(securities.id, holdings.securityId))
    .where(eq(holdings.id, holdingId))
    .get();
  if (!row) throw new InvestmentError('Holding not found', 404);
  return row;
}

export function saleOf(holdingId: string, saleId: string) {
  const row = db.select().from(investmentSales).where(eq(investmentSales.id, saleId)).get();
  if (!row || row.holdingId !== holdingId) throw new InvestmentError('Sale not found', 404);
  return row;
}

/**
 * Checks a sale against the holding and its lots, and picks its parcels: the ones chosen, or
 * first in, first out. Units no lot can give are left uncovered (their gain unknown).
 */
function resolveSale(holdingId: string, input: SaleInput, exceptSaleId?: string) {
  const { holding, currency } = holdingWithSecurity(holdingId);
  if (input.soldOn > todayIso()) throw new InvestmentError("A sale can't be dated in the future");
  // The holding keeps the units held now; a sale's units are as of its date, so splits since
  // then scale them
  const splits = splitsOf(holdingId);
  const today = todayIso();
  const prior = exceptSaleId ? saleOf(holdingId, exceptSaleId) : null;
  const held =
    holding.quantity +
    (prior ? unitsBetween(prior.quantity, prior.soldOn, today, splits).units : 0);
  const sold = unitsBetween(input.quantity, input.soldOn, today, splits).units;
  if (sold > held) throw new InvestmentError("That's more units than this holding has", 409);

  const lotRows = db
    .select()
    .from(taxLots)
    .where(eq(taxLots.holdingId, holdingId))
    .orderBy(asc(taxLots.acquiredOn), asc(taxLots.createdAt))
    .all();
  // Each purchase's units, and what other sales left of them, counted on the sale's date
  const taken = soldUnits(
    lotRows.map((l) => l.id),
    exceptSaleId,
    input.soldOn,
  );
  const lots = lotRows.map((l) => {
    const units = lotUnitsOn(l, splits, input.soldOn).units;
    return { ...l, quantity: units, remaining: units - (taken.get(l.id) ?? 0) };
  });

  let parcels: ParcelChoice[];
  if (input.parcels) {
    const seen = new Set<string>();
    let total = 0;
    for (const p of input.parcels) {
      const lot = lots.find((l) => l.id === p.lotId);
      if (!lot) throw new InvestmentError('A parcel is not one of this holding’s purchases');
      if (seen.has(p.lotId)) throw new InvestmentError('A purchase is chosen twice');
      seen.add(p.lotId);
      if (lot.acquiredOn > input.soldOn)
        throw new InvestmentError('A parcel was bought after the sale date');
      if (p.quantity > lot.remaining)
        throw new InvestmentError('A parcel takes more units than are left in its purchase', 409);
      total += p.quantity;
    }
    if (total > input.quantity)
      throw new InvestmentError('The parcels add up to more units than the sale');
    parcels = input.parcels;
  } else {
    parcels = fifoParcels(lots, input.quantity, input.soldOn).parcels;
  }
  return { holding, currency, held, sold, lots, parcels };
}

/** A sale's parcels, gain and discount before it is saved, with the lots it could draw from */
export function previewSale(holdingId: string, input: SaleInput, exceptSaleId?: string) {
  const { currency, lots, parcels } = resolveSale(holdingId, input, exceptSaleId);
  const ctx = currencyContext();
  const f = saleFigures(
    input,
    parcels.map((p) => ({ lot: lots.find((l) => l.id === p.lotId)!, quantity: p.quantity })),
    toBudget(currency, ctx),
  );
  return {
    ...f,
    discount: discountShare(f),
    unknown: unknownOf(f),
    budgetCurrency: ctx.budget,
    lots: lots.map((l) => ({
      id: l.id,
      acquiredOn: l.acquiredOn,
      quantity: l.quantity,
      costBasis: l.costBasis,
      remaining: l.remaining,
    })),
  };
}

function writeSale(saleId: string, holdingId: string, input: SaleInput, exceptSaleId?: string) {
  const { held, sold, parcels } = resolveSale(holdingId, input, exceptSaleId);
  const at = now();
  const row = {
    soldOn: input.soldOn,
    quantity: input.quantity,
    proceeds: input.proceeds,
    fees: input.fees,
    notes: input.notes?.trim() || null,
    updatedAt: at,
  };
  if (exceptSaleId) {
    db.update(investmentSales).set(row).where(eq(investmentSales.id, saleId)).run();
    db.delete(investmentSaleParcels).where(eq(investmentSaleParcels.saleId, saleId)).run();
  } else {
    db.insert(investmentSales)
      .values({ id: saleId, holdingId, ...row, createdAt: at })
      .run();
  }
  if (parcels.length)
    db.insert(investmentSaleParcels)
      .values(parcels.map((p) => ({ saleId, lotId: p.lotId, quantity: p.quantity })))
      .run();
  // The holding keeps the units held now: the sale's units leave it in the same step
  db.update(holdings)
    .set({ quantity: held - sold, updatedAt: at })
    .where(eq(holdings.id, holdingId))
    .run();
  return db.select().from(investmentSales).where(eq(investmentSales.id, saleId)).get()!;
}

/** Saves a new sale (no `saleId`) or replaces one. Call inside investmentTax.ts's lock. */
export function saveSale(holdingId: string, input: SaleInput, saleId?: string) {
  return saleId
    ? writeSale(saleId, holdingId, input, saleId)
    : writeSale(nanoid(), holdingId, input);
}

/** Removes a sale and puts its units back in the holding and its lots */
export function deleteSale(holdingId: string, saleId: string) {
  const sale = saleOf(holdingId, saleId);
  db.delete(investmentSales).where(eq(investmentSales.id, saleId)).run();
  db.update(holdings)
    .set({
      quantity: sql`${holdings.quantity} + ${unitsBetween(sale.quantity, sale.soldOn, todayIso(), splitsOf(holdingId)).units}`,
      updatedAt: now(),
    })
    .where(eq(holdings.id, holdingId))
    .run();
}

// ─── What sales hold on to ────────────────────────────────────────────────────

/** Units sold from a lot, counted today, and the earliest sale that took some */
export function soldFromLot(lotId: string): { units: number; firstSoldOn: string | null } {
  const row = db
    .select({ first: sql<string | null>`min(${investmentSales.soldOn})` })
    .from(investmentSaleParcels)
    .innerJoin(investmentSales, eq(investmentSales.id, investmentSaleParcels.saleId))
    .where(eq(investmentSaleParcels.lotId, lotId))
    .get();
  return { units: soldUnits([lotId]).get(lotId) ?? 0, firstSoldOn: row?.first ?? null };
}

/** Units each of these lots has given to sales */
export const soldFromLots = (lotIds: string[]) => soldUnits(lotIds);

export function holdingHasSales(holdingId: string): boolean {
  return !!db
    .select({ id: investmentSales.id })
    .from(investmentSales)
    .where(eq(investmentSales.holdingId, holdingId))
    .get();
}
