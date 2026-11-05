import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, categories, categoryGroups, transactions } from '../db/schema.js';
import { householdsRouter } from './households.js';

// Audit F-13: every way of sharing a payment goes through sharePayments, with one result format;
// a preview runs the same checks and records nothing.

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

describe('sharing payments through one path', () => {
  it('previews who would owe what, records nothing, then shares with the same result', async () => {
    const g = (
      await call('', { name: 'Share flat', currency: 'AUD', people: ['Me', 'Pat'], selfIndex: 0 })
    ).data;
    const [me, pat] = g.people.map((p: { id: string }) => p.id);
    const preview = await call(`/${g.group.id}/share`, {
      transactionIds: ['shop', 'repaid', 'missing'],
      preview: true,
    });
    expect(preview.status).toBe(200);
    expect(preview.data.results).toEqual([
      {
        transactionId: 'shop',
        ok: true,
        eventId: null,
        amount: 6000,
        shares: expect.arrayContaining([
          { personId: me, amount: 3000 },
          { personId: pat, amount: 3000 },
        ]),
      },
      { transactionId: 'repaid', ok: false, error: 'Only a payment (money out) can be shared' },
      { transactionId: 'missing', ok: false, error: 'Transaction not found' },
    ]);
    expect((await call(`/${g.group.id}`)).data.events).toHaveLength(0);
    const shared = await call(`/${g.group.id}/share`, { transactionIds: ['shop'] });
    expect(shared.data.shared).toBe(1);
    expect(shared.data.results[0]).toMatchObject({ ok: true, amount: 6000 });
    expect(shared.data.results[0].eventId).toEqual(expect.any(String));
    // The same refusal, worded the same, whichever path asks
    const again = await call(`/${g.group.id}/share`, { transactionIds: ['shop'], preview: true });
    expect(again.data.results[0]).toEqual({
      transactionId: 'shop',
      ok: false,
      error: 'Bank payment is already linked',
    });
  });
});
