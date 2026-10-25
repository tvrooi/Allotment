import { and, eq, isNull, min, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, budgetMonths, cardFunding, categories, transactions } from '../db/schema.js';
import { getBudgetSettings, todayIso } from './mainAmountService.js';
import { roundUpCheck } from './upReviewService.js';
import { onBudget } from './balances.js';

// Setup problems that quietly make a budget less useful, for the Review page and assistants:
// - a budget counting years of imported history (every old purchase is overspending);
// - Up round-up debits missing from an account the bank proves short by exactly those;
// - movements to or from savers that aren't in FlyBudget (closed, or never connected), which
//   otherwise look like spending and income;
// - categories nothing has ever used.
// Read-only: each item links to where the owner fixes it.

/** Up's own descriptions for a saver movement; the saver's name is the last part */
const SAVER_MOVE = /^(?:transfer|cover|forward|quick save transfer) (?:to|from) (.+)$/i;
/** History this long before today without a budget start is worth a prompt */
const HISTORY_MONTHS = 3;
/** Ids listed per saver, for one bulk categorise */
const MAX_IDS = 5000;

const monthsBetween = (a: string, b: string) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 +
  Number(b.slice(5, 7)) -
  Number(a.slice(5, 7));

function budgetStart(today: string) {
  const current = getBudgetSettings().budgetStartMonth ?? null;
  const first = db
    .select({ date: min(transactions.date) })
    .from(transactions)
    .where(onBudget)
    .get()?.date;
  const historyStartMonth = first ? first.slice(0, 7) : null;
  const firstAssigned =
    db
      .select({ month: min(budgetMonths.month) })
      .from(budgetMonths)
      .where(ne(budgetMonths.budgeted, 0))
      .get()?.month ?? null;
  const thisMonth = today.slice(0, 7);
  const suggestion =
    !current && historyStartMonth && monthsBetween(historyStartMonth, thisMonth) >= HISTORY_MONTHS
      ? firstAssigned && firstAssigned < thisMonth
        ? firstAssigned
        : thisMonth
      : null;
  return { current, historyStartMonth, suggestion };
}

function unlinkedSavers() {
  const names = new Set(
    db
      .select({ name: accounts.name })
      .from(accounts)
      .all()
      .map((a) => a.name.trim().toLowerCase()),
  );
  const groups = new Map<string, { name: string; count: number; net: number; ids: string[] }>();
  for (const t of db
    .select({ id: transactions.id, payee: transactions.payeeName, amount: transactions.amount })
    .from(transactions)
    .where(
      and(
        isNull(transactions.categoryId),
        isNull(transactions.transferTransactionId),
        eq(transactions.isParent, 0),
      ),
    )
    .all()) {
    const match = SAVER_MOVE.exec(t.payee?.trim() ?? '');
    if (!match) continue;
    const saver = match[1].trim();
    // A saver with an account here is a transfer to link (Review → transfer suggestions)
    if (names.has(saver.toLowerCase())) continue;
    const g = groups.get(saver.toLowerCase()) ?? { name: saver, count: 0, net: 0, ids: [] };
    g.count++;
    g.net += t.amount;
    if (g.ids.length < MAX_IDS) g.ids.push(t.id);
    groups.set(saver.toLowerCase(), g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

function unusedCategoryCount() {
  const payment = new Set(
    db
      .select({ id: cardFunding.categoryId })
      .from(cardFunding)
      .all()
      .map((r) => r.id),
  );
  const used = new Set([
    ...db
      .selectDistinct({ id: transactions.categoryId })
      .from(transactions)
      .all()
      .map((r) => r.id),
    ...db
      .selectDistinct({ id: budgetMonths.categoryId })
      .from(budgetMonths)
      .where(ne(budgetMonths.budgeted, 0))
      .all()
      .map((r) => r.id),
  ]);
  return db
    .select({ id: categories.id, hidden: categories.hidden })
    .from(categories)
    .all()
    .filter((c) => !c.hidden && !used.has(c.id) && !payment.has(c.id)).length;
}

export function housekeeping(today = todayIso()) {
  return {
    budgetStart: budgetStart(today),
    missingRoundUps: roundUpCheck()
      .filter((c) => c.verdict === 'round-ups' && !c.enabledAt)
      .map((c) => ({
        accountId: c.accountId,
        accountName: c.accountName,
        count: c.missing.count,
        total: c.missing.total,
      })),
    unlinkedSavers: unlinkedSavers(),
    unusedCategories: unusedCategoryCount(),
  };
}
