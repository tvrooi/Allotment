import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Depreciating assets on Tax time, phase 1 (docs/DEPRECIATING-ASSETS-PLAN.md): storage, checks,
// the tax year and its exports, lodged years, files, backups and tokens. Mock data only.
const filesDir = mkdtempSync(path.join(tmpdir(), 'allotment-assets-test-'));
process.env.FLYBUDGET_FILES_DIR = filesDir;

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { db } = await import('../db/index.js');
const schema = await import('../db/schema.js');
const { taxRouter } = await import('./tax.js');
const { claimByRule, claimCandidates, setClaim, taxYear, taxYearArchive, taxYearCsv } =
  await import('../services/taxService.js');
const { addDocument, getDocument, linkDocument } = await import('../services/documentService.js');
const { uploadFromBytes } = await import('../services/fileStore.js');
const { createBackup, parseBackup, restoreBackup } = await import('../services/backupService.js');
const { tokenAllows } = await import('../auth/accessTokens.js');
const { zipEntries, zipEntryData } = await import('../utils/unzip.js');

const { accounts, transactions, taxClaims, depreciatingAssets, taxLodgedYears, documents } = schema;

let server: Server;
let base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/tax', taxRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/tax`;
});
afterAll(() => {
  server.close();
  rmSync(filesDir, { recursive: true, force: true });
});
beforeEach(() => {
  for (const table of [
    schema.documentLinks,
    documents,
    schema.receiptFiles,
    taxLodgedYears,
    depreciatingAssets,
    taxClaims,
    transactions,
    accounts,
  ])
    db.delete(table).run();
  db.insert(accounts)
    .values({ id: 'card', name: 'Card', type: 'credit', createdAt: '2026-01-01' })
    .run();
  db.insert(transactions)
    .values([
      {
        id: 'laptop',
        accountId: 'card',
        date: '2026-09-28',
        amount: -240_000,
        payeeName: 'JB Hi-Fi',
      },
      { id: 'mouse', accountId: 'card', date: '2026-10-02', amount: -4_900, payeeName: 'JB Hi-Fi' },
    ])
    .run();
});

