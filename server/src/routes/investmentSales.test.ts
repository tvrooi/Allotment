import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, budgetSettings, exchangeRates } from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';
import { lodgeYear, unlodgeYear } from '../services/depreciatingAssetService.js';
import { ratesChanged } from '../services/mainAmountService.js';
import { taxYear, taxYearCsv, taxYears } from '../services/taxService.js';
import { tokenAllows } from '../auth/accessTokens.js';
import { investmentsRouter } from './investments.js';

// D3a investment sales (docs/INVESTMENT-SALES-AND-INCOME.md §7): recording sales against lots,
// the holding and lots they change, Tax time's item 18, lodged-year locks, backups and the
// migration. Mock data only; every date is in the past.

const U = 1_000_000;
let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  db.insert(budgetSettings).values({ id: 'budget', currency: 'AUD' }).run();
  db.insert(accounts)
    .values([
      { id: 'broker', name: 'Mock broker', type: 'investment', createdAt: '2023-01-01' },
      {
        id: 'usbroker',
        name: 'Mock US broker',
        type: 'investment',
        currency: 'USD',
        createdAt: '2023-01-01',
      },
      { id: 'super', name: 'Mock super', type: 'retirement', createdAt: '2023-01-01' },
    ])
    .run();
  db.insert(exchangeRates)
    .values([
      { id: 'r1', date: '2025-01-15', base: 'USD', quote: 'AUD', rate: '1.5', source: 'manual' },
      { id: 'r2', date: '2025-09-01', base: 'USD', quote: 'AUD', rate: '1.6', source: 'manual' },
    ])
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
const overview = async () => (await send('GET', '?asOf=2026-01-20')).body;
const holdingOf = async (id: string) =>
  (await overview()).accounts.flatMap((a: any) => a.holdings).find((h: any) => h.id === id);

let mock: string;
let holding: string;
let lotA: string;
let lotB: string;
let lotC: string;
let usHolding: string;
let mainSale: string;
let earlySale: string;

