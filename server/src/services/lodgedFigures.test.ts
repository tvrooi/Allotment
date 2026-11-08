import { describe, expect, it } from 'vitest';
import { amendmentNote, amendments } from './lodgedFigures.js';

const home = (claim: number) => ({
  part: 'home',
  label: 'working from home',
  figures: { claim },
});

describe('amendments', () => {
  it('leaves out a part that has not changed since lodging', () => {
    expect(
      amendments([{ part: 'home', figures: { claim: 59_010 } }], [home(59_010)], true, '2025–26'),
    ).toEqual([]);
  });

  it('reports a changed part with both claims and the note', () => {
    const [a] = amendments(
      [{ part: 'home', figures: { claim: 59_010 } }],
      [home(61_250)],
      true,
      '2025–26',
    );
    expect(a).toMatchObject({
      part: 'home',
      lodgedClaim: 59_010,
      claim: 61_250,
      status: 'amended',
    });
    expect(a.note).toBe(
      'Amended since lodging: working from home was $590.10, now $612.50. Lodge an amendment with the ATO, then mark the year lodged again.',
    );
    expect(a.note).toBe(amendmentNote(a, '2025–26'));
  });

  it('reports a lodged year with no snapshot as not recorded, unless it claims nothing', () => {
    const [a] = amendments([], [home(100)], true, '2025–26');
    expect(a).toMatchObject({ status: 'notRecorded', lodgedClaim: null });
    expect(a.note).toBe("Working from home wasn't recorded when 2025–26 was lodged.");
    expect(amendments([], [home(0)], true, '2025–26')).toEqual([]);
  });

  it('gives none for a year that is not lodged', () => {
    expect(
      amendments([{ part: 'home', figures: { claim: 1 } }], [home(2)], false, '2025–26'),
    ).toEqual([]);
  });

  it('reports a part that fell to nothing as amended', () => {
    const [a] = amendments([{ part: 'home', figures: { claim: 500 } }], [home(0)], true, '2025–26');
    expect(a).toMatchObject({ status: 'amended', lodgedClaim: 500, claim: 0 });
  });
});
