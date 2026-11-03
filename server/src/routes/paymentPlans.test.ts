import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { addDays, format } from 'date-fns';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, categoryGroups, transactions } from '../db/schema.js';
import { accountsRouter } from './accounts.js';
import { transactionsRouter } from './transactions.js';
import { budgetRouter } from './budget.js';
import { reportsRouter } from './reports.js';
import { paymentPlansRouter } from './paymentPlans.js';
import { dueDate, instalmentAmounts } from '../services/paymentPlanService.js';

// Buy now, pay later (docs/PAYMENT-PLANS.md): a drill bought with Afterpay is Home improvement
// spending, and the fortnightly payments from the bank are transfers that pay it off. Its own
// file, so the database holds only this test's data. Mock bank rows only.

let server: Server;
let base: string;

const today = format(new Date(), 'yyyy-MM-dd');
const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd');
const month = today.slice(0, 7);

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/budget', budgetRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/payment-plans', paymentPlansRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  db.insert(categoryGroups).values({ id: 'g-home', name: 'Home', isIncome: 0 }).run();
  db.insert(categoryGroups).values({ id: 'g-income', name: 'Income', isIncome: 1 }).run();
  db.insert(categories).values({ id: 'c-home', groupId: 'g-home', name: 'Home improvement' }).run();
  db.insert(categories).values({ id: 'c-bnpl', groupId: 'g-home', name: 'Afterpay / Zip' }).run();
  db.insert(categories).values({ id: 'c-fees', groupId: 'g-home', name: 'Bank Fees' }).run();
  db.insert(categories).values({ id: 'c-pay', groupId: 'g-income', name: 'Pay' }).run();
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

let n = 0;
async function bankAccount(name: string) {
  const { body } = await call('POST', '/accounts', { name, type: 'checking', startingBalance: 0 });
  return body.id as string;
}
async function imported(accountId: string, date: string, amount: number, payeeName: string) {
  const importedId = `mock-up-${n++}`;
  await call('POST', '/transactions/import/confirm', {
    accountId,
    rows: [{ date, amount, payeeName, importedId }],
  });
  const row = db.select().from(transactions).where(eq(transactions.importedId, importedId)).get()!;
  db.update(transactions).set({ categoryId: 'c-bnpl' }).where(eq(transactions.id, row.id)).run();
  return row.id;
}
const row = (id: string) => db.select().from(transactions).where(eq(transactions.id, id)).get()!;
const balance = async (id: string) =>
  ((await call('GET', '/accounts')).body as { id: string; balance: number }[]).find(
    (a) => a.id === id,
  )!.balance;
type Match = {
  planId: string;
  instalmentIds: string[];
  seqs: number[];
  transaction: { id: string };
};
const matches = async () => (await call('GET', '/payment-plans/matches')).body as Match[];

describe('instalment arithmetic', () => {
  it('puts the odd cents on the first instalment', () => {
    expect(instalmentAmounts(20_001, 4)).toEqual([5_001, 5_000, 5_000, 5_000]);
    expect(instalmentAmounts(20_000, 4)).toEqual([5_000, 5_000, 5_000, 5_000]);
  });
  it('keeps payments already made and shares the rest', () => {
    expect(instalmentAmounts(20_000, 4, [5_003])).toEqual([5_003, 4_999, 4_999, 4_999]);
    expect(() => instalmentAmounts(10_000, 2, [6_000, 5_000])).toThrow(/more than/);
    expect(() => instalmentAmounts(10_000, 1, [6_000])).toThrow(/add an instalment/);
  });
  it('steps due dates by week, fortnight or month', () => {
    expect(dueDate('2026-10-31', 'fortnightly', 3)).toBe('2026-12-12');
    expect(dueDate('2026-10-31', 'weekly', 1)).toBe('2026-11-07');
    expect(dueDate('2027-01-31', 'monthly', 1)).toBe('2027-02-28');
  });
});

