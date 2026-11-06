import { describe, expect, it } from 'vitest';
import type { CardPosition } from '../api/budget';
import type { BudgetCategory } from '../types';
import { cardNotes, cardsByCategory, paymentCategories } from './cardRows';

const position = (over: Partial<CardPosition> = {}): CardPosition => ({
  accountId: 'a1',
  categoryId: 'pay1',
  name: 'Daily card',
  startDate: '2026-01-01',
  debt: 0,
  prepaid: 0,
  available: 0,
  shortfall: 0,
  uncoveredPayments: 0,
  excessFunding: 0,
  fundedPurchases: 0,
  ...over,
});
const category = (id: string, paymentAccountId: string | null): BudgetCategory => ({
  id,
  groupId: 'g',
  name: id,
  icon: null,
  budgetType: null,
  sortOrder: 0,
  createdAt: '',
  paymentAccountId,
  budgeted: 0,
  spent: 0,
  carryOver: 0,
  balance: 0,
});

describe('cardNotes', () => {
  it('says nothing for a card with no debt and nothing to flag', () => {
    expect(cardNotes(position())).toEqual([]);
  });

  it('shows a funded purchase as debt only', () => {
    expect(cardNotes(position({ debt: 8000, available: 8000 }))).toEqual([
      { text: 'Debt: $80', tone: 'info' },
    ]);
  });

  it('flags a partly funded purchase, with the debt it leaves unfunded', () => {
    const notes = cardNotes(position({ debt: 8000, available: 6000, shortfall: 2000 }));
    expect(notes).toEqual([
      { text: 'Debt: $80', tone: 'info' },
      { text: 'Payment shortfall: $20', tone: 'problem' },
    ]);
  });

  it('keeps unfunded payments, extra reserve and a prepaid balance visible', () => {
    const notes = cardNotes(
      position({ uncoveredPayments: 500, excessFunding: 700, prepaid: 900 }),
    ).map((n) => n.text);
    expect(notes).toEqual([
      'Payments without funding: $5',
      'Extra reserve: $7. Use Move money to release it.',
      'Prepaid card balance: $9',
    ]);
  });
});

describe('payment envelope rows', () => {
  it('picks only payment envelopes, in order', () => {
    const cats = [category('food', null), category('pay1', 'a1'), category('pay2', 'a2')];
    expect(paymentCategories(cats).map((c) => c.id)).toEqual(['pay1', 'pay2']);
  });

  it('finds a card by its envelope, and copes with no cards', () => {
    expect(cardsByCategory([position()]).get('pay1')?.name).toBe('Daily card');
    expect(cardsByCategory(undefined).size).toBe(0);
  });
});
