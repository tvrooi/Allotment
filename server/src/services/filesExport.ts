// Every file in Files as one ZIP (docs/FILES.md §5): the files under files/, named by date and
// name, and files.csv saying what each is, its labels and what it is linked to. JSON backups
// carry no files, so this is how files move to another installation.
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import { asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documents } from '../db/schema.js';
import { listDocuments } from './documentService.js';
import { storedFile, storedFileInfo } from './fileStore.js';
import { csvCell } from './taxService.js';
import { extensionOf } from './receiptMeta.js';
import { ZipWriter } from '../utils/zip.js';
import { disposition } from '../utils/contentDisposition.js';

export class FilesExportError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Below ZIP's 4 GB limit, with room for names and the index */
const MAX_ARCHIVE_BYTES = 4_000_000_000;

const safeName = (text: string) =>
  text
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

export async function exportAllFiles(res: Response) {
  const ids = db
    .select({ id: documents.id })
    .from(documents)
    .orderBy(asc(documents.createdAt))
    .all()
    .map((d) => d.id);
  // Described in pages, with their links and labels, the way the library shows them
  const docs = [];
  for (let i = 0; i < ids.length; i += 500)
    docs.push(...listDocuments({ limit: 500, offset: i }).documents);
  docs.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  // Sizes from the metadata only: each file's bytes are read as its entry is written, so the
  // whole library is never in memory at once
  const files = docs.map((d) => ({ doc: d, info: d.hasFile ? storedFileInfo(d.fileId) : null }));
  const total = files.reduce((sum, f) => sum + (f.info?.size ?? 0), 0);
  if (total > MAX_ARCHIVE_BYTES)
    throw new FilesExportError(
      'There are more than 4 GB of files, too many for one ZIP. Copy the data folder instead (docs/FILES.md).',
      413,
    );

  const names = new Set<string>();
  const index: (string | number | null)[][] = [
    [
      'File',
      'Name',
      'Date',
      'Type',
      'Size (bytes)',
      'Description',
      'Labels',
      'Important',
      'Starred',
      'Linked to',
      'Receipt',
    ],
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', disposition(false, `allotment-files-${stamp}.zip`));
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
    for (const { doc, info } of files) {
      let path = '';
      const file = info ? storedFile(doc.fileId) : null;
      if (file) {
        const ext = extensionOf(doc.mimeType);
        const stem = `files/${doc.date} ${safeName(doc.fileName.replace(/\.[a-z0-9]+$/i, '')) || 'file'}`;
        path = `${stem}.${ext}`;
        for (let n = 2; names.has(path); n++) path = `${stem} ${n}.${ext}`;
        names.add(path);
        const onDisk = file.path;
        if (onDisk) await zip.addStream(path, () => createReadStream(onDisk));
        else await zip.add(path, file.data!);
      }
      index.push([
        path || '(not on this installation)',
        doc.fileName,
        doc.date,
        doc.mimeType,
        doc.size,
        doc.description,
        doc.tags.map((t) => t.name).join('; '),
        doc.important ? 'yes' : '',
        doc.starred ? 'yes' : '',
        doc.links
          .map((l) =>
            l.kind === 'transaction'
              ? `Transaction: ${l.date} ${l.label} ${((l.amount ?? 0) / 100).toFixed(2)} (${l.accountName})`
              : `${l.kind[0].toUpperCase()}${l.kind.slice(1)}: ${l.label}`,
          )
          .join('; '),
        doc.receipt ? 'yes' : '',
      ]);
    }
    const csv = index.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
    await zip.add('files.csv', Buffer.from(csv, 'utf8'));
    await zip.finish();
    res.end();
  } catch (e) {
    // Headers are sent: the only way to say it failed is to cut the download short
    res.destroy(e as Error);
  }
}