describe('an Afterpay purchase', () => {
  let up: string;
  let afterpay: string;
  let planId: string;

  it('creates an Afterpay account with payment funding', async () => {
    up = await bankAccount('Up Spending');
    const res = await call('POST', '/payment-plans/account', { provider: 'afterpay' });
    expect(res.status).toBe(201);
    expect(res.body.account).toMatchObject({ name: 'Afterpay', type: 'credit', isOffBudget: 0 });
    expect(res.body.paymentFunding).toEqual({ ok: true });
    afterpay = res.body.account.id;
  });

  it('records the drill as Home improvement on the Afterpay account', async () => {
    const res = await call('POST', '/payment-plans', {
      accountId: afterpay,
      fundingAccountId: up,
      provider: 'afterpay',
      merchant: 'Bunnings',
      purchaseDate: today,
      total: 20_000,
      categoryId: 'c-home',
      instalmentCount: 4,
      frequency: 'fortnightly',
      firstDueDate: today,
    });
    expect(res.status).toBe(201);
    planId = res.body.id;
    expect(res.body).toMatchObject({
      merchant: 'Bunnings',
      paidCount: 0,
      remaining: 20_000,
      status: 'active',
      purchase: { amount: -20_000, categoryId: 'c-home', categoryName: 'Home improvement' },
    });
    expect(res.body.instalments.map((i: { dueDate: string }) => i.dueDate)).toEqual([
      today,
      day(14),
      day(28),
      day(42),
    ]);
    expect(await balance(afterpay)).toBe(-20_000);
  });

  it('suggests the Up debit as payment 1 of 4 and links it only when confirmed', async () => {
    const debit = await imported(up, today, -5_000, 'AFTERPAY');
    // Not Afterpay, and not the amount: never suggested
    await imported(up, today, -5_000, 'WOOLWORTHS');
    await imported(up, today, -4_000, 'AFTERPAY');
    const found = await matches();
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ planId, seqs: [1], transaction: { id: debit } });
    // Suggested, not linked
    expect(row(debit).transferTransactionId).toBeNull();

    const res = await call('POST', `/payment-plans/${planId}/link`, { transactionId: debit });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ paidCount: 1, remaining: 15_000 });
    const linked = row(debit);
    expect(linked.transferTransactionId).not.toBeNull();
    expect(linked.categoryId).toBeNull();
    expect(row(linked.transferTransactionId!)).toMatchObject({
      accountId: afterpay,
      amount: 5_000,
      notes: 'Bunnings: payment 1 of 4',
    });
    expect(await balance(afterpay)).toBe(-15_000);
    expect(await matches()).toHaveLength(0);
  });

  it('reports the drill as Home improvement and the payment as no spending', async () => {
    const res = await call('GET', `/reports/spending-by-category?from=${month}&to=${month}`);
    const spent = res.body as { categoryId: string; totalSpent: number }[];
    expect(spent.find((s) => s.categoryId === 'c-home')?.totalSpent).toBe(20_000);
    // Only the unrelated mock rows are left in Afterpay / Zip; the linked payment isn't spending
    expect(spent.find((s) => s.categoryId === 'c-bnpl')?.totalSpent).toBe(9_000);
  });

  it('shows what is still due under the Afterpay payment envelope', async () => {
    const res = await call('GET', `/budget/${month}`);
    const cats = (
      res.body as {
        categories: { name: string; expectedItems: { name: string; date: string }[] }[];
      }[]
    ).flatMap((g) => g.categories);
    const payment = cats.find((c) => c.name === 'Afterpay payment')!;
    expect(payment).toBeDefined();
    const due = [day(14), day(28), day(42)].filter((d) => d.slice(0, 7) === month);
    expect(payment.expectedItems.map((i) => i.date)).toEqual(due);
    if (due.length) expect(payment.expectedItems[0].name).toBe('Bunnings (2 of 4)');
  });

  it('puts a payment back exactly as it was when unlinked', async () => {
    const plan = (await call('GET', `/payment-plans/${planId}`)).body;
    const first = plan.instalments[0];
    const debit = row(first.transactionId).transferTransactionId!;
    const res = await call('POST', `/payment-plans/${planId}/instalments/${first.id}/unlink`);
    expect(res.body).toMatchObject({ paidCount: 0, remaining: 20_000 });
    expect(row(debit)).toMatchObject({
      transferTransactionId: null,
      categoryId: 'c-bnpl',
      payeeName: 'AFTERPAY',
    });
    expect(row(first.transactionId)).toBeUndefined();
    expect(await balance(afterpay)).toBe(-20_000);
    // Relink for the next steps
    await call('POST', `/payment-plans/${planId}/link`, { transactionId: debit });
  });

  it('links one debit for the next two instalments when paying ahead', async () => {
    const ahead = await imported(up, today, -10_000, 'AFTERPAY');
    const found = await matches();
    expect(found.find((m) => m.transaction.id === ahead)?.seqs).toEqual([2, 3]);
    const res = await call('POST', `/payment-plans/${planId}/link`, { transactionId: ahead });
    expect(res.body).toMatchObject({ paidCount: 3, remaining: 5_000, status: 'active' });
    expect(row(row(ahead).transferTransactionId!).notes).toBe('Bunnings: payments 2–3 of 4');
  });

  it('never suggests a payment again after "Not this payment"', async () => {
    const other = (
      await call('POST', '/payment-plans', {
        accountId: afterpay,
        fundingAccountId: up,
        merchant: 'JB Hi-Fi',
        purchaseDate: day(-1),
        total: 7_000,
        categoryId: 'c-home',
        instalmentCount: 1,
        firstDueDate: day(-1),
      })
    ).body;
    const debit = await imported(up, today, -7_000, 'Afterpay Pty Ltd');
    const match = (await matches()).find((m) => m.transaction.id === debit)!;
    expect(match).toMatchObject({ planId: other.id, seqs: [1] });
    const res = await call('POST', '/payment-plans/dismiss', {
      instalmentId: match.instalmentIds[0],
      transactionId: debit,
    });
    expect(res.status).toBe(204);
    expect((await matches()).find((m) => m.transaction.id === debit)).toBeUndefined();
    expect((await call('DELETE', `/payment-plans/${other.id}`)).status).toBe(204);
  });

  it('refuses a payment that does not add up to what is due', async () => {
    const debit = await imported(up, today, -4_999, 'AFTERPAY');
    const res = await call('POST', `/payment-plans/${planId}/link`, { transactionId: debit });
    expect(res.status).toBe(400);
    expect(row(debit).transferTransactionId).toBeNull();
  });

  it('shrinks the last instalments for a refund and adds a late fee to the next', async () => {
    let res = await call('POST', `/payment-plans/${planId}/fee`, {
      date: today,
      amount: 1_000,
      categoryId: 'c-fees',
    });
    expect(res.body).toMatchObject({ remaining: 6_000 });
    res = await call('POST', `/payment-plans/${planId}/refund`, { date: today, amount: 2_500 });
    expect(res.body.instalments.map((i: { amount: number }) => i.amount)).toEqual([
      5_000, 5_000, 5_000, 3_500,
    ]);
    expect(res.body.remaining).toBe(3_500);
    expect(res.body.extraTransactionIds).toHaveLength(2);
    const [fee, refund] = res.body.extraTransactionIds.map(row);
    expect(fee).toMatchObject({ amount: -1_000, categoryId: 'c-fees', payeeName: 'Afterpay' });
    // The refund counts against what was bought
    expect(refund).toMatchObject({ amount: 2_500, categoryId: 'c-home', accountId: afterpay });
    expect(await balance(afterpay)).toBe(-20_000 + 15_000 - 1_000 + 2_500);
  });

  it('removes the plan and everything it added, leaving the bank rows', async () => {
    const plan = (await call('GET', `/payment-plans/${planId}`)).body;
    const bankRows = plan.instalments
      .filter((i: { transactionId: string | null }) => i.transactionId)
      .map((i: { transactionId: string }) => row(i.transactionId).transferTransactionId);
    const res = await call('DELETE', `/payment-plans/${planId}`);
    expect(res.status).toBe(204);
    expect(row(plan.purchase.id)).toBeUndefined();
    for (const id of plan.extraTransactionIds) expect(row(id)).toBeUndefined();
    for (const id of bankRows) {
      expect(row(id)).toMatchObject({ transferTransactionId: null, categoryId: 'c-bnpl' });
    }
    expect(await balance(afterpay)).toBe(0);
    expect((await call('GET', '/payment-plans')).body).toEqual([]);
  });

  it('refuses a payment envelope or income as the purchase category', async () => {
    const plan = (await call('GET', `/budget/${month}`)).body as {
      categories: { id: string; name: string }[];
    }[];
    const paymentCategory = plan
      .flatMap((g) => g.categories)
      .find((c) => c.name === 'Afterpay payment')!.id;
    for (const categoryId of [paymentCategory, 'c-pay']) {
      const res = await call('POST', '/payment-plans', {
        accountId: afterpay,
        fundingAccountId: up,
        merchant: 'JB Hi-Fi',
        purchaseDate: today,
        total: 10_000,
        categoryId,
        instalmentCount: 4,
        firstDueDate: today,
      });
      expect(res.status).toBe(400);
    }
    // On a bank account, not a credit account
    const res = await call('POST', '/payment-plans', {
      accountId: up,
      fundingAccountId: afterpay,
      merchant: 'JB Hi-Fi',
      purchaseDate: today,
      total: 10_000,
      instalmentCount: 4,
      firstDueDate: today,
    });
    expect(res.status).toBe(400);
  });
});

