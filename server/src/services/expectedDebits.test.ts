import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetSettings,
  categories,
  categoryGroups,
  scheduleOccurrences,
  schedules,
  transactions,
} from '../db/schema.js';
import { ratesChanged } from './mainAmountService.js';
import { expectedDebits, withExpectedDebits } from './expectedDebits.js';

// Recurring debits show against their category as expected until they are paid

const TODAY = '2026-10-15';

beforeAll(() => migrate(db, { migrationsFolder: 'src/db/migrations' }));

beforeEach(() => {
  for (const table of [
    scheduleOccurrences,
    schedules,
    transactions,
    categories,
    categoryGroups,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
  ratesChanged();
  db.insert(categoryGroups)
    .values([
      { id: 'expense', name: 'Expenses' },
      { id: 'income', name: 'Income', isIncome: 1 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'phone', name: 'Phone', groupId: 'expense' },
      { id: 'gym', name: 'Gym', groupId: 'expense' },
      { id: 'salary', name: 'Salary', groupId: 'income' },
    ])
    .run();
  db.insert(accounts)
    .values([
      { id: 'everyday', name: 'Everyday', type: 'checking', createdAt: '2026-01-01' },
      { id: 'saver', name: 'Saver', type: 'savings', createdAt: '2026-01-01' },
      { id: 'old', name: 'Old', type: 'checking', createdAt: '2026-01-01', closedAt: '2026-05-01' },
    ])
    .run();
});

let seq = 0;
function schedule(values: Partial<typeof schedules.$inferInsert>) {
  const id = `s${++seq}`;
  db.insert(schedules)
    .values({
      id,
      name: id,
      amount: -5000,
      recurrenceType: 'monthly',
      recurrenceRule: JSON.stringify({ type: 'monthly', interval: 1, anchorDay: 20 }),
      startDate: '2026-01-20',
      accountId: 'everyday',
      categoryId: 'phone',
      ...values,
    })
    .run();
  return id;
}

const phone = (month: string, today = TODAY) => expectedDebits(month, today).get('phone') ?? [];

describe('expectedDebits', () => {
  it('expects a monthly bill in its category until it is paid', () => {
    const id = schedule({ name: 'Mobile plan' });
    expect(phone('2026-10')).toEqual([
      { scheduleId: id, name: 'Mobile plan', date: '2026-10-20', amount: 5000 },
    ]);
    // Future months expect it too, before any occurrence exists
    expect(phone('2026-12')).toHaveLength(1);
    // A past month expects nothing
    expect(phone('2026-09')).toEqual([]);

    db.insert(transactions)
      .values({ id: 't1', accountId: 'everyday', date: '2026-10-20', amount: -5000 })
      .run();
    db.insert(scheduleOccurrences)
      .values({
        id: 'o1',
        scheduleId: id,
        scheduledDate: '2026-10-20',
        expectedDate: '2026-10-20',
        expectedAmount: -5000,
        status: 'paid',
        matchedTransactionId: 't1',
      })
      .run();
    expect(phone('2026-10')).toEqual([]);
  });

  it('keeps an overdue bill expected this month, and drops a skipped one', () => {
    const id = schedule({
      recurrenceRule: JSON.stringify({ type: 'monthly', interval: 1, anchorDay: 5 }),
      startDate: '2026-01-05',
    });
    expect(phone('2026-10')).toHaveLength(1);
    db.insert(scheduleOccurrences)
      .values({
        id: 'o2',
        scheduleId: id,
        scheduledDate: '2026-10-05',
        expectedDate: '2026-10-05',
        expectedAmount: -5000,
        status: 'skipped',
      })
      .run();
    expect(phone('2026-10')).toEqual([]);
  });

  it('counts every weekly debit in the month', () => {
    schedule({
      categoryId: 'gym',
      amount: -1500,
      recurrenceType: 'weekly',
      recurrenceRule: JSON.stringify({ type: 'weekly', interval: 1, anchorDay: 4 }),
      startDate: '2026-10-01',
    });
    const gym = expectedDebits('2026-10', TODAY).get('gym')!;
    expect(gym.map((g) => g.date)).toEqual([
      '2026-10-01',
      '2026-10-08',
      '2026-10-15',
      '2026-10-22',
      '2026-10-29',
    ]);
  });

  it('leaves out income, transfers, paused items and closed accounts', () => {
    schedule({ amount: 5000 });
    schedule({ transferAccountId: 'saver' });
    schedule({ status: 'paused' });
    schedule({ accountId: 'old' });
    schedule({ categoryId: null });
    expect(expectedDebits('2026-10', TODAY).size).toBe(0);
  });

  it('attaches totals to expense categories only', () => {
    schedule({});
    schedule({ categoryId: 'salary' });
    const groups = withExpectedDebits(
      [
        { isIncome: 0, categories: [{ id: 'phone' }, { id: 'gym' }] },
        { isIncome: 1, categories: [{ id: 'salary' }] },
      ],
      '2026-10',
      TODAY,
    );
    expect(groups[0].categories.map((c) => c.expected)).toEqual([5000, 0]);
    expect(groups[1].categories[0]).toMatchObject({ expected: 0, expectedItems: [] });
  });
});
