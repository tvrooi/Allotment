import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, payees, schedules, transactions } from '../db/schema.js';
import { householdsRouter } from './households.js';
import { householdLedger } from '../services/householdLedger.js';

// Fixed amounts for a shared recurring bill, and what each person owes the household account
// apart from what they owe people who paid themselves (docs/HOUSEHOLDS.md).

let server: Server;
let base: string;
const date = '2026-10-28';
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/households', householdsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/households`;
  db.insert(accounts)
    .values([
      { id: 'joint', name: '2Up Bills', type: 'checking' },
      { id: 'mine', name: 'Spending', type: 'checking' },
    ])
    .run();
  db.insert(payees).values({ id: 'agent', name: 'Ray White' }).run();
  db.insert(schedules)
    .values({
      id: 'rent',
      name: 'Rent',
      amount: -300000,
      recurrenceType: 'monthly',
      startDate: '2026-09-01',
      accountId: 'joint',
      payeeId: 'agent',
    })
    .run();
});
afterAll(() => server.close());

async function call(path: string, body?: unknown, method = body !== undefined ? 'POST' : 'GET') {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
const tx = (
  id: string,
  accountId: string,
  amount: number,
  payeeName: string,
  extra: Partial<typeof transactions.$inferInsert> = {},
) =>
  db
    .insert(transactions)
    .values({ id, accountId, date, amount, payeeName, ...extra })
    .run();

describe('the household ledger', () => {
  it('keeps what is owed to the household account apart from what is owed to people', () => {
    const people = [{ id: 'a' }, { id: 'b' }];
    const ledger = householdLedger(
      people,
      [
        { id: 'c', kind: 'contribution', amount: 1000, payerId: 'a', recipientId: null },
        { id: 'p', kind: 'expense', amount: 3000, payerId: null, recipientId: null },
        { id: 'd', kind: 'expense', amount: 600, payerId: 'a', recipientId: null },
        { id: 's', kind: 'settlement', amount: 100, payerId: 'b', recipientId: 'a' },
      ],
      [
        { eventId: 'p', personId: 'a', amount: 1500 },
        { eventId: 'p', personId: 'b', amount: 1500 },
        { eventId: 'd', personId: 'a', amount: 300 },
        { eventId: 'd', personId: 'b', amount: 300 },
      ],
    );
    expect(ledger.toPool).toEqual({ a: -500, b: -1500 });
    expect(ledger.direct).toEqual({ a: 200, b: -200 });
    expect(ledger.balances).toEqual({ a: -300, b: -1700 });
    expect(ledger.pool).toBe(-2000);
  });
});

describe('a rent with fixed amounts paid from the household account', () => {
  let groupId: string;
  let me: string;
  let juno: string;
  let zephyr: string;
  const fixed = () => ({
    mode: 'exact',
    shares: [
      { personId: me, value: 120000 },
      { personId: juno, value: 100000 },
      { personId: zephyr, value: 80000 },
    ],
  });

  it('gives each person their set part of the rent', async () => {
    const created = (
      await call('', {
        name: 'Rental',
        currency: 'AUD',
        accountId: 'joint',
        people: ['Me', 'Juno', 'Zephyr'],
        selfIndex: 0,
      })
    ).data;
    groupId = created.group.id;
    [me, juno, zephyr] = created.people.map((p: { id: string }) => p.id);
    await call(`/${groupId}/recurring-bills`, { scheduleIds: ['rent'] });
    // Fixed amounts suit a bill, not the default split every payment uses
    expect((await call(`/${groupId}/default-split`, fixed(), 'PUT')).status).toBe(400);
    const updated = await call(`/${groupId}/recurring-bills/rent`, { split: fixed() }, 'PUT');
    expect(updated.status).toBe(200);
    const bill = updated.data.recurringBills[0];
    expect(bill.split).toEqual(fixed());
    expect(bill.fixedTotal).toBe(300000);
    expect(bill.shares.map((s: { amount: number }) => s.amount)).toEqual([120000, 100000, 80000]);
  });

  it('shares a rent payment before anyone has put their part in: each owes the account', async () => {
    tx('rent-oct', 'joint', -300000, 'Ray White', { payeeId: 'agent' });
    tx('rent-odd', 'joint', -305000, 'Ray White', { payeeId: 'agent' });
    const shared = await call(`/${groupId}/recurring-bills/rent/share`, {
      transactionIds: ['rent-oct', 'rent-odd'],
    });
    expect(shared.data.results.map((r: { ok: boolean }) => r.ok)).toEqual([true, false]);
    expect(shared.data.results[1].error).toBe(
      'The fixed amounts add up to $3,000.00, but this payment is $3,050.00',
    );
    const state = shared.data.household;
    const rent = state.events.find(
      (e: { transactionId: string }) => e.transactionId === 'rent-oct',
    );
    expect(rent.payerId).toBeNull();
    expect(rent.shares.map((s: { amount: number }) => s.amount)).toEqual([120000, 100000, 80000]);
    expect(state.toPool).toEqual({ [me]: -120000, [juno]: -100000, [zephyr]: -80000 });
    expect(state.direct).toEqual({ [me]: 0, [juno]: 0, [zephyr]: 0 });
    expect(state.pool).toBe(-300000);
  });

  it('suggests contributions into the household account, from people and your own transfers', async () => {
    tx('juno-in', 'joint', 100000, 'Juno Babic');
    tx('me-out', 'mine', -120000, 'Transfer to 2Up Bills', { transferTransactionId: 'me-in' });
    tx('me-in', 'joint', 120000, 'Transfer from Spending', { transferTransactionId: 'me-out' });
    tx('stranger-in', 'joint', 5000, 'Cashback');
    const suggestions = (await call(`/${groupId}/repayment-suggestions`)).data;
    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'contribution',
          transactionId: 'juno-in',
          personId: juno,
          owes: 100000,
        }),
        expect.objectContaining({
          kind: 'contribution',
          transactionId: 'me-in',
          personId: me,
          owes: 120000,
        }),
      ]),
    );
    expect(suggestions).toHaveLength(2);
    for (const s of suggestions) {
      const recorded = await call(`/${groupId}/events`, {
        kind: 'contribution',
        date: s.date,
        description: 'Rent',
        amount: s.amount,
        payerId: s.personId,
        transactionId: s.transactionId,
      });
      expect(recorded.status).toBe(201);
    }
    const state = (await call(`/${groupId}`)).data;
    expect(state.toPool).toEqual({ [me]: 0, [juno]: 0, [zephyr]: -80000 });
    expect((await call(`/${groupId}/repayment-suggestions`)).data).toEqual([]);
  });

  it('only counts what someone paid themselves as owed to them', async () => {
    tx('groceries', 'mine', -9000, 'Coles');
    await call(`/${groupId}/share`, { transactionIds: ['groceries'] });
    // Zephyr still owes the account $800, but only $30 to me: a $500 payment isn't a repayment
    tx('zephyr-big', 'mine', 50000, 'Zephyr Moss');
    tx('zephyr-small', 'mine', 3000, 'Zephyr Moss');
    const suggestions = (await call(`/${groupId}/repayment-suggestions`)).data;
    expect(suggestions).toEqual([
      expect.objectContaining({
        kind: 'settlement',
        transactionId: 'zephyr-small',
        personId: zephyr,
        owes: 3000,
      }),
    ]);
    const state = (await call(`/${groupId}`)).data;
    expect(state.direct).toEqual({ [me]: 6000, [juno]: -3000, [zephyr]: -3000 });
    expect(state.toPool[zephyr]).toBe(-80000);
  });

  it('removes a contribution the account has spent, leaving its payer owing again', async () => {
    const state = (await call(`/${groupId}`)).data;
    const junos = state.events.find(
      (e: { transactionId: string }) => e.transactionId === 'juno-in',
    );
    const removed = await call(`/${groupId}/events/${junos.id}`, undefined, 'DELETE');
    expect(removed.status).toBe(200);
    expect(removed.data.toPool[juno]).toBe(-100000);
  });
});

