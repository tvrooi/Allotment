import { apiFetch } from './client';
import type { FileCategory } from '../utils/csv';
import type {
  Transaction,
  TransactionQueryParams,
  TransactionSummary,
  ImportPreviewRow,
  TransferLinkResult,
  TransferSuggestion,
} from '../types';

export interface SplitItem {
  categoryId: string | null;
  amount: number;
  notes?: string | null;
}

export interface CreateTransactionData {
  /** Chosen on this device so a resend can't create it twice (see utils/offline.ts) */
  id?: string;
  accountId: string;
  date: string;
  amount: number;
  payeeId?: string | null;
  payeeName?: string | null;
  categoryId?: string | null;
  notes?: string | null;
  splits?: SplitItem[];
  /** A balance correction (reconciliation, "Update value"): left out of income and spending */
  adjustment?: boolean;
}

export interface CreateTransferData {
  id?: string;
  fromAccountId: string;
  toAccountId: string;
  date: string;
  /** In the sending account's currency */
  amount: number;
  /**
   * What arrived, in the receiving account's currency, when the two differ (left out: the
   * day's rate)
   */
  toAmount?: number;
  notes?: string | null;
}

export interface ImportRow {
  date: string;
  amount: number;
  payeeName?: string | null;
  notes?: string | null;
  importedId: string;
  /** Chosen for the file's category before importing */
  categoryId?: string | null;
  /** The file's own category (never sent): the person decides what it maps to */
  fileCategory?: FileCategory | null;
}

/** What goes to the server: the file's own category label stays on this device */
export const toApiRow = ({ fileCategory: _label, ...row }: ImportRow): ImportRow => row;

/** Links the two legs of transfers that were imported together (exact mirrors only) */
export const linkImportedTransfers = (
  pairs: {
    accountId: string;
    importedId: string;
    otherAccountId: string;
    otherImportedId: string;
  }[],
) =>
  apiFetch<{ linked: number; skipped: number }>('/transactions/import/link-transfers', {
    method: 'POST',
    body: JSON.stringify({ pairs }),
  });

/** The selection as the server's query string; shared by the register, summary and export */
export function transactionQuery(params: TransactionQueryParams = {}): URLSearchParams {
  const q = new URLSearchParams();
  if (params.budgetReport) q.set('budget_report', '1');
  if (params.accountIds?.length) q.set('account_ids', params.accountIds.join(','));
  if (params.accountId) q.set('account_id', params.accountId);
  if (params.month) q.set('month', params.month);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.categoryIds?.length) q.set('category_ids', params.categoryIds.join(','));
  else if (params.categoryId) q.set('category_id', params.categoryId);
  if (params.categoryGroupId) q.set('category_group_id', params.categoryGroupId);
  if (params.uncategorized) q.set('uncategorized', '1');
  if (params.payeeIds?.length) q.set('payee_ids', params.payeeIds.join(','));
  if (params.payeeName !== undefined) q.set('payee_name', params.payeeName);
  if (params.search) q.set('search', params.search);
  if (params.direction) q.set('direction', params.direction);
  if (params.minAmount !== undefined) q.set('min_amount', String(params.minAmount));
  if (params.maxAmount !== undefined) q.set('max_amount', String(params.maxAmount));
  if (params.transfers === 'exclude') q.set('transfers', 'exclude');
  if (params.reconciled !== undefined) q.set('reconciled', String(params.reconciled));
  if (params.reviewed !== undefined) q.set('reviewed', String(params.reviewed));
  if (params.hidden !== undefined) q.set('hidden', String(params.hidden));
  if (params.tagIds?.length) q.set('tag_ids', params.tagIds.join(','));
  return q;
}

export function getTransactions(params: TransactionQueryParams = {}) {
  const q = transactionQuery(params);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiFetch<Transaction[]>(`/transactions${qs ? `?${qs}` : ''}`);
}

export function getTransactionSummary(params: TransactionQueryParams = {}) {
  const qs = transactionQuery(params).toString();
  return apiFetch<TransactionSummary>(`/transactions/summary${qs ? `?${qs}` : ''}`);
}

