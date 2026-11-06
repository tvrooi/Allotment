import type { CardPosition } from '../api/budget';
import type { BudgetCategory } from '../types';
import { formatCurrency } from './currency';

// A card's payment envelope as a row of the budget table (BUD-09). The figures are the
// envelope's own (assigned, activity, available); what the card position adds is shown beside
// them. Nothing is recomputed here: `CardPosition` comes from the server's card calculator.

/** The expense categories that are a card's payment envelope, in table order */
export const paymentCategories = (categories: BudgetCategory[]) =>
  categories.filter((c) => c.paymentAccountId);

/** The position behind each payment envelope, by category */
export const cardsByCategory = (cards: CardPosition[] | undefined) =>
  new Map((cards ?? []).map((c) => [c.categoryId, c]));

export interface CardNote {
  text: string;
  /** A shortfall or an unfunded payment is a problem; the rest is information */
  tone: 'problem' | 'info';
}

/**
 * What a card's row says under its name: what is owed, and anything the reserve doesn't cover.
 * A row that is fully funded and has no extras reads as only the debt.
 */
export function cardNotes(card: CardPosition): CardNote[] {
  const notes: CardNote[] = [];
  if (card.debt > 0) notes.push({ text: `Debt: ${formatCurrency(card.debt)}`, tone: 'info' });
  if (card.shortfall > 0)
    notes.push({
      text: `Payment shortfall: ${formatCurrency(card.shortfall)}`,
      tone: 'problem',
    });
  if (card.uncoveredPayments > 0)
    notes.push({
      text: `Payments without funding: ${formatCurrency(card.uncoveredPayments)}`,
      tone: 'problem',
    });
  if (card.excessFunding > 0)
    notes.push({
      text: `Extra reserve: ${formatCurrency(card.excessFunding)}. Use Move money to release it.`,
      tone: 'info',
    });
  if (card.prepaid > 0)
    notes.push({ text: `Prepaid card balance: ${formatCurrency(card.prepaid)}`, tone: 'info' });
  return notes;
}
