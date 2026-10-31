import { deleteTransactionRow } from '../services/transactionHelpers.js';
import { linkTransfer } from '../services/transferService.js';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  transactions,
  categories,
  categoryGroups,
  payees,
  schedules,
  scheduleOccurrences,
} from '../db/schema.js';
import { transactionsRouter } from './transactions.js';
import { householdsRouter } from './households.js';
import { accountsRouter } from './accounts.js';
import { allocateShares } from '../services/householdLedger.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';
import { eq } from 'drizzle-orm';
import { budgetActivity } from '../services/balances.js';
import { insertNewTransaction } from '../services/ruleService.js';
let server: Server;
let base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/households', householdsRouter);
  app.use('/api/accounts', accountsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/households`;
  db.insert(accounts)
    .values([
      { id: 'pool', name: 'Joint', type: 'checking' },
      { id: 'mine', name: 'Personal', type: 'checking' },
    ])
    .run();
});
afterAll(() => server.close());
async function call(path: string, body?: unknown, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
async function group(accountId: string | null = null) {
  return (
    await call('', {
      name: 'Home',
      currency: 'AUD',
      accountId,
      people: ['Me', 'Alex', 'Sam'],
      selfIndex: 0,
    })
  ).data;
}
const date = '2026-10-21';
describe('household attribution', () => {
  it('allocates residual cents deterministically and rejects invalid weights', () => {
    expect(allocateShares(10000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(allocateShares(478000, [40, 30, 30])).toEqual([191200, 143400, 143400]);
    expect(() => allocateShares(1, [0, 0])).toThrow();
  });
  it('keeps the gross reconciled debit, consumes advances and protects pool cash from budgeting', async () => {
    const g = await group('pool');
    // The account list names the pool's group, so the sidebar keeps it out of "For budget"
    const listed = await (await fetch(base.replace('/households', '/accounts'))).json();
    expect(
      Object.fromEntries(
        listed.map((a: { id: string; householdPool: string | null }) => [a.id, a.householdPool]),
      ),
    ).toEqual({ pool: 'Home', mine: null });
    const [me, alex, sam] = g.people;
    db.insert(transactions)
      .values([
        {
          id: 'rent',
          accountId: 'pool',
          date,
          amount: -478000,
          reconciled: 1,
          importedId: 'bank-rent',
        },
        { id: 'advance', accountId: 'pool', date, amount: 478000 },
      ])
      .run();
    for (const [p, amount] of [
      [me, 191200],
      [alex, 143400],
      [sam, 143400],
    ] as const)
      expect(
        (
          await call(`/${g.group.id}/events`, {
            kind: 'contribution',
            date,
            description: 'Advance',
            amount,
            payerId: p.id,
          })
        ).status,
      ).toBe(201);
    const rent = await call(`/${g.group.id}/events`, {
      kind: 'expense',
      date,
      description: 'Rent',
      amount: 478000,
      transactionId: 'rent',
      mode: 'weight',
      shares: g.people.map((p: any, i: number) => ({ personId: p.id, value: i === 0 ? 40 : 30 })),
    });
    expect(rent.status).toBe(201);
    expect(rent.data.pool).toBe(0);
    expect(Object.values(rent.data.balances)).toEqual([0, 0, 0]);
    expect(db.select().from(transactions).where(eq(transactions.id, 'rent')).get()).toMatchObject({
      amount: -478000,
      reconciled: 1,
      importedId: 'bank-rent',
    });
    expect(
      db
        .select()
        .from(transactions)
        .where(budgetActivity)
        .all()
        .some((t) => t.accountId === 'pool'),
    ).toBe(false);
    const report = (await call(`/${g.group.id}/statement`)).data;
    expect(report.personalSpending).toBe(191200);
    expect(report.householdSpending).toBe(478000);
    expect(
      (
        await call(`/${g.group.id}/events`, {
          kind: 'expense',
          date,
          description: 'Duplicate',
          amount: 478000,
          payerId: me.id,
          transactionId: 'rent',
          shares: [{ personId: me.id, value: 1 }],
        })
      ).status,
    ).toBe(400);
  });
  it('supports direct payments by others, partial settlements across claims and full refund reversal', async () => {
    const g = await group();
    const [me, alex] = g.people;
    const expense = {
      kind: 'expense',
      date,
      description: 'Dinner',
      amount: 12000,
      payerId: me.id,
      shares: [
        { personId: me.id, value: 1 },
        { personId: alex.id, value: 1 },
      ],
    };
    const first = await call(`/${g.group.id}/events`, expense);
    const second = await call(`/${g.group.id}/events`, expense);
    expect(second.data.balances[me.id]).toBe(12000);
    expect(second.data.balances[alex.id]).toBe(-12000);
    const settled = await call(`/${g.group.id}/events`, {
      kind: 'settlement',
      date,
      description: 'Partial repayment',
      amount: 3000,
      payerId: alex.id,
      recipientId: me.id,
    });
    expect(settled.data.balances[me.id]).toBe(9000);
    expect(
      (
        await call(`/${g.group.id}/events`, {
          kind: 'settlement',
          date,
          description: 'Too much',
          amount: 10000,
          payerId: alex.id,
          recipientId: me.id,
        })
      ).status,
    ).toBe(400);
    const refunded = await call(`/${g.group.id}/events`, {
      kind: 'refund',
      date,
      description: 'Refund',
      reversesId: first.data.events[0].id,
    });
    expect(refunded.data.balances[me.id]).toBe(3000);
    expect(
      (
        await call(`/${g.group.id}/events`, {
          kind: 'refund',
          date,
          description: 'Duplicate refund',
          reversesId: first.data.events[0].id,
        })
      ).status,
    ).toBe(400);
    const others = await call(`/${g.group.id}/events`, { ...expense, payerId: alex.id });
    expect(others.status).toBe(201);
    expect(db.select().from(transactions).all()).toHaveLength(2);
  });
  it('rejects wrong totals, foreign people, missing bank records and unreceived pool money', async () => {
    const g = await group();
    const stranger = (await group()).people[0];
    for (const input of [
      { payerId: g.people[0].id, mode: 'exact', shares: [{ personId: g.people[0].id, value: 1 }] },
      { payerId: stranger.id, shares: [{ personId: g.people[0].id, value: 1 }] },
      {
        payerId: g.people[0].id,
        transactionId: 'missing',
        shares: [{ personId: g.people[0].id, value: 1 }],
      },
      { shares: [{ personId: g.people[0].id, value: 1 }] },
    ])
      expect(
        (
          await call(`/${g.group.id}/events`, {
            kind: 'expense',
            date,
            description: 'Invalid',
            amount: 100,
            ...input,
          })
        ).status,
      ).toBe(400);
  });
  it('reverses repeated partial refunds without losing cents', async () => {
    const g = await group();
    const saved = await call(`/${g.group.id}/events`, {
      kind: 'expense',
      date,
      description: 'Three ways',
      amount: 10000,
      payerId: g.people[0].id,
      shares: g.people.map((p: any) => ({ personId: p.id, value: 1 })),
    });
    const original = saved.data.events[0];
    for (const amount of [3333, 3333, 3334]) {
      const refund = await call(`/${g.group.id}/events`, {
        kind: 'refund',
        date,
        description: 'Partial refund',
        amount,
        reversesId: original.id,
      });
      expect(refund.status).toBe(201);
    }
    const state = (await call(`/${g.group.id}`)).data;
    expect(Object.values(state.balances)).toEqual([0, 0, 0]);
    expect(
      (
        await call(`/${g.group.id}/events`, {
          kind: 'refund',
          date,
          description: 'Over-refund',
          amount: 1,
          reversesId: original.id,
        })
      ).status,
    ).toBe(400);
  });
  it('protects the full amount of a linked reconciled payment', async () => {
    const url = base.replace('/households', '/transactions/rent');
    const edit = async (body: unknown) =>
      fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await edit({ amount: -191200 })).status).toBe(409);
    // Reconciled rows keep the existing stricter edit protections; no household write weakens them.
    const g = (await call('')).data.find((g: any) => g.accountId === 'pool');
    const state = (await call(`/${g.id}`)).data;
    expect(state.events.find((e: any) => e.transactionId === 'rent').amount).toBe(478000);
  });
  it('requires unlinking household attribution before converting a linked payment to a transfer', async () => {
    const g = await group();
    db.insert(transactions)
      .values([
        { id: 'shared-bank', accountId: 'mine', date, amount: -100 },
        { id: 'shared-counterpart', accountId: 'pool', date, amount: 100 },
      ])
      .run();
    expect(
      (
        await call(`/${g.group.id}/events`, {
          kind: 'expense',
          date,
          description: 'Shared bank purchase',
          amount: 100,
          payerId: g.people[0].id,
          transactionId: 'shared-bank',
          shares: [{ personId: g.people[0].id, value: 1 }],
        })
      ).status,
    ).toBe(201);
    expect(() => linkTransfer('shared-bank', 'shared-counterpart')).toThrow(/household/);
  });
  it('keeps agreed shares and flags review when a bank sync removes a linked payment', async () => {
    const groupRows = (await call('')).data;
    const states = await Promise.all(groupRows.map((g: any) => call(`/${g.id}`)));
    const state = states
      .map((s) => s.data)
      .find((s) => s.events.some((e: any) => e.transactionId === 'shared-bank'));
    const event = state.events.find((e: any) => e.transactionId === 'shared-bank');
    expect(() =>
      deleteTransactionRow({ id: 'shared-bank', transferTransactionId: null }),
    ).not.toThrow();
    const after = (await call(`/${state.group.id}`)).data;
    expect(after.events.find((e: any) => e.id === event.id)).toMatchObject({
      amount: event.amount,
      transactionId: null,
      reviewReason: expect.stringContaining('removed'),
      shares: event.shares,
    });
    expect(after.balances).toEqual(state.balances);
    expect(
      db.select().from(transactions).where(eq(transactions.id, 'shared-bank')).get(),
    ).toBeUndefined();
  });
  it('does not reserve the same received cash for two bills and round-trips household data in backups', async () => {
    const existing = (await call('')).data.find((g: any) => g.accountId === 'pool');
    // A manually recorded receipt must also be present in the account before being reservable.
    db.insert(transactions)
      .values({ id: 'bill-funds', accountId: 'pool', date, amount: 10000 })
      .run();
    const g = (await call(`/${existing.id}`)).data;
    await call(`/${g.group.id}/events`, {
      kind: 'contribution',
      date,
      description: 'Bills',
      amount: 10000,
      payerId: g.people[0].id,
    });
    expect(
      (
        await call(`/${g.group.id}/bills`, {
          description: 'Power',
          dueDate: date,
          amount: 7000,
          reserved: 7000,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call(`/${g.group.id}/bills`, {
          description: 'Internet',
          dueDate: date,
          amount: 7000,
          reserved: 7000,
        })
      ).status,
    ).toBe(400);
    const billState = (await call(`/${g.group.id}`)).data;
    const power = billState.bills.find((b: any) => b.description === 'Power');
    expect(
      (
        await call(`/${g.group.id}/events`, {
          kind: 'expense',
          date,
          description: 'Unrelated',
          amount: 4000,
          shares: [{ personId: g.people[0].id, value: 1 }],
        })
      ).status,
    ).toBe(400);
    const paid = await call(`/${g.group.id}/events`, {
      kind: 'expense',
      date,
      description: 'Power paid',
      amount: 7000,
      billId: power.id,
      shares: [{ personId: g.people[0].id, value: 1 }],
    });
    expect(paid.status).toBe(201);
    expect(paid.data.bills.find((b: any) => b.id === power.id).status).toBe('paid');
    const paidEntry = paid.data.events.find((e: any) => e.billId === power.id);
    const refunded = await call(`/${g.group.id}/events`, {
      kind: 'refund',
      date,
      description: 'Bill reversed',
      reversesId: paidEntry.id,
    });
    expect(refunded.status).toBe(201);
    expect(refunded.data.bills.find((b: any) => b.id === power.id).status).toBe('needs review');
    expect(
      (await call(`/${g.group.id}/bills/${power.id}/reservation`, { reserved: 7000 }, 'PUT'))
        .status,
    ).toBe(400);
    const backup = createBackup();
    const parsed = parseBackup(backup);
    expect(parsed.householdGroups.length).toBeGreaterThan(0);
    expect(parsed.householdShares.length).toBeGreaterThan(0);
    restoreBackup(parsed);
    expect(createBackup()).toMatchObject({
      householdGroups: backup.householdGroups,
      householdEvents: backup.householdEvents,
      householdShares: backup.householdShares,
      householdBills: backup.householdBills,
    });
  });

  it("lists recurring bills shared with the household with everyone's share and unshared payments", async () => {
    const g = await group();
    const [me, alex, sam] = g.people;
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    db.insert(payees).values({ id: 'ovo', name: 'OVO Energy' }).run();
    db.insert(schedules)
      .values([
        {
          id: 'power',
          name: 'Electricity (OVO)',
          amount: -18450,
          recurrenceType: 'monthly',
          startDate: day(-60),
          accountId: 'mine',
          payeeId: 'ovo',
        },
        {
          id: 'pay',
          name: 'Salary',
          amount: 500000,
          recurrenceType: 'monthly',
          startDate: day(-60),
        },
      ])
      .run();
    db.insert(transactions)
      .values([
        { id: 'ovo-1', accountId: 'mine', date: day(-40), amount: -18450, payeeId: 'ovo' },
        { id: 'ovo-2', accountId: 'mine', date: day(-10), amount: -18452, payeeId: 'ovo' },
      ])
      .run();
    db.insert(scheduleOccurrences)
      .values({
        id: 'power-next',
        scheduleId: 'power',
        scheduledDate: day(20),
        expectedDate: day(20),
        expectedAmount: -18450,
      })
      .run();

    expect((await call(`/${g.group.id}/recurring-bills`, { scheduleIds: ['pay'] })).status).toBe(
      400,
    );
    const shared = await call(`/${g.group.id}/recurring-bills`, { scheduleIds: ['power'] });
    expect(shared.status).toBe(200);
    const [bill] = shared.data.recurringBills;
    expect(bill).toMatchObject({ name: 'Electricity (OVO)', amount: 18450, nextDate: day(20) });
    expect(bill.shares).toEqual([
      { personId: me.id, amount: 6150 },
      { personId: alex.id, amount: 6150 },
      { personId: sam.id, amount: 6150 },
    ]);
    expect(bill.payments.map((p: any) => [p.transactionId, p.shared])).toEqual([
      ['ovo-2', false],
      ['ovo-1', false],
    ]);
    // Only one household can share an item
    const other = await group();
    expect(
      (await call(`/${other.group.id}/recurring-bills`, { scheduleIds: ['power'] })).status,
    ).toBe(400);

    // Sharing a payment is still the owner's click, through the usual share endpoint
    await call(`/${g.group.id}/share`, { transactionIds: ['ovo-2'] });
    const after = (await call(`/${g.group.id}`)).data.recurringBills[0];
    expect(after.payments.find((p: any) => p.transactionId === 'ovo-2').shared).toBe(true);

    // The default split applies to the preview too
    await call(
      `/${g.group.id}/default-split`,
      {
        mode: 'percentage',
        shares: [
          { personId: me.id, value: 5000 },
          { personId: alex.id, value: 2500 },
          { personId: sam.id, value: 2500 },
        ],
      },
      'PUT',
    );
    expect((await call(`/${g.group.id}`)).data.recurringBills[0].shares[0].amount).toBe(9225);

    expect(createBackup().householdRecurringBills).toEqual([
      expect.objectContaining({ scheduleId: 'power', groupId: g.group.id }),
    ]);
    const stopped = await call(`/${g.group.id}/recurring-bills/power`, undefined, 'DELETE');
    expect(stopped.data.recurringBills).toEqual([]);
    // Shared payments stay in the household
    expect(stopped.data.events.some((e: any) => e.transactionId === 'ovo-2')).toBe(true);
  });

  it('splits a recurring bill its own way and shares its new payments automatically', async () => {
    const g = await group();
    const [me, alex, sam] = g.people;
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    db.insert(payees).values({ id: 'loop', name: 'Superloop' }).run();
    db.insert(schedules)
      .values({
        id: 'net',
        name: 'Internet (Superloop)',
        amount: -9000,
        recurrenceType: 'monthly',
        startDate: day(-60),
        accountId: 'mine',
        payeeId: 'loop',
      })
      .run();
    db.insert(transactions)
      .values({ id: 'loop-old', accountId: 'mine', date: day(-20), amount: -9000, payeeId: 'loop' })
      .run();
    await call(`/${g.group.id}/recurring-bills`, { scheduleIds: ['net'] });
    const noExtras = {
      payeeId: null,
      importedPayee: null,
      notes: null,
      categoryId: null,
      importedId: null,
    };

    // Its own split: I use most of the internet
    const bad = await call(
      `/${g.group.id}/recurring-bills/net`,
      {
        split: {
          mode: 'percentage',
          shares: [
            { personId: me.id, value: 5000 },
            { personId: alex.id, value: 2500 },
          ],
        },
      },
      'PUT',
    );
    expect(bad.status).toBe(400);
    const split = {
      mode: 'percentage',
      shares: [
        { personId: me.id, value: 5000 },
        { personId: alex.id, value: 2500 },
        { personId: sam.id, value: 2500 },
      ],
    };
    const updated = await call(`/${g.group.id}/recurring-bills/net`, { split }, 'PUT');
    const bill = updated.data.recurringBills.find((b: any) => b.scheduleId === 'net');
    expect(bill.split).toEqual(split);
    expect(bill.shares.map((s: any) => s.amount)).toEqual([4500, 2250, 2250]);

    // Sharing its past payment uses that split
    const shared = await call(`/${g.group.id}/recurring-bills/net/share`, {
      transactionIds: ['loop-old'],
    });
    expect(shared.data.shared).toBe(1);
    const entry = shared.data.household.events.find((e: any) => e.transactionId === 'loop-old');
    expect(entry.shares.map((s: any) => s.amount)).toEqual([4500, 2250, 2250]);

    // Automatic sharing: new payments from today on, never the ones before
    const auto = await call(`/${g.group.id}/recurring-bills/net`, { autoShare: true }, 'PUT');
    expect(auto.data.recurringBills.find((b: any) => b.scheduleId === 'net').autoShareFrom).toBe(
      new Date().toISOString().slice(0, 10),
    );
    db.transaction(() => {
      insertNewTransaction({
        ...noExtras,
        id: 'loop-new',
        accountId: 'mine',
        date: day(0),
        amount: -9100,
        payeeName: 'Superloop',
      });
      insertNewTransaction({
        ...noExtras,
        id: 'loop-backdated',
        accountId: 'mine',
        date: day(-5),
        amount: -9100,
        payeeName: 'Superloop',
      });
      insertNewTransaction({
        ...noExtras,
        id: 'loop-refund',
        accountId: 'mine',
        date: day(0),
        amount: 500,
        payeeName: 'Superloop',
      });
    });
    const after = (await call(`/${g.group.id}`)).data;
    const autoEntry = after.events.find((e: any) => e.transactionId === 'loop-new');
    expect(autoEntry.shares.map((s: any) => s.amount)).toEqual([4550, 2275, 2275]);
    expect(after.events.some((e: any) => e.transactionId === 'loop-backdated')).toBe(false);
    expect(after.events.some((e: any) => e.transactionId === 'loop-refund')).toBe(false);

    // Back to the default split and by-hand sharing
    const reset = await call(
      `/${g.group.id}/recurring-bills/net`,
      { split: null, autoShare: false },
      'PUT',
    );
    const resetBill = reset.data.recurringBills.find((b: any) => b.scheduleId === 'net');
    expect(resetBill).toMatchObject({ split: null, autoShareFrom: null });
    db.transaction(() =>
      insertNewTransaction({
        ...noExtras,
        id: 'loop-manual',
        accountId: 'mine',
        date: day(0),
        amount: -9000,
        payeeName: 'Superloop',
      }),
    );
    expect(
      (await call(`/${g.group.id}`)).data.events.some(
        (e: any) => e.transactionId === 'loop-manual',
      ),
    ).toBe(false);
  });

  it('adds and renames people, keeping their entries and balance', async () => {
    const g = await group();
    const [me, alex] = g.people;
    await call(`/${g.group.id}/events`, {
      kind: 'expense',
      date,
      description: 'Groceries',
      amount: 9000,
      payerId: me.id,
      shares: g.people.map((p: any) => ({ personId: p.id, value: 1 })),
    });
    expect((await call(`/${g.group.id}/people`, { name: 'alex' })).status).toBe(400);
    expect((await call(`/${g.group.id}/people`, { name: '  ' })).status).toBe(400);
    const added = await call(`/${g.group.id}/people`, { name: 'Jo' });
    expect(added.status).toBe(201);
    const jo = added.data.people.find((p: any) => p.name === 'Jo');
    expect(added.data.balances[jo.id]).toBe(0);
    const renamed = await call(`/${g.group.id}/people/${alex.id}`, { name: 'Alexandra' }, 'PUT');
    expect(renamed.data.people.find((p: any) => p.id === alex.id).name).toBe('Alexandra');
    expect(renamed.data.balances[alex.id]).toBe(-3000);
    expect((await call(`/${g.group.id}/people/${alex.id}`, { name: 'Jo' }, 'PUT')).status).toBe(
      400,
    );
    expect((await call(`/${g.group.id}/people/nobody`, { name: 'X' }, 'PUT')).status).toBe(400);
  });

  it('edits and deletes one-off bills, but not the amounts of a paid one', async () => {
    const g = await group();
    const made = await call(`/${g.group.id}/bills`, {
      description: 'Council rates',
      dueDate: '2026-11-30',
      amount: 30000,
      personalShare: 10000,
    });
    const rates = made.data.bills.find((b: any) => b.description === 'Council rates');
    const edited = await call(
      `/${g.group.id}/bills/${rates.id}`,
      { description: 'Council rates Q2', dueDate: '2026-12-15', amount: 31000 },
      'PUT',
    );
    expect(edited.data.bills.find((b: any) => b.id === rates.id)).toMatchObject({
      description: 'Council rates Q2',
      dueDate: '2026-12-15',
      amount: 31000,
    });
    expect(
      (await call(`/${g.group.id}/bills/${rates.id}`, { personalShare: 40000 }, 'PUT')).status,
    ).toBe(400);
    await call(`/${g.group.id}/events`, {
      kind: 'expense',
      date,
      description: 'Rates paid',
      amount: 31000,
      payerId: g.people[0].id,
      billId: rates.id,
      shares: g.people.map((p: any) => ({ personId: p.id, value: 1 })),
    });
    expect((await call(`/${g.group.id}/bills/${rates.id}`, { amount: 1 }, 'PUT')).status).toBe(400);
    expect(
      (await call(`/${g.group.id}/bills/${rates.id}`, { description: 'Rates' }, 'PUT')).status,
    ).toBe(200);
    expect((await call(`/${g.group.id}/bills/${rates.id}`, undefined, 'DELETE')).status).toBe(400);
    const spare = await call(`/${g.group.id}/bills`, {
      description: 'Spare',
      dueDate: '2026-11-30',
      amount: 100,
    });
    const spareId = spare.data.bills.find((b: any) => b.description === 'Spare').id;
    const deleted = await call(`/${g.group.id}/bills/${spareId}`, undefined, 'DELETE');
    expect(deleted.data.bills.some((b: any) => b.id === spareId)).toBe(false);
  });
});
