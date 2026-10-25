import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// Receipts and tax deductions (docs/RECEIPTS-AND-TAX.md), in server mode so tokens apply.
// Mock data and made-up files only.
process.env.FLYBUDGET_SERVER_MODE = 'true';
process.env.FLYBUDGET_ALLOWED_HOSTS = 'budget.example.com';

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { db } = await import('../db/index.js');
const { accounts, receiptFiles, receipts, taxClaims, transactions } =
  await import('../db/schema.js');
const { hostGuard, originGuard, errorHandler } = await import('../middleware/security.js');
const { authRouter, requireSession } = await import('./auth.js');
const { createSession, setInitialPassword, SESSION_COOKIE } = await import('../auth/sessions.js');
const { accessTokensRouter } = await import('./accessTokens.js');
const { receiptsRouter } = await import('./receipts.js');
const { taxRouter } = await import('./tax.js');
const { sniffReceiptType } = await import('../services/receiptService.js');
const { financialYearOf, taxYear } = await import('../services/taxService.js');
const { insertNewTransaction, buildRuleContext } = await import('../services/ruleService.js');
const { createBackup, parseBackup, restoreBackup, BACKUP_TABLES } =
  await import('../services/backupService.js');
const { crc32 } = await import('../utils/zip.js');

let server: Server;
let base: string;
let cookie: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  await setInitialPassword('correct horse battery staple');
  cookie = `${SESSION_COOKIE}=${createSession('vitest').token}`;
  const app = express();
  app.use(hostGuard, originGuard, express.json());
  app.use('/api/auth', authRouter);
  app.use('/api', requireSession);
  app.use('/api/access-tokens', accessTokensRouter);
  app.use('/api/receipts', receiptsRouter);
  app.use('/api/tax', taxRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

beforeEach(() => {
  db.delete(receipts).run();
  db.delete(receiptFiles).run();
  db.delete(taxClaims).run();
  db.delete(transactions).run();
  db.delete(accounts).run();
  db.insert(accounts)
    .values({ id: 'card', name: 'Card', type: 'credit', startingBalance: 0 })
    .run();
  const tx = (id: string, date: string, amount: number, payeeName: string, extra = {}) => ({
    id,
    accountId: 'card',
    date,
    amount,
    payeeName,
    createdAt: date,
    ...extra,
  });
  db.insert(transactions)
    .values([
      tx('laptop', '2026-08-03', -149_900, 'Officeworks'),
      tx('uniform', '2027-06-30', -8_995, 'Uniforms Co'),
      tx('next-year', '2027-07-01', -5_000, 'Officeworks'),
      tx('coffee', '2026-08-05', -650, 'Cafe'),
      tx('pay', '2026-08-04', 500_000, 'Employer'),
    ])
    .run();
});

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; raw?: Uint8Array; type?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  else headers.cookie = cookie;
  let body: BodyInit | undefined;
  if (opts.raw) {
    headers['content-type'] = opts.type ?? 'application/octet-stream';
    body = opts.raw as unknown as BodyInit;
  } else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(base + path, { method, headers, body });
  const bytes = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') ?? '';
  return {
    status: res.status,
    headers: res.headers,
    bytes,
    body: type.includes('json') && bytes.length ? JSON.parse(bytes.toString('utf8')) : null,
  };
}

/** A tiny real JPEG header followed by filler: enough for the type check */
const jpeg = (fill = 'x') =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(fill.repeat(64))]);
const pdf = () => Buffer.from('%PDF-1.7\n% made-up receipt\n');

