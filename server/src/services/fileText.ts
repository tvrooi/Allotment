// The text in a document, so Files can search inside it (docs/FILES.md §6). Read on this server:
// text files as they are, Office and OpenDocument files from their XML, PDFs best effort (text
// drawn with a font's own encoding can't be read without the font, and is left out). Photos are
// read only by the owner's local model, when reading receipts is turned on.
import { inflateSync } from 'node:zlib';
import { eq, isNull, and, notInArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documents } from '../db/schema.js';
import { kindOf } from './receiptMeta.js';
import { readZipEntry, zipEntries, zipEntryData } from '../utils/unzip.js';
import { storedFile } from './fileStore.js';
import { afterReads, canReadPhotos, isReadablePhoto, transcribePhoto } from './receiptReader.js';

/** Most text kept per document */
export const MAX_TEXT = 100_000;
const MAX_XML = 20 * 1024 * 1024;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' ';
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** The words in an XML part: paragraphs, rows and cells become line breaks or spaces */
function xmlText(xml: string) {
  return decodeEntities(
    xml
      .replace(/<\/(w:p|a:p|text:p|text:h|table:table-row|row)>/g, '\n')
      .replace(/<(w:tab|w:br|text:tab|text:line-break)\b[^>]*\/>/g, ' ')
      .replace(/<\/(c|table:table-cell|si)>/g, ' ')
      .replace(/<[^>]+>/g, ''),
  );
}

function officeText(bytes: Buffer, mimeType: string) {
  const entries = zipEntries(bytes) ?? [];
  const part = (name: string) => readZipEntry(bytes, name, MAX_XML)?.toString('utf8') ?? '';
  if (mimeType.includes('wordprocessingml')) return xmlText(part('word/document.xml'));
  if (mimeType.includes('spreadsheetml')) {
    // Words are in the shared strings; numbers and inline text in the sheets
    const sheets = entries
      .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
      .slice(0, 50)
      .map((e) => zipEntryData(bytes, e, MAX_XML)?.toString('utf8') ?? '')
      .map((xml) => xml.replace(/<f>[^<]*<\/f>/g, ''));
    return xmlText(part('xl/sharedStrings.xml')) + '\n' + sheets.map(xmlText).join('\n');
  }
  if (mimeType.includes('presentationml'))
    return entries
      .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .slice(0, 300)
      .map((e) => xmlText(zipEntryData(bytes, e, MAX_XML)?.toString('utf8') ?? ''))
      .join('\n');
  if (mimeType.includes('opendocument')) return xmlText(part('content.xml'));
  return '';
}

/** A PDF literal string's text, with its escapes */
function pdfString(raw: string) {
  return raw.replace(/\\(\d{1,3}|.)/gs, (_, c: string) => {
    if (/^\d/.test(c)) return String.fromCharCode(parseInt(c, 8) & 0xff);
    return { n: '\n', r: '\r', t: '\t', b: '', f: '' }[c] ?? (c === '\n' ? '' : c);
  });
}

/** Text shown by a page's drawing operators (Tj, TJ, ', ") */
function contentText(content: string) {
  const out: string[] = [];
  for (const block of content.match(/BT[\s\S]*?ET/g) ?? []) {
    const line: string[] = [];
    const strings = /\((?:\\.|[^\\)])*\)/gs;
    let m: RegExpExecArray | null;
    while ((m = strings.exec(block))) line.push(pdfString(m[0].slice(1, -1)));
    if (line.length) out.push(line.join(''));
  }
  return out.join('\n');
}

