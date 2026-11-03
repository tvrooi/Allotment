// A minimal ZIP reader, for looking inside Office and OpenDocument files (fileTypes.ts,
// fileText.ts): the central directory's entry names, and one entry's contents at a time.
// Stored and deflated entries only, and never more than `maxBytes` out of any entry, so a
// small file can't expand into a huge one.
import { inflateRawSync } from 'node:zlib';

export type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  /** Where its local header starts */
  offset: number;
};

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX_ENTRIES = 5_000;

/** The entries of a ZIP file, or null when it is not one this reader can read */
export function zipEntries(bytes: Buffer): ZipEntry[] | null {
  if (bytes.length < 22 || bytes.readUInt32LE(0) !== LOCAL) return null;
  // The end record is in the last 64 KB + 22 bytes (its comment is at most 65,535 bytes)
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (bytes.readUInt32LE(i) === EOCD) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const count = bytes.readUInt16LE(end + 10);
  const dirSize = bytes.readUInt32LE(end + 12);
  let at = bytes.readUInt32LE(end + 16);
  if (count > MAX_ENTRIES || at + dirSize > end) return null;
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || bytes.readUInt32LE(at) !== CENTRAL) return null;
    const method = bytes.readUInt16LE(at + 10);
    const compressedSize = bytes.readUInt32LE(at + 20);
    const size = bytes.readUInt32LE(at + 24);
    const nameLength = bytes.readUInt16LE(at + 28);
    const extraLength = bytes.readUInt16LE(at + 30);
    const commentLength = bytes.readUInt16LE(at + 32);
    const offset = bytes.readUInt32LE(at + 42);
    if (at + 46 + nameLength > bytes.length) return null;
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    entries.push({ name, method, compressedSize, size, offset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** One entry's contents, or null when it can't be read or would be larger than maxBytes */
export function zipEntryData(bytes: Buffer, entry: ZipEntry, maxBytes: number): Buffer | null {
  const at = entry.offset;
  if (at + 30 > bytes.length || bytes.readUInt32LE(at) !== LOCAL) return null;
  const start = at + 30 + bytes.readUInt16LE(at + 26) + bytes.readUInt16LE(at + 28);
  const stop = start + entry.compressedSize;
  if (stop > bytes.length) return null;
  const raw = bytes.subarray(start, stop);
  if (entry.method === 0) return raw.length <= maxBytes ? Buffer.from(raw) : null;
  if (entry.method !== 8) return null;
  try {
    return inflateRawSync(raw, { maxOutputLength: maxBytes });
  } catch {
    return null;
  }
}

/** The named entry's contents (see zipEntryData) */
export function readZipEntry(bytes: Buffer, name: string, maxBytes: number): Buffer | null {
  const entry = zipEntries(bytes)?.find((e) => e.name === name);
  return entry ? zipEntryData(bytes, entry, maxBytes) : null;
}
