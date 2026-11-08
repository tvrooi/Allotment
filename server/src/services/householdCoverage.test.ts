import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { householdCoverage, type CoverageItem } from './householdCoverage.js';

const members = [{ id: 'me' }, { id: 'juno' }, { id: 'zephyr' }];
const item = (name: string, date: string, shares: number[]): CoverageItem => ({
  id: name,
  source: 'recurring',
  name,
  date,
  amount: shares.reduce((a, b) => a + b, 0),
  shares: shares.map((amount, i) => ({ personId: members[i].id, amount })),
});

describe('householdCoverage', () => {
  it("compares the household account's cash with the bills due, and shows each person's part", () => {
    const coverage = householdCoverage({
      from: '2026-11-08',
      to: '2026-12-08',
      cash: 17693,
      due: [
        item('Rent', '2026-11-19', [165100, 171700, 141200]),
        item('OVO Energy', '2026-11-28', [5000, 5000, 5000]),
        item('Next year', '2026-12-09', [100, 100, 100]),
      ],
      members,
      contributions: [
        { payerId: 'juno', date: '2026-11-06', amount: 8800 },
        { payerId: 'juno', date: '2026-10-30', amount: 5000 },
        { payerId: 'zephyr', date: '2026-11-06', amount: 8800 },
        { payerId: null, date: '2026-11-07', amount: 100 },
      ],
    });
    expect(coverage.due.map((d) => d.name)).toEqual(['Rent', 'OVO Energy']);
    expect(coverage.needed).toBe(493000);
    expect(coverage.covered).toBe(17693);
    expect(coverage.shortfall).toBe(493000 - 17693);
    expect(coverage.people).toEqual([
      { personId: 'me', shareDue: 170100, paidIn: 0 },
      { personId: 'juno', shareDue: 176700, paidIn: 8800 },
      { personId: 'zephyr', shareDue: 146200, paidIn: 8800 },
    ]);
  });

  it('covers everything when the cash is enough, and nothing when the account is overdrawn', () => {
    const due = [item('Internet', '2026-11-10', [3800, 3800, 3800])];
    const base = { from: '2026-11-08', to: '2026-12-08', due, members, contributions: [] };
    expect(householdCoverage({ ...base, cash: 50000 })).toMatchObject({
      needed: 11400,
      covered: 11400,
      shortfall: 0,
    });
    expect(householdCoverage({ ...base, cash: -500 })).toMatchObject({
      covered: 0,
      shortfall: 11400,
    });
  });

  it('never loses or invents a cent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1e7, max: 1e8 }),
        fc.array(fc.array(fc.integer({ min: 0, max: 1e7 }), { minLength: 3, maxLength: 3 }), {
          maxLength: 8,
        }),
        (cash, parts) => {
          const due = parts.map((p, i) => item(`Bill ${i}`, '2026-11-20', p));
          const c = householdCoverage({
            from: '2026-11-08',
            to: '2026-12-08',
            cash,
            due,
            members,
            contributions: [],
          });
          const total = parts.flat().reduce((a, b) => a + b, 0);
          expect(c.needed).toBe(total);
          expect(c.covered + c.shortfall).toBe(total);
          expect(c.covered).toBeGreaterThanOrEqual(0);
          expect(c.covered).toBeLessThanOrEqual(Math.max(0, cash));
          expect(c.people.reduce((n, p) => n + p.shareDue, 0)).toBe(total);
          for (const p of c.people) expect(Number.isInteger(p.shareDue)).toBe(true);
        },
      ),
    );
  });
});
