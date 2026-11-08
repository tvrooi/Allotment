import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accounts,
  holdings,
  securities,
  securityPrices,
  taxLots,
  transactions,
} from '../db/schema.js';
import { inAccountBalance } from './balances.js';
import {
  convertAmount,
  currencyContext,
  todayIso,
  type CurrencyContext,
} from './mainAmountService.js';
import { mulDiv, valueHolding, type PriceInput } from './investmentMath.js';
import { InvestmentError } from './investmentError.js';
import { holdingHasSales, salesByHolding, soldFromLot, soldFromLots } from './investmentSales.js';
import {
  holdingHasIncome,
  incomeByHolding,
  lotIsReinvestment,
  reinvestedLots,
} from './investmentIncomeService.js';
import { keepingLodgedYears } from './investmentTax.js';
import { splitRows, splitsByHolding, splitsOf } from './investmentSplits.js';
import { lotUnitsOn } from './splitMath.js';

// P3 investments (docs/INVESTMENTS.md): manual securities, prices, positions and tax lots.
// None of it writes a transaction or changes an account's balance. The overview compares the
// holdings' value with the account's recorded balance and leaves recording it to the user.

/** Account types whose positions can be tracked */
export const INVESTMENT_ACCOUNT_TYPES = ['investment', 'retirement', 'crypto'] as const;

export const SECURITY_KINDS = ['stock', 'etf', 'fund', 'bond', 'crypto', 'other'] as const;
export type SecurityKind = (typeof SECURITY_KINDS)[number];

const now = () => new Date().toISOString();

// ─── Securities and prices ────────────────────────────────────────────────────

function security(id: string) {
  const row = db.select().from(securities).where(eq(securities.id, id)).get();
  if (!row) throw new InvestmentError('Security not found', 404);
  return row;
}

function symbolTaken(symbol: string, currency: string, exceptId?: string) {
  const other = db
    .select({ id: securities.id })
    .from(securities)
    .where(
      and(sql`${securities.symbol} = ${symbol} collate nocase`, eq(securities.currency, currency)),
    )
    .get();
  return !!other && other.id !== exceptId;
}

export function createSecurity(input: {
  symbol: string;
  name: string;
  kind: SecurityKind;
  currency: string;
}) {
  const symbol = input.symbol.trim().toUpperCase();
  if (symbolTaken(symbol, input.currency)) {
    throw new InvestmentError(`${symbol} in ${input.currency} is already in your securities`, 409);
  }
  const row = {
    id: nanoid(),
    symbol,
    name: input.name.trim(),
    kind: input.kind,
    currency: input.currency,
    createdAt: now(),
  };
  db.insert(securities).values(row).run();
  return row;
}

export function updateSecurity(
  id: string,
  input: { symbol?: string; name?: string; kind?: SecurityKind; currency?: string },
) {
  const current = security(id);
  const symbol = input.symbol?.trim().toUpperCase() ?? current.symbol;
  const currency = input.currency ?? current.currency;
  if (currency !== current.currency) {
    // Its prices and every lot's cost are in the old currency: relabelling would revalue them
    const priced = db
      .select({ d: securityPrices.date })
      .from(securityPrices)
      .where(eq(securityPrices.securityId, id))
      .get();
    if (priced) {
      throw new InvestmentError(
        'This security already has prices in its currency. Add a new security for the other currency.',
        409,
      );
    }
  }
  if (symbolTaken(symbol, currency, id)) {
    throw new InvestmentError(`${symbol} in ${currency} is already in your securities`, 409);
  }
  db.update(securities)
    .set({
      symbol,
      currency,
      name: input.name?.trim() ?? current.name,
      kind: input.kind ?? current.kind,
    })
    .where(eq(securities.id, id))
    .run();
  return security(id);
}

export function deleteSecurity(id: string) {
  security(id);
  const held = db
    .select({ id: holdings.id })
    .from(holdings)
    .where(eq(holdings.securityId, id))
    .get();
  if (held) throw new InvestmentError('Remove the holdings of this security first', 409);
  db.delete(securities).where(eq(securities.id, id)).run();
}

export function listPrices(securityId: string) {
  security(securityId);
  return db
    .select({ date: securityPrices.date, price: securityPrices.price })
    .from(securityPrices)
    .where(eq(securityPrices.securityId, securityId))
    .orderBy(sql`${securityPrices.date} desc`)
    .all();
}

