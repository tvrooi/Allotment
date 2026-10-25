// What a receipt file is, without touching the file itself: shared by receipts and tax
// exports (and safe for the in-browser demo, which has no Node crypto)

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

export const RECEIPT_TYPES = Object.keys(EXTENSION);
export const extensionOf = (mimeType: string) => EXTENSION[mimeType] ?? 'bin';
