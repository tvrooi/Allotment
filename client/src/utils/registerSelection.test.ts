import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  emptySelection,
  isSelected,
  prune,
  selectAll,
  selectedCount,
  selectedIds,
  selectionTarget,
  selectRange,
  toggle,
} from './registerSelection';

const order = ['a', 'b', 'c', 'd', 'e'];
const params = { accountId: 'acct' };

// A register's listed rows: distinct ids in a displayed order
const listed = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), {
  minLength: 1,
  maxLength: 12,
});
// A listed row to start from and one to go to, as indexes into it
const picks = listed.chain((rows) =>
  fc.record({
    rows: fc.constant(rows),
    from: fc.nat({ max: rows.length - 1 }),
    to: fc.nat({ max: rows.length - 1 }),
  }),
);

describe('toggle', () => {
  it('adds an id to an empty selection and makes it the anchor', () => {
    const sel = toggle(emptySelection, 'b');
    expect(sel).toMatchObject({ kind: 'some', anchor: 'b' });
    expect(isSelected(sel, 'b')).toBe(true);
    expect(isSelected(sel, 'a')).toBe(false);
  });

  it('removes it when toggled again', () => {
    const sel = toggle(toggle(emptySelection, 'b'), 'b');
    expect(isSelected(sel, 'b')).toBe(false);
    expect(selectedCount(sel, order)).toBe(0);
  });

  it('excludes a row from Select all, and brings it back the second time', () => {
    const all = toggle(selectAll(), 'c');
    expect(isSelected(all, 'c')).toBe(false);
    expect(isSelected(all, 'd')).toBe(true);
    expect(isSelected(toggle(all, 'c'), 'c')).toBe(true);
  });
});

