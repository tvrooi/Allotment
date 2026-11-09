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
import { accounts, budgetSettings } from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';
import { taxYear } from '../services/taxService.js';
import { tokenAllows } from '../auth/accessTokens.js';
import { investmentsRouter } from './investments.js';

// D3c splits and consolidations (docs/INVESTMENT-SALES-AND-INCOME.md §4 and §7): a split scales
// the holding and the units of its purchases without rewriting a lot or an earlier sale's cost.
// Mock data only; every date is in the past.

const U = 1_000_000;
let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  db.insert(budgetSettings).values({ id: 'budget', currency: 'AUD' }).run();
  db.insert(accounts)
    .values({ id: 'broker', name: 'Mock broker', type: 'investment', createdAt: '2023-01-01' })
    .run();
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
const holdingOf = async (id: string) =>
  ((await send('GET', '')).body.accounts as any[])
    .flatMap((a) => a.holdings)
    .find((h: any) => h.id === id);

async function newHolding(symbol: string, quantity: number) {
  const security = (
    await send('POST', '/securities', { symbol, name: `Mock ${symbol}`, currency: 'AUD' })
  ).body.id;
  return (await send('POST', '/holdings', { accountId: 'broker', securityId: security, quantity }))
    .body.id as string;
}
async function addLot(holdingId: string, acquiredOn: string, quantity: number, cost: number) {
  const res = await send('POST', `/holdings/${holdingId}/lots`, {
    acquiredOn,
    quantity,
    costBasis: cost,
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}
const sell = (holdingId: string, soldOn: string, quantity: number, proceeds: number) =>
  send('POST', `/holdings/${holdingId}/sales`, { soldOn, quantity, proceeds, fees: 0 });
const split = (holdingId: string, effectiveOn: string, toUnits: number, fromUnits: number) =>
  send('POST', `/holdings/${holdingId}/splits`, { effectiveOn, toUnits, fromUnits });

let holding: string;
let lot: string;
let firstSale: string;
let firstSplit: string;

describe('a 2-for-1 split after a part sale', () => {
  it('sets up a lot of 100 units costing $100 and sells 40 of them for a $40 cost', async () => {
    holding = await newHolding('AAA', 100 * U);
    lot = await addLot(holding, '2024-01-01', 100 * U, 10_000);
    const res = await sell(holding, '2025-02-01', 40 * U, 8_000);
    expect(res.status).toBe(201);
    firstSale = res.body.id;
    expect((await holdingOf(holding)).quantity).toBe(60 * U);
    expect(taxYear(2024).capitalGains.sales[0]).toMatchObject({ cost: 4_000, gain: 4_000 });
  });

  it('previews the split without saving it', async () => {
    const res = await send('POST', `/holdings/${holding}/splits/preview`, {
      effectiveOn: '2025-03-01',
      toUnits: 2,
      fromUnits: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ before: 60 * U, after: 120 * U, rounded: false });
    expect(res.body.lots).toEqual([
      expect.objectContaining({ id: lot, before: 100 * U, after: 200 * U, scaled: true }),
    ]);
    const h = await holdingOf(holding);
    expect(h.quantity).toBe(60 * U);
    expect(h.splits).toEqual([]);
  });

  it('scales the unsold units and keeps the earlier sale’s cost and gain', async () => {
    const res = await split(holding, '2025-03-01', 2, 1);
    expect(res.status).toBe(201);
    firstSplit = res.body.id;
    expect(res.body).toMatchObject({ before: 60 * U, after: 120 * U, rounded: false });

    const h = await holdingOf(holding);
    expect(h.quantity).toBe(120 * U);
    expect(h.splits).toEqual([
      { id: firstSplit, effectiveOn: '2025-03-01', toUnits: 2, fromUnits: 1 },
    ]);
    // The lot is as recorded; its units today are doubled and 120 are left (200 less 2 × 40)
    expect(h.lots[0]).toMatchObject({ quantity: 100 * U, units: 200 * U, remaining: 120 * U });
    expect(h.basisStatus).toBe('complete');
    // 120 units costing the other $60
    expect(h.costBasis).toBe(6_000);
    // The sale still costs $40
    expect(taxYear(2024).capitalGains.sales[0]).toMatchObject({
      cost: 4_000,
      gain: 4_000,
      quantity: 40 * U,
    });
  });

  it('draws the right cost for a later sale', async () => {
    const res = await sell(holding, '2025-06-01', 20 * U, 5_000);
    expect(res.status).toBe(201);
    // 20 of 200 units at the sale date, of a $100 lot
    const sales = (await holdingOf(holding)).sales;
    expect(sales[0]).toMatchObject({ quantity: 20 * U, cost: 1_000, gain: 4_000 });
    const h = await holdingOf(holding);
    expect(h.quantity).toBe(100 * U);
    expect(h.lots[0].remaining).toBe(100 * U);
  });

  it('counts units in the units of the sale’s date when it is recorded after the split', async () => {
    // 10 units before the split are 20 after it: 100 left of the lot by then, 50 before the split
    const res = await sell(holding, '2025-02-15', 10 * U, 1_900);
    expect(res.status).toBe(201);
    const h = await holdingOf(holding);
    // The sale of 10 units before the split took 20 of today's
    expect(h.quantity).toBe(80 * U);
    expect(h.lots[0].remaining).toBe(80 * U);
    const sale = h.sales.find((s: any) => s.id === res.body.id);
    expect(sale).toMatchObject({ quantity: 10 * U, cost: 1_000, gain: 900 });
    // Removing it puts today's units back
    expect((await send('DELETE', `/holdings/${holding}/sales/${res.body.id}`)).status).toBe(204);
    expect((await holdingOf(holding)).quantity).toBe(100 * U);
  });

  it('refuses a sale of more units than are left, counted on its date', async () => {
    // Before the split 100 units were bought, 40 and 10 (as 20 today) sold: 50 left that day
    const res = await sell(holding, '2025-02-15', 61 * U, 1_000);
    expect(res.status).toBe(409);
    expect((await holdingOf(holding)).quantity).toBe(100 * U);
  });

  it('refuses to cut a lot below what sales took, counted after the split', async () => {
    // 40 × 2 + 20 = 100 units taken today: a lot of 50 recorded is 100 today, so 49 is too few
    expect((await send('PUT', `/lots/${lot}`, { quantity: 49 * U })).status).toBe(409);
    expect((await send('PUT', `/lots/${lot}`, { quantity: 50 * U })).status).toBe(200);
    expect((await send('PUT', `/lots/${lot}`, { quantity: 100 * U })).status).toBe(200);
  });

  it('refuses to record or remove a split that would change a sale’s units', async () => {
    const before = await split(holding, '2025-01-01', 3, 1);
    expect(before.status).toBe(409);
    expect(before.body.error).toMatch(/dated on or after 2025-01-01/);
    const removed = await send('DELETE', `/holdings/${holding}/splits/${firstSplit}`);
    expect(removed.status).toBe(409);
    expect((await holdingOf(holding)).quantity).toBe(100 * U);
    expect((await holdingOf(holding)).splits).toHaveLength(1);
  });

  it('removing the sales puts every unit back, and the split can then go', async () => {
    const sales = (await holdingOf(holding)).sales as any[];
    for (const s of sales)
      expect((await send('DELETE', `/holdings/${holding}/sales/${s.id}`)).status).toBe(204);
    expect((await holdingOf(holding)).quantity).toBe(200 * U);
    expect(sales.map((s) => s.id)).toContain(firstSale);
    expect((await send('DELETE', `/holdings/${holding}/splits/${firstSplit}`)).status).toBe(204);
    const h = await holdingOf(holding);
    expect(h.quantity).toBe(100 * U);
    expect(h.splits).toEqual([]);
    expect(h.lots[0]).toMatchObject({ quantity: 100 * U, units: 100 * U, remaining: 100 * U });
  });
});

describe('what a split does not touch', () => {
  it('leaves a lot bought on or after the split date as recorded', async () => {
    const h = await newHolding('BBB', 50 * U);
    const early = await addLot(h, '2025-01-01', 20 * U, 2_000);
    const onDate = await addLot(h, '2025-03-01', 30 * U, 3_000);
    const res = await split(h, '2025-03-01', 4, 1);
    expect(res.status).toBe(201);
    // The holding keeps the units held now; the split multiplies them all
    const holdingNow = await holdingOf(h);
    expect(holdingNow.quantity).toBe(200 * U);
    const byId = new Map(holdingNow.lots.map((l: any) => [l.id, l]));
    expect(byId.get(early)).toMatchObject({ quantity: 20 * U, units: 80 * U });
    expect(byId.get(onDate)).toMatchObject({ quantity: 30 * U, units: 30 * U });
    // Lots no longer add up to the holding: shown as a mismatch prompt, not blocked
    expect(holdingNow.basisStatus).toBe('mismatch');
  });

  it('refuses a bad ratio or date', async () => {
    const h = await newHolding('CCC', 10 * U);
    expect((await split(h, '2025-03-01', 1, 1)).status).toBe(400);
    expect((await split(h, '2025-03-01', 0, 1)).status).toBe(400);
    expect((await split(h, '2025-03-01', 1.5, 1)).status).toBe(400);
    expect((await split(h, '2025-03-01', 100_001, 1)).status).toBe(400);
    expect((await split(h, '2999-01-01', 2, 1)).status).toBe(400);
    expect((await split(h, '2025-02-30', 2, 1)).status).toBe(400);
    expect((await split('nope', '2025-03-01', 2, 1)).status).toBe(404);
    expect(
      (await send('POST', `/holdings/${h}/splits`, { effectiveOn: '2025-03-01', toUnits: 2 }))
        .status,
    ).toBe(400);
    expect((await holdingOf(h)).quantity).toBe(10 * U);
  });

  it('reinvests units bought before a split in units counted today', async () => {
    const h = await newHolding('DDD', 50 * U);
    await addLot(h, '2024-01-01', 50 * U, 5_000);
    await split(h, '2025-03-01', 2, 1);
    const paid = await send('POST', `/holdings/${h}/income`, {
      paidOn: '2025-02-01',
      kind: 'dividend',
      amount: 500,
      unfranked: 500,
      franked: 0,
      frankingCredit: 0,
      withheld: 0,
      reinvested: { quantity: 5 * U, cost: 500 },
    });
    expect(paid.status).toBe(201);
    // 5 units before the split are 10 today
    expect((await holdingOf(h)).quantity).toBe(110 * U);
    expect((await send('DELETE', `/holdings/${h}/income/${paid.body.id}`)).status).toBe(204);
    expect((await holdingOf(h)).quantity).toBe(100 * U);
  });
});

describe('a consolidation', () => {
  it('shows the fraction it drops and is undone to the nearest millionth', async () => {
    const h = await newHolding('EEE', 10 * U);
    await addLot(h, '2024-01-01', 10 * U, 1_000);
    const preview = await send('POST', `/holdings/${h}/splits/preview`, {
      effectiveOn: '2025-03-01',
      toUnits: 1,
      fromUnits: 3,
    });
    expect(preview.body).toMatchObject({ before: 10 * U, after: 3_333_333, rounded: true });
    const res = await split(h, '2025-03-01', 1, 3);
    expect(res.body.rounded).toBe(true);
    const now = await holdingOf(h);
    expect(now.quantity).toBe(3_333_333);
    expect(now.unitsRounded).toBe(true);
    expect(now.lots[0]).toMatchObject({ units: 3_333_333, remaining: 3_333_333 });
    expect(now.costBasis).toBe(1_000);
  });
});

describe('splits in backups', () => {
  it('backs splits up and restores them; an older backup restores with none', () => {
    const backup = createBackup() as any;
    expect(backup.version).toBe(34);
    expect(backup.investmentSplits.length).toBeGreaterThanOrEqual(3);
    restoreBackup(parseBackup(JSON.parse(JSON.stringify(backup))));
    expect(createBackup().investmentSplits).toHaveLength(backup.investmentSplits.length);

    const [first] = backup.investmentSplits;
    for (const bad of [
      { ...first, holdingId: 'nope' },
      { ...first, effectiveOn: '2025-02-30' },
      { ...first, toUnits: 1, fromUnits: 1 },
      { ...first, toUnits: 0 },
    ])
      expect(() => parseBackup({ ...backup, investmentSplits: [bad] })).toThrow(/split/);

    const older = { ...backup, version: 31 };
    delete older.investmentSplits;
    restoreBackup(parseBackup(JSON.parse(JSON.stringify(older))));
    expect(createBackup().investmentSplits).toHaveLength(0);
  });
});

describe('tokens and splits', () => {
  it('an organise token may not preview, record or remove one', () => {
    for (const [method, p] of [
      ['POST', '/investments/holdings/h/splits/preview'],
      ['POST', '/investments/holdings/h/splits'],
      ['DELETE', '/investments/holdings/h/splits/s'],
    ] as const) {
      expect(tokenAllows('organise', method, p, {}), `${method} ${p}`).toBe(false);
      expect(tokenAllows('categorise', method, p, {}), `${method} ${p}`).toBe(false);
      expect(tokenAllows('read', method, p, {}), `${method} ${p}`).toBe(false);
    }
  });
});

describe('migration 0084 investment splits', () => {
  it('adds the table to a populated 0083 database and keeps every holding, lot and sale', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'investment-splits-'));
    fs.cpSync('src/db/migrations', folder, { recursive: true });
    const journalPath = path.join(folder, 'meta', '_journal.json');
    const full = fs.readFileSync(journalPath, 'utf8');
    const journal = JSON.parse(full);
    journal.entries = journal.entries.filter((e: { tag: string }) => e.tag < '0084');
    fs.writeFileSync(journalPath, JSON.stringify(journal));

    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const old = drizzle(sqlite);
    migrate(old, { migrationsFolder: folder });
    sqlite.exec(`
      INSERT INTO accounts (id, name, type, starting_balance) VALUES ('b', 'Mock broker', 'investment', 0);
      INSERT INTO securities (id, symbol, name, currency) VALUES ('s', 'MOCK', 'Mock fund', 'AUD');
      INSERT INTO holdings (id, account_id, security_id, quantity) VALUES ('h', 'b', 's', 4000000);
      INSERT INTO tax_lots (id, holding_id, acquired_on, quantity, cost_basis) VALUES ('l', 'h', '2024-01-01', 5000000, 12345);
      INSERT INTO investment_sales (id, holding_id, sold_on, quantity, proceeds, fees) VALUES ('x', 'h', '2025-01-01', 1000000, 500, 10);
      INSERT INTO investment_sale_parcels (sale_id, lot_id, quantity) VALUES ('x', 'l', 1000000);
    `);
    const rows = () => ({
      holdings: sqlite.prepare('SELECT * FROM holdings').all(),
      lots: sqlite.prepare('SELECT * FROM tax_lots').all(),
      sales: sqlite.prepare('SELECT * FROM investment_sales').all(),
      parcels: sqlite.prepare('SELECT * FROM investment_sale_parcels').all(),
    });
    const before = rows();

    fs.writeFileSync(journalPath, full);
    migrate(old, { migrationsFolder: folder });
    expect(rows()).toEqual(before);
    sqlite
      .prepare(
        "INSERT INTO investment_splits (id, holding_id, effective_on, to_units, from_units) VALUES ('p', 'h', '2025-03-01', 2, 1)",
      )
      .run();
    for (const [to, from] of [
      [0, 1],
      [1, 0],
    ])
      expect(() =>
        sqlite
          .prepare(
            `INSERT INTO investment_splits (id, holding_id, effective_on, to_units, from_units) VALUES ('q${to}${from}', 'h', '2025-03-01', ${to}, ${from})`,
          )
          .run(),
      ).toThrow(/CHECK/);
    // A second run changes nothing, and the split goes with its holding
    migrate(old, { migrationsFolder: folder });
    expect(sqlite.prepare('SELECT count(*) AS n FROM investment_splits').get()).toEqual({ n: 1 });
    sqlite.prepare("DELETE FROM investment_sales WHERE holding_id = 'h'").run();
    sqlite.prepare("DELETE FROM holdings WHERE id = 'h'").run();
    expect(sqlite.prepare('SELECT count(*) AS n FROM investment_splits').get()).toEqual({ n: 0 });
    fs.rmSync(folder, { recursive: true });
  });
});
