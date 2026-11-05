import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DUPLICATE_WINDOW_DAYS,
  matchExistingRows,
  sourceOf,
  type ExistingRow,
  type FileRow,
} from './importDuplicates.js';

// SEC-01: a file row that looks like one the account already has is flagged, not skipped

const file = (
  date: string,
  amount: number,
  payeeName: string | null,
  importedId = `${date}|${amount}|${payeeName}`,
): FileRow => ({ date, amount, payeeName, importedId });

let n = 0;
const have = (
  date: string,
  amount: number,
  payeeName: string | null,
  importedId: string | null = null,
  importedPayee: string | null = null,
): ExistingRow => ({ id: `t${++n}`, date, amount, payeeName, importedPayee, importedId });

describe('matchExistingRows', () => {
  it('flags a typed entry that a statement row repeats', () => {
    const [m] = matchExistingRows(
      [file('2026-11-02', -4_550, 'WOOLWORTHS 1234 SYDNEY NS AUS')],
      [have('2026-11-02', -4_550, 'Woolworths')],
    );
    expect(m).toMatchObject({ date: '2026-11-02', payeeName: 'Woolworths', source: 'manual' });
  });

  it('allows the bank to date it a few days after the typed day, and no more', () => {
    const typed = have('2026-11-01', -2_000, 'Chemist');
    for (let d = 0; d <= DUPLICATE_WINDOW_DAYS; d++)
      expect(
        matchExistingRows([file(`2026-11-0${1 + d}`, -2_000, 'Chemist')], [typed])[0],
      ).not.toBeNull();
    expect(matchExistingRows([file('2026-11-05', -2_000, 'Chemist')], [typed])[0]).toBeNull();
  });

  it('counts days on the calendar, across a month and year end', () => {
    const typed = have('2026-12-30', -1_000, 'Cafe');
    expect(matchExistingRows([file('2027-01-02', -1_000, 'Cafe')], [typed])[0]).not.toBeNull();
    expect(matchExistingRows([file('2027-01-03', -1_000, 'Cafe')], [typed])[0]).toBeNull();
  });

  it('needs the same amount, and payees that do not contradict each other', () => {
    const typed = have('2026-11-02', -4_550, 'Woolworths');
    expect(matchExistingRows([file('2026-11-02', -4_551, 'Woolworths')], [typed])[0]).toBeNull();
    expect(matchExistingRows([file('2026-11-02', 4_550, 'Woolworths')], [typed])[0]).toBeNull();
    expect(matchExistingRows([file('2026-11-02', -4_550, 'Bunnings')], [typed])[0]).toBeNull();
  });

  it('matches on the payee a bank wrote, and on a word that starts another', () => {
    const synced = have('2026-11-02', -990, 'Spotify', 'up:acc:1', 'SPOTIFY P1A2B3C');
    expect(matchExistingRows([file('2026-11-02', -990, 'SPOTIFY')], [synced])[0]).toMatchObject({
      source: 'synced',
    });
    const metro = have('2026-11-02', -990, 'Woolworths Metro');
    expect(matchExistingRows([file('2026-11-02', -990, 'WOOLWORTHSMETRO')], [metro])[0]).not.toBe(
      null,
    );
  });

  it('treats a missing payee on either side as no contradiction', () => {
    expect(
      matchExistingRows([file('2026-11-02', -500, null)], [have('2026-11-02', -500, 'Kiosk')])[0],
    ).not.toBeNull();
    expect(
      matchExistingRows([file('2026-11-02', -500, 'Kiosk')], [have('2026-11-02', -500, null)])[0],
    ).not.toBeNull();
  });

  it('ignores card and statement filler words', () => {
    const typed = have('2026-11-02', -500, 'Visa Purchase');
    expect(
      matchExistingRows([file('2026-11-02', -500, 'EFTPOS PURCHASE')], [typed])[0],
    ).not.toBeNull();
  });

  it('lets each existing row be claimed once', () => {
    const typed = have('2026-11-02', -450, 'Coffee');
    const m = matchExistingRows(
      [file('2026-11-02', -450, 'Coffee', 'a'), file('2026-11-02', -450, 'Coffee', 'b')],
      [typed],
    );
    expect(m.filter(Boolean)).toHaveLength(1);
    expect(m[0]).not.toBeNull(); // first in file order when equally near
  });

  // A statement full of equal amounts must not build every file-row x existing-row pair
  it('pairs thousands of identical rows one to one, in file order', () => {
    const rows = Array.from({ length: 4_000 }, (_, i) =>
      file('2026-11-02', -450, 'Coffee', `f${i}`),
    );
    const existing = Array.from({ length: 1_000 }, () => have('2026-11-02', -450, 'Coffee'));
    const m = matchExistingRows(rows, existing);
    expect(m.filter(Boolean)).toHaveLength(1_000);
    expect(m.slice(0, 1_000).every(Boolean)).toBe(true);
    expect(m.slice(1_000).every((x) => x === null)).toBe(true);
    expect(new Set(m.slice(0, 1_000).map((x) => x!.transactionId)).size).toBe(1_000);
  });

  it('pairs the nearest day first', () => {
    const near = have('2026-11-03', -450, 'Coffee');
    const far = have('2026-11-01', -450, 'Coffee');
    const [m] = matchExistingRows([file('2026-11-03', -450, 'Coffee')], [far, near]);
    expect(m?.transactionId).toBe(near.id);
  });

  it('flags nothing for a clean statement', () => {
    expect(
      matchExistingRows(
        [file('2026-11-02', -450, 'Coffee'), file('2026-11-03', -900, 'Lunch')],
        [have('2026-10-01', -450, 'Coffee'), have('2026-11-02', -451, 'Coffee')],
      ),
    ).toEqual([null, null]);
  });

  it('leaves exact duplicates to their id, and does not let them claim a lookalike', () => {
    const exact = have('2026-11-02', -450, 'Coffee', 'file-1');
    const lookalike = have('2026-11-02', -450, 'Coffee');
    const m = matchExistingRows(
      [file('2026-11-02', -450, 'Coffee', 'file-1'), file('2026-11-02', -450, 'Coffee', 'file-2')],
      [exact, lookalike],
      new Set(['file-1']),
    );
    expect(m[0]).toBeNull();
    expect(m[1]?.transactionId).toBe(lookalike.id);
  });

  it('names where the matching row came from', () => {
    expect(sourceOf(null)).toBe('manual');
    expect(sourceOf('up:abc:123')).toBe('synced');
    expect(sourceOf('eb:m1:REF')).toBe('synced');
    expect(sourceOf('plaid:x')).toBe('synced');
    expect(sourceOf('simplefin:x')).toBe('synced');
    expect(sourceOf('schedule:s1:o1')).toBe('scheduled');
    expect(sourceOf('2026-11-02|-450|Coffee')).toBe('file');
  });

  it('pairs each row with at most one existing row and never reuses one (property-based)', () => {
    const arbRow = fc.record({
      day: fc.integer({ min: 1, max: 10 }),
      amount: fc.constantFrom(-100, -200, 300),
      payee: fc.constantFrom('Coffee', 'Rent', null),
    });
    fc.assert(
      fc.property(
        fc.array(arbRow, { maxLength: 15 }),
        fc.array(arbRow, { maxLength: 15 }),
        (fileSpec, haveSpec) => {
          const day = (d: number) => `2026-11-${String(d).padStart(2, '0')}`;
          const rows = fileSpec.map((r, i) => file(day(r.day), r.amount, r.payee, `f${i}`));
          const existing = haveSpec.map((r) => have(day(r.day), r.amount, r.payee));
          const result = matchExistingRows(rows, existing);
          expect(result).toHaveLength(rows.length);
          const claimed = result.filter(Boolean).map((m) => m!.transactionId);
          expect(new Set(claimed).size).toBe(claimed.length);
          result.forEach((m, i) => {
            if (!m) return;
            const e = existing.find((x) => x.id === m.transactionId)!;
            expect(e.amount).toBe(rows[i].amount);
            expect(
              Math.abs(Number(e.date.slice(-2)) - Number(rows[i].date.slice(-2))),
            ).toBeLessThanOrEqual(DUPLICATE_WINDOW_DAYS);
          });
          // Maximal: a file row left unflagged has no free existing row it could have taken
          const free = existing.filter((e) => !claimed.includes(e.id));
          result.forEach((m, i) => {
            if (m) return;
            for (const e of free)
              if (
                e.amount === rows[i].amount &&
                Math.abs(Number(e.date.slice(-2)) - Number(rows[i].date.slice(-2))) <=
                  DUPLICATE_WINDOW_DAYS &&
                (e.payeeName === null ||
                  rows[i].payeeName === null ||
                  e.payeeName === rows[i].payeeName)
              )
                throw new Error('a free lookalike was left unmatched');
          });
        },
      ),
      { numRuns: 300 },
    );
  });
});
