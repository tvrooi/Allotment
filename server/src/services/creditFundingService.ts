import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { accounts, creditCardPlans, creditFundingEvents } from '../db/schema.js';
import { personalBudgetAccount } from './balances.js';
import { fundingRevision, fundingState } from './budgetService.js';
import { monthBounds } from '../utils/date.js';
import { todayIso } from './mainAmountService.js';
import { BudgetError } from './budgetMoves.js';

export function cardContext(month = todayIso().slice(0, 7)) {
  const plans = db.select().from(creditCardPlans).all();
  const assessment = fundingState(
    monthBounds(month).to < todayIso() ? monthBounds(month).to : todayIso(),
  );
  return {
    today: todayIso(),
    asOf: assessment.asOf,
    revision: assessment.revision,
    complete: assessment.complete,
    unassigned: assessment.unassigned,
    cards: db
      .select()
      .from(accounts)
      .where(personalBudgetAccount)
      .all()
      .filter((a) => ['credit', 'line_of_credit'].includes(a.type))
      .map((a) => ({
        accountId: a.id,
        name: a.name,
        closed: !!a.closedAt,
        enabledFrom: plans.find((p) => p.accountId === a.id)?.enabledFrom ?? null,
        funding: assessment.cards.find((c) => c.accountId === a.id) ?? null,
      })),
    history: db
      .select()
      .from(creditFundingEvents)
      .all()
      .filter((e) => e.date <= assessment.asOf)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      .slice(0, 100),
  };
}
export function previewCardSetup(accountId: string) {
  const account = db
    .select()
    .from(accounts)
    .where(personalBudgetAccount)
    .all()
    .find((a) => a.id === accountId);
  if (!account || !['credit', 'line_of_credit'].includes(account.type))
    throw new BudgetError('Choose an on-budget personal credit card or line of credit', 400);
  if (db.select().from(creditCardPlans).where(eq(creditCardPlans.accountId, accountId)).get())
    throw new BudgetError('Payment reserves are already configured for this account');
  const today = todayIso();
  const before = fundingState(today),
    after = fundingState(today, { accountId, enabledFrom: today });
  if (!before.complete || !after.complete)
    throw new BudgetError('Resolve missing exchange rates or pending payment dates before setup');
  return {
    accountId,
    name: account.name,
    enabledFrom: today,
    revision: fundingRevision(),
    beforeUnassigned: before.unassigned,
    afterUnassigned: after.unassigned,
    debt: after.cards.find((c) => c.accountId === accountId)!.debt,
    reserved: after.cards.find((c) => c.accountId === accountId)!.reserved,
    shortfall: after.cards.find((c) => c.accountId === accountId)!.shortfall,
    creditBalance: after.cards.find((c) => c.accountId === accountId)!.creditBalance,
    note: 'Existing debt receives no automatic assignment. Review all figures; transactions and bank links stay unchanged. Payment-reserve accounting applies to transactions dated on or after the setup date.',
  };
}
export function applyCardSetup(accountId: string, revision: string) {
  return db.transaction(() => {
    if (revision !== fundingRevision())
      throw new BudgetError('Your budget changed. Refresh the setup preview.');
    const preview = previewCardSetup(accountId);
    db.insert(creditCardPlans)
      .values({ accountId, enabledFrom: preview.enabledFrom, createdAt: new Date().toISOString() })
      .run();
    return { accountId, enabledFrom: preview.enabledFrom };
  });
}
export function previewCardFunding(accountId: string, amount: number) {
  if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1e13)
    throw new BudgetError('Enter a nonzero amount in minor units', 400);
  const today = todayIso(),
    before = fundingState(today);
  const card = before.cards.find((c) => c.accountId === accountId);
  if (!card) throw new BudgetError('Review setup for this card first', 400);
  if (!before.complete)
    throw new BudgetError('Resolve missing exchange rates or pending payment dates before funding');
  if (amount > 0 && (amount > before.available || amount > card.shortfall))
    throw new BudgetError('Fund only the payment shortfall using existing unassigned money');
  if (amount < 0 && -amount > card.reserved)
    throw new BudgetError('Release no more than the current payment reserve');
  const after = fundingState(today, undefined, { id: 'preview', accountId, date: today, amount });
  const next = after.cards.find((c) => c.accountId === accountId)!;
  if (next.reserved - card.reserved !== amount)
    throw new BudgetError(
      'Funded purchases already supply this reserve. Review the expense assignments before releasing it.',
    );
  if (after.reserved > before.reserved && after.unassigned < 0)
    throw new BudgetError('Insufficient cash for this payment reserve');
  return {
    accountId,
    name: card.name,
    date: today,
    amount,
    revision: fundingRevision(),
    reservedBefore: card.reserved,
    reservedAfter: next.reserved,
    shortfallAfter: next.shortfall,
    unassignedAfter: after.unassigned,
  };
}
export function applyCardFunding(accountId: string, amount: number, revision: string) {
  return db.transaction(() => {
    if (revision !== fundingRevision())
      throw new BudgetError('Your budget changed. Refresh the payment-funding preview.');
    const preview = previewCardFunding(accountId, amount);
    const event = {
      id: nanoid(),
      accountId,
      date: preview.date,
      amount,
      createdAt: new Date().toISOString(),
    };
    db.insert(creditFundingEvents).values(event).run();
    return event;
  });
}
