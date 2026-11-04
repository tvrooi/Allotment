// Where stored files' bytes live (docs/FILES.md §2). One row per content in receipt_files, named
// by its SHA-256. Most files are kept in the database itself, so a cold copy of it holds them.
// Videos are too large for that: they go in a folder next to the database
// (<budget>-files/), which the Home Assistant backup and the desktop data folder include too.
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { databasePath, db } from '../db/index.js';
import { documents, receiptFiles, receipts } from '../db/schema.js';
import { looksLikeVideo } from './fileTypes.js';
import { getBudgetSettings } from './mainAmountService.js';

/** Largest file kept in the database */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Largest video (kept on disk) */
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

export class FileStoreError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** The folder for files kept on disk: next to the database, one per budget */
export function filesDir() {
  if (process.env.FLYBUDGET_FILES_DIR) return process.env.FLYBUDGET_FILES_DIR;
  if (databasePath === ':memory:') return path.join(tmpdir(), `allotment-files-${process.pid}`);
  const base = path.basename(databasePath).replace(/\.db$/i, '');
  return path.join(path.dirname(databasePath), `${base}-files`);
}

const HASH = /^[0-9a-f]{64}$/;
function diskPath(fileId: string) {
  // Ids are hashes this server computed; anything else never becomes a path
  if (!HASH.test(fileId)) throw new FileStoreError('Not a stored file', 404);
  return path.join(filesDir(), fileId);
}

/** A received file: its hash and size, and its bytes in memory or (a video) in a temporary file */
export type Upload = {
  sha256: string;
  size: number;
  bytes: Buffer | null;
  tempPath: string | null;
  /** Its first bytes, enough to tell what it is */
  head: Buffer;
};

/** An upload held in memory (tests, and callers that already have the bytes) */
export function uploadFromBytes(bytes: Buffer): Upload {
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
    bytes,
    tempPath: null,
    head: bytes.subarray(0, 64),
  };
}

/**
 * Read a request body as it arrives: in memory up to MAX_FILE_BYTES, and past that only when it
 * is a video, which is written to a temporary file in the files folder instead.
 */
export function receiveUpload(stream: Readable): Promise<Upload> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const chunks: Buffer[] = [];
    let size = 0;
    let head = Buffer.alloc(0);
    let file: ReturnType<typeof createWriteStream> | null = null;
    let tempPath: string | null = null;
    let failed = false;
    const fail = (error: Error) => {
      if (failed) return;
      failed = true;
      stream.unpipe?.();
      stream.resume();
      file?.destroy();
      if (tempPath) rmSync(tempPath, { force: true });
      reject(error);
    };
    stream.on('data', (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      hash.update(chunk);
      if (head.length < 64) head = Buffer.concat([head, chunk]).subarray(0, 64);
      if (!file && size > MAX_FILE_BYTES) {
        if (!looksLikeVideo(head))
          return fail(new FileStoreError('Files can be up to 25 MB (videos up to 250 MB)', 413));
        mkdirSync(path.join(filesDir(), 'incoming'), { recursive: true });
        tempPath = path.join(filesDir(), 'incoming', nanoid());
        file = createWriteStream(tempPath);
        file.on('error', fail);
        for (const c of chunks.splice(0)) file.write(c);
      }
      if (size > MAX_VIDEO_BYTES)
        return fail(new FileStoreError('Videos can be up to 250 MB', 413));
      if (file) {
        if (!file.write(chunk)) {
          stream.pause();
          file.once('drain', () => stream.resume());
        }
      } else chunks.push(chunk);
    });
    stream.on('error', fail);
    stream.on('end', () => {
      if (failed) return;
      const done = () =>
        resolve({
          sha256: hash.digest('hex'),
          size,
          bytes: file ? null : Buffer.concat(chunks),
          tempPath,
          head,
        });
      if (file) file.end(done);
      else done();
    });
  });
}

/** Throw away an upload that was not kept */
export function discardUpload(upload: Upload) {
  if (upload.tempPath) rmSync(upload.tempPath, { force: true });
}

/**
 * Keep an upload's bytes (once per content) and return its file id. Call inside the database
 * transaction that adds the row using it; a video's file is moved into place first.
 */