/** The filtered CSV export of the same selection (server: GET /export/transactions/csv) */
export function transactionsCsvPath(params: TransactionQueryParams, decimalComma: boolean) {
  const q = transactionQuery(params);
  if (decimalComma) q.set('decimal', 'comma');
  const qs = q.toString();
  return `/export/transactions/csv${qs ? `?${qs}` : ''}`;
}

export const createTransaction = (data: CreateTransactionData) =>
  apiFetch<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) });

export const updateTransaction = (
  id: string,
  // mainAmount: what it's worth in the budget's currency, typed in (null = the day's rate)
  data: Partial<CreateTransactionData> & { mainAmount?: number | null },
) => apiFetch<Transaction>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTransaction = (id: string) =>
  apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' });

export const reconcileAccount = (accountId: string, transactionIds: string[]) =>
  apiFetch<{ reconciled: number }>(`/accounts/${accountId}/reconcile`, {
    method: 'PUT',
    body: JSON.stringify({ transactionIds }),
  });

export const createTransfer = (data: CreateTransferData) =>
  apiFetch<Transaction[]>('/transactions/transfer', { method: 'POST', body: JSON.stringify(data) });

export const getTransferSuggestions = (accountId?: string) =>
  apiFetch<TransferSuggestion[]>(
    `/transactions/transfers/suggestions${accountId ? `?account_id=${encodeURIComponent(accountId)}` : ''}`,
  );

/** Two existing transactions become the two sides of one transfer */
export const linkTransfer = (transactionId: string, otherTransactionId: string) =>
  apiFetch<TransferLinkResult>('/transactions/transfers/link', {
    method: 'POST',
    body: JSON.stringify({ transactionId, otherTransactionId }),
  });

/** Never suggest these two as a transfer again */
export const dismissTransferSuggestion = (transactionId: string, otherTransactionId: string) =>
  apiFetch<{ ok: true }>('/transactions/transfers/dismiss', {
    method: 'POST',
    body: JSON.stringify({ transactionId, otherTransactionId }),
  });