/** Enter a price for a day, replacing that day's price if there is one */
export function setPrice(securityId: string, date: string, price: number) {
  security(securityId);
  if (date > todayIso()) throw new InvestmentError("A price can't be dated in the future");
  db.insert(securityPrices)
    .values({ securityId, date, price, createdAt: now() })
    .onConflictDoUpdate({
      target: [securityPrices.securityId, securityPrices.date],
      set: { price, createdAt: now() },
    })
    .run();
  return { date, price };
}

export function deletePrice(securityId: string, date: string) {
  const result = db
    .delete(securityPrices)
    .where(and(eq(securityPrices.securityId, securityId), eq(securityPrices.date, date)))
    .run();
  if (!result.changes) throw new InvestmentError('Price not found', 404);
}

// ─── Holdings and lots ────────────────────────────────────────────────────────

function investmentAccount(id: string) {
  const row = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!row || row.closedAt) throw new InvestmentError('Account not found', 404);
  if (!(INVESTMENT_ACCOUNT_TYPES as readonly string[]).includes(row.type)) {
    throw new InvestmentError('Holdings belong in an investment, retirement or crypto account');
  }
  return row;
}

function holding(id: string) {
  const row = db.select().from(holdings).where(eq(holdings.id, id)).get();
  if (!row) throw new InvestmentError('Holding not found', 404);
  return row;
}

export function createHolding(input: {
  accountId: string;
  securityId: string;
  quantity: number;
  notes?: string | null;
}) {
  investmentAccount(input.accountId);
  const sec = security(input.securityId);
  const existing = db
    .select({ id: holdings.id })
    .from(holdings)
    .where(and(eq(holdings.accountId, input.accountId), eq(holdings.securityId, input.securityId)))
    .get();
  if (existing) {
    throw new InvestmentError(`This account already holds ${sec.symbol}: edit that holding`, 409);
  }
  const at = now();
  const row = {
    id: nanoid(),
    accountId: input.accountId,
    securityId: input.securityId,
    quantity: input.quantity,
    notes: input.notes?.trim() || null,
    createdAt: at,
    updatedAt: at,
  };
  db.insert(holdings).values(row).run();
  return row;
}

export function updateHolding(id: string, input: { quantity?: number; notes?: string | null }) {
  holding(id);
  const update: Partial<typeof holdings.$inferInsert> = { updatedAt: now() };
  if (input.quantity !== undefined) update.quantity = input.quantity;
  if (input.notes !== undefined) update.notes = input.notes?.trim() || null;
  db.update(holdings).set(update).where(eq(holdings.id, id)).run();
  return holding(id);
}

/** Removes the position and its lots; the account's transactions and balance are untouched */
export function deleteHolding(id: string) {
  holding(id);
  // Its sales are the record of what was sold: a sold-out holding stays, under Sold
  if (holdingHasSales(id))
    throw new InvestmentError('This holding has sales. Remove its sales first.', 409);
  if (holdingHasIncome(id))
    throw new InvestmentError(
      'This holding has income recorded. Remove those payments first.',
      409,
    );
  db.delete(holdings).where(eq(holdings.id, id)).run();
}

function checkLotDate(date: string) {
  if (date > todayIso()) throw new InvestmentError("A lot can't be acquired in the future");
}

export function addLot(
  holdingId: string,
  input: { acquiredOn: string; quantity: number; costBasis: number | null },
) {
  holding(holdingId);
  checkLotDate(input.acquiredOn);
  const row = { id: nanoid(), holdingId, ...input, createdAt: now() };
  db.insert(taxLots).values(row).run();
  return row;
}