export function storeUpload(upload: Upload, mimeType: string, stamp: string) {
  const fileId = upload.sha256;
  const known = db
    .select({ id: receiptFiles.id })
    .from(receiptFiles)
    .where(eq(receiptFiles.id, fileId))
    .get();
  if (known && storedFileInfo(fileId)) {
    discardUpload(upload);
    return fileId;
  }
  if (upload.tempPath) {
    mkdirSync(filesDir(), { recursive: true });
    renameSync(upload.tempPath, diskPath(fileId));
  }
  if (known) {
    // Its row is here but its bytes aren't (a video whose file was lost, say, with only the
    // database recovered): these are the same bytes (the id is their hash), so put them back
    db.update(receiptFiles)
      .set({
        size: upload.size,
        data: upload.bytes ?? Buffer.alloc(0),
        onDisk: upload.tempPath ? 1 : 0,
      })
      .where(eq(receiptFiles.id, fileId))
      .run();
    return fileId;
  }
  db.insert(receiptFiles)
    .values({
      id: fileId,
      mimeType,
      size: upload.size,
      data: upload.bytes ?? Buffer.alloc(0),
      onDisk: upload.tempPath ? 1 : 0,
      createdAt: stamp,
    })
    .onConflictDoNothing()
    .run();
  return fileId;
}

/**
 * What a stored file is and where it lives, without reading its bytes; null when it is not on
 * this installation
 */
export function storedFileInfo(fileId: string) {
  const row = db
    .select({
      mimeType: receiptFiles.mimeType,
      size: receiptFiles.size,
      onDisk: receiptFiles.onDisk,
    })
    .from(receiptFiles)
    .where(eq(receiptFiles.id, fileId))
    .get();
  if (!row) return null;
  if (row.onDisk) {
    const file = diskPath(fileId);
    if (!existsSync(file)) return null;
    return { mimeType: row.mimeType, size: statSync(file).size, path: file };
  }
  return { mimeType: row.mimeType, size: row.size, path: null };
}

/** A stored file's bytes (in memory) or path (on disk); null when it is not on this installation */
export function storedFile(fileId: string) {
  const info = storedFileInfo(fileId);
  if (!info) return null;
  if (info.path) return { ...info, data: null };
  const data = db
    .select({ data: receiptFiles.data })
    .from(receiptFiles)
    .where(eq(receiptFiles.id, fileId))
    .get()?.data as Buffer;
  return { ...info, data };
}

/** Whether these files are on this installation (a JSON backup carries no files) */
export function presentFiles(fileIds: string[]) {
  if (!fileIds.length) return new Set<string>();
  const rows = db
    .select({ id: receiptFiles.id, onDisk: receiptFiles.onDisk })
    .from(receiptFiles)
    .where(inArray(receiptFiles.id, [...new Set(fileIds)]))
    .all();
  return new Set(rows.filter((r) => !r.onDisk || existsSync(diskPath(r.id))).map((r) => r.id));
}

/**
 * Delete stored files nothing uses any more: no document and no receipt. Call after the rows
 * that used them are gone (outside their transaction, so a file on disk goes only once they are).
 */
export function releaseFiles(fileIds: Iterable<string>) {
  for (const fileId of new Set(fileIds)) {
    const used =
      db.select({ id: documents.id }).from(documents).where(eq(documents.fileId, fileId)).get() ??
      db.select({ id: receipts.id }).from(receipts).where(eq(receipts.fileId, fileId)).get();
    if (used) continue;
    const row = db
      .select({ onDisk: receiptFiles.onDisk })
      .from(receiptFiles)
      .where(eq(receiptFiles.id, fileId))
      .get();
    db.delete(receiptFiles).where(eq(receiptFiles.id, fileId)).run();
    if (row?.onDisk) rmSync(diskPath(fileId), { force: true });
  }
}

/** How much the stored files take, in bytes, and how much of it is on disk */
export function storageUsed() {
  const row = db
    .select({
      bytes: sql<number>`coalesce(sum(${receiptFiles.size}), 0)`,
      files: sql<number>`count(*)`,
      onDisk: sql<number>`coalesce(sum(case when ${receiptFiles.onDisk} = 1 then ${receiptFiles.size} else 0 end), 0)`,
    })
    .from(receiptFiles)
    .get();
  return { bytes: row?.bytes ?? 0, files: row?.files ?? 0, onDisk: row?.onDisk ?? 0 };
}

/**
 * The storage limit (Files → Storage) a new file of this size would go over, or null when it
 * fits. Files and receipts share one store, so both check it; a file already stored (the same
 * bytes) takes no more room.
 */
export function storageCapExceeded(fileId: string, size: number) {
  const capMb = getBudgetSettings().filesCapMb;
  if (capMb == null) return null;
  if (presentFiles([fileId]).size > 0) return null;
  return storageUsed().bytes + size > capMb * 1024 * 1024 ? capMb : null;
}
