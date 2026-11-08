// D3b investment income (docs/INVESTMENT-SALES-AND-INCOME.md §5): dividends, trust distributions
// and interest paid on a holding, with what item 11 needs from each statement, and units
// reinvested through a dividend plan as a lot of their own. Income never writes a transaction or
// changes a balance; the deposit may be linked (investmentLinks.ts). Writes are made through
// investmentTax.ts, which keeps lodged years' figures from moving.
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accounts,
  documentLinks,
  holdings,
  investmentIncome,
  investmentSaleParcels,
  investmentSales,
  securities,
  taxLots,
} from '../db/schema.js';
import { financialYearOf } from './financialYear.js';
import { InvestmentError } from './investmentError.js';
import {
  holdingPeriodConcerns,
  incomeYearTotals,
  partsDisagree,
  SMALL_SHAREHOLDER_LIMIT,
  type IncomeKind,
} from './investmentIncome.js';
import {
  holdingWithSecurity,
  linkedFiles,
  NOT_ON_PERSONAL_RETURN,
  soldFromLot,
  toBudget,
} from './investmentSales.js';
import { currencyContext, todayIso, type CurrencyContext } from './mainAmountService.js';

const now = () => new Date().toISOString();

export interface IncomeInput {
  paidOn: string;
  kind: IncomeKind;
  /** The payment after any tax withheld, in the security's currency */
  amount: number;
  unfranked: number;
  franked: number;
  frankingCredit: number;
  withheld: number;
  /** Units the payment bought through a reinvestment plan, and what they cost */
  reinvested?: { quantity: number; cost: number } | null;
  notes?: string | null;
}

function incomeOf(holdingId: string, incomeId: string) {
  const row = db.select().from(investmentIncome).where(eq(investmentIncome.id, incomeId)).get();
  if (!row || row.holdingId !== holdingId) throw new InvestmentError('Payment not found', 404);
  return row;
}

/**
 * Brings the payment's reinvestment lot in line with `reinvested` (null: none), changing the
 * holding's units by the same amount. Refuses what would undo units a sale has taken.
 */
function syncReinvestment(
  holdingId: string,
  lotId: string | null,
  paidOn: string,
  reinvested: IncomeInput['reinvested'],
): string | null {
  const holding = holdingWithSecurity(holdingId).holding;
  const at = now();
  const moveUnits = (delta: number) => {
    if (holding.quantity + delta < 0)
      throw new InvestmentError(
        'The holding has fewer units than this payment bought. Fix the holding first.',
        409,
      );
    if (delta)
      db.update(holdings)
        .set({ quantity: holding.quantity + delta, updatedAt: at })
        .where(eq(holdings.id, holdingId))
        .run();
  };
  const lot = lotId ? db.select().from(taxLots).where(eq(taxLots.id, lotId)).get() : undefined;
  if (!lot) {
    if (!reinvested) return null;
    const id = nanoid();
    db.insert(taxLots)
      .values({
        id,
        holdingId,
        acquiredOn: paidOn,
        quantity: reinvested.quantity,
        costBasis: reinvested.cost,
        createdAt: at,
      })
      .run();
    moveUnits(reinvested.quantity);
    return id;
  }
  const sold = soldFromLot(lot.id);
  if (!reinvested) {
    if (sold.units)
      throw new InvestmentError(
        'Units this payment bought were sold. Remove that sale first, or keep the reinvestment.',
        409,
      );
    db.delete(taxLots).where(eq(taxLots.id, lot.id)).run();
    moveUnits(-lot.quantity);
    return null;
  }
  if (reinvested.quantity < sold.units)
    throw new InvestmentError(
      "Sales took units this payment bought: it can't have bought fewer than they took",
      409,
    );
  if (sold.firstSoldOn && paidOn > sold.firstSoldOn)
    throw new InvestmentError('A sale took units this payment bought before that date', 409);
  db.update(taxLots)
    .set({ acquiredOn: paidOn, quantity: reinvested.quantity, costBasis: reinvested.cost })
    .where(eq(taxLots.id, lot.id))
    .run();
  moveUnits(reinvested.quantity - lot.quantity);
  return lot.id;
}

