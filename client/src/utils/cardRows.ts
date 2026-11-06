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
  /** Which figure it is, so a view can place its own lines among them */
  key: 'debt' | 'shortfall' | 'uncovered' | 'excess' | 'prepaid';
  text: string;
  /** A shortfall or an unfunded payment is a problem; the rest is information */
  tone: 'problem' | 'info';
}

/**
 * What a card says about its reserve: what is owed, and anything the reserve doesn't cover.
 * One source for the budget table's rows and the sidebar's Card payments panel. The table
 * leaves out a debt or shortfall of $0, so a fully funded card reads quietly; the sidebar passes
 * `showZero` to keep both figures always visible.
 */
export function cardNotes(card: CardPosition, { showZero = false } = {}): CardNote[] {
  const notes: CardNote[] = [];
  if (showZero || card.debt > 0)
    notes.push({ key: 'debt', text: `Debt: ${formatCurrency(card.debt)}`, tone: 'info' });
  if (showZero || card.shortfall > 0)
    notes.push({
      key: 'shortfall',
      text: `Payment shortfall: ${formatCurrency(card.shortfall)}`,
      tone: card.shortfall > 0 ? 'problem' : 'info',
    });
  if (card.uncoveredPayments > 0)
    notes.push({
      key: 'uncovered',
      text: `Payments without funding: ${formatCurrency(card.uncoveredPayments)}`,
      tone: 'problem',
    });
  if (card.excessFunding > 0)
    notes.push({
      key: 'excess',
      text: `Extra reserve: ${formatCurrency(card.excessFunding)}. Use Move money to release it.`,
      tone: 'info',
    });
  if (card.prepaid > 0)
    notes.push({
      key: 'prepaid',
      text: `Prepaid card balance: ${formatCurrency(card.prepaid)}`,
      tone: 'info',
    });
  return notes;
}
