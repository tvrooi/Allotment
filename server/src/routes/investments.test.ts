import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, budgetSettings, exchangeRates, transactions } from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { accountTransactionSum } from '../services/balances.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';
import { ratesChanged } from '../services/mainAmountService.js';
import { investmentsRouter } from './investments.js';

// P3 investments (docs/INVESTMENTS.md): manual securities, prices, holdings and lots. Mock data
// only. Dates are in the past so they're never "in the future" whenever the tests run.

const AS_OF = '2026-01-20';
let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  db.insert(budgetSettings).values({ id: 'budget', currency: 'AUD' }).run();
  db.insert(accounts)
    .values([
      {
        id: 'broker',
        name: 'Mock broker',
        type: 'investment',
        startingBalance: 100000,
        createdAt: '2025-01-01',
      },
      {
        id: 'usbroker',
        name: 'Mock US broker',
        type: 'investment',
        currency: 'USD',
        createdAt: '2025-01-01',
      },
      { id: 'everyday', name: 'Mock everyday', type: 'checking', createdAt: '2025-01-01' },
    ])
    .run();
  db.insert(transactions)
    .values({ id: 'deposit', accountId: 'broker', date: '2025-06-01', amount: 20000 })
    .run();
  db.insert(exchangeRates)
    .values({
      id: 'r1',
      date: '2026-01-15',
      base: 'USD',
      quote: 'AUD',
      rate: '1.5',
      source: 'manual',
    })
    .run();
  ratesChanged();

  const app = express();
  app.use(express.json());
  app.use('/api/investments', investmentsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/investments`;
});
afterAll(() => server.close());

const send = async <T = any>(method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
};
const overview = async () => (await send('GET', `?asOf=${AS_OF}`)).body;
const units = (n: number) => Math.round(n * 1_000_000);

let fund: string;
let usStock: string;
let holding: string;

describe('investments', () => {
  it('starts with every open investment account and nothing held', async () => {
    const o = await overview();
    expect(o.accounts.map((a: any) => a.id)).toEqual(['broker', 'usbroker']);
    expect(o.accounts[0]).toMatchObject({
      recordedBalance: 120000,
      holdingsValue: null,
      difference: null,
    });
    expect(o.totals).toMatchObject({ value: 0, unvalued: 0 });
  });

  it('adds securities, with one symbol per currency', async () => {
    const a = await send('POST', '/securities', {
      symbol: 'mock',
      name: 'Mock index fund',
      kind: 'etf',
      currency: 'aud',
    });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ symbol: 'MOCK', currency: 'AUD', kind: 'etf' });
    fund = a.body.id;
    expect(
      (await send('POST', '/securities', { symbol: 'MOCK', name: 'Again', currency: 'AUD' }))
        .status,
    ).toBe(409);
    const b = await send('POST', '/securities', {
      symbol: 'MOCK',
      name: 'Mock US share',
      kind: 'stock',
      currency: 'USD',
    });
    expect(b.status).toBe(201);
    usStock = b.body.id;
    expect(
      (await send('POST', '/securities', { symbol: 'BAD SYMBOL', name: 'x', currency: 'AUD' }))
        .status,
    ).toBe(400);
  });

  it('only puts holdings in open investment accounts, one per security', async () => {
    expect(
      (
        await send('POST', '/holdings', {
          accountId: 'everyday',
          securityId: fund,
          quantity: units(1),
        })
      ).status,
    ).toBe(400);
    const h = await send('POST', '/holdings', {
      accountId: 'broker',
      securityId: fund,
      quantity: units(10),
    });
    expect(h.status).toBe(201);
    holding = h.body.id;
    expect(
      (
        await send('POST', '/holdings', {
          accountId: 'broker',
          securityId: fund,
          quantity: units(1),
        })
      ).status,
    ).toBe(409);
  });

  it('shows a holding without a price as unvalued, never as zero', async () => {
    const o = await overview();
    const h = o.accounts[0].holdings[0];
    expect(h).toMatchObject({ value: null, accountValue: null, basisStatus: 'missing' });
    expect(o.accounts[0].holdingsValue).toBeNull();
    expect(o.totals.unvalued).toBe(1);
  });

  it('values holdings with the latest price on or before the day', async () => {
    expect(
      (await send('PUT', `/securities/${fund}/prices`, { date: '2026-01-10', price: 1500 })).status,
    ).toBe(200);
    expect(
      (await send('PUT', `/securities/${fund}/prices`, { date: '2026-01-31', price: 9999 })).status,
    ).toBe(200);
    // Replaces that day's price
    await send('PUT', `/securities/${fund}/prices`, { date: '2026-01-10', price: 1600 });
    expect(
      (await send('PUT', `/securities/${fund}/prices`, { date: '2999-01-01', price: 1 })).status,
    ).toBe(400);

    const o = await overview();
    expect(o.accounts[0].holdings[0]).toMatchObject({
      price: 1600,
      priceDate: '2026-01-10',
      value: 16000,
      priceStale: true,
    });
    expect(o.accounts[0]).toMatchObject({
      holdingsValue: 16000,
      recordedBalance: 120000,
      difference: -104000,
    });
    expect((await send('GET', `/securities/${fund}/prices`)).body.map((p: any) => p.date)).toEqual([
      '2026-01-31',
      '2026-01-10',
    ]);
  });

  it('gives a gain only once every unit has a known cost', async () => {
    const lot = await send('POST', `/holdings/${holding}/lots`, {
      acquiredOn: '2025-03-01',
      quantity: units(6),
      costBasis: 6000,
    });
    expect(lot.status).toBe(201);
    let h = (await overview()).accounts[0].holdings[0];
    expect(h).toMatchObject({ basisStatus: 'mismatch', unrealizedGain: null });

    const unknown = await send('POST', `/holdings/${holding}/lots`, {
      acquiredOn: '2025-04-01',
      quantity: units(4),
      costBasis: null,
    });
    h = (await overview()).accounts[0].holdings[0];
    expect(h).toMatchObject({ basisStatus: 'partial', knownBasis: 6000, unrealizedGain: null });

    await send('PUT', `/lots/${unknown.body.id}`, { costBasis: 4400 });
    const o = await overview();
    expect(o.accounts[0].holdings[0]).toMatchObject({
      basisStatus: 'complete',
      costBasis: 10400,
      unrealizedGain: 5600,
      gainPercent: 53.85,
    });
    expect(o.totals).toMatchObject({
      value: 16000,
      costBasis: 10400,
      unrealizedGain: 5600,
      withoutBasis: 0,
    });
  });

  it('converts another currency for the account and the totals, and leaves out what has no rate', async () => {
    await send('POST', '/holdings', {
      accountId: 'usbroker',
      securityId: usStock,
      quantity: units(2),
    });
    await send('PUT', `/securities/${usStock}/prices`, { date: '2026-01-16', price: 10000 });
    let o = await overview();
    const us = o.accounts[1];
    expect(us).toMatchObject({ currency: 'USD', holdingsValue: 20000 });
    expect(o.totals).toMatchObject({ value: 16000 + 30000, unvalued: 0, withoutBasis: 1 });

    // The USD holding in the AUD account: valued in AUD at the day's rate
    await send('POST', '/holdings', {
      accountId: 'broker',
      securityId: usStock,
      quantity: units(1),
    });
    o = await overview();
    expect(o.accounts[0].holdingsValue).toBe(16000 + 15000);

    // Before any rate: unvalued in AUD, but still valued in USD
    const early = (await send('GET', '?asOf=2026-01-16')).body;
    expect(early.accounts[1].holdingsValue).toBe(20000);
    expect(early.accounts[0].holdingsValue).toBe(16000 + 15000);
    const before = (await send('GET', '?asOf=2026-01-14')).body;
    expect(before.accounts[0].holdingsValue).toBeNull();
  });

  it('never writes to the ledger', async () => {
    expect(accountTransactionSum('broker')).toBe(20000);
    expect(db.select().from(transactions).all()).toHaveLength(1);
  });

  it("won't change a priced security's currency or delete a held one", async () => {
    expect((await send('PUT', `/securities/${fund}`, { currency: 'USD' })).status).toBe(409);
    expect(
      (await send('PUT', `/securities/${fund}`, { name: 'Renamed mock fund' })).body.name,
    ).toBe('Renamed mock fund');
    expect((await send('DELETE', `/securities/${fund}`)).status).toBe(409);
  });

  it('backs up and restores positions', async () => {
    const backup = createBackup() as any;
    expect(backup.holdings).toHaveLength(3);
    expect(backup.taxLots).toHaveLength(2);
    restoreBackup(parseBackup(JSON.parse(JSON.stringify(backup))));
    expect((await overview()).totals.costBasis).toBe(10400);
    expect(() =>
      parseBackup({ ...backup, taxLots: [{ ...backup.taxLots[0], quantity: 0 }] }),
    ).toThrow(/tax lot/);
    expect(() =>
      parseBackup({ ...backup, securities: [{ ...backup.securities[0], kind: 'nft' }] }),
    ).toThrow(/security/);
  });

  it('deletes a holding with its lots, then the security', async () => {
    expect((await send('DELETE', `/holdings/${holding}`)).status).toBe(204);
    expect(createBackup().taxLots).toHaveLength(0);
    expect((await send('DELETE', `/securities/${fund}`)).status).toBe(204);
  });
});
