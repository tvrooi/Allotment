import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  budgetMoves,
  budgetSettings,
  cardFunding,
  categories,
  categoryGroups,
  categoryTargets,
  payees,
  rules,
  schedules,
  transactions,
} from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { budgetGroups, budgetSummary } from '../services/budgetService.js';
import { BudgetError, fundedWrite, previewMove, READY_TO_ASSIGN } from '../services/budgetMoves.js';
import { previewAutoAssign } from '../services/autoAssign.js';
import { createProposal } from '../services/budgetProposals.js';
import { addAssigned } from '../services/fundingPlan.js';
import { budgetWithTargets } from '../services/targetService.js';
import { ratesChanged } from '../services/mainAmountService.js';
import { categoriesRouter } from './categories.js';

// An envelope linked to an account (docs/ENVELOPE-FUNDING.md) mirrors it: Rent holds what the
// rent account holds. Moving rent money into the account funds it from Ready to Assign, and
// nothing else (an assignment, interest passing through) can make the two differ.

const TODAY = '2026-10-21';

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  const app = express();
  app.use(express.json());
  app.use('/api/categories', categoriesRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => {
  server.close();
  vi.useRealTimers();
});
afterEach(() => vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`)));

const put = async (path: string, body: unknown) => {
  const res = await fetch(base + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

let seq = 0;
function txn(accountId: string, date: string, amount: number, categoryId: string | null = null) {
  const id = `t${++seq}`;
  db.insert(transactions).values({ id, accountId, date, amount, categoryId }).run();
  return id;
}
/** A confirmed transfer: both legs, each pointing at the other */
function transfer(from: string, to: string, date: string, amount: number) {
  const out = `t${++seq}`;
  const into = `t${++seq}`;
  db.insert(transactions)
    .values([
      { id: out, accountId: from, date, amount: -amount, transferTransactionId: into },
      { id: into, accountId: to, date, amount, transferTransactionId: out },
    ])
    .run();
}
const eqId = (id: string) => eq(categories.id, id);
const link = (categoryId: string, accountId: string | null) =>
  db.update(categories).set({ linkedAccountId: accountId }).where(eqId(categoryId)).run();

const rent = (month: string, today = TODAY) =>
  budgetGroups(month, today)
    .flatMap((g) => g.categories)
    .find((c) => c.id === 'rent')!;
const rta = (month: string) => budgetSummary(month).toBeBudgeted;

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`));
  for (const table of [
    budgetMoves,
    schedules,
    payees,
    rules,
    transactions,
    budgetMonths,
    categoryTargets,
    cardFunding,
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
      { id: 'rent', name: 'Rent', groupId: 'expense' },
      { id: 'food', name: 'Food', groupId: 'expense' },
      { id: 'salary', name: 'Salary', groupId: 'income' },
    ])
    .run();
  const account = (id: string, type: string, extra = {}) => ({
    id,
    name: id,
    type,
    startingBalance: 0,
    createdAt: '2026-07-01',
    ...extra,
  });
  db.insert(accounts)
    .values([
      account('spending', 'checking'),
      account('rentSaver', 'savings'),
      account('holiday', 'savings'),
      account('card', 'credit'),
      account('broker', 'investment', { isOffBudget: 1 }),
    ])
    .run();
  txn('spending', '2026-10-03', 300000, 'salary');
});

