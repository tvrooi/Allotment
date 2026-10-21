import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, transactions, categories, categoryGroups } from '../db/schema.js';
import { householdsRouter } from './households.js';
import { allocateShares } from '../services/householdLedger.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';
import { eq } from 'drizzle-orm';
import { budgetActivity } from '../services/balances.js';
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
    const backup = createBackup();
    const parsed = parseBackup(backup);
    expect(parsed.householdGroups.length).toBeGreaterThan(0);
    expect(parsed.householdShares.length).toBeGreaterThan(0);
    restoreBackup(parsed);
    expect(createBackup()).toMatchObject({householdGroups:backup.householdGroups,householdEvents:backup.householdEvents,householdShares:backup.householdShares,householdBills:backup.householdBills});
  });
});
