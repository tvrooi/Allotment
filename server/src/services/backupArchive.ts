// A backup with files (audit decision I-6, docs/FILES.md §2): the JSON backup and every file it
// refers to, in one ZIP. `backup.json` is exactly what Full Backup downloads; `files/<sha256>`
// holds each file's bytes, named by the hash that stores them, so a restore can check every one.
// Like the JSON backup, it never holds bank tokens, passwords or the encryption key.
import { createReadStream, createWriteStream, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { Response } from 'express';
import { nanoid } from 'nanoid';
import {
  createBackup,
  parseBackup,
  restoreBackup,
  saveSafetyCopy,
  InvalidBackupError,
} from './backupService.js';
import {
  FileStoreError,
  MAX_VIDEO_BYTES,
  discardUpload,
  filesDir,
  receiveUpload,
  releaseFiles,
  storeUpload,
  storedFile,
  storedFileInfo,
} from './fileStore.js';
import { ZipWriter } from '../utils/zip.js';
import { readZipFileEntry, zipFileEntries, zipFileEntryStream } from '../utils/zipFile.js';
import { disposition } from '../utils/contentDisposition.js';
import { todayIso } from '../utils/date.js';

/** ZIP's own limit (no ZIP64), with room for names and the index */
export const MAX_ARCHIVE_BYTES = 4_000_000_000;
/** As big as a JSON backup may be (routes/export.ts) */
const MAX_BACKUP_JSON = 250 * 1024 * 1024;
const FILE_ENTRY = /^files\/([0-9a-f]{64})$/;

const README = `Allotment backup with files

backup.json  the budget, exactly as Settings > Data > Full backup saves it
files/       every stored file (receipts, documents, photos, videos), named by its SHA-256

Restore it in Settings > Data > Restore. Bank connections, passwords and the encryption key are
never in a backup: connect your bank again after restoring on a new installation.
`;

export class BackupArchiveError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type Data = Record<string, unknown>;

/** Every stored file the backup refers to, with its type */
function referencedFiles(data: Data) {
  const files = new Map<string, string>();
  for (const table of ['documents', 'receipts'])
    for (const row of (data[table] as { fileId?: unknown; mimeType?: unknown }[]) ?? [])
      if (typeof row.fileId === 'string' && typeof row.mimeType === 'string')
        files.set(row.fileId, row.mimeType);
  return files;
}

/** Streams the backup and its files as a ZIP; fails before sending anything when it can't */
export async function writeBackupArchive(res: Response) {
  const data = createBackup();
  const json = Buffer.from(JSON.stringify(data), 'utf8');
  const files = [...referencedFiles(data).keys()]
    .map((id) => ({ id, info: storedFileInfo(id) }))
    .filter((f) => f.info);
  const total = json.length + files.reduce((sum, f) => sum + f.info!.size, 0);
  if (total > MAX_ARCHIVE_BYTES)
    throw new BackupArchiveError(
      'The files take more than 4 GB, too many for one ZIP. Download Full backup and copy the data folder instead (docs/FILES.md).',
      413,
    );

  const stamp = todayIso();
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', disposition(false, `allotment-backup-${stamp}.zip`));
  res.setHeader('Cache-Control', 'no-store');
  const write = (chunk: Buffer) =>
    new Promise<void>((resolve, reject) => {
      if (res.destroyed) return reject(new Error('The download was cancelled'));
      if (res.write(chunk)) resolve();
      else {
        res.once('drain', resolve);
        res.once('close', resolve);
      }
    });
  const zip = new ZipWriter(write);
  try {
    await zip.add('README.txt', Buffer.from(README, 'utf8'));
    await zip.add('backup.json', json);
    for (const { id } of files) {
      const file = storedFile(id);
      if (!file) continue;
      const onDisk = file.path;
      if (onDisk) await zip.addStream(`files/${id}`, () => createReadStream(onDisk));
      else await zip.add(`files/${id}`, file.data!);
    }
    await zip.finish();
    res.end();
  } catch (e) {
    // Headers are sent: the only way to say it failed is to cut the download short
    res.destroy(e as Error);
  }
}

/** Where an uploaded archive waits while it is read: beside the files, on the same disk */
export function archiveUploadPath() {
  const dir = path.join(filesDir(), 'incoming');
  mkdirSync(dir, { recursive: true });
  return path.join(dir, `restore-${nanoid()}.zip`);
}

/** Saves an uploaded archive to disk, refusing more than MAX_ARCHIVE_BYTES */
export function receiveArchive(stream: Readable, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const out = createWriteStream(file);
    let failed = false;
    const fail = (error: Error) => {
      if (failed) return;
      failed = true;
      stream.unpipe(out);
      stream.resume();
      out.destroy();
      rmSync(file, { force: true });
      reject(error);
    };
    stream.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_ARCHIVE_BYTES)
        fail(new BackupArchiveError('A backup with files can be up to 4 GB', 413));
    });
    stream.on('error', fail);
    out.on('error', fail);
    out.on('finish', () => resolve());
    stream.pipe(out);
  });
}

