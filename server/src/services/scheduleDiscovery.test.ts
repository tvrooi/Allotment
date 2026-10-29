import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, schedules, transactions } from '../db/schema.js';
import { discoverSchedules, isNotABill } from './scheduleDiscovery.js';

// The recurring finder offers bills and pay, never money moving between accounts, cash taken
// out, a refund, or a one-off.

beforeAll(() => migrate(db, { migrationsFolder: 'src/db/migrations' }));
beforeEach(() => {
  db.delete(schedules).run();
  db.delete(transactions).run();
  db.delete(accounts).run();
  db.insert(accounts)
    .values({ id: 'spend', name: 'Spending', type: 'checking', startingBalance: 0 })
    .run();
});

const MONTHS = ['2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10'];
let n = 0;
function monthly(payeeName: string, amount: number, extra: Record<string, unknown> = {}) {
  for (const date of MONTHS)
    db.insert(transactions)
      .values({ id: `t${++n}`, accountId: 'spend', date, amount, payeeName, ...extra })
      .run();
}

describe('recurring finder', () => {
  it('finds a bill and pay but not transfers, cash, refunds or one-offs', () => {
    monthly('Landlord', -200_000);
    monthly('ACME Pay', 320_000);
    monthly('Transfer to Emergency fund', -50_000);
    monthly('Savings top-up', -20_000, { notes: 'Up internal transfer: review' });
    monthly('ATM Withdrawal Westpac', -10_000);
    // A shop that is paid once and then pays back every month
    db.insert(transactions)
      .values({
        id: 'shop',
        accountId: 'spend',
        date: '2026-05-03',
        amount: -12_300,
        payeeName: 'JB Hi-Fi',
      })
      .run();
    monthly('JB Hi-Fi', 4_900);
    // Seen once: nothing to find
    db.insert(transactions)
      .values({
        id: 'once',
        accountId: 'spend',
        date: '2026-10-09',
        amount: -9_900,
        payeeName: 'One-off repair',
      })
      .run();

    const names = discoverSchedules().found.map((f) => f.payeeName);
    expect(names.sort()).toEqual(['ACME Pay', 'Landlord']);
  });
});

describe('isNotABill', () => {
  const none = new Set<string>();
  it('recognises transfers and cash by their labels', () => {
    expect(isNotABill({ id: 'a', payeeName: 'Transfer from Spending', notes: null }, none)).toBe(
      true,
    );
    expect(isNotABill({ id: 'a', payeeName: 'ATM Withdrawal', notes: null }, none)).toBe(true);
    expect(isNotABill({ id: 'a', payeeName: 'Cash out', notes: null }, none)).toBe(true);
    expect(
      isNotABill({ id: 'a', payeeName: 'X', notes: 'Up internal transfer: review' }, none),
    ).toBe(true);
    expect(isNotABill({ id: 'a', payeeName: 'X', notes: null }, new Set(['a']))).toBe(true);
  });

  it('leaves ordinary payees alone', () => {
    expect(isNotABill({ id: 'a', payeeName: 'Telstra', notes: null }, none)).toBe(false);
    expect(isNotABill({ id: 'a', payeeName: 'Catman Transfers Ltd', notes: null }, none)).toBe(
      false,
    );
  });
});
