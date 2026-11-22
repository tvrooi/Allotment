// The register's selection of transactions, as pure functions (no React): hand-picked rows, or
// Select all with some rows left out. TransactionTable keeps one of these; every action on the
// selection reads it through selectionTarget, so a row that is not selected, or no longer
// listed, is never reached.

export type RegisterSelection =
  /** Rows ticked one by one; `anchor` is the last one toggled, where a Shift range starts */
  | { kind: 'some'; ids: ReadonlySet<string>; anchor: string | null }
  /** Every listed row, less the ones unticked since */
  | { kind: 'all'; except: ReadonlySet<string> };

/** Selecting, with nothing selected yet */
export const emptySelection: RegisterSelection = { kind: 'some', ids: new Set(), anchor: null };

/** Select all: every listed row */
export const selectAll = (): RegisterSelection => ({ kind: 'all', except: new Set() });

/** Whether a listed row is selected */
export const isSelected = (sel: RegisterSelection, id: string): boolean =>
  sel.kind === 'some' ? sel.ids.has(id) : !sel.except.has(id);

const flip = (set: ReadonlySet<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** Ticks or unticks one row (under Select all, leaves it out or brings it back) */
export const toggle = (sel: RegisterSelection, id: string): RegisterSelection =>
  sel.kind === 'some'
    ? { kind: 'some', ids: flip(sel.ids, id), anchor: id }
    : { kind: 'all', except: flip(sel.except, id) };

/**
 * Shift+click: selects every row from the anchor to `target` in the list's order, whichever of
 * the two comes first, and keeps what was selected already. With no anchor (or one no longer
 * listed) it toggles the target, as a plain click would.
 */
export const selectRange = (
  sel: RegisterSelection,
  order: readonly string[],
  target: string,
): RegisterSelection => {
  if (sel.kind === 'all') return toggle(sel, target);
  const to = order.indexOf(target);
  if (to < 0) return sel;
  const from = sel.anchor === null ? -1 : order.indexOf(sel.anchor);
  if (from < 0) return toggle(sel, target);
  const ids = new Set(sel.ids);
  for (const id of order.slice(Math.min(from, to), Math.max(from, to) + 1)) ids.add(id);
  return { kind: 'some', ids, anchor: target };
};

/**
 * Drops what the list no longer shows (a filter, a refresh, an edit that moved rows out), so a
 * row that is not listed is never acted on. Returns the same selection when nothing changed.
 */
export const prune = (sel: RegisterSelection, listed: readonly string[]): RegisterSelection => {
  const here = new Set(listed);
  if (sel.kind === 'some') {
    const ids = [...sel.ids].filter((id) => here.has(id));
    const anchor = sel.anchor !== null && here.has(sel.anchor) ? sel.anchor : null;
    return ids.length === sel.ids.size && anchor === sel.anchor
      ? sel
      : { kind: 'some', ids: new Set(ids), anchor };
  }
  const except = [...sel.except].filter((id) => here.has(id));
  return except.length === sel.except.size ? sel : { kind: 'all', except: new Set(except) };
};

/** The selected rows, in the list's order (the order a request carries them in) */
export const selectedIds = (sel: RegisterSelection, listed: readonly string[]): string[] =>
  listed.filter((id) => isSelected(sel, id));

/** How many listed rows are selected: what the server checks an edit against */
export const selectedCount = (sel: RegisterSelection, listed: readonly string[]): number =>
  selectedIds(sel, listed).length;

/**
 * The selection as the bulk routes take it, next to the register's own params (the server
 * intersects the two): hand-picked rows as `ids`, Select all as the params alone, or with the
 * rows left out as `excludeIds`.
 */
export const selectionTarget = <P>(
  sel: RegisterSelection,
  params: P,
  listed: readonly string[],
): { params: P; ids?: string[]; excludeIds?: string[] } => {
  if (sel.kind === 'some') return { params, ids: selectedIds(sel, listed) };
  const excludeIds = listed.filter((id) => sel.except.has(id));
  return excludeIds.length ? { params, excludeIds } : { params };
};
