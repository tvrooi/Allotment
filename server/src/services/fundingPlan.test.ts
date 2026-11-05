import { describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, budgetMonths, categories, categoryGroups, transactions } from '../db/schema.js';
import { addAssigned, planFunding } from './fundingPlan.js';

// Audit F-13: auto-assign, target funding, payday plans and suggestions share one plan and one write
migrate(db, { migrationsFolder: './src/db/migrations' });
db.insert(accounts).values({ id: 'a', name: 'Everyday', type: 'checking' }).run();
db.insert(categoryGroups).values({ id: 'g', name: 'Bills', isIncome: 0 }).run();
db.insert(categories)
  .values([
    { id: 'rent', groupId: 'g', name: 'Rent' },
    { id: 'power', groupId: 'g', name: 'Power' },
  ])
  .run();
db.insert(transactions)
  .values({ id: 'pay', accountId: 'a', date: '2026-10-01', amount: 100_00, payeeName: 'Pay' })
  .run();

describe('a funding plan', () => {
  it('fills needs in order, capped at money unassigned today, never below zero', () => {
    const plan = planFunding(
      '2026-10',
      [
        { categoryId: 'rent', need: 80_00 },
        { categoryId: 'power', need: 50_00 },
      ],
      '2026-10-15',
    );
    expect(plan.available).toBe(100_00);
    expect(plan.rows.map((r) => [r.categoryId, r.proposed, r.shortfall])).toEqual([
      ['rent', 80_00, 0],
      ['power', 20_00, 30_00],
    ]);
    expect(plan).toMatchObject({ total: 100_00, shortfall: 30_00, complete: true });
    expect(plan.revision).toEqual(expect.any(String));
  });

  it('adds to an assignment, never replacing it', () => {
    addAssigned('2026-10', 'rent', 30_00);
    addAssigned('2026-10', 'rent', 20_00);
    expect(db.select().from(budgetMonths).all()).toEqual([
      expect.objectContaining({ month: '2026-10', categoryId: 'rent', budgeted: 50_00 }),
    ]);
    expect(() => addAssigned('2026-10', 'rent', Number.MAX_SAFE_INTEGER)).toThrow('too large');
  });
});