/** Whether text looks like words rather than glyph numbers in some font's own encoding */
function readable(text: string) {
  const letters = text.match(/[\p{L}\p{N}\s.,:;$%/()&'-]/gu)?.length ?? 0;
  return text.trim().length >= 3 && letters / text.length >= 0.85;
}

function pdfText(bytes: Buffer) {
  const source = bytes.toString('latin1');
  const parts: string[] = [];
  let inflated = 0;
  const streams = /<<([^]*?)>>\s*stream\r?\n/g;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = streams.exec(source)) && n++ < 3000 && inflated < 50 * 1024 * 1024) {
    const dict = m[1];
    // Images, fonts and embedded files hold no page text
    if (
      /\/Subtype\s*\/(Image|Type1C|CIDFontType0C|OpenType)|\/Length1|\/Type\s*\/(XObject|EmbeddedFile)/.test(
        dict,
      ) &&
      !/\/Subtype\s*\/Form/.test(dict)
    )
      continue;
    const start = m.index + m[0].length;
    const end = source.indexOf('endstream', start);
    if (end < 0) break;
    let data = bytes.subarray(start, end);
    if (/\/FlateDecode/.test(dict)) {
      try {
        data = inflateSync(data, { maxOutputLength: 10 * 1024 * 1024 });
      } catch {
        continue;
      }
    } else if (/\/Filter/.test(dict)) continue;
    inflated += data.length;
    const text = contentText(data.toString('latin1'));
    if (text && readable(text)) parts.push(text);
    streams.lastIndex = end;
  }
  return parts.join('\n');
}

/** The text in a file of this type; empty when there is none to find without a model */
export function extractText(bytes: Buffer, mimeType: string): string {
  let text = '';
  const kind = kindOf(mimeType);
  try {
    if (mimeType.startsWith('text/')) text = bytes.toString('utf8');
    else if (kind === 'document' || kind === 'spreadsheet' || kind === 'presentation')
      text = officeText(bytes, mimeType);
    else if (kind === 'pdf') text = pdfText(bytes);
  } catch {
    text = '';
  }
  return text
    .replace(/[\u0000-\u0008\u000b-\u001f]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, MAX_TEXT);
}

function setText(id: string, searchText: string | null, textStatus: string) {
  db.update(documents).set({ searchText, textStatus }).where(eq(documents.id, id)).run();
}

/**
 * Find a document's text and keep it for search. Photos wait for the local model (when it is on);
 * everything else is read here, at once. `force` reads a photo again.
 */
export function indexText(id: string, force = false) {
  const doc = db.select().from(documents).where(eq(documents.id, id)).get();
  if (!doc) return;
  if (kindOf(doc.mimeType) === 'video') return setText(id, null, 'none');
  if (kindOf(doc.mimeType) === 'image') {
    if (!isReadablePhoto(doc.mimeType) || !canReadPhotos()) {
      if (force) setText(id, doc.searchText, 'none');
      return;
    }
    setText(id, doc.searchText, 'pending');
    void afterReads(async () => {
      const file = storedFile(doc.fileId);
      if (!file?.data) return setText(id, null, 'failed');
      try {
        const text = (await transcribePhoto(file.data.toString('base64'), doc.mimeType))
          .trim()
          .slice(0, MAX_TEXT);
        setText(id, text || null, text ? 'read' : 'none');
      } catch (e) {
        if (db.select({ id: documents.id }).from(documents).where(eq(documents.id, id)).get())
          setText(id, null, 'failed');
        void e;
      }
    });
    return;
  }
  const file = storedFile(doc.fileId);
  if (!file?.data) return setText(id, null, 'none');
  const text = extractText(file.data, doc.mimeType);
  setText(id, text || null, text ? 'read' : 'none');
}

/**
 * On startup: find the text of documents never looked at (receipts from before Files, and files
 * added while the server stopped), a few at a time so the server stays responsive.
 */
export function indexPendingText() {
  const waiting = db
    .select({ id: documents.id, mimeType: documents.mimeType })
    .from(documents)
    .where(and(isNull(documents.textStatus), notInArray(documents.mimeType, ['image/heic'])))
    .all()
    .filter((d) => kindOf(d.mimeType) !== 'image' || canReadPhotos());
  const step = (i: number) => {
    if (i >= waiting.length) return;
    try {
      indexText(waiting[i].id);
    } catch {
      // One unreadable file never stops the rest
    }
    setImmediate(() => step(i + 1));
  };
  step(0);
  // Photos left waiting for the model when the server stopped
  for (const d of db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.textStatus, 'pending'))
    .all())
    indexText(d.id);
  return waiting.length;
}
