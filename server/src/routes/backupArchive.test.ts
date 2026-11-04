import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

// A backup with files (audit decision I-6): the JSON backup and every stored file, in one ZIP.
// Made-up files only, in a throwaway files folder.
const filesDir = mkdtempSync(path.join(tmpdir(), 'allotment-archive-test-'));
process.env.FLYBUDGET_FILES_DIR = filesDir;

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { db } = await import('../db/index.js');
const { documents, receiptFiles, documentLinks, documentTags, receipts } =
  await import('../db/schema.js');
const { backupArchiveRouter } = await import('./backupArchive.js');
const { addDocument } = await import('../services/documentService.js');
const { receiveUpload, storedFile, uploadFromBytes } = await import('../services/fileStore.js');
const { zipEntries, zipEntryData } = await import('../utils/unzip.js');
const { tokenAllows } = await import('../auth/accessTokens.js');

let server: Server;
let base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use('/backup-archive', backupArchiveRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/backup-archive`;
});
afterAll(() => {
  server.close();
  rmSync(filesDir, { recursive: true, force: true });
});

/** A new installation's files: no stored bytes, nothing in the folder */
function forgetFiles() {
  for (const table of [receipts, documentTags, documentLinks, documents, receiptFiles])
    db.delete(table).run();
  for (const name of readdirSync(filesDir))
    rmSync(path.join(filesDir, name), { recursive: true, force: true });
}
beforeEach(forgetFiles);

const note = Buffer.from('Insurance policy number 12345\n', 'utf8');
/** A made-up MP4 just over 25 MB, so it is kept on disk */
function bigVideo() {
  const video = Buffer.alloc(26 * 1024 * 1024, 7);
  video.writeUInt32BE(24, 0);
  video.write('ftypisom', 4, 'latin1');
  video.write('isommp42', 16, 'latin1');
  return video;
}

async function twoFiles() {
  const text = addDocument({ upload: uploadFromBytes(note), fileName: 'policy.txt' });
  const video = await receiveUpload(Readable.from([bigVideo()]));
  expect(video.tempPath).not.toBeNull();
  const clip = addDocument({ upload: video, fileName: 'car.mp4' });
  const rows = db.select().from(documents).all();
  const fileOf = (id: string) => rows.find((r) => r.id === id)!.fileId;
  return { text: fileOf(text.id), video: fileOf(clip.id) };
}

async function download() {
  const res = await fetch(base);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('application/zip');
  return Buffer.from(await res.arrayBuffer());
}
const restore = (body: Buffer, type = 'application/zip') =>
  fetch(`${base}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': type },
    body: new Uint8Array(body),
  });

describe('backup with files (audit I-6)', () => {
  it('holds the JSON backup and every file by its hash, and no secrets', async () => {
    const ids = await twoFiles();
    const archive = await download();
    const entries = zipEntries(archive)!;
    expect(entries.map((e) => e.name).sort()).toEqual(
      ['README.txt', 'backup.json', `files/${ids.text}`, `files/${ids.video}`].sort(),
    );
    const json = JSON.parse(
      zipEntryData(
        archive,
        entries.find((e) => e.name === 'backup.json')!,
        50e6,
      )!.toString(),
    );
    expect(json.format).toBe('flybudget-backup');
    expect(json.documents).toHaveLength(2);
    for (const secret of ['upConnections', 'plaidItems', 'sessions', 'accessTokens'])
      expect(json).not.toHaveProperty(secret);
    expect(
      zipEntryData(
        archive,
        entries.find((e) => e.name === `files/${ids.text}`)!,
        1e6,
      ),
    ).toEqual(note);
  });

  it('restores on a new installation: the budget and the files, a video back on disk', async () => {
    const ids = await twoFiles();
    const archive = await download();
    forgetFiles();
    expect(storedFile(ids.text)).toBeNull();

    const res = await restore(archive);
    expect(res.status, await res.clone().text()).toBe(200);
    const body = await res.json();
    expect(body.files).toEqual({ added: 2, alreadyHere: 0, missing: 0 });
    expect(body.restored.documents).toBe(2);
    expect(storedFile(ids.text)!.data).toEqual(note);
    const video = storedFile(ids.video)!;
    expect(video.path && existsSync(video.path)).toBeTruthy();
    expect(db.select().from(documents).all()).toHaveLength(2);
    // The uploaded ZIP doesn't stay behind
    expect(readdirSync(path.join(filesDir, 'incoming'))).toEqual([]);
  });

  it('on the same installation, keeps the files it already has', async () => {
    await twoFiles();
    const res = await restore(await download());
    expect((await res.json()).files).toEqual({ added: 0, alreadyHere: 2, missing: 0 });
  });

  it('refuses a damaged file, and changes nothing: no budget rows, no stray files', async () => {
    const ids = await twoFiles();
    const archive = await download();
    // Flip a byte inside the stored note (entries are stored, so its bytes are in the ZIP as is)
    const at = archive.indexOf(note);
    archive[at] ^= 0xff;
    forgetFiles();
    const res = await restore(archive);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/damaged/);
    expect(db.select().from(documents).all()).toEqual([]);
    expect(storedFile(ids.text)).toBeNull();
    expect(storedFile(ids.video)).toBeNull();
  });

  it('says what is wrong with something that is not a backup with files', async () => {
    expect((await restore(Buffer.from('hello'))).status).toBe(400);
    const { zip } = await import('../utils/zip.js');
    const noBackup = zip([{ name: 'photo.jpg', data: Buffer.from([1, 2, 3]) }]);
    const res = await restore(noBackup);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/backup\.json/);
    expect((await restore(noBackup, 'application/json')).status).toBe(415);
  });

  it('is never reachable with an access token', () => {
    for (const scope of ['read', 'categorise', 'organise'] as const) {
      expect(tokenAllows(scope, 'GET', '/backup-archive', undefined)).toBe(false);
      expect(tokenAllows(scope, 'POST', '/backup-archive/restore', undefined)).toBe(false);
    }
  });
});
