import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import fs, { mkdtempSync, rmSync } from 'node:fs';
import os, { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

// Working from home on Tax time (D4a, docs/TAX-CAR-AND-HOME.md): the hours log, the year's rate,
// the D5 total, lodging as a snapshot (amended, never locked), exports, backups and tokens.
// Mock data only.
const filesDir = mkdtempSync(path.join(tmpdir(), 'allotment-home-test-'));
process.env.FLYBUDGET_FILES_DIR = filesDir;

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { db } = await import('../db/index.js');
const schema = await import('../db/schema.js');
const { taxRouter } = await import('./tax.js');
const { taxYear, taxYearArchive, taxYearCsv, taxYears } = await import('../services/taxService.js');
const { addDocument, getDocument, linkDocument } = await import('../services/documentService.js');
const { uploadFromBytes } = await import('../services/fileStore.js');
const { createBackup, parseBackup, restoreBackup } = await import('../services/backupService.js');
const { tokenAllows } = await import('../auth/accessTokens.js');
const { zipEntries } = await import('../utils/unzip.js');

const { accounts, transactions, taxClaims, taxHomeHours, taxHomeYears, taxLodgedYears } = schema;

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
    schema.documents,
    schema.receiptFiles,
    taxLodgedYears,
    schema.depreciatingAssets,
    taxHomeYears,
    taxHomeHours,
    taxClaims,
    transactions,
    accounts,
  ])
    db.delete(table).run();
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
const day = (date: string, minutes: number, notes: string | null = null) =>
  send('PUT', `/home/days/${date}`, { minutes, notes });

