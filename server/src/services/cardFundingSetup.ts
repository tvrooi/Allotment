import { and, eq, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  cardFunding,
  categories,
  categoryGroups,
  transactions,
} from '../db/schema.js';
import { inAccountBalance, personalBudgetAccount } from './balances.js';
import { fundingRevision, fundingState } from './budgetService.js';
import { BudgetError } from './budgetMoves.js';
import { todayIso } from './mainAmountService.js';

export function cardAccounts() {
  const mapped = new Set(
    db
      .select()
      .from(cardFunding)
      .all()
      .map((m) => m.accountId),
  );
  return db
    .select()
    .from(accounts)
    .where(personalBudgetAccount)
    .all()
    .filter((a) => ['credit', 'line_of_credit'].includes(a.type))
    .map((a) => ({ id: a.id, name: a.name, configured: mapped.has(a.id) }));
}
function install(accountId: string, initialFunding: number) {
  const account = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), personalBudgetAccount))
    .get();
  if (!account || !['credit', 'line_of_credit'].includes(account.type))
    throw new BudgetError('Choose a personal on-budget card or line of credit', 400);
  if (db.select().from(cardFunding).where(eq(cardFunding.accountId, accountId)).get())
    throw new BudgetError('This card already has payment funding');
  if (!Number.isSafeInteger(initialFunding) || initialFunding < 0 || initialFunding > 1e13)
    throw new BudgetError('Enter a nonnegative amount in minor units', 400);
  const today = todayIso();
  const baseline = db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.accountId, accountId), inAccountBalance, lte(transactions.date, today)),
    )
    .all();
  const reviewedBalance =
    account.startingBalance +
    baseline
      .filter((t) => !(t.amount > 0 && t.importedId?.startsWith('schedule:') && !t.reconciled))
      .reduce((s, t) => s + t.amount, 0);
  const categoryId = nanoid(),
    groupId = 'system:card-payments';
  if (db.select().from(categories).where(eq(categories.id, categoryId)).get())
    throw new BudgetError('Payment category identity already exists', 409);
  const group = db.select().from(categoryGroups).where(eq(categoryGroups.id, groupId)).get();
  if (group?.isIncome) throw new BudgetError('Payment group must be an expense group', 409);
  if (!group)
    db.insert(categoryGroups).values({ id: groupId, name: 'Card payments', sortOrder: 999 }).run();
  db.insert(categories)
    .values({ id: categoryId, groupId, name: `${account.name} payment`, budgetType: 'savings' })
    .run();
  db.insert(cardFunding)
    .values({
      accountId,
      categoryId,
      startDate: today,
      baselineIds: JSON.stringify(baseline.map((t) => t.id)),
      reviewedBalance,
      initialFunding,
      createdAt: new Date().toISOString(),
    })
    .run();
  if (initialFunding)
    db.insert(budgetMonths)
      .values({
        id: nanoid(),
        month: today.slice(0, 7),
        categoryId,
        budgeted: initialFunding,
      })
      .run();
  const after = fundingState();
  const card = after.cards.find((c) => c.accountId === accountId)!;
  if (!after.complete)
    throw new BudgetError('Add missing account and transaction exchange rates before setup');
  if (initialFunding > 0 && after.accountIssues.length)
    throw new BudgetError('Reconcile account balance discrepancies before funding a card payment.');
  if (initialFunding > card.debt)
    throw new BudgetError('Initial funding cannot exceed existing card debt', 400);
  if (after.unassigned < 0)
    throw new BudgetError('Insufficient existing cash for this payment reserve');
  return { card, resources: after.resources, unassigned: after.unassigned };
}
class PreviewRollback {
  constructor(public result: ReturnType<typeof install>) {}
}
export function previewCardSetup(accountId: string, initialFunding: number) {
  const revision = fundingRevision(),
    before = fundingState();
  let result: ReturnType<typeof install> | undefined;
  try {
    db.transaction(() => {
      throw new PreviewRollback(install(accountId, initialFunding));
    });
  } catch (error) {
    if (error instanceof PreviewRollback) result = error.result;
    else throw error;
  }
  return {
    accountId,
    initialFunding,
    revision,
    asOf: todayIso(),
    beforeUnassigned: before.unassigned,
    ...result!,
  };
}
/**
 * Payment funding for a brand-new account with nothing on it (an Afterpay account made from
 * the payment-plan setup): there is no existing debt or assignment to review, so the preview
 * would show no change. Same checks as a reviewed setup; throws BudgetError when they fail.
 */
export function setupEmptyCardFunding(accountId: string) {
  return db.transaction(() => {
    const existing = db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .get();
    const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    if (existing || !account || account.startingBalance !== 0)
      throw new BudgetError('Review payment funding for an account that already has activity');
    return install(accountId, 0);
  });
}
export function applyCardSetup(accountId: string, initialFunding: number, revision: string) {
  return db.transaction(() => {
    if (revision !== fundingRevision())
      throw new BudgetError('Budget changed. Refresh the setup preview.');
    return install(accountId, initialFunding);
  });
}

export interface CardFundingPreview {
  month: string;
  accountId: string;
  categoryId: string;
  budgeted: number;
  revision: string;
  available: number;
  shortfall: number;
  unassigned: number;
}
class FundingPreviewRollback {
  constructor(public value: CardFundingPreview) {}
}
/** Read the assignment and calculate its effects in one snapshot, then roll back.
 * The resulting total/revision can be applied through the existing guarded budget write.
 */
export function previewCardAssignment(
  accountId: string,
  month: string,
  amount: number,
): CardFundingPreview {
  if (month !== todayIso().slice(0, 7))
    throw new BudgetError('Choose the current month for payment funding', 400);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1e13)
    throw new BudgetError('Enter a positive funding amount', 400);
  try {
    db.transaction(() => {
      const mapping = db
        .select()
        .from(cardFunding)
        .where(eq(cardFunding.accountId, accountId))
        .get();
      if (!mapping) throw new BudgetError('Review this card setup first', 400);
      const before = fundingState();
      if (!before.complete) throw new BudgetError('Add missing exchange rates before funding');
      const existing = db
        .select()
        .from(budgetMonths)
        .where(and(eq(budgetMonths.categoryId, mapping.categoryId), eq(budgetMonths.month, month)))
        .get();
      const budgeted = (existing?.budgeted ?? 0) + amount;
      if (!Number.isSafeInteger(budgeted) || Math.abs(budgeted) > 1e13)
        throw new BudgetError('Assignment is too large', 400);
      db.insert(budgetMonths)
        .values({ id: nanoid(), month, categoryId: mapping.categoryId, budgeted })
        .onConflictDoUpdate({
          target: [budgetMonths.month, budgetMonths.categoryId],
          set: { budgeted },
        })
        .run();
      const after = fundingState(),
        card = after.cards.find((c) => c.accountId === accountId)!;
      if (after.reserved > before.reserved && after.accountIssues.length)
        throw new BudgetError(
          'Reconcile account balance discrepancies before funding a card payment.',
        );
      if (after.reserved > before.reserved && after.unassigned < 0)
        throw new BudgetError('Insufficient unassigned money for this payment funding');
      throw new FundingPreviewRollback({
        month,
        accountId,
        categoryId: mapping.categoryId,
        budgeted,
        revision: before.revision,
        available: card.available,
        shortfall: card.shortfall,
        unassigned: after.unassigned,
      });
    });
  } catch (error) {
    if (error instanceof FundingPreviewRollback) return error.value;
    throw error;
  }
  throw new BudgetError('Could not preview funding');
}
