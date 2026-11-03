import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { format } from 'date-fns';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, categoryGroups, transactions } from '../db/schema.js';
import { accountsRouter } from './accounts.js';
import { transactionsRouter } from './transactions.js';
import { budgetRouter } from './budget.js';
import { paymentPlansRouter } from './paymentPlans.js';

// The envelope side of an Afterpay purchase (docs/PAYMENT-PLANS.md, docs/CARD-PAYMENTS.md):
// a funded purchase moves its envelope's cash into the Afterpay payment envelope, each payment
// uses it up, and Ready to Assign never changes. Its own file: its own database.

let server: Server;
let base: string;
const today = format(new Date(), 'yyyy-MM-dd');
const month = today.slice(0, 7);

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/budget', budgetRouter);
  app.use('/api/payment-plans', paymentPlansRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  db.insert(categoryGroups).values({ id: 'g-home', name: 'Home', isIncome: 0 }).run();
  db.insert(categories).values({ id: 'c-home', groupId: 'g-home', name: 'Home improvement' }).run();
});
afterAll(() => server.close());

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

type Category = { id: string; name: string; balance: number; activity: number };
async function envelopes() {
  const groups = (await call('GET', `/budget/${month}`)).body as { categories: Category[] }[];
  const all = groups.flatMap((g) => g.categories);
  return {
    home: all.find((c) => c.id === 'c-home')!,
    payment: all.find((c) => c.name === 'Afterpay payment')!,
  };
}
const unassigned = async () =>
  (await call('GET', `/budget/${month}/summary`)).body.toBeBudgeted as number;

describe('envelopes for an Afterpay purchase', () => {
  it('moves the funded purchase into the payment envelope and spends it as you pay', async () => {
    const up = (
      await call('POST', '/accounts', { name: 'Up', type: 'checking', startingBalance: 100_000 })
    ).body.id as string;
    const afterpay = (await call('POST', '/payment-plans/account', {})).body.account.id as string;
    const assign = await call('PUT', `/budget/${month}/c-home`, { budgeted: 20_000 });
    expect(assign.status).toBeLessThan(300);
    const before = await unassigned();
    expect(before).toBe(80_000);

    const plan = (
      await call('POST', '/payment-plans', {
        accountId: afterpay,
        fundingAccountId: up,
        merchant: 'Bunnings',
        purchaseDate: today,
        total: 20_000,
        categoryId: 'c-home',
        instalmentCount: 4,
        firstDueDate: today,
      })
    ).body;
    let { home, payment } = await envelopes();
    // The drill is Home improvement activity; its cash now waits to pay Afterpay
    expect(home.activity).toBe(-20_000);
    expect(home.balance).toBe(0);
    expect(payment.balance).toBe(20_000);

    await call('POST', '/transactions/import/confirm', {
      accountId: up,
      rows: [{ date: today, amount: -5_000, payeeName: 'AFTERPAY', importedId: 'mock-1' }],
    });
    const debit = db
      .select()
      .from(transactions)
      .where(eq(transactions.importedId, 'mock-1'))
      .get()!;
    const linked = await call('POST', `/payment-plans/${plan.id}/link`, {
      transactionId: debit.id,
    });
    expect(linked.status).toBe(200);
    ({ home, payment } = await envelopes());
    expect(home.balance).toBe(0);
    expect(payment.balance).toBe(15_000);
    expect(await unassigned()).toBe(before);
  });
});
