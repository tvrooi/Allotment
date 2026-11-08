// D3b register links (docs/INVESTMENT-SALES-AND-INCOME.md §4 "Links to the register"): a sale or
// a payment may point at the deposit that brought its cash in. The page suggests deposits for
// the same amount within 7 days and the owner confirms one; nothing is linked by guess. A link
// only marks the deposit as investment money: it changes no category, amount or balance, and no
// tax figure, so lodged years don't lock it.
import { and, eq, gte, isNull, lte, ne, sql } from 'drizzle-orm';
import { addDays, format, parseISO } from 'date-fns';
import { db } from '../db/index.js';
import {
  accounts,
  holdings,
  investmentIncome,
  investmentSales,
  securities,
  taxLots,
  transactions,
} from '../db/schema.js';
import { mainAmount } from './balances.js';
import { InvestmentError } from './investmentError.js';
import { holdingWithSecurity, toBudget } from './investmentSales.js';
import { currencyContext } from './mainAmountService.js';

export type LinkedKind = 'sale' | 'income';

/** Deposits are looked for this many days either side of the sale or payment */
const WINDOW_DAYS = 7;
/** Most deposits suggested at once */
const MAX_SUGGESTIONS = 10;

/** The row, its date, and the cash it should have brought in (in the security's currency) */
function target(kind: LinkedKind, holdingId: string, id: string) {
  const { currency } = holdingWithSecurity(holdingId);
  if (kind === 'sale') {
    const sale = db.select().from(investmentSales).where(eq(investmentSales.id, id)).get();
    if (!sale || sale.holdingId !== holdingId) throw new InvestmentError('Sale not found', 404);
    return { date: sale.soldOn, cash: sale.proceeds - sale.fees, currency };
  }
  const row = db
    .select({ income: investmentIncome, reinvested: taxLots.costBasis })
    .from(investmentIncome)
    .leftJoin(taxLots, eq(taxLots.id, investmentIncome.reinvestedLotId))
    .where(eq(investmentIncome.id, id))
    .get();
  if (!row || row.income.holdingId !== holdingId)
    throw new InvestmentError('Payment not found', 404);
  // A reinvested payment brings in only what the plan didn't spend
  return {
    date: row.income.paidOn,
    cash: row.income.amount - (row.reinvested ?? 0),
    currency,
  };
}

/** Whether a register row is already some other sale's or payment's deposit */
function linkedElsewhere(transactionId: string, kind: LinkedKind, id: string) {
  const sale = db
    .select({ id: investmentSales.id })
    .from(investmentSales)
    .where(
      and(
        eq(investmentSales.transactionId, transactionId),
        kind === 'sale' ? ne(investmentSales.id, id) : sql`1 = 1`,
      ),
    )
    .get();
  const income = db
    .select({ id: investmentIncome.id })
    .from(investmentIncome)
    .where(
      and(
        eq(investmentIncome.transactionId, transactionId),
        kind === 'income' ? ne(investmentIncome.id, id) : sql`1 = 1`,
      ),
    )
    .get();
  return !!(sale || income);
}

/**
 * Deposits that could be this sale's or payment's cash: money in, within 7 days, for the same
 * amount in the budget's currency, not split parts and not already another one's. Closest first.
 */
export function depositSuggestions(kind: LinkedKind, holdingId: string, id: string) {
  const { date, cash, currency } = target(kind, holdingId, id);
  const ctx = currencyContext();
  const expected = toBudget(currency, ctx)(cash, date);
  if (expected === null || expected <= 0) return [];
  const day = parseISO(date);
  const from = format(addDays(day, -WINDOW_DAYS), 'yyyy-MM-dd');
  const to = format(addDays(day, WINDOW_DAYS), 'yyyy-MM-dd');
  const sales = db
    .select({ id: investmentSales.transactionId })
    .from(investmentSales)
    .where(sql`${investmentSales.transactionId} is not null`);
  const incomes = db
    .select({ id: investmentIncome.transactionId })
    .from(investmentIncome)
    .where(sql`${investmentIncome.transactionId} is not null`);
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      payeeName: transactions.payeeName,
      accountName: accounts.name,
      currency: accounts.currency,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        gte(transactions.date, from),
        lte(transactions.date, to),
        isNull(transactions.parentTransactionId),
        sql`${transactions.amount} > 0`,
        sql`${mainAmount} = ${expected}`,
        sql`${transactions.id} not in ${sales}`,
        sql`${transactions.id} not in ${incomes}`,
      ),
    )
    .all()
    .sort(
      (a, b) =>
        Math.abs(parseISO(a.date).getTime() - day.getTime()) -
          Math.abs(parseISO(b.date).getTime() - day.getTime()) || a.id.localeCompare(b.id),
    )
    .slice(0, MAX_SUGGESTIONS);
}

/** Links a sale or payment to its deposit (null unlinks it) */
export function linkDeposit(
  kind: LinkedKind,
  holdingId: string,
  id: string,
  transactionId: string | null,
) {
  target(kind, holdingId, id);
  if (transactionId !== null) {
    const tx = db
      .select({
        amount: transactions.amount,
        parent: transactions.parentTransactionId,
      })
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .get();
    if (!tx) throw new InvestmentError('Transaction not found', 404);
    if (tx.parent) throw new InvestmentError('Link the whole transaction, not part of a split');
    if (tx.amount <= 0) throw new InvestmentError('Only money in can be the deposit');
    if (linkedElsewhere(transactionId, kind, id))
      throw new InvestmentError('That deposit is already linked to another sale or payment', 409);
  }
  const table = kind === 'sale' ? investmentSales : investmentIncome;
  db.update(table).set({ transactionId }).where(eq(table.id, id)).run();
}

/** The sale or payment a register row is linked to, for the transaction panel */
export function investmentForTransaction(transactionId: string) {
  const sale = db
    .select({
      id: investmentSales.id,
      holdingId: investmentSales.holdingId,
      date: investmentSales.soldOn,
      symbol: securities.symbol,
    })
    .from(investmentSales)
    .innerJoin(holdings, eq(holdings.id, investmentSales.holdingId))
    .innerJoin(securities, eq(securities.id, holdings.securityId))
    .where(eq(investmentSales.transactionId, transactionId))
    .get();
  if (sale) return { kind: 'sale' as const, ...sale };
  const income = db
    .select({
      id: investmentIncome.id,
      holdingId: investmentIncome.holdingId,
      date: investmentIncome.paidOn,
      incomeKind: investmentIncome.kind,
      symbol: securities.symbol,
    })
    .from(investmentIncome)
    .innerJoin(holdings, eq(holdings.id, investmentIncome.holdingId))
    .innerJoin(securities, eq(securities.id, holdings.securityId))
    .where(eq(investmentIncome.transactionId, transactionId))
    .get();
  return income ? { kind: 'income' as const, ...income } : null;
}