export function updateLot(
  id: string,
  input: { acquiredOn?: string; quantity?: number; costBasis?: number | null },
) {
  // A sold parcel's cost and date follow its lot, so a lodged year's gains can't move
  return keepingLodgedYears(() => {
    const lot = db.select().from(taxLots).where(eq(taxLots.id, id)).get();
    if (!lot) throw new InvestmentError('Lot not found', 404);
    if (input.acquiredOn) checkLotDate(input.acquiredOn);
    const sold = soldFromLot(id);
    // Sold units are counted today, so the lot's are too: its splits since it was bought apply
    const splits = splitsOf(lot.holdingId);
    const unitsNow = (quantity: number, acquiredOn: string) =>
      lotUnitsOn({ acquiredOn, quantity }, splits, todayIso()).units;
    if (
      (input.quantity !== undefined || input.acquiredOn !== undefined) &&
      unitsNow(input.quantity ?? lot.quantity, input.acquiredOn ?? lot.acquiredOn) < sold.units
    )
      throw new InvestmentError(
        "Sales took units from this purchase: it can't hold fewer than they took",
        409,
      );
    if (input.acquiredOn && sold.firstSoldOn && input.acquiredOn > sold.firstSoldOn)
      throw new InvestmentError('A sale took units from this purchase before that date', 409);
    if (Object.keys(input).length) db.update(taxLots).set(input).where(eq(taxLots.id, id)).run();
    return db.select().from(taxLots).where(eq(taxLots.id, id)).get()!;
  });
}

export function deleteLot(id: string) {
  if (soldFromLot(id).units)
    throw new InvestmentError('Units of this purchase were sold. Remove the sale first.', 409);
  if (lotIsReinvestment(id))
    throw new InvestmentError(
      'This purchase is a reinvested payment. Change or remove the payment instead.',
      409,
    );
  const result = db.delete(taxLots).where(eq(taxLots.id, id)).run();
  if (!result.changes) throw new InvestmentError('Lot not found', 404);
}

// ─── Overview ─────────────────────────────────────────────────────────────────

/**
 * An amount in another currency, or null without a rate. A budget that hasn't chosen a
 * currency has nothing to convert to: its amounts are counted as they are.
 */
function convert(
  amount: number | null,
  from: string,
  to: string | null,
  date: string,
  ctx: CurrencyContext,
): number | null {
  if (amount === null) return null;
  if (!to) return amount;
  return convertAmount(amount, from, to, date, ctx);
}

/**
 * Every open investment account with its positions valued on `asOf` (default today). Values
 * are in each security's currency, then each account's, then the budget's for the totals;
 * anything that can't be valued or converted is counted as missing, not as zero.
 */
