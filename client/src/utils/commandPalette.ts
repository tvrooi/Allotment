// The search palette's matching, grouping and transaction rows (layout/CommandPalette.tsx),
// tested independently. Server matches keep their returned order.
import type { Transaction } from '../types';
import { transactionPayeeName } from '../components/transactions/transferLabel';
import { formatRegisterAmount } from '../components/transactions/RoundUp';
import { formatDay } from './dates';

export type PaletteGroupId =
  | 'recent'
  | 'pages'
  | 'actions'
  | 'accounts'
  | 'categories'
  | 'payees'
  | 'goals'
  | 'transactions'
  | 'files';

/** Group headings, in the order groups are shown: pages and actions before data */
export const PALETTE_GROUPS: { id: PaletteGroupId; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'pages', label: 'Pages' },
  { id: 'actions', label: 'Actions' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'categories', label: 'Categories' },
  { id: 'payees', label: 'Payees' },
  { id: 'goals', label: 'Goals' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'files', label: 'Files' },
];

export const PALETTE_SEARCH_LABEL =
  'Search pages, accounts, categories, payees, goals, transactions and files';

/** Server search only starts at two trimmed characters. */
export const paletteCanSearch = (query: string) => query.trim().length >= 2;

/** Results shown per cached group while searching */
export const PER_GROUP = 5;

export interface PaletteEntry {
  id: string;
  group: PaletteGroupId;
  label: string;
  /** A non-selectable server status, excluded from the live result count */
  message?: boolean;
  unavailable?: string;
}

export interface PaletteSection<T extends PaletteEntry> {
  group: PaletteGroupId;
  label: string;
  items: T[];
}

/** Lower case with accents removed, so "cafe" finds "Café" */
export const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** A split parent is returned when a child's note matches; show what the search found. */
export function paletteTransactionNote(
  tx: Pick<Transaction, 'payeeName' | 'notes'> & { children?: Pick<Transaction, 'notes'>[] },
  query: string,
): string | undefined {
  const q = fold(query).trim();
  if (!q || fold(tx.payeeName ?? '').includes(q)) return undefined;
  return (
    [tx, ...(tx.children ?? [])].find((part) => part.notes && fold(part.notes).includes(q))
      ?.notes ?? undefined
  );
}

/** Transaction search rows use the register's labels and listed amounts. */
export function paletteTransactionResult(
  tx: Transaction,
  query: string,
  accountName: (id: string) => string | undefined,
  currency: string | null,
) {
  const matchingNote = paletteTransactionNote(tx, query);
  return {
    id: `transaction:${tx.id}`,
    group: 'transactions' as const,
    label: transactionPayeeName(tx, accountName),
    detail: `${formatDay(tx.date)} · ${matchingNote ?? accountName(tx.accountId) ?? ''}`,
    amount: formatRegisterAmount(tx, currency),
    state: { transactionDetailId: tx.id },
  };
}

/**
 * How well `label` matches `query`: 0 starts with it, 1 a later word starts with it, 2 it
 * appears inside a word, null not at all. Case and accents don't matter.
 */
export function matchRank(label: string, query: string): 0 | 1 | 2 | null {
  const q = fold(query).trim();
  const l = fold(label);
  if (!q) return 0;
  if (l.startsWith(q)) return 0;
  let at = l.indexOf(q, 1);
  while (at > 0) {
    if (!/[\p{L}\p{N}]/u.test(l[at - 1])) return 1;
    at = l.indexOf(q, at + 1);
  }
  return l.includes(q) ? 2 : null;
}

/**
 * What the palette lists. With no query: the recent destinations, then every page and action.
 * Searching: the best `PER_GROUP` cached matches (best match first, then the list's own order).
 * Server groups keep every supplied match in server order once the query is long enough.
 * Groups follow PALETTE_GROUPS, empty groups are omitted. Recents aren't searched.
 */
export function paletteSections<T extends PaletteEntry>(
  entries: T[],
  query: string,
  recent: T[] = [],
): PaletteSection<T>[] {
  const searching = fold(query).trim() !== '';
  const sections: PaletteSection<T>[] = [];
  for (const { id, label } of PALETTE_GROUPS) {
    let items: T[];
    if (id === 'transactions' || id === 'files')
      items = paletteCanSearch(query) ? entries.filter((e) => e.group === id) : [];
    else if (id === 'recent') items = searching ? [] : recent;
    else if (!searching)
      items = id === 'pages' || id === 'actions' ? entries.filter((e) => e.group === id) : [];
    else
      items = entries
        .filter((e) => e.group === id)
        .map((entry, order) => ({ entry, order, rank: matchRank(entry.label, query) }))
        .filter((m) => m.rank !== null)
        .sort((a, b) => a.rank! - b.rank! || a.order - b.order)
        .slice(0, PER_GROUP)
        .map((m) => m.entry);
    if (items.length) sections.push({ group: id, label, items });
  }
  return sections;
}

/** Status rows stay navigable for announcement, but aren't search results. */
export function paletteResultCount(sections: PaletteSection<PaletteEntry>[]): number {
  return sections.reduce(
    (count, section) => count + section.items.filter((item) => !item.message).length,
    0,
  );
}
