import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  householdEvents,
  householdGroups,
  householdPeople,
  householdPoolAccounts,
  householdRecurringBills,
  householdShares,
  payees,
  schedules,
  transactions,
} from '../db/schema.js';
import {
  housematePayees,
  incomeCategoryIds,
  isPersonalIncomeSchedule,
  scheduleScopes,
} from './scheduleScope.js';
import { detectSalary } from './importTidy.js';

// Synthetic household: the owner and two housemates share a 2Up account ("pool") that pays the
// rent; Juno and Kai pay their part into it. Nothing here is real data.

beforeAll(() => migrate(db, { migrationsFolder: 'src/db/migrations' }));
beforeEach(() => {
  for (const table of [
    householdShares,
    householdEvents,
    householdRecurringBills,
    householdPoolAccounts,
    householdPeople,
    householdGroups,
    schedules,
    transactions,
    payees,
    categories,
    categoryGroups,
    accounts,
  ])
    db.delete(table).run();
  db.insert(accounts)
    .values([
      { id: 'spend', name: 'Spending', type: 'checking' },
      { id: 'pool', name: '2Up', type: 'checking' },
      { id: 'bills', name: '2Up Bills', type: 'savings' },
      { id: 'super', name: 'Super', type: 'retirement', isOffBudget: 1 },
    ])
    .run();
  db.insert(householdGroups)
    .values({
      id: 'hh',
      name: 'Home',
      currency: 'AUD',
      accountId: 'pool',
      // The owner pays half; the housemates a quarter each
      defaultSplitJson: JSON.stringify({
        mode: 'percentage',
        shares: [
          { personId: 'me', value: 5000 },
          { personId: 'juno', value: 2500 },
          { personId: 'kai', value: 2500 },
        ],
      }),
    })
    .run();
  db.insert(householdPoolAccounts).values({ groupId: 'hh', accountId: 'bills' }).run();
  db.insert(householdPeople)
    .values([
      { id: 'me', groupId: 'hh', name: 'Me', isSelf: 1 },
      { id: 'juno', groupId: 'hh', name: 'Juno', isSelf: 0 },
      { id: 'kai', groupId: 'hh', name: 'Kai', isSelf: 0 },
    ])
    .run();
  db.insert(categoryGroups).values({ id: 'in', name: 'Income', isIncome: 1 }).run();
  db.insert(categories).values({ id: 'pay', name: 'Pay', groupId: 'in' }).run();
});

let n = 0;
function schedule(amount: number, extra: Partial<typeof schedules.$inferInsert> = {}) {
  const id = extra.id ?? `s${++n}`;
  db.insert(schedules)
    .values({
      id,
      name: id,
      amount,
      recurrenceType: 'monthly',
      recurrenceRule: JSON.stringify({ type: 'monthly', interval: 1, anchorDay: 1 }),
      startDate: '2026-10-01',
      ...extra,
    })
    .run();
  return id;
}
/** A bank row recorded in the household as a person's money */
function recorded(
  payeeId: string,
  kind: 'contribution' | 'settlement',
  payerId: string,
  to?: string,
) {
  const id = `t${++n}`;
  db.insert(payees).values({ id: payeeId, name: payeeId }).onConflictDoNothing().run();
  db.insert(transactions)
    .values({
      id,
      accountId: kind === 'contribution' ? 'pool' : 'spend',
      date: '2026-10-01',
      amount: 80000,
      payeeId,
    })
    .run();
  db.insert(householdEvents)
    .values({
      id: `e${n}`,
      groupId: 'hh',
      kind,
      date: '2026-10-01',
      description: kind,
      amount: 80000,
      payerId,
      recipientId: to ?? null,
      transactionId: id,
    })
    .run();
}
const scopeOf = (id: string) => scheduleScopes().get(id);