export type ArchiveRestore = {
  restored: Record<string, number>;
  safetyCopy: string | null;
  files: { added: number; alreadyHere: number; missing: number };
};

/**
 * Restores a backup with files from an archive on disk. Every file is checked against its hash
 * and stored first; only then is the budget replaced (restoreBackup, all or nothing). If anything
 * fails, the budget is untouched and the files this restore added are removed again.
 */
export async function restoreBackupArchive(file: string): Promise<ArchiveRestore> {
  const entries = zipFileEntries(file);
  if (!entries) throw new BackupArchiveError('This is not a ZIP file');
  const backupEntry = entries.find((e) => e.name === 'backup.json');
  if (!backupEntry)
    throw new BackupArchiveError(
      'This ZIP has no backup.json: it is not an Allotment backup with files',
    );
  const json = await readZipFileEntry(file, backupEntry, MAX_BACKUP_JSON);
  if (!json) throw new BackupArchiveError('The backup inside the ZIP is too large or damaged');
  let raw: unknown;
  try {
    raw = JSON.parse(json.toString('utf8'));
  } catch {
    throw new BackupArchiveError('The backup inside the ZIP is not valid JSON');
  }
  const data = parseBackup(raw);
  const wanted = referencedFiles(data as unknown as Data);

  const added: string[] = [];
  let alreadyHere = 0;
  try {
    for (const entry of entries) {
      const id = FILE_ENTRY.exec(entry.name)?.[1];
      // Only files the backup refers to; anything else in the ZIP is left alone
      if (!id || !wanted.has(id)) continue;
      if (storedFileInfo(id)) {
        alreadyHere++;
        continue;
      }
      const stream = zipFileEntryStream(file, entry, MAX_VIDEO_BYTES);
      if (!stream)
        throw new BackupArchiveError(`A file in the ZIP can't be read (${id.slice(0, 12)}…)`);
      const upload = await receiveUpload(stream);
      if (upload.sha256 !== id) {
        discardUpload(upload);
        throw new BackupArchiveError(
          `A file in the ZIP is damaged: its contents don't match its name (${id.slice(0, 12)}…). Nothing was restored.`,
        );
      }
      storeUpload(upload, wanted.get(id)!, new Date().toISOString());
      added.push(id);
    }
    const missing = [...wanted.keys()].filter((id) => !storedFileInfo(id)).length;
    const safetyCopy = await saveSafetyCopy();
    const restored = restoreBackup(data);
    return { restored, safetyCopy, files: { added: added.length, alreadyHere, missing } };
  } catch (e) {
    // The budget wasn't replaced: files only this restore added belong to nothing
    releaseFiles(added);
    if (e instanceof FileStoreError) throw new BackupArchiveError(e.message, e.status);
    throw e;
  }
}

export { InvalidBackupError };
