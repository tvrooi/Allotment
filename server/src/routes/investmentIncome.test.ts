import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

// D3b investment income (docs/INVESTMENT-SALES-AND-INCOME.md §7): dividends, reinvestment,
// distributions and interest, Tax time's items 10 and 11, the 45-day prompt, lodged years,
// deposits in the register, files, backups and tokens. Mock data only; every date is in the past.
const filesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'allotment-income-test-'));
process.env.FLYBUDGET_FILES_DIR = filesDir;

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { db } = await import('../db/index.js');
const { accounts, budgetSettings, transactions } = await import('../db/schema.js');
const { errorHandler } = await import('../middleware/security.js');
const { createBackup, parseBackup, restoreBackup } = await import('../services/backupService.js');
const { lodgeYear, unlodgeYear } = await import('../services/depreciatingAssetService.js');
const { addDocument, linkDocument } = await import('../services/documentService.js');
const { uploadFromBytes } = await import('../services/fileStore.js');
const { taxYear, taxYearArchive, taxYearCsv, taxYears } = await import('../services/taxService.js');
const { tokenAllows } = await import('../auth/accessTokens.js');
const { zipEntries } = await import('../utils/unzip.js');
const { investmentsRouter } = await import('./investments.js');

const U = 1_000_000;
let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  db.insert(budgetSettings).values({ id: 'budget', currency: 'AUD' }).run();
  db.insert(accounts)
    .values([
      { id: 'broker', name: 'Mock broker', type: 'investment', createdAt: '2023-01-01' },
      { id: 'super', name: 'Mock super', type: 'retirement', createdAt: '2023-01-01' },
      { id: 'bank', name: 'Mock bank', type: 'checking', createdAt: '2023-01-01' },
    ])
    .run();
  const tx = (id: string, date: string, amount: number, extra = {}) =>
    db
      .insert(transactions)
      .values({ id, accountId: 'bank', date, amount, payeeName: 'Mock deposit', ...extra })
      .run();
  tx('dep1', '2025-09-22', 7_000);
  tx('dep2', '2025-09-25', 7_000);
  tx('far', '2025-10-05', 7_000);
  tx('out', '2025-09-21', -7_000);
  tx('drp', '2025-12-16', 1_000);
  tx('parent', '2025-09-23', 7_000, { isParent: 1 });
  tx('child', '2025-09-23', 7_000, { parentTransactionId: 'parent' });

  const app = express();
  app.use(express.json());
  app.use('/api/investments', investmentsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/investments`;
});
afterAll(() => {
  server.close();
  fs.rmSync(filesDir, { recursive: true, force: true });
});

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
  (await send('GET', '?asOf=2026-06-30')).body.accounts
    .flatMap((a: any) => a.holdings)
    .find((h: any) => h.id === id);

const dividend = {
  paidOn: '2025-09-20',
  kind: 'dividend',
  amount: 7_000,
  unfranked: 0,
  franked: 7_000,
  frankingCredit: 3_000,
  withheld: 0,
};
const drp = {
  paidOn: '2025-12-15',
  kind: 'dividend',
  amount: 10_000,
  unfranked: 2_000,
  franked: 8_000,
  frankingCredit: 3_429,
  withheld: 0,
  reinvested: { quantity: 2 * U, cost: 9_000 },
};

let security: string;
let holding: string;
let superHolding: string;
let paid: string;
let reinvested: string;

describe('investment income', () => {
  it('records a franked dividend on a holding', async () => {
    security = (
      await send('POST', '/securities', { symbol: 'MOCK', name: 'Mock shares', currency: 'AUD' })
    ).body.id;
    holding = (
      await send('POST', '/holdings', {
        accountId: 'broker',
        securityId: security,
        quantity: 100 * U,
      })
    ).body.id;
    await send('POST', `/holdings/${holding}/lots`, {
      acquiredOn: '2024-01-02',
      quantity: 100 * U,
      costBasis: 500_000,
    });
    const res = await send('POST', `/holdings/${holding}/income`, dividend);
    expect(res.status).toBe(201);
    paid = res.body.id;
    expect((await holdingOf(holding)).income).toEqual([
      expect.objectContaining({ id: paid, franked: 7_000, partsDisagree: false, reinvested: null }),
    ]);
  });

  it('adds reinvested units as a lot of their own, and keeps them in step', async () => {
    const res = await send('POST', `/holdings/${holding}/income`, drp);
    expect(res.status).toBe(201);
    reinvested = res.body.id;
    let h = await holdingOf(holding);
    expect(h.quantity).toBe(102 * U);
    const lot = h.lots.find((l: any) => l.reinvested);
    expect(lot).toMatchObject({ acquiredOn: '2025-12-15', quantity: 2 * U, costBasis: 9_000 });
    expect(h.income[0].reinvested).toMatchObject({ lotId: lot.id, quantity: 2 * U, cost: 9_000 });

    await send('PUT', `/holdings/${holding}/income/${reinvested}`, {
      ...drp,
      reinvested: { quantity: 3 * U, cost: 10_000 },
    });
    expect((await holdingOf(holding)).quantity).toBe(103 * U);
    await send('PUT', `/holdings/${holding}/income/${reinvested}`, { ...drp, reinvested: null });
    h = await holdingOf(holding);
    expect(h.quantity).toBe(100 * U);
    expect(h.lots.some((l: any) => l.reinvested)).toBe(false);
    await send('PUT', `/holdings/${holding}/income/${reinvested}`, drp);
    expect((await holdingOf(holding)).quantity).toBe(102 * U);
  });

  it('refuses what a payment or its units cannot be', async () => {
    const post = (body: object) =>
      send('POST', `/holdings/${holding}/income`, { ...dividend, ...body });
    expect((await post({ paidOn: '2999-01-01' })).status).toBe(400);
    expect((await post({ kind: 'bonus' })).status).toBe(400);
    expect((await post({ amount: -1 })).status).toBe(400);
    expect((await post({ reinvested: { quantity: U, cost: 7_001 } })).status).toBe(400);

    const h = await holdingOf(holding);
    const lot = h.lots.find((l: any) => l.reinvested);
    expect((await send('DELETE', `/lots/${lot.id}`)).status).toBe(409);
    expect((await send('DELETE', `/holdings/${holding}`)).status).toBe(409);

    // A sale takes the reinvested units: the payment can no longer drop them
    const sale = await send('POST', `/holdings/${holding}/sales`, {
      soldOn: '2026-01-05',
      quantity: 2 * U,
      proceeds: 9_500,
      fees: 0,
      parcels: [{ lotId: lot.id, quantity: 2 * U }],
    });
    expect(sale.status).toBe(201);
    expect((await send('DELETE', `/holdings/${holding}/income/${reinvested}`)).status).toBe(409);
    expect(
      (
        await send('PUT', `/holdings/${holding}/income/${reinvested}`, {
          ...drp,
          reinvested: { quantity: U, cost: 9_000 },
        })
      ).status,
    ).toBe(409);
    expect((await send('DELETE', `/holdings/${holding}/sales/${sale.body.id}`)).status).toBe(204);
    expect((await holdingOf(holding)).quantity).toBe(102 * U);
  });

  it('puts the year on Tax time: item 11, distributions apart, interest in item 10, super left out', async () => {
    await send('POST', `/holdings/${holding}/income`, {
      ...dividend,
      paidOn: '2026-01-10',
      kind: 'distribution',
      amount: 1_200,
      franked: 300,
      frankingCredit: 129,
    });
    await send('POST', `/holdings/${holding}/income`, {
      ...dividend,
      paidOn: '2026-02-01',
      kind: 'interest',
      amount: 900,
      franked: 0,
      frankingCredit: 0,
      withheld: 100,
    });
    superHolding = (
      await send('POST', '/holdings', { accountId: 'super', securityId: security, quantity: U })
    ).body.id;
    expect((await send('POST', `/holdings/${superHolding}/income`, dividend)).status).toBe(201);

    const year = taxYear(2025).investmentIncome;
    expect(year).toMatchObject({
      dividends: {
        unfranked: 2_000,
        franked: 15_000,
        frankingCredit: 6_429,
        withheld: 0,
        count: 2,
      },
      distributions: { amount: 1_200, franked: 300, frankingCredit: 129, count: 1 },
      interest: { gross: 1_000, withheld: 100, count: 1 },
      superPayments: 1,
      unconverted: 0,
    });
    expect(year.notes.join(' ')).toMatch(/annual tax statement/);
    expect(year.notes.join(' ')).toMatch(/super/);
    expect(year.notes.join(' ')).not.toMatch(/45 days/);
    expect(taxYears('2026-06-30').map((y) => y.financialYear)).toContain(2025);
    const { csv } = taxYearCsv(2025);
    expect(csv).toContain('Investment income (items 10 and 11)');
    expect(csv).toContain('11T Franked amount,150.00');
    expect(csv).toContain('10L Gross interest,10.00');
  });

  it('prompts about the 45-day rule only over the small shareholder exemption', async () => {
    const big = (
      await send('POST', '/securities', { symbol: 'BIG', name: 'Mock big', currency: 'AUD' })
    ).body.id;
    const bigHolding = (
      await send('POST', '/holdings', { accountId: 'broker', securityId: big, quantity: 1_000 * U })
    ).body.id;
    await send('POST', `/holdings/${bigHolding}/lots`, {
      acquiredOn: '2025-10-01',
      quantity: 1_000 * U,
      costBasis: 10_000_000,
    });
    const payment = await send('POST', `/holdings/${bigHolding}/income`, {
      ...dividend,
      paidOn: '2025-10-10',
      amount: 1_200_000,
      franked: 1_200_000,
      frankingCredit: 514_286,
    });
    // Sold 19 days after buying: the credit may not count
    await send('POST', `/holdings/${bigHolding}/sales`, {
      soldOn: '2025-10-20',
      quantity: 1_000 * U,
      proceeds: 10_100_000,
      fees: 0,
    });
    const year = taxYear(2025).investmentIncome;
    expect(year.notes.join(' ')).toMatch(/held at risk for 45 days/);
    expect(year.payments.find((p) => p.id === payment.body.id)?.holdingPeriodConcern).toBe(true);
    expect(year.payments.find((p) => p.id === paid)?.holdingPeriodConcern).toBe(false);
  });

  it("refuses a change to a lodged year's income and allows one that changes no figure", async () => {
    lodgeYear(2025);
    const changed = await send('PUT', `/holdings/${holding}/income/${paid}`, {
      ...dividend,
      frankingCredit: 2_999,
    });
    expect(changed.status).toBe(409);
    expect(changed.body.error).toMatch(/2025–26, already lodged/);
    expect(
      (await send('POST', `/holdings/${holding}/income`, { ...dividend, paidOn: '2026-03-01' }))
        .status,
    ).toBe(409);
    expect(
      (
        await send('PUT', `/holdings/${holding}/income/${paid}`, {
          ...dividend,
          notes: 'Mock note',
        })
      ).status,
    ).toBe(200);
    unlodgeYear(2025);
  });

  it('suggests deposits for the same amount within 7 days, and links one', async () => {
    const suggest = await send('GET', `/holdings/${holding}/income/${paid}/deposits`);
    expect(suggest.body.map((t: any) => t.id)).toEqual(['dep1', 'parent', 'dep2']);
    // A reinvested payment brings in only what the plan didn't spend
    expect(
      (await send('GET', `/holdings/${holding}/income/${reinvested}/deposits`)).body.map(
        (t: any) => t.id,
      ),
    ).toEqual(['drp']);

    expect(
      (
        await send('PUT', `/holdings/${holding}/income/${paid}/transaction`, {
          transactionId: 'dep1',
        })
      ).status,
    ).toBe(204);
    expect((await send('GET', '/transactions/dep1')).body).toMatchObject({
      kind: 'income',
      symbol: 'MOCK',
      date: '2025-09-20',
    });
    expect((await holdingOf(holding)).income.find((i: any) => i.id === paid).transactionId).toBe(
      'dep1',
    );
    // Taken now: not suggested for another, and not linkable to it
    const other = (
      await send('POST', `/holdings/${holding}/income`, { ...dividend, paidOn: '2025-09-21' })
    ).body.id;
    expect(
      (await send('GET', `/holdings/${holding}/income/${other}/deposits`)).body.map(
        (t: any) => t.id,
      ),
    ).toEqual(['parent', 'dep2']);
    const link = (transactionId: string) =>
      send('PUT', `/holdings/${holding}/income/${other}/transaction`, { transactionId });
    expect((await link('dep1')).status).toBe(409);
    expect((await link('out')).status).toBe(400);
    expect((await link('child')).status).toBe(400);
    expect((await link('nope')).status).toBe(404);
    await send('DELETE', `/holdings/${holding}/income/${other}`);

    // A link changes no figure: allowed in a lodged year, and unlinking clears it
    lodgeYear(2025);
    expect(
      (
        await send('PUT', `/holdings/${holding}/income/${paid}/transaction`, {
          transactionId: null,
        })
      ).status,
    ).toBe(204);
    unlodgeYear(2025);
    expect((await send('GET', '/transactions/dep1')).body).toBeNull();
    await send('PUT', `/holdings/${holding}/income/${paid}/transaction`, { transactionId: 'dep1' });
    expect((await send('GET', `/holdings/${holding}/other/${paid}/deposits`)).status).toBe(404);
  });

  it('puts files linked to payments in the year and its ZIP', () => {
    const doc = addDocument({
      upload: uploadFromBytes(Buffer.from('Mock dividend statement\n')),
      fileName: 'statement.txt',
    });
    linkDocument(doc.id, 'investmentIncome', paid);
    const year = taxYear(2025).investmentIncome;
    expect(year.payments.find((p) => p.id === paid)?.files.map((f) => f.fileName)).toEqual([
      'statement.txt',
    ]);
    const names = zipEntries(taxYearArchive(2025).data)!.map((e) => e.name);
    expect(names.some((n) => n.startsWith('files/') && n.includes('statement'))).toBe(true);
  });

  it('backs income up and restores it; an older backup restores with none', () => {
    const backup = createBackup() as any;
    expect(backup.version).toBe(33);
    expect(backup.investmentIncome.length).toBeGreaterThanOrEqual(5);
    restoreBackup(parseBackup(JSON.parse(JSON.stringify(backup))));
    expect(taxYear(2025).investmentIncome.dividends.franked).toBeGreaterThan(0);
    expect(() =>
      parseBackup({
        ...backup,
        investmentIncome: [{ ...backup.investmentIncome[0], kind: 'bonus' }],
      }),
    ).toThrow(/investment income/);
    expect(() =>
      parseBackup({
        ...backup,
        investmentIncome: [{ ...backup.investmentIncome[0], transactionId: 'missing' }],
      }),
    ).toThrow(/investment income/);

    // As version 30 wrote it: no income, no deposit links, no files linked to a payment
    const older = {
      ...backup,
      version: 30,
      investmentSales: backup.investmentSales.map(({ transactionId: _, ...s }: any) => s),
      documentLinks: backup.documentLinks.filter((l: any) => !l.investmentIncomeId),
    };
    delete older.investmentIncome;
    restoreBackup(parseBackup(JSON.parse(JSON.stringify(older))));
    expect(taxYear(2025).investmentIncome.payments).toHaveLength(0);
  });

  it('lets an organise token read investments and write none of it', () => {
    expect(tokenAllows('organise', 'GET', '/investments', undefined)).toBe(true);
    for (const [method, p] of [
      ['POST', '/investments/holdings/h/income'],
      ['PUT', '/investments/holdings/h/income/i'],
      ['DELETE', '/investments/holdings/h/income/i'],
      ['GET', '/investments/holdings/h/income/i/deposits'],
      ['PUT', '/investments/holdings/h/income/i/transaction'],
      ['PUT', '/investments/holdings/h/sales/s/transaction'],
      ['GET', '/investments/transactions/t'],
      ['GET', '/investments/securities/s/prices'],
    ] as const)
      expect(tokenAllows('organise', method, p, {}), `${method} ${p}`).toBe(false);
    expect(tokenAllows('read', 'GET', '/investments', undefined)).toBe(false);
    expect(tokenAllows('categorise', 'GET', '/investments', undefined)).toBe(false);
  });
});

describe('migration 0083 investment income', async () => {
  const Database = (await import('better-sqlite3')).default;
  const { drizzle } = await import('drizzle-orm/better-sqlite3');

  it('adds income and deposit links to a populated 0082 database and keeps every sale', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'investment-income-'));
    fs.cpSync('src/db/migrations', folder, { recursive: true });
    const journalPath = path.join(folder, 'meta', '_journal.json');
    const full = fs.readFileSync(journalPath, 'utf8');
    const journal = JSON.parse(full);
    journal.entries = journal.entries.filter((e: { tag: string }) => e.tag < '0083');
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
    const sales = () =>
      sqlite
        .prepare('SELECT id, holding_id, sold_on, quantity, proceeds, fees FROM investment_sales')
        .all();
    const before = sales();

    fs.writeFileSync(journalPath, full);
    migrate(old, { migrationsFolder: folder });
    expect(sales()).toEqual(before);
    expect(sqlite.prepare('SELECT transaction_id FROM investment_sales').get()).toEqual({
      transaction_id: null,
    });
    sqlite
      .prepare(
        "INSERT INTO investment_income (id, holding_id, paid_on, kind, amount, franked, franking_credit) VALUES ('i', 'h', '2025-02-01', 'dividend', 700, 700, 300)",
      )
      .run();
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO investment_income (id, holding_id, paid_on, kind, amount) VALUES ('j', 'h', '2025-02-01', 'bonus', 1)",
        )
        .run(),
    ).toThrow(/CHECK/);
    // A second run changes nothing
    migrate(old, { migrationsFolder: folder });
    expect(sqlite.prepare('SELECT count(*) AS n FROM investment_income').get()).toEqual({ n: 1 });
    fs.rmSync(folder, { recursive: true });
  });
});