/** "Transfer: account" on an existing transaction: links its match there, or creates it */
export const transferToAccount = (id: string, accountId: string) =>
  apiFetch<TransferLinkResult>(`/transactions/${id}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ accountId }),
  });

/**
 * "Not a transfer": both sides become ordinary transactions again. Undo passes
 * `dismiss: false` so the pair is suggested again.
 */
export const unlinkTransfer = (id: string, opts: { dismiss?: boolean } = {}) =>
  apiFetch<[Transaction, Transaction | null]>(`/transactions/${id}/unlink-transfer`, {
    method: 'POST',
    body: JSON.stringify(opts),
  });

/** Unlocks one reconciled transaction so its amount, date and account can change again */
export const unlockTransaction = (id: string) =>
  apiFetch<Transaction>(`/transactions/${id}/unlock`, { method: 'POST', body: '{}' });

export const importPreview = (accountId: string, rows: ImportRow[]) =>
  apiFetch<ImportPreviewRow[]>('/transactions/import/preview', {
    method: 'POST',
    body: JSON.stringify({ accountId, rows: rows.map(toApiRow) }),
  });

export interface ImportResult {
  imported: number;
  skipped: number;
  /** The account's balance before and after (minor units) */
  balanceBefore: number;
  balance: number;
  /** Its starting balance moved so a balance typed as "today's" stayed true */
  startingBalanceAdjusted: boolean;
}

export const importConfirm = (accountId: string, rows: ImportRow[]) =>
  apiFetch<ImportResult>('/transactions/import/confirm', {
    method: 'POST',
    body: JSON.stringify({ accountId, rows: rows.map(toApiRow) }),
  });

// ─── Phase 9: review, report visibility and tags ──────────────────────────────

export const setTransactionFlags = (
  id: string,
  flags: { reviewed?: boolean; hiddenFromReports?: boolean },
) =>
  apiFetch<Transaction>(`/transactions/${id}/flags`, {
    method: 'PATCH',
    body: JSON.stringify(flags),
  });

export const setTransactionTags = (id: string, tagIds: string[]) =>
  apiFetch<{ tagIds: string[] }>(`/transactions/${id}/tags`, {
    method: 'PUT',
    body: JSON.stringify({ tagIds }),
  });

export interface ReviewChange {
  id: string;
  previous: string | null;
}

/** Mark the selection reviewed; refused (409) if it no longer has `expectedCount` rows */
export const reviewSelection = (
  params: TransactionQueryParams,
  reviewed: boolean,
  expectedCount: number,
) =>
  apiFetch<{ matched: number; changes: ReviewChange[] }>('/transactions/review', {
    method: 'POST',
    body: JSON.stringify({
      selection: Object.fromEntries(transactionQuery(params)),
      reviewed,
      expectedCount,
    }),
  });

/** Undo a review: put these rows' previous states back */
export const restoreReview = (changes: ReviewChange[]) =>
  apiFetch<{ restored: number }>('/transactions/review', {
    method: 'POST',
    body: JSON.stringify({ restore: changes }),
  });

// ─── Splitting after the fact and editing many at once ────────────────────────

export interface SplitPartInput {
  categoryId: string | null;
  /** Signed cents, like the transaction */
  amount: number;
  notes?: string | null;
}

/** Split a transaction into parts, change its parts, or (no parts) put it back together */
export const splitTransaction = (id: string, splits: SplitPartInput[]) =>
  apiFetch<Transaction>(`/transactions/${id}/split`, {
    method: 'PUT',
    body: JSON.stringify({ splits }),
  });

/** Only the fields being changed; anything left out stays as it is */
export interface BulkChanges {
  categoryId?: string | null;
  payeeName?: string;
  /** null removes the notes */
  notes?: string | null;
  hiddenFromReports?: boolean;
  reviewed?: boolean;
  addTagIds?: string[];
  removeTagIds?: string[];
}

export type BulkSkipReason = 'reconciled' | 'transfer' | 'split' | 'household';

export interface BulkPreview {
  matched: number;
  changing: number;
  skipped: Record<BulkSkipReason, number>;
  accounts: { id: string; name: string }[];
}

/** A changed row's previous values (opaque to the client: sent back for undo) */
export type BulkRestore = { id: string } & Record<string, unknown>;

export interface BulkResult {
  matched: number;
  changed: number;
  skipped: Record<BulkSkipReason, number>;
  restore: BulkRestore[];
}

interface BulkTarget {
  params: TransactionQueryParams;
  /** Hand-picked rows (only these, if they are in the selection) */
  ids?: string[];
}

const bulkBody = ({ params, ids }: BulkTarget) => ({
  selection: Object.fromEntries(transactionQuery(params)),
  ...(ids ? { ids } : {}),
});

/** What a bulk edit would change, without changing anything */
export const previewBulkEdit = (target: BulkTarget, changes: BulkChanges) =>
  apiFetch<BulkPreview>('/transactions/bulk', {
    method: 'POST',
    body: JSON.stringify({ ...bulkBody(target), changes, preview: true }),
  });

/** Apply a bulk edit; refused (409) if the selection no longer has `expectedCount` rows */
export const bulkEditTransactions = (
  target: BulkTarget,
  changes: BulkChanges,
  expectedCount: number,
) =>
  apiFetch<BulkResult>('/transactions/bulk', {
    method: 'POST',
    body: JSON.stringify({ ...bulkBody(target), changes, expectedCount }),
  });

/** Undo a bulk edit: put these rows' previous values back */
export const restoreBulkEdit = (restore: BulkRestore[]) =>
  apiFetch<{ restored: number }>('/transactions/bulk', {
    method: 'POST',
    body: JSON.stringify({ restore }),
  });

export interface BulkDeletePreview {
  matched: number;
  /** Rows that will be deleted */
  deletable: number;
  skipped: { reconciled: number; household: number };
  accounts: { id: string; name: string }[];
  sample: { id: string; date: string; payeeName: string | null; amount: number }[];
}

/** What deleting the selection would remove, without deleting anything */
export const previewBulkDelete = (target: BulkTarget) =>
  apiFetch<BulkDeletePreview>('/transactions/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ...bulkBody(target), preview: true }),
  });

/** Delete the selection's deletable rows; refused (409) if their number is no longer `expectedCount` */
export const bulkDeleteTransactions = (target: BulkTarget, expectedCount: number) =>
  apiFetch<{ deleted: number; skipped: BulkDeletePreview['skipped'] }>(
    '/transactions/bulk-delete',
    { method: 'POST', body: JSON.stringify({ ...bulkBody(target), expectedCount }) },
  );
