// What a stored file is, without touching the file itself: shared by receipts, Files and tax
// exports (and safe for the in-browser demo, which has no Node crypto or zlib)

export type FileKind =
  'image' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'text' | 'video';

/** Every type the Files library accepts: its usual extension and what kind of file it is */
export const FILE_TYPES: Record<string, { ext: string; kind: FileKind }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/heic': { ext: 'heic', kind: 'image' },
  'image/gif': { ext: 'gif', kind: 'image' },
  'application/pdf': { ext: 'pdf', kind: 'pdf' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: 'docx',
    kind: 'document',
  },
  'application/vnd.oasis.opendocument.text': { ext: 'odt', kind: 'document' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    ext: 'xlsx',
    kind: 'spreadsheet',
  },
  'application/vnd.oasis.opendocument.spreadsheet': { ext: 'ods', kind: 'spreadsheet' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    ext: 'pptx',
    kind: 'presentation',
  },
  'application/vnd.oasis.opendocument.presentation': { ext: 'odp', kind: 'presentation' },
  'text/csv': { ext: 'csv', kind: 'spreadsheet' },
  'text/markdown': { ext: 'md', kind: 'text' },
  'text/plain': { ext: 'txt', kind: 'text' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
};

/** What a receipt can be: photos and PDFs (the reader and matching work on these) */
export const RECEIPT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
];
export const extensionOf = (mimeType: string) => FILE_TYPES[mimeType]?.ext ?? 'bin';
export const kindOf = (mimeType: string): FileKind | null => FILE_TYPES[mimeType]?.kind ?? null;
export const isVideo = (mimeType: string) => kindOf(mimeType) === 'video';

/**
 * Shown in the page rather than downloaded: photos the browser can draw and videos. Nothing
 * that is a document (PDF, Office, text, HEIC) ever renders in the app's own origin.
 */
export const showsInline = (mimeType: string) =>
  (kindOf(mimeType) === 'image' && mimeType !== 'image/heic') || isVideo(mimeType);
