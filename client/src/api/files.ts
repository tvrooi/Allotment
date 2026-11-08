import { API_BASE } from './base';
import { apiFetch } from './client';

// Files (server: routes/files.ts, docs/FILES.md): the budget's document library. Amounts are cents.

export type FileKind =
  'image' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'text' | 'video';
export type LinkKind =
  | 'transaction'
  | 'category'
  | 'goal'
  | 'account'
  | 'asset'
  /** A sale's contract note or a payment's statement (D3b), linked from Investments */
  | 'investmentSale'
  | 'investmentIncome'
  /** A working-from-home year's bills (D4a); the id is the financial year */
  | 'homeYear';

export interface FileLink {
  kind: LinkKind;
  id: string;
  label: string;
  date?: string;
  amount?: number;
  accountName?: string;
  /** The receipt's matched transaction (removing it unmatches the receipt) */
  viaReceipt?: boolean;
}

export interface StoredDocument {
  id: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  kind: FileKind | null;
  size: number;
  description: string | null;
  documentDate: string | null;
  /** Its own date, else its receipt's, else the day it was added */
  date: string;
  important: boolean;
  starred: boolean;
  textStatus: 'pending' | 'read' | 'failed' | 'none' | null;
  hasFile: boolean;
  createdAt: string;
  updatedAt: string;
  tags: { id: string; name: string; color: string }[];
  links: FileLink[];
  receipt: {
    id: string;
    transactionId: string | null;
    merchant: string | null;
    total: number | null;
    readStatus: string | null;
  } | null;
}

export interface FileFilter {
  q?: string;
  tag?: string;
  kind?: FileKind;
  from?: string;
  to?: string;
  starred?: boolean;
  important?: boolean;
  linked?: boolean;
  receipt?: boolean;
  linkKind?: LinkKind;
  linkId?: string;
  limit?: number;
  offset?: number;
}

export interface FileStorage {
  bytes: number;
  files: number;
  onDisk: number;
  documents: number;
  capMb: number | null;
  maxFileBytes: number;
  maxVideoBytes: number;
}

const enc = encodeURIComponent;

export const fileUrl = (id: string, download = false) =>
  `${API_BASE}/files/${enc(id)}/file${download ? '?download' : ''}`;
export const filesExportUrl = () => `${API_BASE}/files/export`;

export function listFiles(filter: FileFilter = {}) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === '') continue;
    q.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  return apiFetch<{ total: number; documents: StoredDocument[] }>(`/files?${q}`);
}
export const getFile = (id: string) => apiFetch<StoredDocument>(`/files/${enc(id)}`);
export const fileCounts = (kind: LinkKind) =>
  apiFetch<{ id: string; count: number }[]>(`/files/counts?kind=${kind}`);
export const getFileStorage = () => apiFetch<FileStorage>('/files/storage');
export const setFileStorageCap = (capMb: number | null) =>
  apiFetch<FileStorage>('/files/storage', { method: 'PUT', body: JSON.stringify({ capMb }) });

export function uploadFile(
  file: Blob,
  fileName: string,
  options: { link?: { kind: LinkKind; id: string }; tagIds?: string[] } = {},
) {
  const q = new URLSearchParams({ fileName });
  if (options.link) {
    q.set('linkKind', options.link.kind);
    q.set('linkId', options.link.id);
  }
  if (options.tagIds?.length) q.set('tagIds', options.tagIds.join(','));
  return apiFetch<StoredDocument>(`/files?${q}`, {
    method: 'POST',
    // Never JSON: the server reads the body as the file
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
}

export type FileChange = Partial<{
  fileName: string;
  description: string | null;
  documentDate: string | null;
  important: boolean;
  starred: boolean;
  tagIds: string[];
}>;
export const updateFile = (id: string, change: FileChange) =>
  apiFetch<StoredDocument>(`/files/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(change) });
export const linkFile = (id: string, kind: LinkKind, targetId: string) =>
  apiFetch<StoredDocument>(`/files/${enc(id)}/links`, {
    method: 'POST',
    body: JSON.stringify({ kind, id: targetId }),
  });
export const unlinkFile = (id: string, kind: LinkKind, targetId: string) =>
  apiFetch<StoredDocument>(`/files/${enc(id)}/links/${kind}/${enc(targetId)}`, {
    method: 'DELETE',
  });
export const makeReceipt = (id: string) =>
  apiFetch<{ receipt: { id: string }; document: StoredDocument }>(`/files/${enc(id)}/receipt`, {
    method: 'POST',
  });
export const findFileText = (id: string) =>
  apiFetch<StoredDocument>(`/files/${enc(id)}/text`, { method: 'POST' });
export const deleteFile = (id: string) => apiFetch<void>(`/files/${enc(id)}`, { method: 'DELETE' });