describe('repayments and contributions alongside other money', () => {
  let flat: string;
  let me: string;
  let kai: string;

  it('records a repayment for what I paid, though I still owe the household account', async () => {
    db.insert(accounts)
      .values([
        { id: 'flat', name: 'Flat account', type: 'checking' },
        { id: 'trip', name: 'Trip account', type: 'checking' },
      ])
      .run();
    const created = (
      await call('', {
        name: 'Flat',
        currency: 'AUD',
        accountId: 'flat',
        people: ['Me', 'Kai'],
        selfIndex: 0,
      })
    ).data;
    flat = created.group.id;
    [me, kai] = created.people.map((p: { id: string }) => p.id);
    tx('power', 'flat', -10000, 'AGL');
    tx('dinner', 'mine', -2000, 'Thai place');
    await call(`/${flat}/share`, { transactionIds: ['power', 'dinner'] });
    let state = (await call(`/${flat}`)).data;
    // I owe the account $50 and am owed $10 for dinner: my overall balance is −$40
    expect(state.toPool[me]).toBe(-5000);
    expect(state.direct[me]).toBe(1000);
    expect(state.balances[me]).toBe(-4000);
    tx('kai-back', 'mine', 1000, 'Kai Tran');
    const suggestion = (await call(`/${flat}/repayment-suggestions`)).data.find(
      (s: { transactionId: string }) => s.transactionId === 'kai-back',
    );
    expect(suggestion).toMatchObject({ kind: 'settlement', personId: kai, owes: 1000 });
    const recorded = await call(`/${flat}/events`, {
      kind: 'settlement',
      date,
      description: 'Dinner back',
      amount: 1000,
      payerId: kai,
      recipientId: me,
      transactionId: 'kai-back',
    });
    expect(recorded.status).toBe(201);
    state = recorded.data;
    expect(state.direct).toEqual({ [me]: 0, [kai]: 0 });
    // More than either balance is still refused
    expect(
      (
        await call(`/${flat}/events`, {
          kind: 'settlement',
          date,
          description: 'Too much',
          amount: 100,
          payerId: kai,
          recipientId: me,
        })
      ).status,
    ).toBe(400);
  });

  it("doesn't take a transfer from another household's account as my contribution", async () => {
    await call('', {
      name: 'Trip',
      currency: 'AUD',
      accountId: 'trip',
      people: ['Me', 'Kai'],
      selfIndex: 0,
    });
    tx('trip-out', 'trip', -3000, 'Transfer to Flat account', { transferTransactionId: 'flat-in' });
    tx('flat-in', 'flat', 3000, 'Transfer from Trip account', {
      transferTransactionId: 'trip-out',
    });
    tx('mine-out', 'mine', -5000, 'Transfer to Flat account', { transferTransactionId: 'mine-in' });
    tx('mine-in', 'flat', 5000, 'Transfer from Spending', { transferTransactionId: 'mine-out' });
    const contributions = (await call(`/${flat}/repayment-suggestions`)).data
      .filter((s: { kind: string }) => s.kind === 'contribution')
      .map((s: { transactionId: string; personId: string }) => [s.transactionId, s.personId]);
    expect(contributions).toEqual([['mine-in', me]]);
  });
});

