import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  budgetSettings,
  cardFunding,
  categories,
  categoryGroups,
  transactions,
} from '../db/schema.js';
import { budgetSummary } from './budgetService.js';
import { applyCardSetup, previewCardSetup } from './cardFundingSetup.js';
import { ratesChanged } from './mainAmountService.js';

// The resources figure is cash before debt on enrolled cards. `breakdown` names its parts
// without changing any total (docs/ENVELOPE-FUNDING.md, "The cash breakdown").

const TODAY = '2026-10-21';
const MONTH = '2026-10';
beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`));
});
afterAll(() => vi.useRealTimers());

function build(cash: number, saver: number, debt: number, food: number, later: number) {
  for (const table of [
    cardFunding,
    transactions,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
  ratesChanged();
  db.insert(accounts)
    .values([
      {
        id: 'cash',
        name: 'Cash',
        type: 'checking',
        startingBalance: cash,
        createdAt: '2026-09-01',
      },
      {
        id: 'saver',
        name: 'Rent saver',
        type: 'savings',
        startingBalance: saver,
        createdAt: '2026-09-01',
      },
      {
        id: 'later',
        name: 'Pay later',
        type: 'credit',
        startingBalance: -debt,
        createdAt: '2026-09-01',
      },
    ])
    .run();
  db.insert(categoryGroups).values({ id: 'expenses', name: 'Expenses' }).run();
  db.insert(categories)
    .values([
      { id: 'food', name: 'Food', groupId: 'expenses', budgetType: 'flexible' },
      { id: 'rent', name: 'Rent', groupId: 'expenses', linkedAccountId: 'saver' },
    ])
    .run();
  // The card is reviewed with its existing debt left without a reserve
  applyCardSetup('later', 0, previewCardSetup('later', 0).revision);
  db.insert(budgetMonths)
    .values({ id: `food:${MONTH}`, categoryId: 'food', month: MONTH, budgeted: food })
    .run();
  if (later)
    db.insert(budgetMonths)
      .values({ id: 'food:2026-11', categoryId: 'food', month: '2026-11', budgeted: later })
      .run();
}

describe('cash breakdown', () => {
  it('names the parts of resources and Ready to assign without changing either', () => {
    build(100000, 82550, 50000, 30000, 0);
    const s = budgetSummary(MONTH);
    const b = s.breakdown;
    // Existing totals: the card's debt is outside resources
    expect(s.resources).toBe(182550);
    expect(s.envelopes).toBe(112550);
    expect(s.toBeBudgeted).toBe(70000);
    expect(s.paymentShortfall).toBe(50000);

    expect(b.cash).toBe(182550);
    expect(b.otherDebt).toBe(0);
    expect(b.cardDebt).toEqual({ total: 50000, reserved: 0, unreserved: 50000 });
    expect(b.linked).toEqual([
      { categoryId: 'rent', name: 'Rent', accountName: 'Rent saver', amount: 82550 },
    ]);
    expect(b.everydayEnvelopes).toBe(30000);

    // cash − unreserved debt = net cash; resources − envelopes = Ready to assign
    expect(b.cash - b.cardDebt.unreserved).toBe(132550);
    expect(s.resources - s.envelopes - b.setAside).toBe(s.toBeBudgeted);
  });

  it('reports an overdraft as other debt, which resources net off', () => {
    build(100000, 82550, 50000, 30000, 0);
    db.update(accounts).set({ startingBalance: -20000 }).where(eq(accounts.id, 'cash')).run();
    const s = budgetSummary(MONTH);
    expect(s.breakdown.otherDebt).toBe(-20000);
    expect(s.breakdown.cash).toBe(82550);
    expect(s.resources).toBe(62550);
  });

  it('takes later-month assignments out of Ready to assign through setAside', () => {
    build(100000, 82550, 50000, 30000, 5000);
    const s = budgetSummary(MONTH);
    expect(s.breakdown.setAside).toBe(5000);
    expect(s.resources - s.envelopes - s.breakdown.setAside).toBe(s.toBeBudgeted);
  });

  it('always reconciles to the totals', () => {
    const money = (max: number) => fc.integer({ min: 0, max }).map((n) => n * 100);
    fc.assert(
      fc.property(
        money(5000),
        money(5000),
        money(2000),
        money(3000),
        money(500),
        (cash, saver, debt, food, later) => {
          build(cash, saver, debt, food, later);
          const s = budgetSummary(MONTH);
          const b = s.breakdown;
          expect(b.cash + b.otherDebt).toBe(s.resources);
          expect(b.cardDebt.reserved + b.cardDebt.unreserved).toBe(b.cardDebt.total);
          expect(b.cardDebt.unreserved).toBe(s.paymentShortfall);
          expect(b.linked.reduce((n, l) => n + l.amount, 0) + b.everydayEnvelopes).toBe(
            s.envelopes,
          );
          expect(s.resources - s.envelopes - b.setAside).toBe(s.toBeBudgeted);
        },
      ),
      { numRuns: 30 },
    );
  });
});
