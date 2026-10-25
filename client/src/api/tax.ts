import { API_BASE } from './base';
import { apiFetch } from './client';

// Receipts and tax deductions (server: routes/receipts.ts, routes/tax.ts). Amounts are cents.

export { TAX_LABEL_NAMES } from '../utils/taxLabels';

export type TaxLabel = string;

export interface Receipt {
  id: string;
  transactionId: string | null;
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  merchant: string | null;
  receiptDate: string | null;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  /** Tip, delivery and other fees */
  tip: number | null;
  /** auto | manual | created (a transaction made from it); null = unmatched */
  matchedBy: 'auto' | 'manual' | 'created' | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** False after restoring a backup on another installation: backups carry no files */
  hasFile: boolean;
  /** The matched transaction, in lists */
  transaction?: {
    id: string;
    date: string;
    amount: number;
    payeeName: string | null;
    accountName: string;
  } | null;
}

export interface LineItem {
  description: string;
  amount: number;
  categoryId: string | null;
}

export interface ReceiptDetail extends Receipt {
  lineItems: (LineItem & { id: string; position: number })[];
}

/** What matching added to the transaction */
export interface AttachOutcome {
  transactionId: string;
  tagged: boolean;
  notesAdded: boolean;
  split: number;
  categorised: boolean;
  skipped: string | null;
}

export interface ReceiptSettings {
  autoSplit: boolean;
  addNotes: boolean;
  addTag: boolean;
}

export interface ReceiptMatch {
  id: string;
  date: string;
  amount: number;
  payeeName: string | null;
  accountName: string;
  exactAmount: boolean;
  daysApart: number;
}

export interface TaxClaim {
  transactionId: string;
  label: TaxLabel;
  workUseBps: number;
  notes: string | null;
}

export interface TaxYearClaim extends TaxClaim {
  date: string;
  payeeName: string | null;
  categoryName: string | null;
  accountName: string;
  transactionNotes: string | null;
  cost: number;
  claim: number;
  receipts: { id: string; fileName: string }[];
  overImmediateLimit: boolean;
}

export interface TaxYear {
  financialYear: number;
  name: string;
  from: string;
  to: string;
  claims: TaxYearClaim[];
  totals: { label: TaxLabel; name: string; count: number; total: number }[];
  total: number;
  workRelatedTotal: number;
  missingReceipts: number;
  notes: string[];
}

export const receiptFileUrl = (id: string) => `${API_BASE}/receipts/${encodeURIComponent(id)}/file`;

export const listReceipts = (filter: {
  transactionId?: string;
  inbox?: boolean;
  status?: 'matched' | 'unmatched';
}) => {
  const q = new URLSearchParams();
  if (filter.transactionId) q.set('transactionId', filter.transactionId);
  if (filter.inbox) q.set('inbox', '1');
  if (filter.status) q.set('status', filter.status);
  return apiFetch<Receipt[]>(`/receipts?${q}`);
};
export const receiptCounts = () =>
  apiFetch<{ transactionId: string; count: number }[]>('/receipts/counts');
export const uploadReceipt = (file: Blob, fileName: string, transactionId?: string) => {
  const q = new URLSearchParams({ fileName });
  if (transactionId) q.set('transactionId', transactionId);
  return apiFetch<Receipt>(`/receipts?${q}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
};
export type ReceiptChange = Partial<
  Pick<
    Receipt,
    'transactionId' | 'merchant' | 'receiptDate' | 'total' | 'subtotal' | 'tax' | 'tip' | 'notes'
  > & { lineItems: LineItem[] }
>;
export const getReceipt = (id: string) =>
  apiFetch<ReceiptDetail>(`/receipts/${encodeURIComponent(id)}`);
export const updateReceipt = (id: string, change: ReceiptChange) =>
  apiFetch<ReceiptDetail & { outcome: AttachOutcome | null }>(
    `/receipts/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(change),
    },
  );
export const deleteReceipt = (id: string) =>
  apiFetch<void>(`/receipts/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const receiptMatches = (id: string, q?: string) =>
  apiFetch<ReceiptMatch[]>(
    `/receipts/${encodeURIComponent(id)}/matches${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  );
export const createTransactionFromReceipt = (
  id: string,
  body: { accountId: string; categoryId?: string | null },
) =>
  apiFetch<ReceiptDetail & { outcome: AttachOutcome }>(
    `/receipts/${encodeURIComponent(id)}/transaction`,
    { method: 'POST', body: JSON.stringify(body) },
  );
export const matchReceiptsNow = () =>
  apiFetch<{ matched: number }>('/receipts/match', { method: 'POST' });
export const getReceiptSettings = () => apiFetch<ReceiptSettings>('/receipts/settings');
export const setReceiptSettings = (change: Partial<ReceiptSettings>) =>
  apiFetch<ReceiptSettings>('/receipts/settings', {
    method: 'PUT',
    body: JSON.stringify(change),
  });

export const taxYears = () => apiFetch<{ financialYear: number; name: string }[]>('/tax/years');
export const taxYear = (fy: number) => apiFetch<TaxYear>(`/tax/years/${fy}`);
export const taxYearCsvUrl = (fy: number) => `${API_BASE}/tax/years/${fy}/csv`;
export const taxYearArchiveUrl = (fy: number) => `${API_BASE}/tax/years/${fy}/archive`;
export const claimedIds = () => apiFetch<string[]>('/tax/claims');
export const getClaim = (transactionId: string) =>
  apiFetch<TaxClaim | null>(`/tax/claims/${encodeURIComponent(transactionId)}`);
export const setClaim = (
  transactionId: string,
  claim: { label: TaxLabel; workUseBps: number; notes: string | null },
) =>
  apiFetch<TaxClaim>(`/tax/claims/${encodeURIComponent(transactionId)}`, {
    method: 'PUT',
    body: JSON.stringify(claim),
  });
export const removeClaim = (transactionId: string) =>
  apiFetch<void>(`/tax/claims/${encodeURIComponent(transactionId)}`, { method: 'DELETE' });

/**
 * A photo made small enough to keep: at most 2000 pixels on its longest side, as JPEG. A PDF,
 * or a photo this browser can't read (HEIC in Chrome), is kept as it is.
 */
export async function prepareReceipt(file: File): Promise<{ blob: Blob; name: string }> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif')
    return { blob: file, name: file.name };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return { blob: file, name: file.name };
    return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg' };
  } catch {
    return { blob: file, name: file.name };
  }
}