/** Saves a new payment (no `incomeId`) or replaces one. Call inside investmentTax.ts's lock. */
export function saveIncome(holdingId: string, input: IncomeInput, incomeId?: string) {
  holdingWithSecurity(holdingId);
  if (input.paidOn > todayIso())
    throw new InvestmentError("A payment can't be dated in the future");
  if (input.reinvested && input.reinvested.cost > input.amount)
    throw new InvestmentError("The amount reinvested can't be more than the payment");
  const existing = incomeId ? incomeOf(holdingId, incomeId) : null;
  const lotId = syncReinvestment(
    holdingId,
    existing?.reinvestedLotId ?? null,
    input.paidOn,
    input.reinvested,
  );
  const at = now();
  const row = {
    paidOn: input.paidOn,
    kind: input.kind,
    amount: input.amount,
    unfranked: input.unfranked,
    franked: input.franked,
    frankingCredit: input.frankingCredit,
    withheld: input.withheld,
    reinvestedLotId: lotId,
    notes: input.notes?.trim() || null,
    updatedAt: at,
  };
  const id = existing?.id ?? nanoid();
  if (existing) db.update(investmentIncome).set(row).where(eq(investmentIncome.id, id)).run();
  else
    db.insert(investmentIncome)
      .values({ id, holdingId, ...row, createdAt: at })
      .run();
  return db.select().from(investmentIncome).where(eq(investmentIncome.id, id)).get()!;
}

/** Removes a payment and the units it reinvested. Call inside investmentTax.ts's lock. */
export function deleteIncome(holdingId: string, incomeId: string) {
  const row = incomeOf(holdingId, incomeId);
  syncReinvestment(holdingId, row.reinvestedLotId, row.paidOn, null);
  db.delete(investmentIncome).where(eq(investmentIncome.id, incomeId)).run();
}

// ─── Reading ──────────────────────────────────────────────────────────────────

function incomeRecords() {
  return db
    .select({
      income: investmentIncome,
      accountName: accounts.name,
      accountType: accounts.type,
      symbol: securities.symbol,
      securityName: securities.name,
      currency: securities.currency,
      reinvestedUnits: taxLots.quantity,
      reinvestedCost: taxLots.costBasis,
    })
    .from(investmentIncome)
    .innerJoin(holdings, eq(holdings.id, investmentIncome.holdingId))
    .innerJoin(accounts, eq(accounts.id, holdings.accountId))
    .innerJoin(securities, eq(securities.id, holdings.securityId))
    .leftJoin(taxLots, eq(taxLots.id, investmentIncome.reinvestedLotId))
    .orderBy(asc(investmentIncome.paidOn), asc(investmentIncome.createdAt))
    .all();
}
type IncomeRecord = ReturnType<typeof incomeRecords>[number];

/** A payment as entered, in the security's currency */
function incomeOut(r: IncomeRecord) {
  const i = r.income;
  return {
    id: i.id,
    holdingId: i.holdingId,
    paidOn: i.paidOn,
    kind: i.kind as IncomeKind,
    amount: i.amount,
    unfranked: i.unfranked,
    franked: i.franked,
    frankingCredit: i.frankingCredit,
    withheld: i.withheld,
    reinvested:
      i.reinvestedLotId && r.reinvestedUnits !== null
        ? { lotId: i.reinvestedLotId, quantity: r.reinvestedUnits, cost: r.reinvestedCost ?? 0 }
        : null,
    /** The deposit it's linked to, if any */
    transactionId: i.transactionId,
    notes: i.notes,
    /** Its parts don't add up to the payment plus tax withheld (a prompt to check) */
    partsDisagree: partsDisagree({ ...i, kind: i.kind as IncomeKind }),
  };
}
export type IncomeOut = ReturnType<typeof incomeOut>;

/** Each holding's payments, newest first, for the Investments page */
export function incomeByHolding() {
  const out = new Map<string, IncomeOut[]>();
  for (const r of incomeRecords().reverse()) {
    out.set(r.income.holdingId, [...(out.get(r.income.holdingId) ?? []), incomeOut(r)]);
  }
  return out;
}

/** A payment's figures in the budget's currency on the day it was paid */
function converted(r: IncomeRecord, ctx: CurrencyContext) {
  const to = toBudget(r.currency, ctx);
  const at = (n: number) => to(n, r.income.paidOn);
  return {
    kind: r.income.kind as IncomeKind,
    amount: at(r.income.amount),
    unfranked: at(r.income.unfranked),
    franked: at(r.income.franked),
    frankingCredit: at(r.income.frankingCredit),
    withheld: at(r.income.withheld),
  };
}

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A financial year's investment income for Tax time: item 11 (dividends), trust distributions
 * (cash and franking only) and interest (item 10), with each payment in the budget's currency.
 * Super is left out. A payment that can't be converted is left out and counted, never zero.
 */