describe('receipts', () => {
  it('reads the real type from the bytes, never the name', () => {
    expect(sniffReceiptType(jpeg())).toBe('image/jpeg');
    expect(sniffReceiptType(pdf())).toBe('application/pdf');
    expect(sniffReceiptType(Buffer.from('\x89PNG\r\n\x1a\n....', 'latin1'))).toBe('image/png');
    expect(sniffReceiptType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
  });

  it('uploads to a transaction, stores each file once, and cleans up after the last', async () => {
    const one = await call('POST', '/receipts?transactionId=laptop&fileName=laptop.jpg', {
      raw: jpeg(),
      type: 'image/jpeg',
    });
    expect(one.status).toBe(201);
    expect(one.body).toMatchObject({
      transactionId: 'laptop',
      mimeType: 'image/jpeg',
      hasFile: true,
    });
    // The same photo again, in the inbox: a second receipt, one stored file
    const two = await call('POST', '/receipts?fileName=again.jpg', { raw: jpeg() });
    expect(two.body.transactionId).toBeNull();
    expect(db.select().from(receiptFiles).all()).toHaveLength(1);
    expect((await call('GET', '/receipts?inbox=1')).body.map((r: { id: string }) => r.id)).toEqual([
      two.body.id,
    ]);
    expect((await call('GET', '/receipts/counts')).body).toEqual([
      { transactionId: 'laptop', count: 1 },
    ]);

    expect((await call('DELETE', `/receipts/${one.body.id}`)).status).toBe(204);
    expect(db.select().from(receiptFiles).all()).toHaveLength(1);
    await call('DELETE', `/receipts/${two.body.id}`);
    expect(db.select().from(receiptFiles).all()).toHaveLength(0);
  });

  it('refuses what is not a receipt, too big, or for a missing transaction', async () => {
    const html = await call('POST', '/receipts', {
      raw: Buffer.from('<html>'),
      type: 'image/jpeg',
    });
    expect(html.status).toBe(400);
    const empty = await call('POST', '/receipts', { raw: new Uint8Array(0) });
    expect(empty.status).toBe(400);
    const big = await call('POST', '/receipts', {
      raw: Buffer.concat([jpeg(), Buffer.alloc(11 * 1024 * 1024)]),
    });
    expect(big.status).toBe(413);
    const lost = await call('POST', '/receipts?transactionId=nope', { raw: jpeg() });
    expect(lost.status).toBe(404);
  });

  it('serves photos inline and documents as downloads, with no sniffing or scripts', async () => {
    const photo = (await call('POST', '/receipts?fileName=a.jpg', { raw: jpeg() })).body;
    const doc = (await call('POST', '/receipts?fileName=b.pdf', { raw: pdf() })).body;
    const p = await call('GET', `/receipts/${photo.id}/file`);
    expect(p.status).toBe(200);
    expect(p.headers.get('content-type')).toBe('image/jpeg');
    expect(p.headers.get('x-content-type-options')).toBe('nosniff');
    expect(p.headers.get('content-security-policy')).toContain('sandbox');
    expect(p.headers.get('content-disposition')).toMatch(/^inline/);
    expect(p.bytes.equals(jpeg())).toBe(true);
    const d = await call('GET', `/receipts/${doc.id}/file`);
    expect(d.headers.get('content-disposition')).toMatch(/^attachment/);
  });

  it('suggests the transaction a receipt is for, exact totals first', async () => {
    const r = (await call('POST', '/receipts', { raw: jpeg() })).body;
    await call('PATCH', `/receipts/${r.id}`, {
      body: { receiptDate: '2026-08-04', total: 149_900, merchant: 'Officeworks' },
    });
    const matches = (await call('GET', `/receipts/${r.id}/matches`)).body;
    expect(matches[0]).toMatchObject({ id: 'laptop', exactAmount: true, daysApart: 1 });
    // Money in is never a match, and far-off totals are left out
    expect(matches.map((m: { id: string }) => m.id)).not.toContain('pay');
    expect(matches.map((m: { id: string }) => m.id)).not.toContain('coffee');
    await call('PATCH', `/receipts/${r.id}`, { body: { transactionId: 'laptop' } });
    expect((await call('GET', '/receipts?transactionId=laptop')).body).toHaveLength(1);
  });

  it('keeps a receipt in the inbox when its transaction is deleted', async () => {
    const r = (await call('POST', '/receipts?transactionId=coffee', { raw: jpeg() })).body;
    db.delete(transactions)
      .where(sql`id = 'coffee'`)
      .run();
    expect((await call('GET', '/receipts?inbox=1')).body[0].id).toBe(r.id);
  });
});

describe('tax deductions', () => {
  it('names financial years by the year they start', () => {
    expect(financialYearOf('2026-06-30')).toBe(2025);
    expect(financialYearOf('2026-07-01')).toBe(2026);
  });

  it('claims by label and work use, per financial year, with the checks that matter', async () => {
    const laptop = await call('PUT', '/tax/claims/laptop', {
      body: { label: 'D5', workUseBps: 8000, notes: 'Laptop for work' },
    });
    expect(laptop.status).toBe(200);
    await call('PUT', '/tax/claims/uniform', { body: { label: 'D3' } });
    await call('PUT', '/tax/claims/next-year', { body: { label: 'D5' } });
    await call('POST', '/receipts?transactionId=uniform', { raw: jpeg() });

    const year = (await call('GET', '/tax/years/2026')).body;
    expect(year).toMatchObject({ name: '2026–27', from: '2026-07-01', to: '2027-06-30' });
    expect(year.claims.map((c: { transactionId: string }) => c.transactionId)).toEqual([
      'laptop',
      'uniform',
    ]);
    expect(year.claims[0]).toMatchObject({
      cost: 149_900,
      claim: 119_920,
      overImmediateLimit: true,
    });
    expect(year.totals).toEqual([
      {
        label: 'D3',
        name: 'Work-related clothing, laundry and dry-cleaning',
        count: 1,
        total: 8_995,
      },
      { label: 'D5', name: 'Other work-related expenses', count: 1, total: 119_920 },
    ]);
    expect(year.missingReceipts).toBe(1);
    expect(year.notes.some((n: string) => n.includes('written evidence'))).toBe(true);
    expect(year.notes.some((n: string) => n.includes('decline in value'))).toBe(true);
    expect(
      (await call('GET', '/tax/years')).body.map((y: { financialYear: number }) => y.financialYear),
    ).toEqual(expect.arrayContaining([2027, 2026]));
  });

  it('refuses transfers, splits and bad shares', async () => {
    db.insert(transactions)
      .values({
        id: 'parent',
        accountId: 'card',
        date: '2026-08-01',
        amount: -100,
        isParent: 1,
        createdAt: 'x',
      })
      .run();
    expect((await call('PUT', '/tax/claims/parent', { body: { label: 'D5' } })).status).toBe(400);
    expect((await call('PUT', '/tax/claims/laptop', { body: { label: 'D99' } })).status).toBe(400);
    expect(
      (await call('PUT', '/tax/claims/laptop', { body: { label: 'D5', workUseBps: 0 } })).status,
    ).toBe(400);
    expect((await call('PUT', '/tax/claims/nope', { body: { label: 'D5' } })).status).toBe(404);
  });

  it('exports CSV safe for spreadsheets, and a ZIP with every receipt', async () => {
    db.insert(transactions)
      .values({
        id: 'evil',
        accountId: 'card',
        date: '2026-09-01',
        amount: -1_000,
        payeeName: '=HYPERLINK("x")',
        createdAt: 'x',
      })
      .run();
    await call('PUT', '/tax/claims/evil', { body: { label: 'D5' } });
    await call('PUT', '/tax/claims/laptop', { body: { label: 'D5' } });
    await call('POST', '/receipts?transactionId=laptop&fileName=laptop.jpg', { raw: jpeg() });
    const csv = await call('GET', '/tax/years/2026/csv');
    const text = csv.bytes.toString('utf8');
    expect(text).toContain("'=HYPERLINK");
    expect(text).toContain('2026-08-03,D5,Other work-related expenses,Officeworks');

    const archive = await call('GET', '/tax/years/2026/archive');
    expect(archive.headers.get('content-type')).toBe('application/zip');
    const entries = readZip(archive.bytes);
    expect(entries.map((e) => e.name)).toEqual([
      'deductions-2026-27.csv',
      'receipts/2026-08-03 D5 Officeworks.jpg',
    ]);
    expect(entries[1].data.equals(jpeg())).toBe(true);
  });

  it('leaves out a claim whose transaction was later split or made a transfer', async () => {
    await call('PUT', '/tax/claims/laptop', { body: { label: 'D5' } });
    await call('PUT', '/tax/claims/uniform', { body: { label: 'D3' } });
    db.update(transactions)
      .set({ isParent: 1 })
      .where(sql`id = 'laptop'`)
      .run();
    db.update(transactions)
      .set({ transferTransactionId: 'coffee' })
      .where(sql`id = 'uniform'`)
      .run();
    expect(taxYear(2026).claims).toEqual([]);
    expect((await call('GET', '/tax/claims')).body).toEqual([]);
    // The claim row is kept: undo the split and it counts again
    db.update(transactions)
      .set({ isParent: 0 })
      .where(sql`id = 'laptop'`)
      .run();
    expect(taxYear(2026).claims.map((c) => c.transactionId)).toEqual(['laptop']);
  });

  it('names every receipt in the archive uniquely, and neutralises formulas that look like numbers', async () => {
    db.insert(transactions)
      .values([
        {
          id: 'ow2',
          accountId: 'card',
          date: '2026-08-03',
          amount: -2_000,
          payeeName: 'Officeworks',
          createdAt: 'x',
        },
        {
          id: 'sum',
          accountId: 'card',
          date: '2026-08-04',
          amount: -500,
          payeeName: '-1+2',
          createdAt: 'x',
        },
      ])
      .run();
    for (const id of ['laptop', 'ow2', 'sum'])
      await call('PUT', `/tax/claims/${id}`, { body: { label: 'D5' } });
    await call('POST', '/receipts?transactionId=laptop', { raw: jpeg('a') });
    await call('POST', '/receipts?transactionId=ow2', { raw: jpeg('b') });
    const names = readZip((await call('GET', '/tax/years/2026/archive')).bytes).map((e) => e.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'receipts/2026-08-03 D5 Officeworks.jpg',
        'receipts/2026-08-03 D5 Officeworks 2.jpg',
      ]),
    );
    expect(new Set(names).size).toBe(names.length);
    const csv = (await call('GET', '/tax/years/2026/csv')).bytes.toString('utf8');
    expect(csv).toContain(",'-1+2,");
    expect(csv).not.toContain(',-1+2,');
  });

  it('is claimed by a rule as a payment imports, never replacing a claim', () => {
    const rule = {
      id: 'r',
      enabled: true,
      sortOrder: 0,
      conditionsOp: 'and' as const,
      conditions: [{ field: 'payee_name' as const, op: 'contains' as const, value: 'Officeworks' }],
      actions: [{ type: 'claim_tax_deduction' as const, value: 'D5' }],
    };
    const input = (amount: number) => ({
      accountId: 'card',
      date: '2026-10-01',
      amount,
      payeeId: null,
      payeeName: 'Officeworks',
      importedPayee: null,
      notes: null,
      categoryId: null,
      importedId: null,
    });
    const out = insertNewTransaction(input(-2_500), { rules: [rule], ctx: buildRuleContext() });
    expect(
      db
        .select()
        .from(taxClaims)
        .all()
        .find((c) => c.transactionId === out.transaction.id),
    ).toMatchObject({ label: 'D5', workUseBps: 10_000 });
    // A refund from the same shop is not claimed
    const refund = insertNewTransaction(input(2_500), { rules: [rule], ctx: buildRuleContext() });
    expect(
      db
        .select()
        .from(taxClaims)
        .all()
        .some((c) => c.transactionId === refund.transaction.id),
    ).toBe(false);
    expect(taxYear(2026).claims).toHaveLength(1);
  });
});

