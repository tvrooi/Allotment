// A file's real type, read from its bytes (docs/FILES.md §3). Never from the browser's claim,
// and from the name only for plain text, which has no signature: then the whole file must be
// UTF-8 text with no NUL bytes. Anything else (SVG, HTML, scripts, programs) is refused.
import { readZipEntry, zipEntries } from '../utils/unzip.js';

const at = (bytes: Buffer, offset: number, text: string) =>
  bytes.subarray(offset, offset + text.length).toString('latin1') === text;

const VIDEO_BRANDS: Record<string, string> = {
  isom: 'video/mp4',
  iso2: 'video/mp4',
  iso4: 'video/mp4',
  iso5: 'video/mp4',
  iso6: 'video/mp4',
  mp41: 'video/mp4',
  mp42: 'video/mp4',
  avc1: 'video/mp4',
  'M4V ': 'video/mp4',
  dash: 'video/mp4',
  'qt  ': 'video/quicktime',
};
const HEIC_BRANDS = ['heic', 'heix', 'mif1', 'msf1'];

/** A photo, PDF or video from its first bytes; null when it is none of them */
export function sniffMediaType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (at(bytes, 0, '\x89PNG\r\n\x1a\n')) return 'image/png';
  if (at(bytes, 0, 'RIFF') && at(bytes, 8, 'WEBP')) return 'image/webp';
  if (at(bytes, 0, 'GIF87a') || at(bytes, 0, 'GIF89a')) return 'image/gif';
  if (at(bytes, 0, '%PDF-')) return 'application/pdf';
  if (at(bytes, 4, 'ftyp')) {
    const brand = bytes.subarray(8, 12).toString('latin1');
    if (HEIC_BRANDS.includes(brand)) return 'image/heic';
    if (VIDEO_BRANDS[brand]) return VIDEO_BRANDS[brand];
  }
  return null;
}

/** Whether the first bytes are a video's, so a large upload can go to disk before it all arrives */
export function looksLikeVideo(head: Buffer) {
  const type = sniffMediaType(head);
  return type === 'video/mp4' || type === 'video/quicktime';
}

const OOXML: [string, string][] = [
  ['word/document.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['xl/workbook.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  [
    'ppt/presentation.xml',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
];
const ODF = new Set([
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
]);

/** An Office (OOXML) or OpenDocument file, from what is inside the ZIP */
function sniffZipDocument(bytes: Buffer): string | null {
  const entries = zipEntries(bytes);
  if (!entries) return null;
  const names = new Set(entries.map((e) => e.name));
  // A macro-enabled file (vbaProject.bin) is refused whatever it is called
  if ([...names].some((n) => n.toLowerCase().endsWith('vbaproject.bin'))) return null;
  if (names.has('[Content_Types].xml'))
    for (const [part, type] of OOXML) if (names.has(part)) return type;
  if (names.has('mimetype')) {
    const declared = readZipEntry(bytes, 'mimetype', 200)?.toString('latin1').trim();
    if (declared && ODF.has(declared)) return declared;
  }
  return null;
}

const TEXT_BY_EXTENSION: Record<string, string> = {
  csv: 'text/csv',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
};

/** Plain text by its name's extension, when the whole file really is UTF-8 text */
function sniffText(bytes: Buffer, fileName: string | undefined): string | null {
  const ext = fileName?.toLowerCase().match(/\.([a-z]+)$/)?.[1];
  const type = ext ? TEXT_BY_EXTENSION[ext] : undefined;
  if (!type || bytes.includes(0)) return null;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  return type;
}

/** The file's type for the Files library; null = not a type it keeps */
export function sniffFileType(bytes: Buffer, fileName?: string): string | null {
  if (!bytes.length) return null;
  return sniffMediaType(bytes) ?? sniffZipDocument(bytes) ?? sniffText(bytes, fileName);
}
