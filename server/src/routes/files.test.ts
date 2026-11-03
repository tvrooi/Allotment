import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

// Files (docs/FILES.md), in server mode so tokens apply. Mock data and made-up files only.
process.env.FLYBUDGET_SERVER_MODE = 'true';
process.env.FLYBUDGET_ALLOWED_HOSTS = 'budget.example.com';
const filesDir = mkdtempSync(path.join(tmpdir(), 'allotment-files-test-'));
process.env.FLYBUDGET_FILES_DIR = filesDir;

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { eq } = await import('drizzle-orm');
const { db } = await import('../db/index.js');
const schema = await import('../db/schema.js');
const {
  accounts,
  budgetSettings,
  categories,
  categoryGroups,
  documentLinks,
  documents,
  documentTags,
  goals,
  receiptFiles,
  receipts,
  tags,
  transactions,
} = schema;
const { hostGuard, originGuard, errorHandler } = await import('../middleware/security.js');
const { authRouter, requireSession } = await import('./auth.js');
const { createSession, setInitialPassword, SESSION_COOKIE } = await import('../auth/sessions.js');
const { accessTokensRouter } = await import('./accessTokens.js');
const { receiptsRouter } = await import('./receipts.js');
const { filesRouter } = await import('./files.js');
const { categoriesRouter } = await import('./categories.js');
const { transactionsRouter } = await import('./transactions.js');
const { sniffFileType } = await import('../services/fileTypes.js');
const { extractText, indexText } = await import('../services/fileText.js');
const { createBackup, parseBackup, restoreBackup } = await import('../services/backupService.js');
const { zip } = await import('../utils/zip.js');
const { taxYear, taxYearArchive } = await import('../services/taxService.js');
const { zipEntries, zipEntryData } = await import('../utils/unzip.js');

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
  app.use('/api/files', filesRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => {
  server.close();
  rmSync(filesDir, { recursive: true, force: true });
});

beforeEach(() => {
  db.delete(documentLinks).run();
  db.delete(documentTags).run();
  db.delete(schema.taxClaims).run();
  db.delete(receipts).run();
  db.delete(documents).run();
  db.delete(receiptFiles).run();
  db.delete(transactions).run();
  db.delete(goals).run();
  db.delete(categories).run();
  db.delete(categoryGroups).run();
  db.delete(tags).run();
  db.delete(accounts).run();
  db.update(budgetSettings).set({ filesCapMb: null }).run();
  db.insert(accounts)
    .values({ id: 'card', name: 'Card', type: 'credit', startingBalance: 0 })
    .run();
  db.insert(categoryGroups).values({ id: 'g', name: 'Living', sortOrder: 0 }).run();
  db.insert(categories)
    .values([
      { id: 'home', name: 'Home', groupId: 'g', sortOrder: 0 },
      { id: 'house', name: 'House', groupId: 'g', sortOrder: 1 },
    ])
    .run();
  db.insert(goals).values({ id: 'car', name: 'New car', targetAmount: 1_000_000 }).run();
  db.insert(tags).values({ id: 'tax', name: 'Tax' }).run();
  const tx = (id: string, date: string, amount: number, payeeName: string) => ({
    id,
    accountId: 'card',
    date,
    amount,
    payeeName,
    createdAt: date,
  });
  db.insert(transactions)
    .values([
      tx('fridge', '2026-08-03', -149_900, 'Appliances R Us'),
      tx('insurance', '2026-09-01', -60_000, 'Insurer'),
      tx('refund', '2026-09-10', 5_000, 'Appliances R Us'),
    ])
    .run();
});

async function call(
  method: string,
  url: string,
  opts: { token?: string; body?: unknown; raw?: Uint8Array; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  else headers.cookie = cookie;
  let body: BodyInit | undefined;
  if (opts.raw) {
    headers['content-type'] = 'application/octet-stream';
    body = opts.raw as unknown as BodyInit;
  } else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(base + url, { method, headers, body });
  const bytes = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') ?? '';
  return {
    status: res.status,
    headers: res.headers,
    bytes,
    body: type.includes('json') && bytes.length ? JSON.parse(bytes.toString('utf8')) : null,
  };
}

const png = (fill = 'x') =>
  Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), Buffer.from(fill.repeat(64))]);
