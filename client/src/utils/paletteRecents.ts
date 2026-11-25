import { signedInPerson } from '../api/person';

// Where the search palette last took you on this device, newest first: names and paths only,
// never amounts. Forgotten when the budget on this page changes: signing out, someone else
// signing in (offline/snapshot.ts clearOfflineCopy), or restoring a backup (DataExport.tsx).

/** A stored identifier: keep the flybudget prefix */
export const PALETTE_RECENTS_KEY = 'flybudget:palette-recents';
export const MAX_RECENTS = 8;

export interface PaletteRecent {
  name: string;
  path: string;
}

interface Stored {
  /** Multi-user mode: whose budget these came from (api/person.ts); null elsewhere */
  person: string | null;
  items: PaletteRecent[];
}

const isRecent = (r: unknown): r is PaletteRecent =>
  !!r &&
  typeof (r as PaletteRecent).name === 'string' &&
  typeof (r as PaletteRecent).path === 'string' &&
  (r as PaletteRecent).path.startsWith('/');

export function readRecents(): PaletteRecent[] {
  try {
    const stored = JSON.parse(localStorage.getItem(PALETTE_RECENTS_KEY) ?? 'null') as Stored | null;
    if (!stored || (stored.person ?? null) !== signedInPerson() || !Array.isArray(stored.items))
      return [];
    return stored.items.filter(isRecent).slice(0, MAX_RECENTS);
  } catch {
    return []; // storage blocked or unreadable: nothing remembered
  }
}

/**
 * Puts a destination at the top, once, keeping the newest MAX_RECENTS. Once means the same
 * name and path: every goal opens on Goals, and each is its own recent.
 */
export function rememberRecent(recent: PaletteRecent) {
  const same = (r: PaletteRecent) => r.path === recent.path && r.name === recent.name;
  const items = [recent, ...readRecents().filter((r) => !same(r))].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(
      PALETTE_RECENTS_KEY,
      JSON.stringify({ person: signedInPerson(), items } satisfies Stored),
    );
  } catch {
    /* storage blocked: nothing is remembered */
  }
}

export function clearRecents() {
  try {
    localStorage.removeItem(PALETTE_RECENTS_KEY);
  } catch {
    /* storage blocked: nothing was remembered */
  }
}