describe('scheduleScopes', () => {
  it('keeps personal and account-less items personal, and off-budget ones apart', () => {
    const own = schedule(300000, { accountId: 'spend', categoryId: 'pay' });
    const loose = schedule(-5000);
    const offBudget = schedule(20000, { accountId: 'super' });
    expect(scopeOf(own)).toEqual({ kind: 'personal' });
    expect(scopeOf(loose)).toEqual({ kind: 'personal' });
    expect(scopeOf(offBudget)).toEqual({ kind: 'off_budget' });
  });

  it("names a housemate's deposit into any of the household's accounts as their contribution", () => {
    db.insert(payees).values({ id: 'p-juno', name: 'JUNO RENT TRANSFER' }).run();
    const juno = schedule(80000, { accountId: 'pool', payeeId: 'p-juno', categoryId: 'pay' });
    const unknown = schedule(80000, { accountId: 'bills', name: 'Deposit' });
    expect(scopeOf(juno)).toMatchObject({
      kind: 'household',
      groupId: 'hh',
      groupName: 'Home',
      role: 'contribution',
      personId: 'juno',
      personName: 'Juno',
    });
    expect(scopeOf(unknown)).toMatchObject({ role: 'contribution', personId: null });
  });

  it("gives a bill the owner's share, from its own split or the household's default", () => {
    const rent = schedule(-240000, { accountId: 'pool' });
    const internet = schedule(-9000, { accountId: 'spend' });
    // Fixed parts of the internet bill, paid from the owner's own account
    db.insert(householdRecurringBills)
      .values({
        scheduleId: internet,
        groupId: 'hh',
        splitJson: JSON.stringify({
          mode: 'exact',
          shares: [
            { personId: 'me', value: 5000 },
            { personId: 'juno', value: 2000 },
            { personId: 'kai', value: 2000 },
          ],
        }),
      })
      .run();
    expect(scopeOf(rent)).toMatchObject({ kind: 'household', role: 'bill', myShare: 120000 });
    expect(scopeOf(internet)).toMatchObject({ kind: 'household', role: 'bill', myShare: 5000 });
  });

  it('takes the share of a household-account bill from how its latest payment was split', () => {
    const rent = schedule(-478000, { accountId: 'pool' });
    // Before anything is shared: the household's default split (the owner's half)
    expect(scopeOf(rent)).toMatchObject({ role: 'bill', myShare: 239000 });
    const pay = (id: string, date: string, amount: number, split: [string, number][]) => {
      db.insert(transactions)
        .values({ id, accountId: 'pool', date, amount: -amount, scheduleId: rent })
        .run();
      db.insert(householdEvents)
        .values({
          id: `e-${id}`,
          groupId: 'hh',
          kind: 'expense',
          date,
          description: 'Rent',
          amount,
          transactionId: id,
        })
        .run();
      db.insert(householdShares)
        .values(
          split.map(([personId, cents]) => ({
            id: `${id}-${personId}`,
            eventId: `e-${id}`,
            personId,
            amount: cents,
          })),
        )
        .run();
    };
    pay('older', '2026-09-19', 478000, [
      ['me', 159334],
      ['juno', 159333],
      ['kai', 159333],
    ]);
    pay('newer', '2026-10-19', 478000, [
      ['me', 165100],
      ['juno', 171700],
      ['kai', 141200],
    ]);
    expect(scopeOf(rent)).toMatchObject({ role: 'bill', myShare: 165100 });
    // A different expected amount scales the same split, in whole cents
    db.update(schedules).set({ amount: -500000 }).where(eq(schedules.id, rent)).run();
    expect(scopeOf(rent)).toMatchObject({ myShare: 172699 });
  });

  it("treats the owner's own transfer into the household account as their contribution", () => {
    const mine = schedule(-80000, { accountId: 'spend', transferAccountId: 'pool' });
    expect(scopeOf(mine)).toMatchObject({ role: 'contribution', personId: 'me' });
  });

  it('learns housemate payees from what the owner recorded, never between housemates', () => {
    recorded('p-kai', 'settlement', 'kai', 'me');
    recorded('p-juno', 'settlement', 'juno', 'kai');
    expect([...housematePayees().keys()]).toEqual(['p-kai']);
    const kai = schedule(80000, { payeeId: 'p-kai', categoryId: 'pay' });
    const juno = schedule(80000, { payeeId: 'p-juno', categoryId: 'pay' });
    expect(scopeOf(kai)).toMatchObject({
      kind: 'household',
      role: 'contribution',
      personId: 'kai',
    });
    // Juno paid Kai, not the owner: nothing learned, so it stays the owner's
    expect(scopeOf(juno)).toEqual({ kind: 'personal' });

    const income = incomeCategoryIds();
    const row = (id: string) =>
      db
        .select()
        .from(schedules)
        .all()
        .find((s) => s.id === id)!;
    expect(isPersonalIncomeSchedule(row(kai), scopeOf(kai), income)).toBe(false);
    expect(isPersonalIncomeSchedule(row(juno), scopeOf(juno), income)).toBe(true);
  });

  it('classifies every schedule in one call', () => {
    for (let i = 0; i < 40; i++) schedule(80000, { accountId: i % 2 ? 'pool' : 'spend' });
    const scopes = scheduleScopes();
    expect(scopes.size).toBe(40);
    expect([...scopes.values()].filter((s) => s.kind === 'household')).toHaveLength(20);
  });
});

describe('detectSalary', () => {
  it("never offers a housemate's repeating transfer as pay", () => {
    const today = '2026-10-30';
    const fortnights = [
      '2026-08-07',
      '2026-08-21',
      '2026-09-04',
      '2026-09-18',
      '2026-10-02',
      '2026-10-16',
    ];
    db.insert(payees)
      .values([
        { id: 'p-acme', name: 'ACME Pty Ltd' },
        { id: 'p-kai', name: 'Kai' },
      ])
      .run();
    for (const date of fortnights) {
      db.insert(transactions)
        .values([
          { id: `acme-${date}`, accountId: 'spend', date, amount: 50000, payeeId: 'p-acme' },
          { id: `kai-${date}`, accountId: 'spend', date, amount: 90000, payeeId: 'p-kai' },
        ])
        .run();
    }
    // Before Kai's money is recorded as theirs, the larger run looks like pay
    expect(detectSalary(today)?.payeeId).toBe('p-kai');
    db.insert(householdEvents)
      .values({
        id: 'settle',
        groupId: 'hh',
        kind: 'settlement',
        date: '2026-10-16',
        description: 'Kai paid me back',
        amount: 90000,
        payerId: 'kai',
        recipientId: 'me',
        transactionId: 'kai-2026-10-16',
      })
      .run();
    expect(detectSalary(today)?.payeeId).toBe('p-acme');
  });
});
