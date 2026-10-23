import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addDays, format, parseISO } from 'date-fns';
import { looksEnded } from './scheduleActivity.js';
import { nearMissReason } from './scheduleDiscovery.js';

// Pure parts of recurring detection: why a payee wasn't found, and when an item looks ended

const day = (from: string, n: number) => format(addDays(parseISO(from), n), 'yyyy-MM-dd');
const series = (start: string, gaps: number[], amounts: number[]) => {
  const out = [{ date: start, amount: amounts[0] }];
  gaps.forEach((g, i) => out.push({ date: day(out[i].date, g), amount: amounts[i + 1] }));
  return out;
};
const last = (s: { date: string }[]) => s[s.length - 1].date;

describe('nearMissReason', () => {
  it('names why a regular-looking payee was not found', () => {
    const gym = series('2026-06-01', [7, 7, 7], [-1500, -1500, -2100, -1500]);
    expect(nearMissReason(gym, last(gym))).toEqual({
      reason: 'amounts_vary',
      recurrenceType: 'weekly',
    });
    const two = series('2026-08-03', [30], [-999, -999]);
    expect(nearMissReason(two, last(two))).toMatchObject({ reason: 'too_few' });
    const drift = series('2026-05-01', [24, 38, 30], [-5000, -5000, -5000, -5000]);
    expect(nearMissReason(drift, last(drift))).toEqual({
      reason: 'dates_drift',
      recurrenceType: 'monthly',
    });
    // Two charges and a refund: one sign alone isn't enough
    const refund = series('2026-07-01', [14, 14], [-2000, 2000, -2000]);
    expect(nearMissReason(refund, last(refund))).toMatchObject({ reason: 'mixed_signs' });
  });

  it('stays quiet for what is regular, irregular or stopped', () => {
    const fine = series('2026-06-01', [14, 14, 14], [-1000, -1000, -1000, -1000]);
    expect(nearMissReason(fine, last(fine))).toBeNull();
    const random = series('2026-06-01', [3, 40, 9], [-1000, -1000, -1000, -1000]);
    expect(nearMissReason(random, last(random))).toBeNull();
    const two = series('2026-03-03', [30], [-999, -999]);
    expect(nearMissReason(two, '2026-10-01')).toBeNull();
  });

  it('never explains a series the strict match would take', () => {
    fc.assert(
      fc.property(
        fc.constantFrom({ gap: 7, jitter: 2 }, { gap: 14, jitter: 2 }),
        fc.array(fc.integer({ min: -2, max: 2 }), { minLength: 3, maxLength: 3 }),
        fc.integer({ min: 100, max: 1_000_000 }),
        ({ gap }, jitter, amount) => {
          const s = series(
            '2026-06-01',
            jitter.map((j) => gap + j),
            [0, 0, 0, 0].map(() => -amount),
          );
          expect(nearMissReason(s, last(s))).toBeNull();
        },
      ),
    );
  });
});

describe('looksEnded', () => {
  const occ = (
    expectedDate: string,
    status = 'pending',
    matchedTransactionId: string | null = null,
  ) => ({
    expectedDate,
    status,
    matchedTransactionId,
  });
  const today = '2026-10-23';

  it('needs two misses in a row, past the flexibility window', () => {
    // 20 Oct is still within 3 days
    expect(
      looksEnded([occ('2026-08-20', 'paid'), occ('2026-09-20'), occ('2026-10-20')], today, 3, null),
    ).toBe(false);
    expect(
      looksEnded([occ('2026-08-15', 'paid'), occ('2026-09-15'), occ('2026-10-15')], today, 3, null),
    ).toBe(true);
    expect(looksEnded([occ('2026-09-15'), occ('2026-10-15', 'paid')], today, 3, null)).toBe(false);
    expect(looksEnded([occ('2026-10-15')], today, 3, null)).toBe(false);
  });

  it('ignores skipped occurrences and misses before "Still active"', () => {
    const occs = [occ('2026-08-15'), occ('2026-09-15', 'skipped'), occ('2026-10-15')];
    expect(looksEnded(occs, today, 3, null)).toBe(true);
    expect(looksEnded(occs, today, 3, '2026-09-30')).toBe(false);
    // A matched occurrence counts as paid even while pending
    expect(
      looksEnded([occ('2026-09-15', 'pending', 'tx'), occ('2026-10-15')], today, 3, null),
    ).toBe(false);
  });
});
