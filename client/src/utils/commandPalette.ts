// The search palette's matching and grouping (components/layout/CommandPalette.tsx): pure, so
// it is tested on its own. Everything it searches is already in the browser.

export type PaletteGroupId =
  'recent' | 'pages' | 'actions' | 'accounts' | 'categories' | 'payees' | 'goals';

/** Group headings, in the order groups are shown: pages and actions before data */
export const PALETTE_GROUPS: { id: PaletteGroupId; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'pages', label: 'Pages' },
  { id: 'actions', label: 'Actions' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'categories', label: 'Categories' },
  { id: 'payees', label: 'Payees' },
  { id: 'goals', label: 'Goals' },
];

/** Results shown per group while searching */
export const PER_GROUP = 5;

export interface PaletteEntry {
  id: string;
  group: PaletteGroupId;
  label: string;
}

export interface PaletteSection<T extends PaletteEntry> {
  group: PaletteGroupId;
  label: string;
  items: T[];
}

/** Lower case with accents removed, so "cafe" finds "Café" */
export const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

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
 * Searching: the best `PER_GROUP` matches of each group (best match first, then the list's own
 * order), groups in PALETTE_GROUPS order, empty groups left out. Recents aren't searched; what
 * they point at is.
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
    if (id === 'recent') items = searching ? [] : recent;
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
