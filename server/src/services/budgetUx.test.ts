import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  budgetProposals,
  budgetSettings,
  categories,
  categoryGroups,
  transactions,
} from '../db/schema.js';
import { housekeeping } from './housekeeping.js';
import {
  applyProposal,
  createProposal,
  dismissProposal,
  listProposals,
} from './budgetProposals.js';
import { getBudgetSettings, startBudgetIfNew, updateBudgetSettings } from './mainAmountService.js';
import { categoryTemplate } from '../db/defaultCategories.js';
import { BudgetError } from './budgetMoves.js';

// Budget start suggestions, saver movements, assignment suggestions and category templates
// (phase "budget UX": Ready to assign, Review → Tidy up).

beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  for (const table of [
    budgetProposals,
    transactions,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
  db.insert(accounts)
    .values({ id: 'spend', name: 'Spending', type: 'checking', startingBalance: 0 })
    .run();
  db.insert(accounts)
    .values({ id: 'mojo', name: '🌞 Mojo', type: 'savings', startingBalance: 0 })
    .run();
  db.insert(categoryGroups).values({ id: 'inc', name: 'Income', isIncome: 1 }).run();
  db.insert(categoryGroups).values({ id: 'exp', name: 'Spending', isIncome: 0 }).run();
  db.insert(categories).values({ id: 'pay', groupId: 'inc', name: 'Pay' }).run();
  db.insert(categories).values({ id: 'groceries', groupId: 'exp', name: 'Groceries' }).run();
  db.insert(categories).values({ id: 'rent', groupId: 'exp', name: 'Rent' }).run();
  db.insert(categories).values({ id: 'unused', groupId: 'exp', name: 'HOA Fees' }).run();
  const tx = (id: string, date: string, amount: number, payeeName: string, extra = {}) =>
    db
      .insert(transactions)
      .values({ id, accountId: 'spend', date, amount, payeeName, ...extra })
      .run();
  tx('pay1', '2026-10-01', 300000, 'Employer', { categoryId: 'pay' });
  tx('old', '2024-03-02', -5000, 'Corner store', { categoryId: 'groceries' });
  tx('s1', '2026-02-01', -2000, 'Transfer to Splurge');
  tx('s2', '2026-02-03', 1500, 'Cover from Splurge');
  tx('s3', '2026-02-04', -700, 'Forward to Bond Clean');
  // A saver that is an account here is a transfer to link, not a closed saver
  tx('m1', '2026-02-05', -900, 'Transfer to Mojo');
});

describe('housekeeping', () => {
  it('suggests a budget start when years of history count, and stops once one is set', () => {
    expect(housekeeping().budgetStart).toEqual({
      current: null,
      historyStartMonth: '2024-03',
      suggestion: '2026-10',
    });
    // The first month with an assignment is where the budget really began
    db.insert(budgetMonths)
      .values({ id: 'b', month: '2026-08', categoryId: 'rent', budgeted: 100 })
      .run();
    expect(housekeeping().budgetStart.suggestion).toBe('2026-08');
    updateBudgetSettings({ budgetStartMonth: '2026-08' });
    expect(housekeeping().budgetStart.suggestion).toBeNull();
  });

  it('groups movements to savers that are not accounts here, and counts unused categories', () => {
    const { unlinkedSavers, unusedCategories } = housekeeping();
    expect(unlinkedSavers).toEqual([
      { name: 'Splurge', count: 2, net: -500, ids: ['s1', 's2'] },
      { name: 'Bond Clean', count: 1, net: -700, ids: ['s3'] },
    ]);
    expect(unusedCategories).toBe(2); // rent and HOA Fees
    db.update(categories).set({ hidden: 1 }).run();
    expect(housekeeping().unusedCategories).toBe(0);
  });
});

describe('budget start for a new budget', () => {
  it('starts this month only when nothing was ever assigned and no start is set', () => {
    expect(startBudgetIfNew()).toBe('2026-10');
    expect(getBudgetSettings().budgetStartMonth).toBe('2026-10');
    expect(startBudgetIfNew()).toBeNull();
    updateBudgetSettings({ budgetStartMonth: null });
    db.insert(budgetMonths)
      .values({ id: 'b', month: '2026-09', categoryId: 'rent', budgeted: 100 })
      .run();
    expect(startBudgetIfNew()).toBeNull();
    expect(getBudgetSettings().budgetStartMonth).toBeNull();
  });
});

describe('assignment suggestions', () => {
  it('are saved without assigning anything, and applied all at once by the owner', () => {
    const p = createProposal(
      {
        month: '2026-10',
        note: 'Cover rent first',
        rows: [
          { categoryId: 'rent', amount: 200000, reason: 'Due on the 1st' },
          { categoryId: 'groceries', amount: 50000 },
        ],
      },
      undefined,
    );
    expect(p).toMatchObject({ status: 'open', total: 250000, tokenName: 'Assistant' });
    expect(p.rows[0].categoryName).toBe('Rent');
    expect(db.select().from(budgetMonths).all()).toEqual([]);
    expect(applyProposal(p.id)).toEqual({ applied: 250000, month: '2026-10' });
    expect(
      db
        .select()
        .from(budgetMonths)
        .all()
        .map((r) => [r.categoryId, r.budgeted])
        .sort(),
    ).toEqual([
      ['groceries', 50000],
      ['rent', 200000],
    ]);
    expect(() => applyProposal(p.id)).toThrow(BudgetError);
    expect(listProposals('open')).toEqual([]);
  });

  it('refuse income categories, other months and more than is ready to assign', () => {
    const one =
      (categoryId: string, amount: number, month = '2026-10') =>
      () =>
        createProposal({ month, rows: [{ categoryId, amount }] });
    expect(one('pay', 100)).toThrow(/expense category/);
    expect(one('rent', 100, '2027-01')).toThrow(/this month or next/);
    expect(one('rent', 292901)).toThrow(/ready to assign/);
    expect(one('rent', 100, '2026-11')).not.toThrow();
  });

  it('assign nothing if money ran short since, and can be dismissed', () => {
    const p = createProposal({ month: '2026-10', rows: [{ categoryId: 'rent', amount: 292900 }] });
    db.insert(budgetMonths)
      .values({ id: 'b', month: '2026-10', categoryId: 'groceries', budgeted: 10000 })
      .run();
    expect(() => applyProposal(p.id)).toThrow(/Insufficient/);
    expect(db.select().from(budgetMonths).all()).toHaveLength(1);
    expect(dismissProposal(p.id)).toEqual({ ok: true });
    expect(listProposals()[0].status).toBe('dismissed');
  });
});

describe('category templates', () => {
  it('uses the Australian template in Australian time zones or when asked', () => {
    const names = (t: ReturnType<typeof categoryTemplate>) =>
      t.flatMap((g) => g.categories.map((c) => c.name));
    expect(names(categoryTemplate(undefined, 'Australia/Melbourne'))).toContain('Rego & CTP');
    expect(names(categoryTemplate(undefined, 'America/New_York'))).toContain('HOA Fees');
    expect(names(categoryTemplate('au', 'UTC'))).toContain('Afterpay / Zip');
    expect(names(categoryTemplate('default', 'Australia/Perth'))).not.toContain('Rego & CTP');
  });
});
