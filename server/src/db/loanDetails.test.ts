import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';
import { accountLoanDetails, accounts } from './schema.js';

// Loan details (docs/LONG-TERM-FORECAST.md §7): rate and repayment beside a loan account.
// Mock data only.

beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  db.insert(accounts)
    .values({
      id: 'mock-mortgage',
      name: 'Mock mortgage',
      type: 'mortgage',
      startingBalance: -32_000_000,
    })
    .run();
});

describe('account_loan_details', () => {
  it('stores a rate, repayment and optional term, and goes with its account', () => {
    db.insert(accountLoanDetails)
      .values({
        accountId: 'mock-mortgage',
        rateBps: 650,
        monthlyRepayment: 202_262,
        termMonths: 360,
      })
      .run();
    const row = db
      .select()
      .from(accountLoanDetails)
      .where(eq(accountLoanDetails.accountId, 'mock-mortgage'))
      .get();
    expect(row).toMatchObject({ rateBps: 650, monthlyRepayment: 202_262, termMonths: 360 });
    db.delete(accounts).where(eq(accounts.id, 'mock-mortgage')).run();
    expect(db.select().from(accountLoanDetails).all()).toEqual([]);
  });

  it('refuses a negative repayment or an impossible term', () => {
    db.insert(accounts).values({ id: 'mock-loan', name: 'Mock loan', type: 'loan' }).run();
    const insert = (v: Partial<typeof accountLoanDetails.$inferInsert>) =>
      db
        .insert(accountLoanDetails)
        .values({ accountId: 'mock-loan', rateBps: 100, ...v })
        .run();
    expect(() => insert({ monthlyRepayment: -1 })).toThrow();
    expect(() => insert({ termMonths: 0 })).toThrow();
    expect(() => insert({ rateBps: 100_001 })).toThrow();
  });
});