describe('repaying a housemate I owe', () => {
  it('suggests my own payment to them, within what I owe, and records it', async () => {
    db.insert(accounts).values({ id: 'cabin', name: 'Cabin account', type: 'checking' }).run();
    const created = (
      await call('', {
        name: 'Cabin',
        currency: 'AUD',
        accountId: 'cabin',
        people: ['Me', 'Kai'],
        selfIndex: 0,
      })
    ).data;
    const cabin = created.group.id;
    const [me, kai] = created.people.map((p: { id: string }) => p.id);
    // Kai paid $100 for both of us: I owe him $50
    await call(`/${cabin}/events`, {
      kind: 'expense',
      date,
      description: 'Firewood',
      amount: 10000,
      payerId: kai,
      mode: 'equal',
      shares: [
        { personId: me, value: 1 },
        { personId: kai, value: 1 },
      ],
    });
    tx('to-kai', 'mine', -3000, 'Kai Tran');
    tx('too-much', 'mine', -9000, 'Kai Tran');
    tx('elsewhere', 'mine', -1000, 'Someone Else');
    tx('kai-transfer', 'mine', -1000, 'Kai Tran', { transferTransactionId: 'kai-leg' });
    tx('kai-pool', 'cabin', -1000, 'Kai Tran');
    const found = (await call(`/${cabin}/repayment-suggestions`)).data;
    expect(found).toEqual([
      expect.objectContaining({
        kind: 'payment',
        transactionId: 'to-kai',
        amount: 3000,
        personId: kai,
        owes: 5000,
      }),
    ]);
    const state = (await call(`/${cabin}`)).data;
    expect(state.settlements).toEqual([{ fromId: me, toId: kai, amount: 5000 }]);
    const recorded = await call(`/${cabin}/events`, {
      kind: 'settlement',
      date,
      description: 'Repayment to Kai',
      amount: 3000,
      payerId: me,
      recipientId: kai,
      transactionId: 'to-kai',
    });
    expect(recorded.status).toBe(201);
    expect(recorded.data.settlements).toEqual([{ fromId: me, toId: kai, amount: 2000 }]);
    expect((await call(`/${cabin}/repayment-suggestions`)).data).toEqual([]);
  });

  it('suggests nothing outgoing when nobody is owed by me', async () => {
    db.insert(accounts).values({ id: 'quiet', name: 'Quiet account', type: 'checking' }).run();
    const quiet = (
      await call('', {
        name: 'Quiet',
        currency: 'AUD',
        accountId: 'quiet',
        people: ['Me', 'Ola'],
        selfIndex: 0,
      })
    ).data.group.id;
    tx('to-ola', 'mine', -2000, 'Ola Berg');
    expect((await call(`/${quiet}/repayment-suggestions`)).data).toEqual([]);
  });
});

