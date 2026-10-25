import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, householdEvents, rules, transactions } from '../db/schema.js';
import { householdsRouter } from './households.js';
import { accountsRouter } from './accounts.js';
import { budgetSummary } from '../services/budgetService.js';
import { insertNewTransaction } from '../services/ruleService.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';

// Several pool accounts, default splits, sharing payments in one step, repayment suggestions
// and the "share with household" rule action (docs/HOUSEHOLDS.md).

let server: Server;
let base: string;
const date = '2026-10-10';
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/households', householdsRouter);
  app.use('/api/accounts', accountsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  db.insert(accounts)
    .values([
      { id: 'bills', name: '2Up Essentials', type: 'savings' },
      { id: 'joint', name: '2Up Spending', type: 'checking' },
      { id: 'mine', name: 'Spending', type: 'checking' },
    ])
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
const blank = {
  payeeId: null,
  importedPayee: null,
  notes: null,
  categoryId: null,
  importedId: null,
};
const tx = (id: string, accountId: string, amount: number, payeeName: string, d = date) =>
  db.insert(transactions).values({ id, accountId, date: d, amount, payeeName }).run();

let groupId: string;
let me: string;
let juno: string;
let zephyr: string;

describe('pool accounts', () => {
  it('adds a second pool account, which leaves the personal budget too', async () => {
    const created = (
      await call('/households', {
        name: 'Rental',
        currency: 'AUD',
        accountId: 'bills',
        people: ['Me', 'Juno', 'Zephyr'],
        selfIndex: 0,
      })
    ).data;
    groupId = created.group.id;
    [me, juno, zephyr] = created.people.map((p: { id: string }) => p.id);
    tx('rent', 'joint', -478000, 'DEFT');
    const before = budgetSummary('2026-10').uncategorized;
    const added = await call(`/households/${groupId}/pool-accounts`, { accountId: 'joint' });
    expect(added.status).toBe(201);
    expect(added.data.poolAccountIds).toEqual(['bills', 'joint']);
    // The full rent paid from the joint account is no longer your uncategorised spending
    expect(budgetSummary('2026-10').uncategorized).toBe(before - 478000);
    const listed = (await call('/accounts')).data;
    expect(listed.find((a: { id: string }) => a.id === 'joint').householdPool).toBe('Rental');
    expect((await call('/households', undefined)).data[0].poolAccountIds).toEqual([
      'bills',
      'joint',
    ]);
    // An account belongs to one household; the first pool account stays
    expect(
      (await call(`/households/${groupId}/pool-accounts`, { accountId: 'joint' })).status,
    ).toBe(400);
    expect(
      (await call(`/households/${groupId}/pool-accounts/bills`, undefined, 'DELETE')).status,
    ).toBe(400);
  });

  it('survives a backup and restore', () => {
    restoreBackup(parseBackup(JSON.parse(JSON.stringify(createBackup()))));
    expect(budgetSummary('2026-10').uncategorized).toBe(0);
  });
});

describe('sharing payments', () => {
  it('saves a default split and shares payments with it in one step', async () => {
    const split = {
      mode: 'percentage',
      shares: [
        { personId: me, value: 4000 },
        { personId: juno, value: 3000 },
        { personId: zephyr, value: 3000 },
      ],
    };
    expect(
      (
        await call(
          `/households/${groupId}/default-split`,
          { ...split, shares: split.shares.slice(1) },
          'PUT',
        )
      ).status,
    ).toBe(400);
    const saved = await call(`/households/${groupId}/default-split`, split, 'PUT');
    expect(saved.data.group.defaultSplit).toEqual(split);
    tx('coles', 'mine', -9000, 'Coles');
    tx('pay', 'mine', 250000, 'Employer');
    const shared = await call(`/households/${groupId}/share`, {
      transactionIds: ['coles', 'pay', 'coles'],
    });
    expect(shared.data.results.map((r: { ok: boolean }) => r.ok)).toEqual([true, false, false]);
    expect(shared.data.results[1].error).toMatch(/money out/);
    const event = shared.data.household.events.find(
      (e: { transactionId: string }) => e.transactionId === 'coles',
    );
    expect(event).toMatchObject({
      kind: 'expense',
      amount: 9000,
      payerId: me,
      description: 'Coles',
    });
    expect(event.shares.map((s: { amount: number }) => s.amount)).toEqual([3600, 2700, 2700]);
    // Juno and Zephyr now owe their shares
    expect(shared.data.household.balances[juno]).toBe(-2700);
  });

  it('shares a pool payment as paid by the pool, once contributions cover it', async () => {
    const contribution = (id: string, payerId: string, amount: number) => {
      tx(id, 'joint', amount, 'Contribution');
      return call(`/households/${groupId}/events`, {
        kind: 'contribution',
        date,
        description: 'Rent',
        amount,
        payerId,
        transactionId: id,
      });
    };
    await contribution('c1', me, 191200);
    await contribution('c2', juno, 143400);
    await contribution('c3', zephyr, 143400);
    const shared = await call(`/households/${groupId}/share`, { transactionIds: ['rent'] });
    expect(shared.data.results[0]).toMatchObject({ ok: true });
    const rent = shared.data.household.events.find(
      (e: { transactionId: string }) => e.transactionId === 'rent',
    );
    expect(rent.payerId).toBeNull();
  });
});

describe('repayments', () => {
  it('suggests money received from someone who owes, up to what they owe', async () => {
    tx('j1', 'mine', 2700, 'JUNO BABIC');
    tx('j2', 'mine', 9999, 'Juno Babic'); // more than Juno owes
    tx('x1', 'mine', 2700, 'Someone else');
    const suggestions = (await call(`/households/${groupId}/repayment-suggestions`)).data;
    expect(suggestions).toEqual([
      expect.objectContaining({
        transactionId: 'j1',
        personId: juno,
        personName: 'Juno',
        owes: 2700,
      }),
    ]);
    const settled = await call(`/households/${groupId}/events`, {
      kind: 'settlement',
      date,
      description: 'Repayment',
      amount: 2700,
      payerId: juno,
      recipientId: me,
      transactionId: 'j1',
    });
    expect(settled.status).toBe(201);
    expect((await call(`/households/${groupId}/repayment-suggestions`)).data).toEqual([]);
  });
});

describe('the share rule action', () => {
  it('shares new matching payments with the default split, and never fails an import', () => {
    db.insert(rules)
      .values({
        id: 'share-woolies',
        conditions: JSON.stringify([{ field: 'payee_name', op: 'contains', value: 'Woolworths' }]),
        actions: JSON.stringify([{ type: 'share_with_household', value: groupId }]),
      })
      .run();
    const { transaction } = insertNewTransaction({
      ...blank,
      accountId: 'mine',
      date,
      amount: -5000,
      payeeName: 'Woolworths',
    });
    const event = db
      .select()
      .from(householdEvents)
      .where(eq(householdEvents.transactionId, transaction.id))
      .get();
    expect(event).toMatchObject({ kind: 'expense', amount: 5000 });
    // Money in isn't shared, and an import of a refund still succeeds
    const refund = insertNewTransaction({
      ...blank,
      accountId: 'mine',
      date,
      amount: 5000,
      payeeName: 'Woolworths',
    });
    expect(
      db
        .select()
        .from(householdEvents)
        .where(eq(householdEvents.transactionId, refund.transaction.id))
        .get(),
    ).toBeUndefined();
  });
});
