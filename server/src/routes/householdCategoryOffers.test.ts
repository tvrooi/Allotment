import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, categories, categoryGroups, payees, transactions } from '../db/schema.js';
import { householdsRouter } from './households.js';

// Audit decision I-8: a repayment to you is offered a category from what the repayer owed you
// for. Only an offer: the household ledger and the deposit stay as they are.

let server: Server;
let base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/households', householdsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/households`;
  db.insert(accounts).values({ id: 'mine', name: 'Spending', type: 'checking' }).run();
  db.insert(categoryGroups).values({ id: 'g', name: 'Everyday', isIncome: 0 }).run();
  db.insert(categories)
    .values([
      { id: 'groceries', groupId: 'g', name: 'Groceries' },
      { id: 'power', groupId: 'g', name: 'Electricity & Gas' },
    ])
    .run();
  const tx = (id: string, date: string, amount: number, categoryId: string | null) =>
    db
      .insert(transactions)
      .values({ id, accountId: 'mine', date, amount, payeeName: id, categoryId })
      .run();
  tx('shop', '2026-10-01', -6000, 'groceries');
  tx('bill', '2026-10-02', -2000, 'power');
  tx('repaid', '2026-10-05', 4000, null);
});
afterAll(() => server.close());

async function call(path: string, body?: unknown) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

describe('categorising a repayment back to what it paid for', () => {
  it('offers the categories the repayer owed you for, largest first, until it has one', async () => {
    const g = (
      await call('', { name: 'Flat', currency: 'AUD', people: ['Me', 'Pat'], selfIndex: 0 })
    ).data;
    const [me, pat] = g.people.map((p: { id: string }) => p.id);
    const equal = [
      { personId: me, value: 1 },
      { personId: pat, value: 1 },
    ];
    for (const [transactionId, amount, date] of [
      ['shop', 6000, '2026-10-01'],
      ['bill', 2000, '2026-10-02'],
    ] as const)
      expect(
        (
          await call(`/${g.group.id}/events`, {
            kind: 'expense',
            date,
            description: transactionId,
            amount,
            payerId: me,
            transactionId,
            mode: 'weight',
            shares: equal,
          })
        ).status,
      ).toBe(201);
    expect((await call(`/${g.group.id}/category-offers`)).data).toEqual([]);
    const repaid = await call(`/${g.group.id}/events`, {
      kind: 'settlement',
      date: '2026-10-05',
      description: 'Repayment from Pat',
      amount: 4000,
      payerId: pat,
      recipientId: me,
      transactionId: 'repaid',
    });
    expect(repaid.status).toBe(201);
    const offers = (await call(`/${g.group.id}/category-offers`)).data;
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ transactionId: 'repaid', amount: 4000, payerId: pat });
    expect(offers[0].candidates).toEqual([
      { categoryId: 'groceries', name: 'Groceries', amount: 3000 },
      { categoryId: 'power', name: 'Electricity & Gas', amount: 1000 },
    ]);
    // Nothing was changed by offering
    expect(
      db.select().from(transactions).where(eq(transactions.id, 'repaid')).get()?.categoryId,
    ).toBeNull();
    // Once the owner categorises the deposit, the offer goes
    db.update(transactions)
      .set({ categoryId: 'groceries' })
      .where(eq(transactions.id, 'repaid'))
      .run();
    expect((await call(`/${g.group.id}/category-offers`)).data).toEqual([]);
    expect((await call('/missing/category-offers')).status).toBeGreaterThanOrEqual(400);
  });
});

describe('categorising your repayment to someone back to what you owed them for', () => {
  it('offers the categories of your shares of what they paid, from the payees they name', async () => {
    db.insert(categories).values({ id: 'dining', groupId: 'g', name: 'Restaurants' }).run();
    db.insert(payees)
      .values([
        // A default category wins
        { id: 'cafe', name: 'Corner Cafe', defaultCategoryId: 'dining' },
        // Otherwise the category you use most for that payee
        { id: 'bakery', name: 'Bakery' },
      ])
      .run();
    const mine = (id: string, payeeId: string, categoryId: string) =>
      db
        .insert(transactions)
        .values({ id, accountId: 'mine', date: '2026-09-01', amount: -500, payeeId, categoryId })
        .run();
    mine('b1', 'bakery', 'groceries');
    mine('b2', 'bakery', 'groceries');
    mine('b3', 'bakery', 'power');
    db.insert(transactions)
      .values({
        id: 'to-sam',
        accountId: 'mine',
        date: '2026-10-20',
        amount: -3500,
        payeeName: 'Sam',
      })
      .run();
    const g = (
      await call('', { name: 'Friends', currency: 'AUD', people: ['Me', 'Sam'], selfIndex: 0 })
    ).data;
    const [me, sam] = g.people.map((p: { id: string }) => p.id);
    const half = [
      { personId: me, value: 1 },
      { personId: sam, value: 1 },
    ];
    // Sam paid these, so none has a bank payment of yours
    for (const [description, amount] of [
      ['corner cafe', 4000],
      ['Bakery', 2000],
      ['Somewhere unknown', 9000],
    ] as const)
      expect(
        (
          await call(`/${g.group.id}/events`, {
            kind: 'expense',
            date: '2026-10-10',
            description,
            amount,
            payerId: sam,
            mode: 'weight',
            shares: half,
          })
        ).status,
      ).toBe(201);
    const repaid = await call(`/${g.group.id}/events`, {
      kind: 'settlement',
      date: '2026-10-20',
      description: 'Paid Sam back',
      amount: 3500,
      payerId: me,
      recipientId: sam,
      transactionId: 'to-sam',
    });
    expect(repaid.status).toBe(201);
    const offers = (await call(`/${g.group.id}/category-offers`)).data;
    expect(offers).toEqual([
      expect.objectContaining({
        transactionId: 'to-sam',
        amount: 3500,
        direction: 'from_you',
        payerId: me,
        personId: sam,
        candidates: [
          { categoryId: 'dining', name: 'Restaurants', amount: 2000 },
          { categoryId: 'groceries', name: 'Groceries', amount: 1000 },
        ],
      }),
    ]);
    db.update(transactions)
      .set({ categoryId: 'dining' })
      .where(eq(transactions.id, 'to-sam'))
      .run();
    expect((await call(`/${g.group.id}/category-offers`)).data).toEqual([]);
  });
});