describe('hours by day', () => {
  it('adds, edits and removes a day, and the year adds them up at the ATO rate', async () => {
    expect((await day('2025-08-04', 480)).status).toBe(200);
    expect((await day('2025-08-05', 450, 'Late start')).status).toBe(200);
    // The same date again replaces it
    await day('2025-08-04', 510);
    const { body } = await send('GET', '/home/2025');
    expect(body.days).toEqual([
      { date: '2025-08-04', minutes: 510, notes: null },
      { date: '2025-08-05', minutes: 450, notes: 'Late start' },
    ]);
    expect(body.rate).toMatchObject({ table: 700, override: null, checked: '2026-11-08' });
    expect(body.rate.source).toMatch(/^https:\/\/www\.ato\.gov\.au\//);
    // 960 minutes = 16 hours × 70c
    expect(body.year).toMatchObject({ minutes: 960, days: 2, rateTenths: 700, claim: 1_120 });
    expect((await send('DELETE', '/home/days/2025-08-05')).status).toBe(204);
    expect((await send('GET', '/home/2025')).body.days).toHaveLength(1);
  });

  it('keeps each financial year to its own days', async () => {
    await day('2025-06-30', 60);
    await day('2025-07-01', 120);
    expect((await send('GET', '/home/2024')).body.year.minutes).toBe(60);
    expect((await send('GET', '/home/2025')).body.year.minutes).toBe(120);
  });

  it('refuses a fake date, 0 or 1,441 minutes, and a long note', async () => {
    expect((await day('2025-02-30', 60)).status).toBe(400);
    expect((await day('2025-08-04', 0)).status).toBe(400);
    expect((await day('2025-08-04', 1441)).status).toBe(400);
    expect((await day('2025-08-04', 60, 'x'.repeat(501))).status).toBe(400);
    expect((await day('2025-08-04', 1440)).status).toBe(200);
    expect((await send('PUT', '/home/days/2025-08-04', { minutes: 60, extra: 1 })).status).toBe(
      400,
    );
  });
});

describe('fill a pattern', () => {
  it('writes the weekdays across a range, never overwriting a recorded day', async () => {
    await day('2025-08-05', 90, 'Kept');
    // 4 to 15 August 2025: Monday 4th to Friday 15th, Tuesday and Wednesday only
    const fill = { from: '2025-08-04', to: '2025-08-15', weekdays: [2, 3], minutes: 480 };
    const preview = await send('POST', '/home/fill', { ...fill, preview: true });
    expect(preview.body).toEqual({ added: 3, skipped: 1 });
    expect((await send('GET', '/home/2025')).body.days).toHaveLength(1);
    const { status, body } = await send('POST', '/home/fill', fill);
    expect(status).toBe(200);
    expect(body).toEqual({ added: 3, skipped: 1 });
    const days = (await send('GET', '/home/2025')).body.days;
    expect(days.map((d: { date: string }) => d.date)).toEqual([
      '2025-08-05',
      '2025-08-06',
      '2025-08-12',
      '2025-08-13',
    ]);
    expect(days[0]).toMatchObject({ minutes: 90, notes: 'Kept' });
  });

  it('refuses a range across two financial years, over 400 days or backwards, and a bad body', async () => {
    const ok = { weekdays: [1], minutes: 60 };
    expect(
      (await send('POST', '/home/fill', { ...ok, from: '2025-06-01', to: '2025-07-31' })).status,
    ).toBe(400);
    expect(
      (await send('POST', '/home/fill', { ...ok, from: '2024-01-01', to: '2025-06-30' })).status,
    ).toBe(400);
    expect(
      (await send('POST', '/home/fill', { ...ok, from: '2025-08-10', to: '2025-08-01' })).status,
    ).toBe(400);
    expect(
      (
        await send('POST', '/home/fill', {
          ...ok,
          weekdays: [8],
          from: '2025-08-01',
          to: '2025-08-31',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await send('POST', '/home/fill', {
          ...ok,
          weekdays: [],
          from: '2025-08-01',
          to: '2025-08-31',
        })
      ).status,
    ).toBe(400);
    expect(
      (await send('POST', '/home/fill', { ...ok, from: '2025-02-30', to: '2025-08-31' })).status,
    ).toBe(400);
    expect(
      (
        await send('POST', '/home/fill', {
          ...ok,
          minutes: 1441,
          from: '2025-08-01',
          to: '2025-08-31',
        })
      ).status,
    ).toBe(400);
    expect(db.select().from(taxHomeHours).all()).toEqual([]);
  });
});

describe("a year's rate", () => {
  it('has no rate for 2026–27 until one is typed, then claims at it', async () => {
    await day('2026-08-03', 600);
    let year = taxYear(2026);
    expect(year.home).toMatchObject({ minutes: 600, claim: 0, missing: ['rate'] });
    expect(year.notes).toContain("Type the ATO's rate for 2026–27.");
    expect(year.totals.find((t) => t.label === 'D5')).toBeUndefined();

    const set = await send('PUT', '/home/years/2026', { rateTenths: 710, notes: 'ATO page' });
    expect(set.status).toBe(200);
    expect(set.body.rate).toMatchObject({ table: null, override: 710 });
    year = taxYear(2026);
    // 10 hours at 71c
    expect(year.home).toMatchObject({ claim: 710, rateSource: 'override', missing: [] });
    expect(year.notes).not.toContain("Type the ATO's rate for 2026–27.");
  });

  it('lets a typed rate override the table, and null go back to it', async () => {
    await day('2025-08-04', 600);
    await send('PUT', '/home/years/2025', { rateTenths: 800, notes: null });
    expect(taxYear(2025).home.claim).toBe(800);
    await send('PUT', '/home/years/2025', { rateTenths: null, notes: null });
    expect(taxYear(2025).home).toMatchObject({ claim: 700, rateSource: 'table' });
  });

  it('refuses a rate of 0 or over 10,000', async () => {
    expect((await send('PUT', '/home/years/2025', { rateTenths: 0, notes: null })).status).toBe(
      400,
    );
    expect(
      (await send('PUT', '/home/years/2025', { rateTenths: 10_001, notes: null })).status,
    ).toBe(400);
    expect((await send('PUT', '/home/years/2025', { notes: null })).status).toBe(400);
  });
});

describe('the tax year', () => {
  it('adds the claim to D5 beside ordinary D5 claims, and to the total', async () => {
    db.insert(accounts)
      .values({ id: 'card', name: 'Card', type: 'credit', createdAt: '2025-01-01' })
      .run();
    db.insert(transactions)
      .values({
        id: 'pen',
        accountId: 'card',
        date: '2025-09-01',
        amount: -2_000,
        payeeName: 'Office',
      })
      .run();
    await send('PUT', '/claims/pen', { label: 'D5', workUseBps: 10_000, notes: null });
    await day('2025-08-04', 600);
    const year = taxYear(2025);
    const d5 = year.totals.find((t) => t.label === 'D5')!;
    expect(d5.total).toBe(2_000 + 700);
    expect(d5.count).toBe(2);
    expect(year.total).toBe(2_700);
    // Hours are not a purchase, so they never raise the written-evidence flag or the missing count
    expect(year.missingReceipts).toBe(1);
    expect(year.notes.join(' ')).toContain('one bill for each expense the rate covers');
  });

  it('lists years that have hours or a typed rate', async () => {
    await day('2022-09-01', 60);
    await send('PUT', '/home/years/2019', { rateTenths: 520, notes: null });
    const years = taxYears('2025-11-08').map((y) => y.financialYear);
    expect(years).toContain(2022);
    expect(years).toContain(2019);
  });
});

describe('lodged years are amended, not locked', () => {
  it('records the snapshot, lets a day change, then reports the amendment', async () => {
    await day('2025-08-04', 600);
    expect((await send('PUT', '/lodged/2025')).status).toBe(200);
    expect(db.select().from(schema.taxLodgedFigures).all()).toHaveLength(1);
    expect(taxYear(2025).amendments).toEqual([]);

    // Not refused
    expect((await day('2025-08-05', 600)).status).toBe(200);
    expect((await send('DELETE', '/home/days/2025-08-04')).status).toBe(204);
    expect(
      (
        await send('POST', '/home/fill', {
          from: '2025-09-01',
          to: '2025-09-05',
          weekdays: [1],
          minutes: 60,
        })
      ).status,
    ).toBe(200);
    expect((await send('PUT', '/home/years/2025', { rateTenths: 800, notes: null })).status).toBe(
      200,
    );

    const year = taxYear(2025);
    // 11 hours at 80c, was 10 hours at 70c
    expect(year.amendments).toHaveLength(1);
    expect(year.amendments[0]).toMatchObject({
      part: 'home',
      status: 'amended',
      lodgedClaim: 700,
      claim: 880,
    });
    expect(year.amendments[0].note).toBe(
      'Amended since lodging: working from home was $7.00, now $8.80. Lodge an amendment with the ATO, then mark the year lodged again.',
    );
    expect(year.notes).toContain(year.amendments[0].note);
  });

  it('marking lodged again records the new figures and clears the amendment', async () => {
    await day('2025-08-04', 600);
    await send('PUT', '/lodged/2025');
    await day('2025-08-05', 600);
    expect(taxYear(2025).amendments).toHaveLength(1);
    await send('PUT', '/lodged/2025');
    expect(taxYear(2025).amendments).toEqual([]);
    expect(db.select().from(schema.taxLodgedFigures).all()).toHaveLength(1);
  });

  it('keeps a lodged year listed after its last day is removed, with the amendment', async () => {
    await day('2024-08-05', 600);
    await send('PUT', '/lodged/2024');
    expect((await send('DELETE', '/home/days/2024-08-05')).status).toBe(204);
    expect(taxYears('2025-11-08').map((y) => y.financialYear)).toContain(2024);
    expect(taxYear(2024).amendments[0]).toMatchObject({
      status: 'amended',
      lodgedClaim: 700,
      claim: 0,
    });
  });

  it('removes the snapshot when the year is unlocked, and an open year has no amendments', async () => {
    await day('2025-08-04', 600);
    await send('PUT', '/lodged/2025');
    await send('DELETE', '/lodged/2025');
    expect(db.select().from(schema.taxLodgedFigures).all()).toEqual([]);
    await day('2025-08-05', 600);
    expect(taxYear(2025).amendments).toEqual([]);
  });

  it('says a year lodged before this existed did not record working from home', async () => {
    db.insert(taxLodgedYears).values({ financialYear: 2025, lodgedAt: '2025-10-01' }).run();
    expect(taxYear(2025).amendments).toEqual([]);
    await day('2025-08-04', 600);
    const [a] = taxYear(2025).amendments;
    expect(a).toMatchObject({ status: 'notRecorded', lodgedClaim: null });
    expect(a.note).toBe("Working from home wasn't recorded when 2025–26 was lodged.");
  });

  it('still refuses a change to an asset in a lodged year (the existing lock)', async () => {
    await day('2025-08-04', 600);
    const asset = await send('POST', '/assets', {
      name: 'Mock laptop',
      label: 'D5',
      method: 'prime_cost',
      cost: 100_000,
      startDate: '2025-08-10',
      effectiveLifeHundredths: 300,
      workUseBps: 10_000,
    });
    await send('PUT', '/lodged/2025');
    expect(asset.status).toBe(201);
    const change = await send('PUT', `/assets/${asset.body.id}/years/2025`, { workUseBps: 5_000 });
    expect(change.status).toBe(409);
    expect(change.body.error).toContain('Unlock the year first');
  });
});

describe('exports', () => {
  it('puts the claim in the CSV, and the hours and the bills in the archive', async () => {
    await day('2025-08-04', 90, 'Roster');
    await day('2025-08-05', 480);
    const bill = addDocument({
      upload: uploadFromBytes(Buffer.from('Mock internet bill\n')),
      fileName: 'internet.txt',
    });
    linkDocument(bill.id, 'homeYear', '2025');

    const { csv } = taxYearCsv(2025);
    expect(csv).toContain(
      'D5,Other work-related expenses,Working from home: 9.50 hours over 2 days at 70.0c per hour',
    );
    expect(csv).toContain(',6.65,');
    expect(csv).toContain('internet.txt');

    const { data, missingFiles } = taxYearArchive(2025);
    const names = zipEntries(data)!.map((e) => e.name);
    expect(names).toContain('home-hours-2025-26.csv');
    expect(names.some((n) => n.startsWith('files/2025-07-01 D5 internet'))).toBe(true);
    expect(missingFiles).toBe(0);
  });

  it('adds nothing for a year with no hours', () => {
    const { csv } = taxYearCsv(2025);
    expect(csv).not.toContain('Working from home');
    expect(zipEntries(taxYearArchive(2025).data)!.map((e) => e.name)).toEqual([
      'deductions-2025-26.csv',
    ]);
  });
});

describe('the homeYear file link', () => {
  it('links a file to a year, creating its row, and a second link is not duplicated', () => {
    const doc = addDocument({
      upload: uploadFromBytes(Buffer.from('Mock energy bill\n')),
      fileName: 'energy.txt',
    });
    const linked = linkDocument(doc.id, 'homeYear', '2025');
    expect(linked.links).toEqual([
      expect.objectContaining({ kind: 'homeYear', id: '2025', label: 'Working from home 2025–26' }),
    ]);
    expect(linkDocument(doc.id, 'homeYear', '2025').links).toHaveLength(1);
    expect(db.select().from(taxHomeYears).all()).toHaveLength(1);
    expect(getDocument(doc.id).links).toHaveLength(1);
  });

  it('refuses a year that is not one', () => {
    const doc = addDocument({
      upload: uploadFromBytes(Buffer.from('Mock bill\n')),
      fileName: 'bill.txt',
    });
    expect(() => linkDocument(doc.id, 'homeYear', 'abc')).toThrow(/not found/);
    expect(() => linkDocument(doc.id, 'homeYear', '12')).toThrow(/not found/);
  });

  it('is removed with its year row', () => {
    const doc = addDocument({
      upload: uploadFromBytes(Buffer.from('Mock bill\n')),
      fileName: 'bill.txt',
    });
    linkDocument(doc.id, 'homeYear', '2025');
    db.delete(taxHomeYears).run();
    expect(getDocument(doc.id).links).toEqual([]);
  });
});

describe('tokens', () => {
  it('an organise token reads the year (with working from home) and the hours by day', () => {
    expect(tokenAllows('organise', 'GET', '/tax/home/2025', undefined)).toBe(true);
    expect(tokenAllows('organise', 'GET', '/tax/home/2025/', undefined)).toBe(true);
    expect(tokenAllows('organise', 'GET', '/tax/years/2025', undefined)).toBe(true);
  });

  it('a token that is not organise reads none of it', () => {
    for (const scope of ['read', 'categorise'] as const)
      for (const p of ['/tax/home/2025', '/tax/years/2025'])
        expect(tokenAllows(scope, 'GET', p, undefined), `${scope} ${p}`).toBe(false);
  });

  it('an organise token cannot write any of it, or lodge a year', () => {
    for (const [method, p] of [
      ['PUT', '/tax/home/days/2025-08-04'],
      ['DELETE', '/tax/home/days/2025-08-04'],
      ['POST', '/tax/home/fill'],
      ['PUT', '/tax/home/years/2025'],
      ['PUT', '/tax/lodged/2025'],
      ['DELETE', '/tax/lodged/2025'],
      ['GET', '/tax/home/days/2025-08-04'],
      ['GET', '/tax/home/2025/extra'],
      ['GET', '/tax/lodged'],
    ] as const)
      expect(tokenAllows('organise', method, p, {}), `${method} ${p}`).toBe(false);
  });
});

describe('backups', () => {
  it('round-trips hours, rates, lodged figures and the year link (format 33)', async () => {
    await day('2025-08-04', 600);
    await send('PUT', '/home/years/2025', { rateTenths: 750, notes: 'n' });
    await send('PUT', '/lodged/2025');
    const doc = addDocument({
      upload: uploadFromBytes(Buffer.from('Mock bill\n')),
      fileName: 'bill.txt',
    });
    linkDocument(doc.id, 'homeYear', '2025');
    const backup = JSON.parse(JSON.stringify(createBackup()));
    expect(backup.version).toBe(33);
    expect(backup.taxHomeHours).toHaveLength(1);
    expect(backup.taxLodgedFigures).toHaveLength(1);

    db.delete(taxHomeHours).run();
    db.delete(taxLodgedYears).run();
    restoreBackup(parseBackup(backup));
    expect(db.select().from(taxHomeHours).all()).toHaveLength(1);
    expect(db.select().from(schema.taxLodgedFigures).all()).toHaveLength(1);
    expect(taxYear(2025).home).toMatchObject({ claim: 750, rateSource: 'override' });
    expect(getDocument(doc.id).links.map((l) => l.kind)).toEqual(['homeYear']);
  });

  it('restores a version 32 backup with the new tables empty', async () => {
    await day('2025-08-04', 600);
    const older = JSON.parse(JSON.stringify(createBackup()));
    older.version = 32;
    delete older.taxHomeHours;
    delete older.taxHomeYears;
    delete older.taxLodgedFigures;
    restoreBackup(parseBackup(older));
    expect(db.select().from(taxHomeHours).all()).toEqual([]);
    expect(db.select().from(taxHomeYears).all()).toEqual([]);
  });

  it('refuses lodged figures for a year that is not lodged, and impossible hours', () => {
    const backup = JSON.parse(JSON.stringify(createBackup()));
    expect(() =>
      parseBackup({
        ...backup,
        taxLodgedFigures: [
          { financialYear: 2025, part: 'home', figures: '{"claim":1}', recordedAt: 'x' },
        ],
      }),
    ).toThrow(/lodged figures/);
    expect(() =>
      parseBackup({
        ...backup,
        taxHomeHours: [
          { workDate: '2025-08-04', minutes: 2000, notes: null, createdAt: 'x', updatedAt: 'x' },
        ],
      }),
    ).toThrow(/hours/);
  });
});

describe('migration 0085 working from home', () => {
  it('adds the tables to a populated 0084 database and keeps claims and lodged years', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'tax-home-'));
    fs.cpSync('src/db/migrations', folder, { recursive: true });
    const journalPath = path.join(folder, 'meta', '_journal.json');
    const full = fs.readFileSync(journalPath, 'utf8');
    const journal = JSON.parse(full);
    journal.entries = journal.entries.filter((e: { tag: string }) => e.tag < '0085');
    fs.writeFileSync(journalPath, JSON.stringify(journal));

    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const old = drizzle(sqlite);
    migrate(old, { migrationsFolder: folder });
    sqlite.exec(`
      INSERT INTO accounts (id, name, type, starting_balance) VALUES ('a', 'Mock card', 'credit', 0);
      INSERT INTO transactions (id, account_id, date, amount, payee_name) VALUES ('t', 'a', '2025-09-01', -2000, 'Mock');
      INSERT INTO tax_claims (transaction_id, label, work_use_bps, created_at, updated_at) VALUES ('t', 'D5', 10000, 'x', 'x');
      INSERT INTO tax_lodged_years (financial_year, lodged_at) VALUES (2024, '2024-10-01');
    `);
    const rows = () => ({
      claims: sqlite.prepare('SELECT * FROM tax_claims').all(),
      lodged: sqlite.prepare('SELECT * FROM tax_lodged_years').all(),
      links: sqlite.prepare('SELECT * FROM document_links').all(),
    });
    const before = rows();

    fs.writeFileSync(journalPath, full);
    migrate(old, { migrationsFolder: folder });
    expect(rows()).toEqual(before);

    sqlite
      .prepare(
        "INSERT INTO tax_home_hours (work_date, minutes, created_at, updated_at) VALUES ('2025-08-04', 60, 'x', 'x')",
      )
      .run();
    for (const minutes of [0, 1441])
      expect(() =>
        sqlite
          .prepare(
            `INSERT INTO tax_home_hours (work_date, minutes, created_at, updated_at) VALUES ('2025-08-0${minutes ? 5 : 6}', ${minutes}, 'x', 'x')`,
          )
          .run(),
      ).toThrow(/CHECK/);
    sqlite
      .prepare(
        "INSERT INTO tax_lodged_figures (financial_year, part, figures, recorded_at) VALUES (2024, 'home', '{}', 'x')",
      )
      .run();
    // Unlodging cascades to the snapshot
    sqlite.prepare('DELETE FROM tax_lodged_years WHERE financial_year = 2024').run();
    expect(sqlite.prepare('SELECT * FROM tax_lodged_figures').all()).toEqual([]);
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO tax_lodged_figures (financial_year, part, figures, recorded_at) VALUES (1999, 'home', '{}', 'x')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY/);
    sqlite.close();
  });
});
