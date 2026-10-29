import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  budgetSettings,
  categories,
  categoryGroups,
  transactions,
} from '../db/schema.js';
import { budgetSummary } from './budgetService.js';
import { budgetWithTargets } from './targetService.js';
import { withHistoricActivity } from './historicActivity.js';
import { clearBudgetCache } from './budgetService.js';
import { updateBudgetSettings } from './mainAmountService.js';

// Months before the budget start show what was really spent, read-only.

beforeAll(() => migrate(db, { migrationsFolder: 'src/db/migrations' }));
beforeEach(() => {
  for (const table of [
    transactions,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
  clearBudgetCache();
  db.insert(accounts)
    .values({ id: 'spend', name: 'Spending', type: 'checking', startingBalance: 100_000 })
    .run();
  db.insert(categoryGroups).values({ id: 'exp', name: 'Spending', isIncome: 0 }).run();
  db.insert(categories).values({ id: 'groceries', groupId: 'exp', name: 'Groceries' }).run();
  db.insert(transactions)
    .values({
      id: 'old',
      accountId: 'spend',
      date: '2026-08-12',
      amount: -4_500,
      payeeName: 'Coles',
      categoryId: 'groceries',
    })
    .run();
  updateBudgetSettings({ budgetStartMonth: '2026-10' });
});

const groceries = (month: string) =>
  withHistoricActivity(budgetWithTargets(month, '2026-10-21'), month)
    .flatMap((g) => g.categories)
    .find((c) => c.id === 'groceries')!;

describe('withHistoricActivity', () => {
  it('shows real activity in a month before the budget start', () => {
    const cat = groceries('2026-08');
    expect(cat.activity).toBe(-4_500);
    expect(cat.spent).toBe(4_500);
    expect(cat.budgeted).toBe(0);
    expect(cat.carryOver).toBe(0);
  });

  it('leaves months from the start on alone', () => {
    expect(groceries('2026-10').activity).toBe(0);
  });
});

describe('budget summary', () => {
  it('says whether anything has been assigned yet', () => {
    expect(budgetSummary('2026-10', '2026-10-21').anythingAssigned).toBe(false);
    db.insert(budgetMonths)
      .values({ id: 'b1', month: '2026-10', categoryId: 'groceries', budgeted: 1_000 })
      .run();
    clearBudgetCache();
    expect(budgetSummary('2026-10', '2026-10-21').anythingAssigned).toBe(true);
  });
});
