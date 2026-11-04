// Reading a ZIP file on disk, entry by entry, for archives too large to hold in memory (a backup
// with files, services/backupArchive.ts). The same subset as unzip.ts: stored and deflated
// entries, no ZIP64 (the writer, zip.ts, stops at 4 GB), at most MAX_ENTRIES of them.
import { closeSync, createReadStream, fstatSync, openSync, readSync } from 'node:fs';
import { createInflateRaw } from 'node:zlib';
import { Readable } from 'node:stream';
import type { ZipEntry } from './unzip.js';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX_ENTRIES = 65_535;

function readAt(fd: number, position: number, length: number) {
  const buffer = Buffer.alloc(length);
  const read = readSync(fd, buffer, 0, length, position);
  return buffer.subarray(0, read);
}

/** The entries of a ZIP file on disk, or null when it is not one this reader can read */
export function zipFileEntries(file: string): ZipEntry[] | null {
  const fd = openSync(file, 'r');
  try {
    const size = fstatSync(fd).size;
    if (size < 22 || readAt(fd, 0, 4).readUInt32LE(0) !== LOCAL) return null;
    // The end record is in the last 64 KB + 22 bytes (its comment is at most 65,535 bytes)
    const tailStart = Math.max(0, size - 65_557);
    const tail = readAt(fd, tailStart, size - tailStart);
    let end = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD) {
        end = i;
        break;
      }
    }
    if (end < 0) return null;
    const count = tail.readUInt16LE(end + 10);
    const dirSize = tail.readUInt32LE(end + 12);
    const dirAt = tail.readUInt32LE(end + 16);
    if (count > MAX_ENTRIES || dirAt + dirSize > tailStart + end) return null;
    const dir = readAt(fd, dirAt, dirSize);
    const entries: ZipEntry[] = [];
    let at = 0;
    for (let n = 0; n < count; n++) {
      if (at + 46 > dir.length || dir.readUInt32LE(at) !== CENTRAL) return null;
      const nameLength = dir.readUInt16LE(at + 28);
      const extraLength = dir.readUInt16LE(at + 30);
      const commentLength = dir.readUInt16LE(at + 32);
      if (at + 46 + nameLength > dir.length) return null;
      entries.push({
        name: dir.subarray(at + 46, at + 46 + nameLength).toString('utf8'),
        method: dir.readUInt16LE(at + 10),
        compressedSize: dir.readUInt32LE(at + 20),
        size: dir.readUInt32LE(at + 24),
        offset: dir.readUInt32LE(at + 42),
      });
      at += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  } finally {
    closeSync(fd);
  }
}

/** Where an entry's data starts, from its local header; null when the header isn't one */
function dataStart(file: string, entry: ZipEntry): number | null {
  const fd = openSync(file, 'r');
  try {
    const header = readAt(fd, entry.offset, 30);
    if (header.length < 30 || header.readUInt32LE(0) !== LOCAL) return null;
    return entry.offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  } finally {
    closeSync(fd);
  }
}

/**
 * An entry's contents as a stream; null when it can't be read. A deflated entry is limited to
 * `maxBytes` out, so a small entry can't expand into a huge one.
 */
export function zipFileEntryStream(
  file: string,
  entry: ZipEntry,
  maxBytes: number,
): Readable | null {
  if (entry.method !== 0 && entry.method !== 8) return null;
  if (entry.method === 0 && entry.size > maxBytes) return null;
  const start = dataStart(file, entry);
  if (start === null) return null;
  if (entry.compressedSize === 0) return Readable.from([]);
  const raw = createReadStream(file, { start, end: start + entry.compressedSize - 1 });
  return entry.method === 0 ? raw : raw.pipe(createInflateRaw({ maxOutputLength: maxBytes }));
}

/** An entry's contents in memory; null when it can't be read or is larger than maxBytes */
export async function readZipFileEntry(
  file: string,
  entry: ZipEntry,
  maxBytes: number,
): Promise<Buffer | null> {
  const stream = zipFileEntryStream(file, entry, maxBytes);
  if (!stream) return null;
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      size += chunk.length;
      if (size > maxBytes) {
        stream.destroy();
        return null;
      }
      chunks.push(chunk);
    }
  } catch {
    return null;
  }
  return Buffer.concat(chunks);
}