describe('an envelope linked to an account', () => {
  it('counts a transfer into the account as money in the envelope, out of Ready to Assign', () => {
    link('rent', 'rentSaver');
    transfer('spending', 'rentSaver', '2026-10-04', 200000);
    expect(rent('2026-10')).toMatchObject({
      budgeted: 0,
      transferred: 200000,
      activity: 0,
      balance: 200000,
    });
    expect(rta('2026-10')).toBe(100000);

    // Paying rent from the rent account spends what the transfer put in
    txn('rentSaver', '2026-10-10', -200000, 'rent');
    expect(rent('2026-10')).toMatchObject({ transferred: 200000, balance: 0, spent: 200000 });
    expect(rta('2026-10')).toBe(100000);
  });

  it('takes a transfer back out of the account from the envelope, and carries what is left', () => {
    link('rent', 'rentSaver');
    transfer('spending', 'rentSaver', '2026-10-04', 200000);
    transfer('rentSaver', 'spending', '2026-10-12', 50000);
    expect(rent('2026-10')).toMatchObject({ transferred: 150000, balance: 150000 });
    expect(rta('2026-10')).toBe(150000);
    // November starts with what October left, like any envelope
    expect(rent('2026-11')).toMatchObject({ carryOver: 150000, transferred: 0, balance: 150000 });
  });

  it('holds what the account holds, whatever an earlier assignment said', () => {
    // As the live budget had it: October assigned A$1,722.67 to Rent, A$1,642.67 was spent from
    // another account, then A$825.50 moved into the rent account. Rent holds A$825.50, not 905.50.
    link('rent', 'rentSaver');
    db.insert(budgetMonths)
      .values({ id: 'a', month: '2026-10', categoryId: 'rent', budgeted: 172267 })
      .run();
    txn('spending', '2026-10-05', -164267, 'rent');
    transfer('spending', 'rentSaver', '2026-10-06', 82550);
    expect(rent('2026-10')).toMatchObject({
      budgeted: 172267,
      activity: -164267,
      transferred: 74550,
      balance: 82550,
    });
    // The A$80 the assignment left over is back in Ready to Assign
    expect(rta('2026-10')).toBe(300000 - 164267 - 82550);
  });

  it('passes interest forwarded to another account through, leaving it ready to assign', () => {
    link('rent', 'rentSaver');
    transfer('spending', 'rentSaver', '2026-10-04', 82550);
    // Up pays interest into the rent account and forwards it straight on to another saver
    txn('rentSaver', '2026-10-05', 51, 'salary');
    transfer('rentSaver', 'holiday', '2026-10-05', 51);
    expect(rent('2026-10')).toMatchObject({ transferred: 82550, balance: 82550 });
    expect(rta('2026-10')).toBe(300000 + 51 - 82550);
    // Interest kept in the account is the envelope's, like everything else there
    txn('rentSaver', '2026-10-06', 20, 'salary');
    expect(rent('2026-10').balance).toBe(82570);
  });

  it('follows the account balance, whatever moved it, up to today', () => {
    link('rent', 'rentSaver');
    // An inflow that isn't a transfer, and money from a tracking account, are in the account
    txn('rentSaver', '2026-10-05', 40000);
    transfer('broker', 'rentSaver', '2026-10-06', 10000);
    // Another account's transfer has nothing to do with Rent
    transfer('spending', 'holiday', '2026-10-07', 20000);
    expect(rent('2026-10')).toMatchObject({ transferred: 50000, balance: 50000 });
    expect(rta('2026-10')).toBe(300000);

    // A transfer later this month counts when its day comes
    transfer('spending', 'rentSaver', '2026-10-25', 100000);
    expect(rent('2026-10').transferred).toBe(50000);
    expect(rent('2026-10', '2026-10-25').transferred).toBe(150000);
  });

  it('takes rent paid from another account out of Ready to Assign, not the envelope', () => {
    link('rent', 'rentSaver');
    transfer('spending', 'rentSaver', '2026-10-04', 82550);
    txn('spending', '2026-10-08', -10000, 'rent');
    expect(rent('2026-10')).toMatchObject({ activity: -10000, balance: 82550 });
    expect(rta('2026-10')).toBe(300000 - 82550 - 10000);
  });

  it('refuses assignments and moves: money reaches it by a transfer', () => {
    link('rent', 'rentSaver');
    transfer('spending', 'rentSaver', '2026-10-04', 82550);
    const assign = () =>
      fundedWrite(() => {
        db.insert(budgetMonths)
          .values({ id: 'b', month: '2026-10', categoryId: 'rent', budgeted: 1000 })
          .run();
      });
    expect(assign).toThrow(BudgetError);
    expect(assign).toThrow('Rent follows the rentSaver account');
    expect(db.select().from(budgetMonths).all()).toEqual([]);
    expect(() =>
      previewMove('2026-10', { sourceId: 'rent', destinationId: READY_TO_ASSIGN, amount: 100 }),
    ).toThrow(/Transfer money to or from rentSaver/);
    expect(() =>
      previewMove('2026-10', { sourceId: 'food', destinationId: 'rent', amount: 100 }),
    ).toThrow(BudgetError);
    // An unlinked envelope still takes an assignment
    fundedWrite(() => {
      db.insert(budgetMonths)
        .values({ id: 'c', month: '2026-10', categoryId: 'food', budgeted: 1000 })
        .run();
    });
    expect(rta('2026-10')).toBe(300000 - 82550 - 1000);
    // Auto-assign leaves it out
    db.insert(categoryTargets)
      .values({ categoryId: 'rent', type: 'monthly', amount: 200000, createdMonth: '2026-10' })
      .run();
    expect(
      previewAutoAssign('2026-10', { strategy: 'underfunded' }, TODAY).rows.map(
        (c: { categoryId: string }) => c.categoryId,
      ),
    ).not.toContain('rent');
  });

  it('lets a leftover later assignment reserve nothing, and lets the owner clear it', () => {
    link('rent', 'rentSaver');
    transfer('spending', 'rentSaver', '2026-10-04', 82550);
    // From before the envelope was linked: assigned to December
    db.insert(budgetMonths)
      .values({ id: 'dec', month: '2026-12', categoryId: 'rent', budgeted: 50000 })
      .run();
    expect(rta('2026-10')).toBe(300000 - 82550);
    expect(rent('2026-12')).toMatchObject({ budgeted: 50000, transferred: -50000, balance: 82550 });
    // Clearing it is allowed; raising it is not
    fundedWrite(() => {
      db.update(budgetMonths).set({ budgeted: 0 }).where(eq(budgetMonths.id, 'dec')).run();
    });
    expect(db.select().from(budgetMonths).all()[0].budgeted).toBe(0);
    expect(() =>
      fundedWrite(() => {
        db.update(budgetMonths).set({ budgeted: 100 }).where(eq(budgetMonths.id, 'dec')).run();
      }),
    ).toThrow(BudgetError);
  });

  it('keeps an assignment from before the account takes effect promised (Codex on #206)', () => {
    // A saver first effective in December: November's assignment still follows the usual rules
    db.update(accounts).set({ createdAt: '2026-12-01' }).where(eq(accounts.id, 'rentSaver')).run();
    link('rent', 'rentSaver');
    db.insert(budgetMonths)
      .values({ id: 'nov', month: '2026-11', categoryId: 'rent', budgeted: 10000 })
      .run();
    expect(rta('2026-10')).toBe(300000 - 10000);
    expect(rent('2026-11')).toMatchObject({ budgeted: 10000, transferred: 0, balance: 10000 });
  });

  it('refuses suggestions and plan writes that would assign to it', () => {
    link('rent', 'rentSaver');
    expect(() =>
      createProposal({ month: '2026-10', rows: [{ categoryId: 'rent', amount: 1000 }] }),
    ).toThrow(/follows the rentSaver account/);
    expect(() => fundedWrite(() => addAssigned('2026-10', 'rent', 1000))).toThrow(BudgetError);
    expect(db.select().from(budgetMonths).all()).toEqual([]);
  });

  it('stops counting when unlinked, without rewriting anything', () => {
    link('rent', 'rentSaver');
    transfer('spending', 'rentSaver', '2026-10-04', 200000);
    expect(rta('2026-10')).toBe(100000);
    link('rent', null);
    expect(rent('2026-10')).toMatchObject({ transferred: 0, balance: 0 });
    expect(rta('2026-10')).toBe(300000);
  });

  it('counts toward a monthly target like an assignment', () => {
    link('rent', 'rentSaver');
    db.insert(categoryTargets)
      .values({ categoryId: 'rent', type: 'monthly', amount: 200000, createdMonth: '2026-10' })
      .run();
    const target = () =>
      budgetWithTargets('2026-10')
        .flatMap((g) => g.categories)
        .find((c) => c.id === 'rent')!.target!;
    expect(target().underfunded).toBe(200000);
    transfer('spending', 'rentSaver', '2026-10-04', 150000);
    expect(target()).toMatchObject({ assigned: 150000, underfunded: 50000 });
  });
});

