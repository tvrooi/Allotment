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
export function applyCardSetup(accountId: string, initialFunding: number, revision: string) {
  return db.transaction(() => {
    if (revision !== fundingRevision())
      throw new BudgetError('Budget changed. Refresh the setup preview.');
    return install(accountId, initialFunding);
  });
}