describe('splitting an amount that does not divide evenly', () => {
  it("doesn't always give the spare cent to the same person", async () => {
    db.insert(accounts).values({ id: 'thirds', name: 'Thirds account', type: 'checking' }).run();
    const created = (
      await call('', {
        name: 'Thirds',
        currency: 'AUD',
        accountId: 'thirds',
        people: ['Me', 'Ana', 'Bo'],
        selfIndex: 0,
      })
    ).data;
    const thirds = created.group.id;
    const ids = created.people.map((p: { id: string }) => p.id);
    const withSpare = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const state = (
        await call(`/${thirds}/events`, {
          kind: 'expense',
          date,
          description: `Pizza ${i}`,
          amount: 10000,
          payerId: ids[0],
          mode: 'equal',
          shares: ids.map((personId: string) => ({ personId, value: 1 })),
        })
      ).data;
      const event = state.events.find(
        (e: { description: string }) => e.description === `Pizza ${i}`,
      );
      const amounts = event.shares.map((s: { amount: number }) => s.amount);
      expect(amounts.reduce((a: number, b: number) => a + b, 0)).toBe(10000);
      withSpare.add(event.shares.find((s: { amount: number }) => s.amount === 3334).personId);
    }
    // 30 expenses with the spare cent always on one person has a chance of about 1 in 10^14
    expect(withSpare.size).toBeGreaterThan(1);
  });

  it('gives the same split when the same payment is shared again after it was removed', async () => {
    db.insert(accounts).values({ id: 'redo', name: 'Redo account', type: 'checking' }).run();
    const created = (
      await call('', {
        name: 'Redo',
        currency: 'AUD',
        accountId: 'redo',
        people: ['Me', 'Ana'],
        selfIndex: 0,
      })
    ).data;
    const redo = created.group.id;
    // 6001 cents split two ways: the spare cent goes to one of them, whichever ids come up
    for (let i = 0; i < 12; i++) {
      tx(`odd-${i}`, 'mine', -6001, `Odd ${i}`);
      const sharesOf = async () => {
        const state = (await call(`/${redo}/share`, { transactionIds: [`odd-${i}`] })).data;
        return state;
      };
      await sharesOf();
      const first = (await call(`/${redo}`)).data.events.find(
        (e: { transactionId: string }) => e.transactionId === `odd-${i}`,
      );
      const before = first.shares.map((s: { amount: number }) => s.amount);
      await call(`/${redo}/events/${first.id}`, undefined, 'DELETE');
      await sharesOf();
      const again = (await call(`/${redo}`)).data.events.find(
        (e: { transactionId: string }) => e.transactionId === `odd-${i}`,
      );
      expect(again.id).not.toBe(first.id);
      expect(again.shares.map((s: { amount: number }) => s.amount)).toEqual(before);
    }
  });
});