export function incomeYear(fy: number) {
  const ctx = currencyContext();
  let superPayments = 0;
  const mine = incomeRecords().filter((r) => {
    if (financialYearOf(r.income.paidOn) !== fy) return false;
    if (r.accountType === NOT_ON_PERSONAL_RETURN) {
      superPayments += 1;
      return false;
    }
    return true;
  });
  const figures = mine.map((r) => converted(r, ctx));
  const totals = incomeYearTotals(figures);
  const files = linkedFiles(
    documentLinks.investmentIncomeId,
    mine.map((r) => r.income.id),
  );

  // The 45-day rule matters only above the small shareholder exemption
  const credits = totals.dividends.frankingCredit + totals.distributions.frankingCredit;
  const holdingIds = [...new Set(mine.map((r) => r.income.holdingId))];
  const concerns =
    credits >= SMALL_SHAREHOLDER_LIMIT && holdingIds.length
      ? new Set(
          holdingPeriodConcerns(
            mine.map((r, i) => ({
              id: r.income.id,
              holdingId: r.income.holdingId,
              paidOn: r.income.paidOn,
              frankingCredit: figures[i].frankingCredit ?? 0,
            })),
            db
              .select({
                holdingId: investmentSales.holdingId,
                acquiredOn: taxLots.acquiredOn,
                soldOn: investmentSales.soldOn,
              })
              .from(investmentSaleParcels)
              .innerJoin(investmentSales, eq(investmentSales.id, investmentSaleParcels.saleId))
              .innerJoin(taxLots, eq(taxLots.id, investmentSaleParcels.lotId))
              .where(inArray(investmentSales.holdingId, holdingIds))
              .all(),
          ),
        )
      : new Set<string>();

  const payments = mine.map((r, i) => ({
    ...incomeOut(r),
    symbol: r.symbol,
    securityName: r.securityName,
    accountName: r.accountName,
    /** In the budget's currency; null without an exchange rate */
    converted: figures[i],
    /** Units bought and sold within 45 days around it: its credit may not count */
    holdingPeriodConcern: concerns.has(r.income.id),
    files: files.get(r.income.id) ?? [],
  }));

  const notes: string[] = [];
  if (totals.unconverted)
    notes.push(
      `${totals.unconverted === 1 ? 'A payment needs' : `${totals.unconverted} payments need`} an exchange rate on the day it was paid before it can be counted. Add one in Settings → Currencies.`,
    );
  if (payments.some((p) => p.partsDisagree))
    notes.push(
      "A dividend's unfranked and franked amounts don't add up to what was paid plus tax withheld. Check them against the statement.",
    );
  if (totals.distributions.count)
    notes.push(
      "Distributions from ETFs and managed funds go on the return from the fund's annual tax statement (items 13 and 18), not as dividends. Only their cash and franking are shown here.",
    );
  if (credits >= SMALL_SHAREHOLDER_LIMIT)
    notes.push(
      `Franking credits this year are ${money(credits)}, so the small shareholder exemption doesn't apply: a credit counts only if the shares were held at risk for 45 days (90 for preference shares).${concerns.size ? ' Payments marked below had units bought and sold within 45 days around them.' : ''}`,
    );
  if (superPayments)
    notes.push(
      'Income in super (retirement) accounts is left out: the fund pays tax on it, not your return.',
    );
  if (ctx.budget && ctx.budget !== 'AUD')
    notes.push(
      `Investment income is in your budget's currency (${ctx.budget}); the return needs Australian dollars.`,
    );

  return { financialYear: fy, payments, ...totals, superPayments, notes };
}
export type IncomeYear = ReturnType<typeof incomeYear>;

/** Financial years with a payment on a personal return */
export function incomeYears(): number[] {
  const years = new Set<number>();
  for (const r of db
    .select({ paidOn: investmentIncome.paidOn, type: accounts.type })
    .from(investmentIncome)
    .innerJoin(holdings, eq(holdings.id, investmentIncome.holdingId))
    .innerJoin(accounts, eq(accounts.id, holdings.accountId))
    .orderBy(desc(investmentIncome.paidOn))
    .all())
    if (r.type !== NOT_ON_PERSONAL_RETURN) years.add(financialYearOf(r.paidOn));
  return [...years];
}

// ─── What income holds on to ──────────────────────────────────────────────────

export function holdingHasIncome(holdingId: string): boolean {
  return !!db
    .select({ id: investmentIncome.id })
    .from(investmentIncome)
    .where(eq(investmentIncome.holdingId, holdingId))
    .get();
}

/** Whether a lot is the units a payment reinvested (changed through the payment, not on its own) */
export function lotIsReinvestment(lotId: string): boolean {
  return !!db
    .select({ id: investmentIncome.id })
    .from(investmentIncome)
    .where(eq(investmentIncome.reinvestedLotId, lotId))
    .get();
}

/** Payments whose reinvested lot is one of these */
export const reinvestedLots = (lotIds: string[]) =>
  new Set(
    lotIds.length
      ? db
          .select({ lotId: investmentIncome.reinvestedLotId })
          .from(investmentIncome)
          .where(inArray(investmentIncome.reinvestedLotId, lotIds))
          .all()
          .map((r) => r.lotId!)
      : [],
  );