describe('earlier Afterpay purchases', () => {
  it('groups past payments into plans and records each as its purchase', async () => {
    const up = await bankAccount('Up Earlier');
    const afterpay = (await call('POST', '/payment-plans/account', { name: 'Afterpay Earlier' }))
      .body.account.id as string;
    // A finished plan (odd cent on the first), and one still being paid
    const done = [
      await imported(up, day(-120), -5_001, 'AFTERPAY'),
      await imported(up, day(-106), -5_000, 'AFTERPAY'),
      await imported(up, day(-92), -5_000, 'AFTERPAY'),
      await imported(up, day(-78), -5_000, 'AFTERPAY'),
    ];
    const going = [
      await imported(up, day(-15), -3_000, 'AFTERPAY'),
      await imported(up, day(-1), -3_000, 'AFTERPAY'),
    ];
    // A reconciled Afterpay row is locked: counted, never grouped
    const locked = await imported(up, day(-60), -2_000, 'AFTERPAY');
    db.update(transactions).set({ reconciled: 1 }).where(eq(transactions.id, locked)).run();

    const res = await call('GET', '/payment-plans/history?provider=afterpay&months=12');
    const { groups, lockedCount } = res.body as {
      groups: {
        accountId: string;
        transactions: { id: string }[];
        suggested: { instalmentCount: number; total: number; firstDueDate: string };
        inProgress: boolean;
      }[];
      lockedCount: number;
    };
    const mine = groups.filter((g) => g.accountId === up);
    expect(mine).toHaveLength(2);
    expect(lockedCount).toBeGreaterThanOrEqual(1);
    const [recent, older] = mine;
    expect(older.transactions.map((t) => t.id)).toEqual(done);
    expect(older).toMatchObject({
      inProgress: false,
      suggested: { instalmentCount: 4, total: 20_001, firstDueDate: day(-120) },
    });
    expect(recent.transactions.map((t) => t.id)).toEqual(going);
    expect(recent).toMatchObject({
      inProgress: true,
      suggested: { instalmentCount: 4, total: 12_000 },
    });

    const created = await call('POST', '/payment-plans', {
      accountId: afterpay,
      fundingAccountId: up,
      merchant: 'Kmart',
      purchaseDate: day(-120),
      total: 20_001,
      categoryId: 'c-home',
      instalmentCount: 4,
      firstDueDate: day(-120),
      linkTransactionIds: done,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ paidCount: 4, remaining: 0, status: 'paid' });
    for (const id of done) expect(row(id).transferTransactionId).not.toBeNull();
    expect(await balance(afterpay)).toBe(0);

    const ongoing = await call('POST', '/payment-plans', {
      accountId: afterpay,
      fundingAccountId: up,
      merchant: 'Rebel',
      purchaseDate: day(-15),
      total: 12_000,
      categoryId: 'c-home',
      instalmentCount: 4,
      firstDueDate: day(-15),
      linkTransactionIds: going,
    });
    expect(ongoing.body).toMatchObject({ paidCount: 2, remaining: 6_000 });
    expect(ongoing.body.nextDue).toEqual({ date: day(13), amount: 3_000 });
    expect(await balance(afterpay)).toBe(-6_000);

    // Recorded payments are no longer offered
    const after = (await call('GET', '/payment-plans/history?months=12')).body.groups as {
      accountId: string;
    }[];
    expect(after.filter((g) => g.accountId === up)).toHaveLength(0);

    // A reconciled payment can't be linked
    const refused = await call('POST', '/payment-plans', {
      accountId: afterpay,
      fundingAccountId: up,
      merchant: 'Myer',
      purchaseDate: day(-60),
      total: 8_000,
      instalmentCount: 4,
      firstDueDate: day(-60),
      linkTransactionIds: [locked],
    });
    expect(refused.status).toBe(403);
    expect(row(locked).transferTransactionId).toBeNull();
  });

  it('finds the plan a purchase or payment belongs to', async () => {
    const plans = (await call('GET', '/payment-plans')).body as {
      id: string;
      purchase: { id: string };
      instalments: { transactionId: string | null }[];
    }[];
    const plan = plans[0];
    expect((await call('GET', `/payment-plans/for-transaction/${plan.purchase.id}`)).body.id).toBe(
      plan.id,
    );
    const paid = plan.instalments.find((i) => i.transactionId)!.transactionId!;
    const bankSide = row(paid).transferTransactionId!;
    expect((await call('GET', `/payment-plans/for-transaction/${bankSide}`)).body.id).toBe(plan.id);
  });
});