export function investmentOverview(asOf: string = todayIso()) {
  const ctx = currencyContext();
  const today = todayIso();
  const accountRows = db
    .select()
    .from(accounts)
    .where(and(isNull(accounts.closedAt), inArray(accounts.type, [...INVESTMENT_ACCOUNT_TYPES])))
    .orderBy(asc(accounts.sortOrder), sql`${accounts.name} collate nocase`)
    .all();
  const accountIds = accountRows.map((a) => a.id);

  const securityRows = db.select().from(securities).orderBy(asc(securities.symbol)).all();
  const prices = new Map<string, PriceInput[]>();
  for (const p of db.select().from(securityPrices).all()) {
    let list = prices.get(p.securityId);
    if (!list) prices.set(p.securityId, (list = []));
    list.push({ date: p.date, price: p.price });
  }

  const holdingRows = accountIds.length
    ? db.select().from(holdings).where(inArray(holdings.accountId, accountIds)).all()
    : [];
  const lotRows = holdingRows.length
    ? db
        .select()
        .from(taxLots)
        .where(
          inArray(
            taxLots.holdingId,
            holdingRows.map((h) => h.id),
          ),
        )
        .orderBy(asc(taxLots.acquiredOn), asc(taxLots.createdAt))
        .all()
    : [];

  const balances = new Map(
    (accountIds.length
      ? db
          .select({
            accountId: transactions.accountId,
            sum: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
          })
          .from(transactions)
          .where(and(inArray(transactions.accountId, accountIds), inAccountBalance))
          .groupBy(transactions.accountId)
          .all()
      : []
    ).map((r) => [r.accountId, r.sum]),
  );

  // A lot counts only the units no sale took, at that share of its cost
  const taken = soldFromLots(lotRows.map((l) => l.id));
  const reinvested = reinvestedLots(lotRows.map((l) => l.id));
  const sales = salesByHolding(ctx);
  const splits = splitsByHolding();
  const income = incomeByHolding();

  const securityById = new Map(securityRows.map((s) => [s.id, s]));
  // Counted over every account, closed ones too: a held security can't be deleted
  const heldCounts = new Map(
    db
      .select({ securityId: holdings.securityId, n: sql<number>`count(*)` })
      .from(holdings)
      .groupBy(holdings.securityId)
      .all()
      .map((r) => [r.securityId, r.n]),
  );
  const totals = {
    value: 0,
    /** Holdings left out of `value`: no price, or no rate to the budget's currency */
    unvalued: 0,
    costBasis: 0,
    unrealizedGain: 0,
    /** Holdings left out of the gain totals: some unit's cost isn't known */
    withoutBasis: 0,
  };

  const accountsOut = accountRows.map((account) => {
    const currency = account.currency ?? ctx.budget;
    let holdingsValue: number | null = 0;
    const rows = holdingRows
      .filter((h) => h.accountId === account.id)
      .map((h) => {
        const sec = securityById.get(h.securityId)!;
        // A lot's units today are its recorded units scaled by the splits since it was bought
        const lots = lotRows
          .filter((l) => l.holdingId === h.id)
          .map((l) => {
            const units = lotUnitsOn(l, splits.get(h.id) ?? [], today);
            return {
              ...l,
              units: units.units,
              exact: units.exact,
              remaining: units.units - (taken.get(l.id) ?? 0),
            };
          });
        const held = lots
          .filter((l) => l.remaining > 0)
          .map((l) => ({
            quantity: l.remaining,
            costBasis: l.costBasis === null ? null : mulDiv(l.costBasis, l.remaining, l.units),
          }));
        const valuation = valueHolding(h.quantity, held, prices.get(sec.id) ?? [], asOf);
        const accountValue = convert(valuation.value, sec.currency, currency, asOf, ctx);
        holdingsValue =
          holdingsValue === null || accountValue === null ? null : holdingsValue + accountValue;

        const mainValue = convert(valuation.value, sec.currency, ctx.budget, asOf, ctx);
        if (mainValue === null) totals.unvalued += 1;
        else totals.value += mainValue;
        const mainBasis = convert(valuation.costBasis, sec.currency, ctx.budget, asOf, ctx);
        const mainGain = convert(valuation.unrealizedGain, sec.currency, ctx.budget, asOf, ctx);
        if (mainBasis === null || mainGain === null) totals.withoutBasis += 1;
        else {
          totals.costBasis += mainBasis;
          totals.unrealizedGain += mainGain;
        }

        return {
          id: h.id,
          accountId: h.accountId,
          quantity: h.quantity,
          notes: h.notes,
          updatedAt: h.updatedAt,
          security: sec,
          lots: lots.map((l) => ({
            id: l.id,
            acquiredOn: l.acquiredOn,
            /** As recorded when bought; `units` is what that is today, after any splits */
            quantity: l.quantity,
            units: l.units,
            costBasis: l.costBasis,
            /** Units no sale has taken, counted today */
            remaining: l.remaining,
            /** Bought by a reinvested payment: changed through that payment */
            reinvested: reinvested.has(l.id),
          })),
          /** Splits and consolidations, newest first */
          splits: splitRows(h.id),
          /** A consolidation dropped a fraction of a millionth of a unit from a purchase */
          unitsRounded: lots.some((l) => !l.exact),
          /** Newest first, figures in the budget's currency */
          sales: sales.get(h.id) ?? [],
          /** Dividends, distributions and interest, newest first, as entered */
          income: income.get(h.id) ?? [],
          ...valuation,
          /** The value in the account's currency (null without a price or rate) */
          accountValue,
        };
      });
    const recordedBalance = account.startingBalance + (balances.get(account.id) ?? 0);
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency,
      recordedBalance,
      holdingsValue: rows.length ? holdingsValue : null,
      /** Holdings value − recorded balance; null when either side isn't known */
      difference: rows.length && holdingsValue !== null ? holdingsValue - recordedBalance : null,
      holdings: rows,
    };
  });

  return {
    asOf,
    budgetCurrency: ctx.budget,
    accounts: accountsOut,
    securities: securityRows.map((s) => {
      const latest = (prices.get(s.id) ?? []).reduce<PriceInput | null>(
        (best, p) => (!best || p.date > best.date ? p : best),
        null,
      );
      return {
        ...s,
        latestPrice: latest?.price ?? null,
        latestPriceDate: latest?.date ?? null,
        holdingCount: heldCounts.get(s.id) ?? 0,
      };
    }),
    totals,
  };
}