const send = async (method: string, p: string, body?: unknown) => {
  const res = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const laptop = (extra: Record<string, unknown> = {}) => ({
  name: 'Work laptop',
  label: 'D5',
  method: 'prime_cost',
  cost: 240_000,
  startDate: '2026-10-01',
  effectiveLifeHundredths: 200,
  workUseBps: 8_000,
  transactionId: 'laptop',
  ...extra,
});

describe('depreciating assets (plan phase 1)', () => {
  it('stores an asset and gives its schedule (the plan’s worked example)', async () => {
    const { status, body } = await send('POST', '/assets', laptop());
    expect(status).toBe(201);
    expect(body).toMatchObject({
      name: 'Work laptop',
      purchaseDate: '2026-09-28',
      partOfSet: false,
    });
    expect(body.schedule.map((r: { decline: number }) => r.decline)).toEqual([
      89_753, 120_329, 29_918,
    ]);
    const preview = await send('POST', '/assets/preview', {
      cost: 240_000,
      startDate: '2026-10-01',
      effectiveLifeHundredths: 200,
      workUseBps: 8_000,
    });
    expect(preview.body.diminishing_value[0].decline).toBe(179_507);
    expect(preview.body.prime_cost[0].decline).toBe(89_753);
  });

  it('refuses what the rules don’t allow', async () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ cost: 30_000, transactionId: null }, /\$300 or less/],
      [{ startDate: '2006-05-09' }, /10 May 2006/],
      [{ effectiveLifeHundredths: 0 }, /./],
      [{ openingFy: 2027 }, /both the year/],
      [{ transactionId: 'nope' }, /not found/],
    ];
    for (const [extra, message] of cases) {
      const { status, body } = await send('POST', '/assets', laptop(extra));
      expect(status, JSON.stringify(extra)).toBeGreaterThanOrEqual(400);
      expect(body.error).toMatch(message);
    }
    // A set or identical items over $300 in total may be depreciated item by item
    const set = await send(
      'POST',
      '/assets',
      laptop({ cost: 25_000, partOfSet: true, transactionId: null }),
    );
    expect(set.status).toBe(201);
  });

  it('is never claimed outright as well: claims, rules and suggestions leave its purchase alone', async () => {
    await send('POST', '/assets', laptop());
    expect(() => setClaim('laptop', { label: 'D5' })).toThrow(/depreciated as “Work laptop”/);
    claimByRule('laptop', 'D5');
    expect(db.select().from(taxClaims).all()).toEqual([]);
    setClaim('mouse', { label: 'D5' });
    const suggested = claimCandidates(2026, '2027-06-30').candidates.map((c) => c.transactionId);
    expect(suggested).not.toContain('laptop');
    // And one purchase is one asset
    const again = await send('POST', '/assets', laptop({ name: 'Twice' }));
    expect(again.status).toBe(409);
  });

  it('“Depreciate instead” replaces a claim with the asset, in one step', async () => {
    setClaim('laptop', { label: 'D5', workUseBps: 8_000 });
    const refused = await send('POST', '/assets', laptop());
    expect(refused.status).toBe(409);
    expect(db.select().from(depreciatingAssets).all()).toEqual([]);
    const done = await send('POST', '/assets', laptop({ replaceClaim: true }));
    expect(done.status).toBe(201);
    expect(db.select().from(taxClaims).all()).toEqual([]);
  });

  it('adds into the tax year, its CSV and its archive, with the purchase as evidence', async () => {
    await send('POST', '/assets', laptop());
    setClaim('mouse', { label: 'D5' });
    const year = taxYear(2026);
    expect(year.assets).toHaveLength(1);
    expect(year.assets[0]).toMatchObject({ deduction: 71_802, row: { decline: 89_753 } });
    expect(year.totals.find((t) => t.label === 'D5')).toMatchObject({
      count: 2,
      total: 71_802 + 4_900,
    });
    expect(year.total).toBe(71_802 + 4_900);
    expect(year.missingReceipts).toBe(2);

    // A warranty linked to the asset is evidence, and goes in the archive
    const asset = db.select().from(depreciatingAssets).get()!;
    const doc = addDocument({
      upload: uploadFromBytes(Buffer.from('Warranty: 2 years\n')),
      fileName: 'warranty.txt',
    });
    linkDocument(doc.id, 'asset', asset.id);
    expect(taxYear(2026).assets[0].files.map((f) => f.fileName)).toEqual(['warranty.txt']);
    expect(taxYear(2026).missingReceipts).toBe(1);

    expect(taxYearCsv(2026).csv).toContain('Decline in value: Work laptop');
    const archive = taxYearArchive(2026).data;
    const names = zipEntries(archive)!.map((e) => e.name);
    expect(names).toContain('depreciation-2026-27.csv');
    expect(names.some((n) => n.startsWith('files/') && n.includes('warranty'))).toBe(true);
    const schedule = zipEntryData(
      archive,
      zipEntries(archive)!.find((e) => e.name === 'depreciation-2026-27.csv')!,
      1e6,
    )!.toString();
    expect(schedule).toContain('Work laptop,D5,Prime cost,2400.00,2026-10-01,2.00');

    // Removing the asset keeps the file (records are kept for five years)
    expect((await send('DELETE', `/assets/${asset.id}`)).status).toBe(204);
    expect(getDocument(doc.id).links).toEqual([]);
  });

  it('a lodged year locks its figures until it is unlocked', async () => {
    const { body: asset } = await send('POST', '/assets', laptop());
    expect((await send('PUT', '/lodged/2026')).body).toEqual([2026]);
    expect((await send('PUT', `/assets/${asset.id}`, { cost: 250_000 })).status).toBe(409);
    expect(
      (await send('PUT', `/assets/${asset.id}/years/2026`, { workUseBps: 5_000 })).status,
    ).toBe(409);
    expect((await send('DELETE', `/assets/${asset.id}`)).status).toBe(409);
    // What doesn't change a figure is still fine, and so is a later year
    expect(
      (await send('PUT', `/assets/${asset.id}`, { name: 'Laptop (work)', notes: 'Serial 123' }))
        .status,
    ).toBe(200);
    expect(
      (await send('PUT', `/assets/${asset.id}/years/2027`, { workUseBps: 5_000 })).body.schedule[1]
        .deduction,
    ).toBe(60_165);
    await send('DELETE', '/lodged/2026');
    expect((await send('PUT', `/assets/${asset.id}`, { cost: 250_000 })).status).toBe(200);
  });

  it('disposal gives a balancing adjustment; a gain is income, never a deduction', async () => {
    const { body: asset } = await send('POST', '/assets', laptop());
    const sold = await send('POST', `/assets/${asset.id}/dispose`, {
      date: '2027-12-31',
      terminationValue: 200_000,
    });
    expect(sold.status).toBe(200);
    const year = taxYear(2027);
    const row = year.assets[0];
    expect(row.row.balancingAdjustment).toBeGreaterThan(0);
    expect(row.income).toBe(row.row.balancingTaxable);
    expect(row.deduction).toBe(row.row.deduction);
    expect(year.notes.join(' ')).toMatch(/assessable income/);
    expect(taxYear(2028).assets).toEqual([]);
    expect((await send('DELETE', `/assets/${asset.id}/dispose`)).body.disposedDate).toBeNull();
  });

  it('travels with a backup (format 24), file links included; a format 23 backup restores', async () => {
    const { body: asset } = await send('POST', '/assets', laptop());
    const doc = addDocument({
      upload: uploadFromBytes(Buffer.from('Invoice\n')),
      fileName: 'invoice.txt',
    });
    linkDocument(doc.id, 'asset', asset.id);
    await send('PUT', '/lodged/2026');
    const backup = JSON.parse(JSON.stringify(createBackup()));
    expect(backup.version).toBe(24);
    expect(backup.depreciatingAssets).toHaveLength(1);
    db.delete(depreciatingAssets).run();
    restoreBackup(parseBackup(backup));
    expect(db.select().from(depreciatingAssets).all()).toHaveLength(1);
    expect(getDocument(doc.id).links.map((l) => l.kind)).toEqual(['asset']);
    expect(db.select().from(taxLodgedYears).all()).toHaveLength(1);

    const older = { ...backup, version: 23 };
    delete older.depreciatingAssets;
    delete older.depreciatingAssetYears;
    delete older.taxLodgedYears;
    older.documentLinks = [];
    restoreBackup(parseBackup(older));
    expect(db.select().from(depreciatingAssets).all()).toEqual([]);
  });

  it('an organise token may read assets, and nothing more', () => {
    expect(tokenAllows('organise', 'GET', '/tax/assets', undefined)).toBe(true);
    expect(tokenAllows('organise', 'GET', '/tax/assets/abc', undefined)).toBe(true);
    for (const [method, p] of [
      ['POST', '/tax/assets'],
      ['POST', '/tax/assets/preview'],
      ['PUT', '/tax/assets/abc'],
      ['DELETE', '/tax/assets/abc'],
      ['POST', '/tax/assets/abc/dispose'],
      ['PUT', '/tax/assets/abc/years/2026'],
      ['PUT', '/tax/lodged/2026'],
      ['GET', '/tax/years/2026/assets/csv'],
    ])
      expect(tokenAllows('organise', method, p, {}), `${method} ${p}`).toBe(false);
    expect(tokenAllows('read', 'GET', '/tax/assets', undefined)).toBe(false);
    expect(tokenAllows('categorise', 'GET', '/tax/assets', undefined)).toBe(false);
  });
});