describe('backups and access', () => {
  it('carries receipt details and claims, keeps files on this installation', async () => {
    expect(BACKUP_TABLES).toEqual(expect.arrayContaining(['receipts', 'taxClaims']));
    await call('POST', '/receipts?transactionId=laptop', { raw: jpeg() });
    await call('PUT', '/tax/claims/laptop', { body: { label: 'D5' } });
    const backup = JSON.parse(JSON.stringify(createBackup()));
    expect(JSON.stringify(backup)).not.toContain('receipt_files');
    expect(backup.receipts).toHaveLength(1);
    restoreBackup(parseBackup(backup));
    const list = (await call('GET', '/receipts?transactionId=laptop')).body;
    expect(list[0]).toMatchObject({ hasFile: true });
    expect(db.select().from(taxClaims).all()).toHaveLength(1);
    // Restored where the file isn't: the receipt says so instead of failing
    db.delete(receiptFiles).run();
    const missing = (await call('GET', '/receipts?transactionId=laptop')).body[0];
    expect(missing.hasFile).toBe(false);
    expect((await call('GET', `/receipts/${missing.id}/file`)).status).toBe(404);
  });

  it('never lets a read-only token see receipts or claims', async () => {
    const created = await call('POST', '/access-tokens', { body: { name: 'Assistant', days: 7 } });
    const token = created.body.token as string;
    for (const path of [
      '/receipts',
      '/receipts/counts',
      '/tax/years',
      '/tax/years/2026',
      '/tax/claims',
    ]) {
      expect((await call('GET', path, { token })).status, path).toBe(403);
    }
  });
});

const { sql } = await import('drizzle-orm');

/** Reads a stored (uncompressed) ZIP's entries and checks each one's CRC */
function readZip(buf: Buffer) {
  const entries: { name: string; data: Buffer }[] = [];
  let at = 0;
  while (buf.readUInt32LE(at) === 0x04034b50) {
    const crc = buf.readUInt32LE(at + 14);
    const size = buf.readUInt32LE(at + 18);
    const nameLength = buf.readUInt16LE(at + 26);
    const extra = buf.readUInt16LE(at + 28);
    const name = buf.subarray(at + 30, at + 30 + nameLength).toString('utf8');
    const data = buf.subarray(at + 30 + nameLength + extra, at + 30 + nameLength + extra + size);
    expect(crc32(data)).toBe(crc);
    entries.push({ name, data: Buffer.from(data) });
    at += 30 + nameLength + extra + size;
  }
  expect(buf.readUInt32LE(buf.length - 22)).toBe(0x06054b50);
  return entries;
}
