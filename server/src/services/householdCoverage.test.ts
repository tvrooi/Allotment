import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { householdCoverage, type CoverageItem } from './householdCoverage.js';

const members = [{ id: 'me' }, { id: 'alex' }, { id: 'sam' }];
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
      cash: 15040,
      due: [
        item('Rent', '2026-11-19', [140000, 150000, 120000]),
        item('Power', '2026-11-28', [4000, 4000, 4000]),
        item('Next year', '2026-12-09', [100, 100, 100]),
      ],
      members,
      contributions: [
        { payerId: 'alex', date: '2026-11-06', amount: 7500 },
        { payerId: 'alex', date: '2026-10-30', amount: 5000 },
        { payerId: 'sam', date: '2026-11-06', amount: 7500 },
        { payerId: null, date: '2026-11-07', amount: 100 },
      ],
    });
    expect(coverage.due.map((d) => d.name)).toEqual(['Rent', 'Power']);
    expect(coverage.needed).toBe(422000);
    expect(coverage.covered).toBe(15040);
    expect(coverage.shortfall).toBe(422000 - 15040);
    expect(coverage.people).toEqual([
      { personId: 'me', shareDue: 144000, paidIn: 0 },
      { personId: 'alex', shareDue: 154000, paidIn: 7500 },
      { personId: 'sam', shareDue: 124000, paidIn: 7500 },
    ]);
  });

  it('covers everything when the cash is enough, and nothing when the account is overdrawn', () => {
    const due = [item('Internet', '2026-11-10', [3300, 3300, 3300])];
    const base = { from: '2026-11-08', to: '2026-12-08', due, members, contributions: [] };
    expect(householdCoverage({ ...base, cash: 50000 })).toMatchObject({
      needed: 9900,
      covered: 9900,
      shortfall: 0,
    });
    expect(householdCoverage({ ...base, cash: -500 })).toMatchObject({
      covered: 0,
      shortfall: 9900,
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