const gif = () => Buffer.from('GIF89a' + 'x'.repeat(40), 'latin1');
const pdf = (text = 'Warranty for fridge') => {
  const stream = deflateSync(Buffer.from(`BT /F1 12 Tf 72 712 Td (${text}) Tj ET`));
  return Buffer.concat([
    Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`),
    stream,
    Buffer.from('\nendstream\nendobj\n%%EOF\n'),
  ]);
};
const docx = (text: string, extra: { name: string; data: Uint8Array }[] = []) =>
  zip([
    { name: '[Content_Types].xml', data: Buffer.from('<Types/>') },
    {
      name: 'word/document.xml',
      data: Buffer.from(
        `<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p><w:p><w:r><w:t>Second &amp; last</w:t></w:r></w:p></w:body></w:document>`,
      ),
    },
    ...extra,
  ]);
const ods = () =>
  zip([
    { name: 'mimetype', data: Buffer.from('application/vnd.oasis.opendocument.spreadsheet') },
    {
      name: 'content.xml',
      data: Buffer.from(
        '<office:document-content><text:p>Policy 12345</text:p></office:document-content>',
      ),
    },
  ]);
const mp4Head = () => {
  const head = Buffer.alloc(32);
  head.writeUInt32BE(32, 0);
  head.write('ftypisom', 4, 'latin1');
  return head;
};

async function upload(name: string, bytes: Buffer, query = '') {
  const res = await call('POST', `/files?fileName=${encodeURIComponent(name)}${query}`, {
    raw: bytes,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

describe('file types', () => {
  it('reads what a file is from its bytes, and plain text only when it really is text', () => {
    expect(sniffFileType(png(), 'x.pdf')).toBe('image/png');
    expect(sniffFileType(gif())).toBe('image/gif');
    expect(sniffFileType(pdf())).toBe('application/pdf');
    expect(sniffFileType(docx('Hello'), 'a.zip')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(sniffFileType(ods())).toBe('application/vnd.oasis.opendocument.spreadsheet');
    expect(sniffFileType(Buffer.concat([mp4Head(), Buffer.alloc(100)]))).toBe('video/mp4');
    expect(sniffFileType(Buffer.from('a,b\n1,2\n'), 'budget.csv')).toBe('text/csv');
    expect(sniffFileType(Buffer.from('# Notes'), 'notes.md')).toBe('text/markdown');
    // Not by its name alone: NUL bytes, invalid UTF-8, or no text extension
    expect(sniffFileType(Buffer.from('a\0b'), 'x.txt')).toBeNull();
    expect(sniffFileType(Buffer.from([0xc3, 0x28]), 'x.txt')).toBeNull();
    expect(sniffFileType(Buffer.from('<svg onload="alert(1)"/>'), 'x.svg')).toBeNull();
    expect(sniffFileType(Buffer.from('<html><script></script>'), 'x.html')).toBeNull();
    // A ZIP that is not a document, and a macro-enabled one
    expect(sniffFileType(zip([{ name: 'a.txt', data: Buffer.from('a') }]))).toBeNull();
    expect(
      sniffFileType(docx('x', [{ name: 'word/vbaProject.bin', data: Buffer.from('macro') }])),
    ).toBeNull();
  });

  it('finds the text in documents for search', () => {
    expect(extractText(docx('Fridge warranty'), sniffFileType(docx('x'))!)).toBe(
      'Fridge warranty\nSecond & last',
    );
    expect(extractText(ods(), 'application/vnd.oasis.opendocument.spreadsheet')).toBe(
      'Policy 12345',
    );
    expect(extractText(pdf('Serial no. AB-123'), 'application/pdf')).toBe('Serial no. AB-123');
    expect(extractText(Buffer.from('Date,Amount\n2026-08-03,1499'), 'text/csv')).toContain(
      '2026-08-03',
    );
  });

  it('reads ZIP entries without letting one expand past its limit', () => {
    const big = zip([{ name: 'big.xml', data: Buffer.alloc(100_000, 0x41) }]);
    const entry = zipEntries(big)![0];
    expect(zipEntryData(big, entry, 1_000)).toBeNull();
    expect(zipEntryData(big, entry, 200_000)?.length).toBe(100_000);
  });
});

describe('the library', () => {
  it('adds any kind of document, labels it and finds it by name, label, content and kind', async () => {
    const warranty = await upload('Fridge warranty.docx', docx('Serial AB-123'), '&tagIds=tax');
    expect(warranty).toMatchObject({
      fileName: 'Fridge warranty.docx',
      kind: 'document',
      hasFile: true,
      tags: [{ id: 'tax', name: 'Tax' }],
      links: [],
      receipt: null,
    });
    await upload('photo.png', png());
    indexText(warranty.id);

    const find = async (q: string) =>
      (await call('GET', `/files?${q}`)).body.documents.map(
        (d: { fileName: string }) => d.fileName,
      );
    expect(await find('q=ab-123')).toEqual(['Fridge warranty.docx']);
    expect(await find('q=tax')).toEqual(['Fridge warranty.docx']);
    expect(await find('tag=tax')).toEqual(['Fridge warranty.docx']);
    expect(await find('kind=image')).toEqual(['photo.png']);
    expect(await find('q=100%25')).toEqual([]);

    const changed = await call('PATCH', `/files/${warranty.id}`, {
      body: {
        fileName: 'Fridge warranty',
        description: 'Five years, from the shop',
        documentDate: '2026-08-03',
        important: true,
        starred: true,
        tagIds: [],
      },
    });
    expect(changed.body).toMatchObject({
      fileName: 'Fridge warranty',
      description: 'Five years, from the shop',
      date: '2026-08-03',
      important: true,
      starred: true,
      tags: [],
    });
    expect(await find('important=1')).toEqual(['Fridge warranty']);
    expect(await find('starred=1')).toEqual(['Fridge warranty']);
    expect(await find('from=2026-08-01&to=2026-08-31')).toEqual(['Fridge warranty']);
  });

  it('links one file to many transactions, categories, goals and accounts; unlinking keeps it', async () => {
    const policy = await upload('policy.pdf', pdf(), '&linkKind=transaction&linkId=insurance');
    for (const [kind, id] of [
      ['transaction', 'fridge'],
      ['category', 'home'],
      ['goal', 'car'],
      ['account', 'card'],
    ])
      expect((await call('POST', `/files/${policy.id}/links`, { body: { kind, id } })).status).toBe(
        201,
      );
    const detail = (await call('GET', `/files/${policy.id}`)).body;
    expect(
      detail.links.map((l: { kind: string; label: string }) => `${l.kind}:${l.label}`).sort(),
    ).toEqual([
      'account:Card',
      'category:Home',
      'goal:New car',
      'transaction:Appliances R Us',
      'transaction:Insurer',
    ]);
    expect(
      (await call('POST', `/files/${policy.id}/links`, { body: { kind: 'goal', id: 'nope' } }))
        .status,
    ).toBe(404);

    const counts = (await call('GET', '/files/counts?kind=transaction')).body;
    expect(counts).toEqual(
      expect.arrayContaining([
        { id: 'fridge', count: 1 },
        { id: 'insurance', count: 1 },
      ]),
    );
    const forGoal = (await call('GET', '/files?linkKind=goal&linkId=car')).body;
    expect(forGoal.total).toBe(1);

    const unlinked = await call('DELETE', `/files/${policy.id}/links/transaction/fridge`);
    expect(unlinked.body.links).toHaveLength(4);
    // Deleting what it is linked to removes only the link
    db.delete(transactions).where(eq(transactions.id, 'insurance')).run();
    const after = (await call('GET', `/files/${policy.id}`)).body;
    expect(after.links.map((l: { kind: string }) => l.kind).sort()).toEqual([
      'account',
      'category',
      'goal',
    ]);
    expect((await call('GET', '/files?linked=0')).body.total).toBe(0);
  });

  it('filters the register to transactions with receipts or files, or without', async () => {
    await upload('policy.pdf', pdf(), '&linkKind=transaction&linkId=insurance');
    await call('POST', '/receipts?transactionId=fridge&fileName=r.png', { raw: png('r') });
    const ids = async (q: string) =>
      (await call('GET', `/transactions?${q}`)).body.map((t: { id: string }) => t.id).sort();
    expect(await ids('has_files=1')).toEqual(['fridge', 'insurance']);
    expect(await ids('has_files=0')).toEqual(['refund']);
  });

  it('moves a merged category’s files to the category it joins', async () => {
    const one = await upload('rates.pdf', pdf(), '&linkKind=category&linkId=home');
    await call('POST', `/files/${one.id}/links`, { body: { kind: 'category', id: 'house' } });
    const two = await upload('lease.pdf', pdf('Lease'), '&linkKind=category&linkId=home');
    expect((await call('DELETE', '/categories/home?reassignTo=house')).status).toBe(204);
    expect((await call('GET', '/files?linkKind=category&linkId=house')).body.total).toBe(2);
    expect((await call('GET', `/files/${one.id}`)).body.links).toHaveLength(1);
    expect((await call('GET', `/files/${two.id}`)).body.links[0]).toMatchObject({ id: 'house' });
  });

  it('serves photos and videos inline and everything else as a download, never sniffed', async () => {
    const photo = await upload('p.png', png());
    const sheet = await upload('s.csv', Buffer.from('=HYPERLINK("x"),1\n'));
    const a = await call('GET', `/files/${photo.id}/file`);
    expect(a.headers.get('content-disposition')).toMatch(/^inline/);
    expect(a.headers.get('x-content-type-options')).toBe('nosniff');
    expect(a.headers.get('content-security-policy')).toContain('sandbox');
    const b = await call('GET', `/files/${sheet.id}/file`);
    expect(b.headers.get('content-type')).toMatch(/^text\/csv/);
    expect(b.headers.get('content-disposition')).toMatch(/^attachment/);
    expect(
      (await call('GET', `/files/${photo.id}/file?download`)).headers.get('content-disposition'),
    ).toMatch(/^attachment/);
  });

  it('refuses unknown types, empty files and a body sent as JSON', async () => {
    expect(
      (await call('POST', '/files?fileName=x.exe', { raw: Buffer.from('MZ\x90\0') })).status,
    ).toBe(415);
    expect((await call('POST', '/files?fileName=x.png', { raw: Buffer.alloc(0) })).status).toBe(
      400,
    );
    expect((await call('POST', '/files?fileName=x.txt', { body: { a: 1 } })).status).toBe(400);
  });

  it('keeps videos over 25 MB on disk, plays them by range, and refuses anything else that large', async () => {
    const video = Buffer.concat([mp4Head(), Buffer.alloc(26 * 1024 * 1024, 7)]);
    const added = await upload('house contents.mp4', video);
    expect(added).toMatchObject({ kind: 'video', size: video.length, hasFile: true });
    expect(db.select().from(receiptFiles).get()).toMatchObject({ onDisk: 1 });
    expect(readdirSync(filesDir)).toContain(added.fileId);

    const part = await call('GET', `/files/${added.id}/file`, { headers: { range: 'bytes=0-15' } });
    expect(part.status).toBe(206);
    expect(part.bytes.subarray(4, 12).toString('latin1')).toBe('ftypisom');
    expect(part.headers.get('content-disposition')).toMatch(/^inline/);

    const tooBig = Buffer.concat([pdf(), Buffer.alloc(26 * 1024 * 1024)]);
    expect((await call('POST', '/files?fileName=big.pdf', { raw: tooBig })).status).toBe(413);
    expect(readdirSync(path.join(filesDir, 'incoming'))).toEqual([]);

    expect((await call('DELETE', `/files/${added.id}`)).status).toBe(204);
    expect(existsSync(path.join(filesDir, added.fileId))).toBe(false);
  });

  it('serves a small file’s ranges from the database too', async () => {
    const added = await upload('clip.mp4', Buffer.concat([mp4Head(), Buffer.alloc(1000, 1)]));
    const part = await call('GET', `/files/${added.id}/file`, { headers: { range: 'bytes=-10' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe('bytes 1022-1031/1032');
    expect(
      (await call('GET', `/files/${added.id}/file`, { headers: { range: 'bytes=5000-' } })).status,
    ).toBe(416);
  });

  it('keeps to the owner’s storage limit, counting a file stored once only once', async () => {
    const first = png('a'.repeat(20_000));
    await upload('one.png', first);
    const s = (await call('PUT', '/files/storage', { body: { capMb: 1 } })).body;
    expect(s).toMatchObject({ capMb: 1, documents: 1, files: 1 });
    // The same bytes again take no more room
    await upload('again.png', first);
    const big = png('b'.repeat(1024 * 1024));
    expect((await call('POST', '/files?fileName=big.png', { raw: big })).status).toBe(413);
  });
});

describe('receipts in Files', () => {
  it('shows every receipt as a document, with its match as a link', async () => {
    const r = await call('POST', '/receipts?transactionId=fridge&fileName=fridge.png', {
      raw: png('r'),
    });
    expect(r.status).toBe(201);
    const list = (await call('GET', '/files?receipt=1')).body;
    expect(list.total).toBe(1);
    expect(list.documents[0]).toMatchObject({
      id: r.body.documentId,
      receipt: { id: r.body.id, transactionId: 'fridge' },
      links: [{ kind: 'transaction', id: 'fridge', viaReceipt: true }],
    });
    expect((await call('GET', '/files/counts?kind=transaction')).body).toEqual([
      { id: 'fridge', count: 1 },
    ]);
    // Removing the link from Files unmatches the receipt
    await call('DELETE', `/files/${r.body.documentId}/links/transaction/fridge`);
    expect((await call('GET', `/receipts/${r.body.id}`)).body.transactionId).toBeNull();
  });

  it('keeps a file a document still uses when the receipt with the same bytes is deleted', async () => {
    const bytes = png('same');
    const r = await call('POST', '/receipts?fileName=a.png', { raw: bytes });
    const doc = await upload('copy.png', bytes);
    expect(doc.fileId).toBe(r.body.fileId);
    expect((await call('DELETE', `/receipts/${r.body.id}`)).status).toBe(204);
    expect((await call('GET', `/files/${r.body.documentId}`)).status).toBe(404);
    expect((await call('GET', `/files/${doc.id}/file`)).status).toBe(200);
    expect((await call('DELETE', `/files/${doc.id}`)).status).toBe(204);
    expect(db.select().from(receiptFiles).all()).toEqual([]);
  });

  it('makes a photo or PDF a receipt, matched to the one transaction it is linked to', async () => {
    const doc = await upload('invoice.pdf', pdf(), '&linkKind=transaction&linkId=fridge');
    const made = await call('POST', `/files/${doc.id}/receipt`);
    expect(made.status).toBe(201);
    expect(made.body.receipt).toMatchObject({ documentId: doc.id, transactionId: 'fridge' });
    expect(made.body.document.links).toEqual([
      expect.objectContaining({ kind: 'transaction', id: 'fridge', viaReceipt: true }),
    ]);
    expect((await call('POST', `/files/${doc.id}/receipt`)).status).toBe(409);
    const sheet = await upload('s.csv', Buffer.from('a,b\n'));
    expect((await call('POST', `/files/${sheet.id}/receipt`)).status).toBe(400);
    // Deleting the document deletes its receipt
    expect((await call('DELETE', `/files/${doc.id}`)).status).toBe(204);
    expect(db.select().from(receipts).all()).toEqual([]);
  });
});

describe('tax time', () => {
  it('counts a file linked to a claimed transaction as its evidence, and puts it in the archive', async () => {
    db.insert(schema.taxClaims)
      .values({
        transactionId: 'insurance',
        label: 'D15',
        workUseBps: 10_000,
        createdAt: 'x',
        updatedAt: 'x',
      })
      .run();
    expect(taxYear(2026).missingReceipts).toBe(1);
    await upload('Income protection policy.pdf', pdf(), '&linkKind=transaction&linkId=insurance');
    const year = taxYear(2026);
    expect(year.missingReceipts).toBe(0);
    expect(year.claims[0].files).toEqual([
      expect.objectContaining({ fileName: 'Income protection policy.pdf' }),
    ]);
    const archive = taxYearArchive(2026);
    expect(zipEntries(archive.data)!.map((e) => e.name)).toContain(
      'files/2026-09-01 D15 Income protection policy.pdf',
    );
  });
});

describe('backups and export', () => {
  it('carries documents, links and labels, and gives receipts from older backups their documents', async () => {
    const doc = await upload('plan.pdf', pdf(), '&linkKind=goal&linkId=car&tagIds=tax');
    await call('POST', '/receipts?fileName=r.png', { raw: png('r') });
    const backup = JSON.parse(JSON.stringify(createBackup()));
    expect(backup.version).toBe(23);
    expect(backup.documents).toHaveLength(2);
    expect(backup.documentLinks).toHaveLength(1);
    expect(backup.documentTags).toHaveLength(1);
    restoreBackup(parseBackup(backup));
    expect((await call('GET', `/files/${doc.id}`)).body).toMatchObject({
      hasFile: true,
      links: [{ kind: 'goal', id: 'car' }],
      tags: [{ id: 'tax' }],
    });

    // Format 22: no Files tables, receipts without documents
    const old = { ...backup, version: 22 };
    delete old.documents;
    delete old.documentLinks;
    delete old.documentTags;
    for (const r of old.receipts) delete r.documentId;
    restoreBackup(parseBackup(old));
    const list = (await call('GET', '/files')).body;
    expect(list.total).toBe(1);
    expect(list.documents[0].receipt).not.toBeNull();
  });

  it('exports every file in one ZIP with an index', async () => {
    await upload('Fridge warranty.pdf', pdf(), '&linkKind=transaction&linkId=fridge');
    await upload('notes.md', Buffer.from('# Home\n'));
    const res = await call('GET', '/files/export');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    const entries = zipEntries(res.bytes)!;
    const names = entries.map((e) => e.name);
    expect(names).toHaveLength(3);
    expect(names).toContain('files.csv');
    expect(names.some((n) => /^files\/\d{4}-\d{2}-\d{2} Fridge warranty\.pdf$/.test(n))).toBe(true);
    const index = zipEntryData(
      res.bytes,
      entries.find((e) => e.name === 'files.csv')!,
      1e6,
    )!;
    expect(index.toString('utf8')).toContain(
      'Transaction: 2026-08-03 Appliances R Us -1499.00 (Card)',
    );
  });

  it('never lets an access token see a file', async () => {
    const doc = await upload('a.png', png());
    const created = await call('POST', '/access-tokens', { body: { name: 'Assistant', days: 7 } });
    const token = created.body.token as string;
    for (const url of [
      '/files',
      `/files/${doc.id}`,
      `/files/${doc.id}/file`,
      '/files/export',
      '/files/storage',
    ])
      expect((await call('GET', url, { token })).status, url).toBe(403);
    expect((await call('DELETE', `/files/${doc.id}`, { token })).status).toBe(403);
    expect((await call('POST', '/files?fileName=a.png', { token, raw: png() })).status).toBe(403);
  });
});