describe('selectRange', () => {
  it('adds every id from the anchor to the target, inclusive, in the list order', () => {
    const sel = selectRange(toggle(emptySelection, 'b'), order, 'd');
    expect(selectedIds(sel, order)).toEqual(['b', 'c', 'd']);
  });

  it('gives the same rows whichever end was clicked first', () => {
    const down = selectRange(toggle(emptySelection, 'b'), order, 'd');
    const up = selectRange(toggle(emptySelection, 'd'), order, 'b');
    expect(selectedIds(up, order)).toEqual(selectedIds(down, order));
  });

  it('with the anchor itself as the target selects exactly that row', () => {
    const sel = selectRange(toggle(emptySelection, 'c'), order, 'c');
    expect(selectedIds(sel, order)).toEqual(['c']);
  });

  it('two rows below the anchor selects those three rows and no others', () => {
    const sel = selectRange(toggle(emptySelection, 'a'), order, 'c');
    expect(selectedIds(sel, order)).toEqual(['a', 'b', 'c']);
  });

  it('toggles the target when there is no anchor, or the anchor is no longer listed', () => {
    expect(selectedIds(selectRange(emptySelection, order, 'c'), order)).toEqual(['c']);
    const stale = toggle(emptySelection, 'gone');
    expect(selectedIds(selectRange(stale, order, 'c'), order)).toEqual(['c']);
  });

  it('keeps what was already selected outside the range', () => {
    const sel = selectRange(toggle(toggle(emptySelection, 'e'), 'a'), order, 'b');
    expect(selectedIds(sel, order)).toEqual(['a', 'b', 'e']);
  });

  it('moves the anchor to the clicked row, so the next range starts there', () => {
    const first = selectRange(toggle(emptySelection, 'a'), order, 'b');
    expect(selectedIds(selectRange(first, order, 'd'), order)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('select all', () => {
  it('counts the listed rows less the excluded ones still listed', () => {
    const all = toggle(toggle(selectAll(), 'b'), 'gone');
    expect(selectedCount(all, order)).toBe(4);
    expect(selectedIds(all, order)).toEqual(['a', 'c', 'd', 'e']);
  });
});

describe('prune', () => {
  it('keeps only the hand-picked rows that are still listed', () => {
    const sel = selectRange(toggle(emptySelection, 'a'), order, 'd');
    expect(selectedIds(prune(sel, ['b', 'd', 'x']), order)).toEqual(['b', 'd']);
  });

  it('returns the same selection when nothing was dropped, so a render does not loop', () => {
    const sel = toggle(emptySelection, 'a');
    expect(prune(sel, order)).toBe(sel);
    expect(prune(selectAll(), order)).toEqual(selectAll());
  });

  it('forgets an exclusion that is no longer listed', () => {
    const all = toggle(selectAll(), 'gone');
    expect(prune(all, order)).toEqual(selectAll());
  });
});

describe('selectionTarget', () => {
  it('sends hand-picked rows as ids, in the list order', () => {
    const sel = toggle(toggle(emptySelection, 'd'), 'b');
    expect(selectionTarget(sel, params, order)).toEqual({ params, ids: ['b', 'd'] });
  });

  it('sends Select all with nothing excluded as the params alone', () => {
    expect(selectionTarget(selectAll(), params, order)).toEqual({ params });
  });

  it('sends Select all with exclusions as the params and the excluded ids that are listed', () => {
    const all = toggle(toggle(selectAll(), 'e'), 'b');
    expect(selectionTarget(all, params, order)).toEqual({ params, excludeIds: ['b', 'e'] });
  });
});

describe('registerSelection (property-based)', () => {
  it('a range is contiguous in the list order', () => {
    fc.assert(
      fc.property(picks, ({ rows, from, to }) => {
        const sel = selectRange(toggle(emptySelection, rows[from]), rows, rows[to]);
        const [lo, hi] = [Math.min(from, to), Math.max(from, to)];
        expect(selectedIds(sel, rows)).toEqual(rows.slice(lo, hi + 1));
      }),
    );
  });

  it('range(a, b) equals range(b, a)', () => {
    fc.assert(
      fc.property(picks, ({ rows, from, to }) => {
        const ab = selectRange(toggle(emptySelection, rows[from]), rows, rows[to]);
        const ba = selectRange(toggle(emptySelection, rows[to]), rows, rows[from]);
        expect(selectedIds(ab, rows)).toEqual(selectedIds(ba, rows));
      }),
    );
  });

  it('toggling twice is the identity on what is selected', () => {
    fc.assert(
      fc.property(picks, ({ rows, from, to }) => {
        const base = toggle(emptySelection, rows[from]);
        const twice = toggle(toggle(base, rows[to]), rows[to]);
        expect(selectedIds(twice, rows)).toEqual(selectedIds(base, rows));
      }),
    );
  });

  it('prune is idempotent', () => {
    fc.assert(
      fc.property(picks, fc.array(fc.string({ minLength: 1, maxLength: 4 })), (p, extra) => {
        const sel = selectRange(toggle(emptySelection, p.rows[p.from]), p.rows, p.rows[p.to]);
        const now = [...p.rows.slice(0, p.to), ...extra];
        const once = prune(sel, now);
        expect(prune(once, now)).toEqual(once);
        expect(prune(once, now)).toBe(once);
      }),
    );
  });

  it('the count is the number of ids, for hand-picked rows and for Select all', () => {
    fc.assert(
      fc.property(picks, ({ rows, from, to }) => {
        const some = selectRange(toggle(emptySelection, rows[from]), rows, rows[to]);
        expect(selectedCount(some, rows)).toBe(selectedIds(some, rows).length);
        const all = toggle(selectAll(), rows[from]);
        expect(selectedCount(all, rows)).toBe(selectedIds(all, rows).length);
      }),
    );
  });

  it('an excluded id is never selected', () => {
    fc.assert(
      fc.property(picks, ({ rows, from }) => {
        const all = toggle(selectAll(), rows[from]);
        expect(selectedIds(all, rows)).not.toContain(rows[from]);
      }),
    );
  });

  it('the target reaches as many rows as the count says', () => {
    fc.assert(
      fc.property(picks, fc.boolean(), ({ rows, from, to }, everything) => {
        const sel = everything
          ? toggle(selectAll(), rows[to])
          : selectRange(toggle(emptySelection, rows[from]), rows, rows[to]);
        const target = selectionTarget(sel, params, rows);
        const reached = target.ids
          ? target.ids.length
          : rows.length - (target.excludeIds?.length ?? 0);
        expect(reached).toBe(selectedCount(sel, rows));
      }),
    );
  });
});
