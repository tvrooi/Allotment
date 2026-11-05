import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, transactions } from '../db/schema.js';
import { householdsRouter } from './households.js';
import { exportRouter } from './export.js';
import { errorHandler } from '../middleware/security.js';
import { sharePayments } from '../services/householdService.js';

// Editing a household entry in place (SPL-03) and the activity log (SPL-04). Mock data only.

let server: Server;
let base: string;
const date = '2026-10-28';
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use((req, res, next) =>
    req.path === '/api/export/restore' ? next() : express.json()(req, res, next),
  );
  app.use('/api/households', householdsRouter);
  app.use('/api/export', exportRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  db.insert(accounts).values({ id: 'mine', name: 'Spending', type: 'checking' }).run();
});
afterAll(() => server.close());

async function call(path: string, body?: unknown, method = body !== undefined ? 'POST' : 'GET') {
  const response = await fetch(`${base}/households${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}

/** A household of Me, Ana and Bo with no household account */
async function newHousehold(name: string) {
  const created = (
    await call('', { name, currency: 'AUD', people: ['Me', 'Ana', 'Bo'], selfIndex: 0 })
  ).data;
  const [me, ana, bo] = created.people.map((p: { id: string }) => p.id);
  return { id: created.group.id as string, me, ana, bo };
}
const equal = (ids: string[]) => ids.map((personId) => ({ personId, value: 1 }));
const expense = (
  h: { me: string; ana: string; bo: string },
  amount: number,
  extra: object = {},
) => ({
  kind: 'expense',
  date,
  description: 'Groceries',
  amount,
  payerId: h.me,
  mode: 'equal',
  shares: equal([h.me, h.ana, h.bo]),
  ...extra,
});
const sumShares = (e: { shares: { amount: number }[] }) =>
  e.shares.reduce((n, s) => n + s.amount, 0);

describe('editing an entry in place (SPL-03)', () => {
  it('changes the amount and split under the same id, keeping the shares adding up', async () => {
    const h = await newHousehold('Edit split');
    const added = (await call(`/${h.id}/events`, expense(h, 9000), 'POST')).data;
    const id = added.events[0].id;
    const edited = await call(
      `/${h.id}/events/${id}`,
      expense(h, 8410, {
        description: 'Groceries and bread',
        mode: 'exact',
        shares: [
          { personId: h.me, value: 4000 },
          { personId: h.ana, value: 4410 },
        ],
      }),
      'PUT',
    );
    expect(edited.status).toBe(200);
    expect(edited.data.events).toHaveLength(1);
    const event = edited.data.events[0];
    expect(event).toMatchObject({ id, amount: 8410, description: 'Groceries and bread' });
    expect(sumShares(event)).toBe(8410);
    // Ana owes 4410 and Bo no longer takes part
    expect(edited.data.direct[h.ana]).toBe(-4410);
    expect(edited.data.direct[h.bo]).toBe(0);
  });

  it('keeps the bank link, and refuses a new date or amount for a linked entry', async () => {
    const h = await newHousehold('Edit linked');
    db.insert(transactions)
      .values({ id: 'edit-pay', accountId: 'mine', date, amount: -6000, payeeName: 'Cafe' })
      .run();
    const shared = sharePayments(h.id, ['edit-pay'], { source: 'manual' })[0];
    expect(shared.ok).toBe(true);
    const state = (await call(`/${h.id}`)).data;
    const entry = state.events[0];
    const keep = expense(h, 6000, { transactionId: 'edit-pay', description: 'Cafe lunch' });
    const ok = await call(`/${h.id}/events/${entry.id}`, keep, 'PUT');
    expect(ok.status).toBe(200);
    expect(ok.data.events[0]).toMatchObject({
      id: entry.id,
      transactionId: 'edit-pay',
      description: 'Cafe lunch',
    });
    for (const change of [{ amount: 7000 }, { date: '2026-10-27' }]) {
      const refused = await call(`/${h.id}/events/${entry.id}`, { ...keep, ...change }, 'PUT');
      expect(refused.status).toBe(400);
      expect(refused.data.error).toMatch(/linked to a bank payment/);
    }
    // A different bank payment is not a quiet way to relink it
    expect(
      (await call(`/${h.id}/events/${entry.id}`, { ...keep, transactionId: null }, 'PUT')).status,
    ).toBe(400);
  });

  it('lets an expense with a refund change its description only', async () => {
    const h = await newHousehold('Edit refund');
    const id = (await call(`/${h.id}/events`, expense(h, 3000), 'POST')).data.events[0].id;
    await call(
      `/${h.id}/events`,
      { kind: 'refund', date, description: 'Returned', reversesId: id, amount: 1000 },
      'POST',
    );
    const before = (await call(`/${h.id}`)).data;
    const renamed = await call(`/${h.id}/events/${id}`, { description: 'Party food' }, 'PUT');
    expect(renamed.status).toBe(200);
    expect(renamed.data.events.find((e: { id: string }) => e.id === id)).toMatchObject({
      description: 'Party food',
      amount: 3000,
    });
    expect(renamed.data.balances).toEqual(before.balances);
    const refused = await call(`/${h.id}/events/${id}`, expense(h, 2000), 'PUT');
    expect(refused.status).toBe(400);
    expect(refused.data.error).toMatch(/Only the description/);
  });

  it('refuses an edit that would leave a later repayment larger than what is owed', async () => {
    const h = await newHousehold('Edit settled');
    // Ana paid $90 for three: Me and Bo each owe her $30
    const id = (await call(`/${h.id}/events`, expense(h, 9000, { payerId: h.ana }), 'POST')).data
      .events[0].id;
    expect(
      (
        await call(
          `/${h.id}/events`,
          {
            kind: 'settlement',
            date,
            description: 'Repayment',
            amount: 3000,
            payerId: h.bo,
            recipientId: h.ana,
          },
          'POST',
        )
      ).status,
    ).toBe(201);
    const before = (await call(`/${h.id}`)).data;
    // Dropping Bo from the split would leave his $30 repayment with nothing behind it
    const refused = await call(
      `/${h.id}/events/${id}`,
      expense(h, 9000, { payerId: h.ana, shares: equal([h.me, h.ana]) }),
      'PUT',
    );
    expect(refused.status).toBe(400);
    expect(refused.data.error).toMatch(/larger than what is owed/);
    // Nothing changed, and nothing was logged for the refusal
    expect((await call(`/${h.id}`)).data.balances).toEqual(before.balances);
    expect((await call(`/${h.id}/activity`)).data.map((a: { kind: string }) => a.kind)).toEqual([
      'settled',
      'created',
    ]);
    // The nearest allowed edit: a change that keeps what Bo owes at least what he repaid
    const allowed = await call(
      `/${h.id}/events/${id}`,
      expense(h, 12000, { payerId: h.ana }),
      'PUT',
    );
    expect(allowed.status).toBe(200);
  });

  it('refuses a participant from another household and an unknown entry', async () => {
    const h = await newHousehold('Edit one');
    const other = await newHousehold('Edit two');
    const id = (await call(`/${h.id}/events`, expense(h, 3000), 'POST')).data.events[0].id;
    expect(
      (
        await call(
          `/${h.id}/events/${id}`,
          expense(h, 3000, { shares: equal([h.me, other.ana]) }),
          'PUT',
        )
      ).status,
    ).toBe(400);
    expect((await call(`/${h.id}/events/nope`, expense(h, 3000), 'PUT')).status).toBe(400);
    expect(
      (await call(`/${h.id}/events/${id}`, { ...expense(h, 3000), kind: 'contribution' }, 'PUT'))
        .status,
    ).toBe(400);
  });
});

describe('the household activity log (SPL-04)', () => {
  it('records adding, editing and removing, and keeps a removed entry’s line', async () => {
    const h = await newHousehold('Log');
    const id = (await call(`/${h.id}/events`, expense(h, 8410), 'POST')).data.events[0].id;
    await call(
      `/${h.id}/events/${id}`,
      expense(h, 8410, { description: 'Weekly shop', payerId: h.ana }),
      'PUT',
    );
    expect((await call(`/${h.id}/events/${id}`, undefined, 'DELETE')).status).toBe(200);
    const log = (await call(`/${h.id}/activity`)).data;
    expect(log.map((a: { kind: string }) => a.kind)).toEqual(['removed', 'edited', 'created']);
    expect(log[0]).toMatchObject({
      eventId: id,
      source: 'owner',
      summary: 'Removed “Weekly shop” ($84.10)',
    });
    expect(log[1].summary).toBe('Changed “Weekly shop” (description, payer Me to Ana)');
    expect(log[2].summary).toBe('Shared “Groceries” ($84.10)');
  });

  it('says where an automatic share came from, and logs nothing for a refused or previewed one', async () => {
    const h = await newHousehold('Log auto');
    db.insert(transactions)
      .values([
        { id: 'log-a', accountId: 'mine', date, amount: -3000, payeeName: 'Power' },
        { id: 'log-b', accountId: 'mine', date, amount: -4000, payeeName: 'Water' },
        { id: 'log-c', accountId: 'mine', date, amount: 5000, payeeName: 'Refund in' },
      ])
      .run();
    sharePayments(h.id, ['log-a'], { source: 'rule' });
    sharePayments(h.id, ['log-b'], { source: 'bill', preview: true });
    sharePayments(h.id, ['log-c'], { source: 'auto-bill' });
    const log = (await call(`/${h.id}/activity`)).data;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ kind: 'auto_shared', source: 'rule' });
  });

  it('is in the backup, and a backup from before it restores with an empty log', async () => {
    const h = await newHousehold('Log backup');
    await call(`/${h.id}/events`, expense(h, 3000), 'POST');
    const backup = await (await fetch(`${base}/export/backup`)).json();
    expect(backup.householdActivity.some((a: { groupId: string }) => a.groupId === h.id)).toBe(
      true,
    );
    expect(
      (
        await fetch(`${base}/export/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backup),
        })
      ).status,
    ).toBe(200);
    expect((await call(`/${h.id}/activity`)).data).toHaveLength(1);
    delete backup.householdActivity;
    expect(
      (
        await fetch(`${base}/export/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backup),
        })
      ).status,
    ).toBe(200);
    expect((await call(`/${h.id}/activity`)).data).toEqual([]);
  });
});
