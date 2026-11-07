import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  scheduleOccurrences,
  schedules,
  transactions,
} from '../db/schema.js';
import { linkOccurrenceToTransaction } from './matchingEngine.js';

// Matching a bank payment to a recurring item: the occurrence is paid, and the payment takes
// the item's category only when it has none. Synthetic rows only.

beforeAll(() => migrate(db, { migrationsFolder: 'src/db/migrations' }));

beforeEach(() => {
  for (const table of [
    scheduleOccurrences,
    transactions,
    schedules,
    categories,
    categoryGroups,
    accounts,
  ])
    db.delete(table).run();
  db.insert(accounts)
    .values([
      { id: 'spend', name: 'Spending', type: 'checking' },
      { id: 'saver', name: 'Saver', type: 'savings' },
    ])
    .run();
  db.insert(categoryGroups).values({ id: 'g', name: 'Bills' }).run();
  db.insert(categories)
    .values([
      { id: 'phone', name: 'Phone', groupId: 'g' },
      { id: 'other', name: 'Other', groupId: 'g' },
    ])
    .run();
});

let n = 0;
function setUp(
  row: Partial<typeof transactions.$inferInsert>,
  item: Partial<typeof schedules.$inferInsert> = {},
) {
  const id = `${++n}`;
  db.insert(schedules)
    .values({
      id: `s${id}`,
      name: 'Mobile',
      amount: -5900,
      recurrenceType: 'monthly',
      recurrenceRule: JSON.stringify({ type: 'monthly', interval: 1, anchorDay: 5 }),
      startDate: '2026-01-05',
      accountId: 'spend',
      categoryId: 'phone',
      ...item,
    })
    .run();
  db.insert(scheduleOccurrences)
    .values({
      id: `o${id}`,
      scheduleId: `s${id}`,
      scheduledDate: '2026-10-05',
      expectedDate: '2026-10-05',
      expectedAmount: -5900,
    })
    .run();
  db.insert(transactions)
    .values({ id: `t${id}`, accountId: 'spend', date: '2026-10-06', amount: -5900, ...row })
    .run();
  linkOccurrenceToTransaction(`o${id}`, `t${id}`, 'manual', 100);
  const tx = db
    .select()
    .from(transactions)
    .where(eq(transactions.id, `t${id}`))
    .get()!;
  const occ = db
    .select()
    .from(scheduleOccurrences)
    .where(eq(scheduleOccurrences.id, `o${id}`))
    .get()!;
  return { tx, occ };
}

describe('linkOccurrenceToTransaction', () => {
  it("gives an uncategorised payment the recurring item's category and marks it paid", () => {
    const { tx, occ } = setUp({});
    expect(tx).toMatchObject({ categoryId: 'phone', scheduleId: 's1' });
    expect(occ).toMatchObject({ status: 'paid', matchedTransactionId: 't1' });
  });

  it('keeps a category already set', () => {
    expect(setUp({ categoryId: 'other' }).tx.categoryId).toBe('other');
  });

  it('leaves a split as a whole, a balance correction and a plain transfer without one', () => {
    expect(setUp({ isParent: 1 }).tx.categoryId).toBeNull();
    expect(setUp({ isAdjustment: 1 }).tx.categoryId).toBeNull();
    db.insert(transactions)
      .values({ id: 'other-side', accountId: 'saver', date: '2026-10-06', amount: 5900 })
      .run();
    expect(setUp({ transferTransactionId: 'other-side' }).tx.categoryId).toBeNull();
  });

  it('categorises a transfer matched to a recurring transfer', () => {
    db.insert(transactions)
      .values({ id: 'their-side', accountId: 'saver', date: '2026-10-06', amount: 5900 })
      .run();
    const { tx } = setUp({ transferTransactionId: 'their-side' }, { transferAccountId: 'saver' });
    expect(tx.categoryId).toBe('phone');
  });

  it('changes nothing about the category when the item has none', () => {
    expect(setUp({}, { categoryId: null }).tx.categoryId).toBeNull();
  });
});