describe('linking a category to an account', () => {
  it('links and unlinks an expense envelope', async () => {
    const linked = await put('/categories/rent', { linkedAccountId: 'rentSaver' });
    expect(linked.status).toBe(200);
    expect(linked.body.linkedAccountId).toBe('rentSaver');
    // Other edits keep the link
    expect((await put('/categories/rent', { name: 'Home' })).body.linkedAccountId).toBe(
      'rentSaver',
    );
    const unlinked = await put('/categories/rent', { linkedAccountId: null });
    expect(unlinked.body.linkedAccountId).toBeNull();
  });

  it('refuses links that would count money wrongly', async () => {
    for (const [id, accountId] of [
      ['salary', 'rentSaver'], // income
      ['rent', 'broker'], // off budget
      ['rent', 'card'], // card debt
      ['rent', 'missing'],
    ])
      expect((await put(`/categories/${id}`, { linkedAccountId: accountId })).status).toBe(409);

    db.update(accounts).set({ closedAt: '2026-09-01' }).where(eq(accounts.id, 'holiday')).run();
    expect((await put('/categories/rent', { linkedAccountId: 'holiday' })).status).toBe(409);

    // One envelope per account, so no transfer counts twice
    expect((await put('/categories/rent', { linkedAccountId: 'rentSaver' })).status).toBe(200);
    const taken = await put('/categories/food', { linkedAccountId: 'rentSaver' });
    expect(taken.status).toBe(409);
    expect(taken.body.error).toMatch(/already funds Rent/);

    // A linked envelope can't move into an income group
    expect((await put('/categories/rent', { groupId: 'income' })).status).toBe(409);
  });

  it('keeps a link to an account closed since, and still saves other edits', async () => {
    expect((await put('/categories/rent', { linkedAccountId: 'rentSaver' })).status).toBe(200);
    db.update(accounts).set({ closedAt: '2026-10-20' }).where(eq(accounts.id, 'rentSaver')).run();
    const renamed = await put('/categories/rent', { name: 'Home', hidden: 1 });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ name: 'Home', linkedAccountId: 'rentSaver' });
    // Re-sending the same link is not a new one
    expect((await put('/categories/rent', { linkedAccountId: 'rentSaver' })).status).toBe(200);
    // Still never an income envelope
    expect((await put('/categories/rent', { groupId: 'income' })).status).toBe(409);
  });

  it('clears the link when the account is deleted', () => {
    link('rent', 'rentSaver');
    db.delete(accounts).where(eq(accounts.id, 'rentSaver')).run();
    expect(db.select().from(categories).where(eqId('rent')).get()?.linkedAccountId).toBeNull();
  });
});