async function addLot(holdingId: string, acquiredOn: string, quantity: number, cost: number) {
  const res = await send('POST', `/holdings/${holdingId}/lots`, {
    acquiredOn,
    quantity,
    costBasis: cost,
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

describe('investment sales', () => {
  it('sets up a holding of three purchases', async () => {
    mock = (
      await send('POST', '/securities', { symbol: 'MOCK', name: 'Mock fund', currency: 'AUD' })
    ).body.id;
    holding = (
      await send('POST', '/holdings', { accountId: 'broker', securityId: mock, quantity: 170 * U })
    ).body.id;
    lotA = await addLot(holding, '2023-07-01', 100 * U, 500_000);
    lotB = await addLot(holding, '2025-03-01', 50 * U, 400_000);
    lotC = await addLot(holding, '2024-01-10', 20 * U, 200_000);
  });

  it('previews a sale first in, first out, with its gain and discount', async () => {
    const res = await send('POST', `/holdings/${holding}/sales/preview`, {
      soldOn: '2025-09-01',
      quantity: 120 * U,
      proceeds: 1_210_000,
      fees: 10_000,
    });
    expect(res.status).toBe(200);
    // Oldest first: A, then C (bought before B)
    expect(res.body.parcels.map((p: any) => [p.lotId, p.quantity, p.gain, p.discountable])).toEqual(
      [
        [lotA, 100 * U, 500_000, true],
        [lotC, 20 * U, 0, true],
      ],
    );
    expect(res.body).toMatchObject({ proceeds: 1_200_000, gain: 500_000, discount: 'all' });
    // Nothing saved
    expect((await holdingOf(holding)).quantity).toBe(170 * U);
  });

  it('records sales against chosen parcels and lowers the holding', async () => {
    const early = await send('POST', `/holdings/${holding}/sales`, {
      soldOn: '2024-09-01',
      quantity: 10 * U,
      proceeds: 150_000,
      fees: 0,
      parcels: [{ lotId: lotC, quantity: 10 * U }],
    });
    expect(early.status).toBe(201);
    earlySale = early.body.id;
    const main = await send('POST', `/holdings/${holding}/sales`, {
      soldOn: '2025-09-01',
      quantity: 120 * U,
      proceeds: 1_210_000,
      fees: 10_000,
      parcels: [
        { lotId: lotA, quantity: 100 * U },
        { lotId: lotB, quantity: 20 * U },
      ],
      notes: 'Mock contract note',
    });
    expect(main.status).toBe(201);
    mainSale = main.body.id;

    const h = await holdingOf(holding);
    expect(h.quantity).toBe(40 * U);
    expect(h.lots.map((l: any) => [l.id, l.remaining])).toEqual([
      [lotA, 0],
      [lotC, 10 * U],
      [lotB, 30 * U],
    ]);
    // What's left costs B's 30 of 50 units and C's 10 of 20
    expect(h).toMatchObject({ basisStatus: 'complete', costBasis: 240_000 + 100_000 });
    expect(h.sales.map((s: any) => [s.id, s.gain, s.discount])).toEqual([
      [mainSale, 540_000, 'some'],
      [earlySale, 50_000, 'none'],
    ]);
  });

  it('refuses a sale the holding or its lots cannot give', async () => {
    const other = (
      await send('POST', '/holdings', { accountId: 'super', securityId: mock, quantity: 10 * U })
    ).body.id;
    const otherLot = await addLot(other, '2024-01-01', 10 * U, 10_000);
    const try_ = (body: object) =>
      send('POST', `/holdings/${holding}/sales`, {
        soldOn: '2025-10-01',
        quantity: 5 * U,
        proceeds: 1_000,
        fees: 0,
        ...body,
      });
    expect((await try_({ quantity: 0 })).status).toBe(400);
    expect((await try_({ soldOn: '2999-01-01' })).status).toBe(400);
    expect((await try_({ quantity: 41 * U })).status).toBe(409);
    expect((await try_({ parcels: [{ lotId: otherLot, quantity: U }] })).status).toBe(400);
    expect(
      (
        await try_({
          parcels: [
            { lotId: lotB, quantity: U },
            { lotId: lotB, quantity: U },
          ],
        })
      ).status,
    ).toBe(400);
    expect(
      (await try_({ soldOn: '2025-02-01', parcels: [{ lotId: lotB, quantity: U }] })).status,
    ).toBe(400);
    expect((await try_({ parcels: [{ lotId: lotA, quantity: U }] })).status).toBe(409);
    expect((await try_({ parcels: [{ lotId: lotB, quantity: 6 * U }] })).status).toBe(400);
    expect((await try_({ extra: true })).status).toBe(400);
    expect((await holdingOf(holding)).quantity).toBe(40 * U);

    // A sale in super, left out of Tax time
    expect(
      (
        await send('POST', `/holdings/${other}/sales`, {
          soldOn: '2025-10-01',
          quantity: 5 * U,
          proceeds: 6_000,
          fees: 0,
        })
      ).status,
    ).toBe(201);
  });

  it('keeps what sales hold on to', async () => {
    expect((await send('DELETE', `/lots/${lotA}`)).status).toBe(409);
    expect((await send('PUT', `/lots/${lotB}`, { quantity: 19 * U })).status).toBe(409);
    expect((await send('PUT', `/lots/${lotB}`, { acquiredOn: '2025-09-02' })).status).toBe(409);
    expect((await send('DELETE', `/holdings/${holding}`)).status).toBe(409);
    expect((await send('PUT', `/lots/${lotB}`, { quantity: 20 * U })).status).toBe(200);
    expect((await send('PUT', `/lots/${lotB}`, { quantity: 50 * U })).status).toBe(200);
  });

  it("converts a foreign sale's cost and proceeds on their own dates", async () => {
    const usx = (
      await send('POST', '/securities', { symbol: 'USX', name: 'Mock US', currency: 'USD' })
    ).body.id;
    usHolding = (
      await send('POST', '/holdings', { accountId: 'usbroker', securityId: usx, quantity: 10 * U })
    ).body.id;
    await addLot(usHolding, '2025-01-15', 10 * U, 100_000);
    const res = await send('POST', `/holdings/${usHolding}/sales`, {
      soldOn: '2025-09-01',
      quantity: 10 * U,
      proceeds: 120_000,
      fees: 0,
    });
    expect(res.status).toBe(201);
    const [sale] = (await holdingOf(usHolding)).sales;
    expect(sale).toMatchObject({ proceeds: 192_000, cost: 150_000, gain: 42_000 });
  });

  it("puts the year's sales on Tax time as item 18", () => {
    const year = taxYear(2025).capitalGains;
    expect(year.sales.map((s) => s.id).sort()).toHaveLength(2);
    expect(year).toMatchObject({
      totalGains: 582_000,
      currentLosses: 0,
      lossesCarriedIn: 0,
      discount: 250_000,
      netGain: 332_000,
      lossesCarriedForward: 0,
      superSales: 1,
    });
    expect(year.notes.join(' ')).toMatch(/super/);
    expect(taxYear(2024).capitalGains).toMatchObject({ totalGains: 50_000, netGain: 50_000 });
    expect(taxYears('2026-01-20').map((y) => y.financialYear)).toEqual(
      expect.arrayContaining([2025, 2024]),
    );
    const { csv } = taxYearCsv(2025);
    expect(csv).toContain('Capital gains (item 18)');
    expect(csv).toContain(
      '2025-09-01,MOCK Mock fund,Mock broker,120,12000.00,6600.00,5400.00,Partly',
    );
    expect(csv).toContain('18A Net capital gain,3320.00');
  });

  it('counts net capital losses carried in from before Allotment', async () => {
    expect(
      (await send('PUT', '/carried-losses', { financialYear: 2025, amount: 100_000 })).status,
    ).toBe(204);
    // 1,000 of losses: 820 against gains with no discount, 180 against the discountable ones
    expect(taxYear(2025).capitalGains).toMatchObject({
      lossesCarriedIn: 100_000,
      lossesApplied: 100_000,
      discount: 241_000,
      netGain: 241_000,
      carriedInFromBefore: { financialYear: 2025, amount: 100_000 },
    });
    // A loss in 2024 carries into 2025 on top of them
    await send('PUT', `/holdings/${holding}/sales/${earlySale}`, {
      soldOn: '2024-09-01',
      quantity: 10 * U,
      proceeds: 50_000,
      fees: 0,
      parcels: [{ lotId: lotC, quantity: 10 * U }],
    });
    expect(taxYear(2024).capitalGains).toMatchObject({ netGain: 0, lossesCarriedForward: 50_000 });
    expect(taxYear(2025).capitalGains.lossesCarriedIn).toBe(150_000);
    await send('PUT', `/holdings/${holding}/sales/${earlySale}`, {
      soldOn: '2024-09-01',
      quantity: 10 * U,
      proceeds: 150_000,
      fees: 0,
      parcels: [{ lotId: lotC, quantity: 10 * U }],
    });
    await send('PUT', '/carried-losses', { financialYear: null, amount: 0 });
    expect(taxYear(2025).capitalGains).toMatchObject({
      netGain: 332_000,
      carriedInFromBefore: null,
    });
  });

  it("refuses a change to a lodged year's gains and allows the same change in an open year", async () => {
    lodgeYear(2025);
    const changed = await send('PUT', `/holdings/${holding}/sales/${mainSale}`, {
      soldOn: '2025-09-01',
      quantity: 110 * U,
      proceeds: 1_000_000,
      fees: 0,
    });
    expect(changed.status).toBe(409);
    expect(changed.body.error).toMatch(/2025–26, already lodged/);
    // Undone in full: the holding and its parcels are as they were
    const h = await holdingOf(holding);
    expect(h.quantity).toBe(40 * U);
    expect(h.sales[0]).toMatchObject({ quantity: 120 * U, gain: 540_000 });

    expect((await send('PUT', `/lots/${lotB}`, { costBasis: 1 })).status).toBe(409);
    expect((await send('DELETE', `/holdings/${holding}/sales/${mainSale}`)).status).toBe(409);
    expect((await send('PUT', '/carried-losses', { financialYear: 2025, amount: 1 })).status).toBe(
      409,
    );
    // A 2024 loss would carry into 2025: refused
    const loss = await send('PUT', `/holdings/${holding}/sales/${earlySale}`, {
      soldOn: '2024-09-01',
      quantity: 10 * U,
      proceeds: 50_000,
      fees: 0,
      parcels: [{ lotId: lotC, quantity: 10 * U }],
    });
    expect(loss.status).toBe(409);
    // A smaller 2024 gain changes nothing in 2025: allowed
    expect((await send('PUT', `/lots/${lotC}`, { costBasis: 220_000 })).status).toBe(200);
    expect(taxYear(2024).capitalGains.netGain).toBe(40_000);

    unlodgeYear(2025);
    expect((await send('PUT', `/lots/${lotB}`, { costBasis: 400_000 })).status).toBe(200);
  });

  it('removing a sale puts its units back exactly', async () => {
    const before = await holdingOf(holding);
    const res = await send('POST', `/holdings/${holding}/sales`, {
      soldOn: '2025-12-01',
      quantity: 15 * U,
      proceeds: 200_000,
      fees: 1_000,
    });
    expect((await holdingOf(holding)).quantity).toBe(25 * U);
    expect((await send('DELETE', `/holdings/${holding}/sales/${res.body.id}`)).status).toBe(204);
    const after = await holdingOf(holding);
    expect(after.quantity).toBe(before.quantity);
    expect(after.lots).toEqual(before.lots);
    expect(after.costBasis).toBe(before.costBasis);
  });

  it('backs sales up and restores them; an older backup restores with none', () => {
    const backup = createBackup() as any;
    expect(backup.version).toBe(31);
    expect(backup.investmentSales).toHaveLength(4);
    expect(backup.investmentSaleParcels).toHaveLength(5);
    restoreBackup(parseBackup(JSON.parse(JSON.stringify(backup))));
    expect(taxYear(2025).capitalGains.netGain).toBe(332_000);

    // A parcel from another holding's lot is refused
    const misplaced = backup.investmentSaleParcels.map((p: any) =>
      p.saleId === earlySale
        ? { ...p, lotId: backup.taxLots.find((l: any) => l.holdingId !== holding).id }
        : p,
    );
    expect(() => parseBackup({ ...backup, investmentSaleParcels: misplaced })).toThrow(/parcel/);
    expect(() =>
      parseBackup({
        ...backup,
        investmentSales: [{ ...backup.investmentSales[0], soldOn: '2025-02-30' }],
      }),
    ).toThrow(/investment sale/);

    const older = { ...backup, version: 29 };
    delete older.investmentSales;
    delete older.investmentSaleParcels;
    restoreBackup(parseBackup(JSON.parse(JSON.stringify(older))));
    expect(createBackup().investmentSales).toHaveLength(0);
    expect(taxYear(2025).capitalGains.sales).toHaveLength(0);
  });
});

describe('tokens and investment sales', () => {
  // Decision 7 (§9): organise tokens read investments (D3b), nothing writes
  it('an organise token reads investments and item 18, and writes nothing', () => {
    expect(tokenAllows('organise', 'GET', '/tax/years/2025', undefined)).toBe(true);
    expect(tokenAllows('organise', 'GET', '/investments', undefined)).toBe(true);
    for (const [method, p] of [
      ['POST', '/investments/holdings/h/sales/preview'],
      ['POST', '/investments/holdings/h/sales'],
      ['PUT', '/investments/holdings/h/sales/s'],
      ['DELETE', '/investments/holdings/h/sales/s'],
      ['PUT', '/investments/carried-losses'],
      ['PUT', '/tax/lodged/2025'],
    ] as const)
      expect(tokenAllows('organise', method, p, {}), `${method} ${p}`).toBe(false);
    expect(tokenAllows('read', 'GET', '/tax/years/2025', undefined)).toBe(false);
    expect(tokenAllows('categorise', 'GET', '/tax/years/2025', undefined)).toBe(false);
  });
});

describe('migration 0082 investment sales', () => {
  it('adds the tables to a populated 0081 database and keeps every holding and lot', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'investment-sales-'));
    fs.cpSync('src/db/migrations', folder, { recursive: true });
    const journalPath = path.join(folder, 'meta', '_journal.json');
    const full = fs.readFileSync(journalPath, 'utf8');
    const journal = JSON.parse(full);
    journal.entries = journal.entries.filter((e: { tag: string }) => e.tag < '0082');
    fs.writeFileSync(journalPath, JSON.stringify(journal));

    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const old = drizzle(sqlite);
    migrate(old, { migrationsFolder: folder });
    sqlite.exec(`
      INSERT INTO budget_settings (id, currency) VALUES ('budget', 'AUD');
      INSERT INTO accounts (id, name, type, starting_balance) VALUES ('b', 'Mock broker', 'investment', 0);
      INSERT INTO securities (id, symbol, name, currency) VALUES ('s', 'MOCK', 'Mock fund', 'AUD');
      INSERT INTO holdings (id, account_id, security_id, quantity) VALUES ('h', 'b', 's', 5000000);
      INSERT INTO tax_lots (id, holding_id, acquired_on, quantity, cost_basis) VALUES ('l', 'h', '2024-01-01', 5000000, 12345);
    `);
    const rows = () =>
      sqlite
        .prepare('SELECT * FROM holdings JOIN tax_lots ON tax_lots.holding_id = holdings.id')
        .all();
    const before = rows();

    fs.writeFileSync(journalPath, full);
    migrate(old, { migrationsFolder: folder });
    expect(rows()).toEqual(before);
    expect(
      sqlite
        .prepare(
          'SELECT capital_losses_carried_in, capital_losses_carried_in_fy FROM budget_settings',
        )
        .get(),
    ).toEqual({ capital_losses_carried_in: 0, capital_losses_carried_in_fy: null });
    sqlite
      .prepare(
        "INSERT INTO investment_sales (id, holding_id, sold_on, quantity, proceeds) VALUES ('x', 'h', '2025-01-01', 1000000, 500)",
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO investment_sale_parcels (sale_id, lot_id, quantity) VALUES ('x', 'l', 1000000)",
      )
      .run();
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO investment_sales (id, holding_id, sold_on, quantity, proceeds) VALUES ('y', 'h', '2025-01-01', 0, 500)",
        )
        .run(),
    ).toThrow(/CHECK/);
    // A second run changes nothing
    migrate(old, { migrationsFolder: folder });
    expect(sqlite.prepare('SELECT count(*) AS n FROM investment_sale_parcels').get()).toEqual({
      n: 1,
    });
    fs.rmSync(folder, { recursive: true });
  });
});
