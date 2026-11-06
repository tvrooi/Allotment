import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  budgetSettings,
  payees,
  transactions,
  transferMatchDismissals,
  upAccountMappings,
  upConnections,
  upDeletedImports,
} from '../db/schema.js';
import { upRouter } from './up.js';
import { transactionsRouter } from './transactions.js';
import { syncUp } from '../services/upSyncService.js';
import { startUpMock, upMockTransaction, UP_TEST_TOKEN } from '../test/upMock.js';

// Up's Saver transfers (HANDOVER open item 6, plan B8): Up names the other account of a transfer
// but not the other transaction. Sync never links them; the suggestions offer the pair Up
// reported, marked as such, and the owner links it.

let mock: Awaited<ReturnType<typeof startUpMock>>;
let server: Server;
let base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  mock = await startUpMock();
  process.env.FLYBUDGET_UP_API = mock.base;
  const app = express();
  app.use(express.json());
  app.use('/up', upRouter);
  app.use('/transactions', transactionsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await mock.close();
  server.close();
  delete process.env.FLYBUDGET_UP_API;
});
beforeEach(() => {
  for (const table of [
    upConnections,
    upAccountMappings,
    upDeletedImports,
    transferMatchDismissals,
    transactions,
    payees,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
});

const call = (path: string, data?: unknown) =>
  fetch(base + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });

/** One side of an Up transfer, dated `day` of October 2026, naming `other` as the other account */
function upTransfer(id: string, account: string, amount: number, day: number, other: string) {
  const row = upMockTransaction(id, amount, 'SETTLED', account);
  const at = `2026-10-${String(day).padStart(2, '0')}T09:00:00+10:00`;
  row.attributes = { ...row.attributes, description: 'Transfer', createdAt: at, settledAt: at };
  return {
    ...row,
    relationships: { ...row.relationships, transferAccount: { data: { id: other } } },
  };
}

async function connect(saverSide: number) {
  mock.setMode('normal');
  mock.setHistory('spending', [upTransfer('to-saver', 'spending', -25_000, 1, 'saver')]);
  mock.setHistory('saver', [upTransfer('from-spending', 'saver', 25_000, saverSide, 'spending')]);
  expect((await call('/up/setup', { accessToken: UP_TEST_TOKEN })).ok).toBe(true);
  const mapped = await call('/up/map-accounts', {
    mappings: ['spending', 'saver'].map((upAccountId) => ({ upAccountId, action: 'create' })),
  });
  expect(mapped.ok).toBe(true);
  expect((await syncUp()).errors).toEqual([]);
  // A manual account with the same amount arriving the same day: closer than the Saver side
  db.insert(accounts).values({ id: 'card', name: 'Card', type: 'credit_card' }).run();
  db.insert(transactions)
    .values({
      id: 'decoy',
      accountId: 'card',
      date: '2026-10-01',
      amount: 25_000,
      payeeName: 'Pay',
    })
    .run();
  const local = (up: string) =>
    db.select().from(upAccountMappings).where(eq(upAccountMappings.upAccountId, up)).get()!
      .accountId!;
  return { spending: local('spending'), saver: local('saver') };
}

type Suggestion = {
  outflow: { id: string; accountId: string };
  inflow: { id: string; accountId: string };
  reported: boolean;
};
const suggestions = async () =>
  (await (await call('/transactions/transfers/suggestions')).json()) as Suggestion[];

describe('transfers Up reported', () => {
  it('are suggested between the accounts Up named, marked, and linked only by the owner', async () => {
    const { spending, saver } = await connect(3);
    // The sync linked nothing
    expect(
      db
        .select()
        .from(transactions)
        .all()
        .every((t) => !t.transferTransactionId),
    ).toBe(true);

    const list = await suggestions();
    expect(list).toHaveLength(1);
    expect(list[0].outflow.accountId).toBe(spending);
    expect(list[0].inflow.accountId).toBe(saver);
    expect(list[0].reported).toBe(true);
    expect(list.some((s) => s.inflow.id === 'decoy')).toBe(false);

    const linked = await call('/transactions/transfers/link', {
      transactionId: list[0].outflow.id,
      otherTransactionId: list[0].inflow.id,
    });
    expect(linked.ok).toBe(true);
    const out = db.select().from(transactions).where(eq(transactions.id, list[0].outflow.id)).get();
    expect(out?.transferTransactionId).toBe(list[0].inflow.id);
    expect(await suggestions()).toEqual([]);
  });

  it('never pair Up’s side with a row in another account, even with no other match', async () => {
    // The Saver side is outside the matching window, so only the decoy has the amount nearby
    await connect(20);
    expect(await suggestions()).toEqual([]);
  });

  it('are not marked when neither side came from Up', async () => {
    db.insert(accounts)
      .values([
        { id: 'a', name: 'A', type: 'checking' },
        { id: 'b', name: 'B', type: 'savings' },
      ])
      .run();
    db.insert(transactions)
      .values([
        { id: 'x', accountId: 'a', date: '2026-10-01', amount: -500, payeeName: 'Move' },
        { id: 'y', accountId: 'b', date: '2026-10-01', amount: 500, payeeName: 'Move' },
      ])
      .run();
    const list = await suggestions();
    expect(list.map((s) => [s.outflow.id, s.inflow.id, s.reported])).toEqual([['x', 'y', false]]);
  });
});
