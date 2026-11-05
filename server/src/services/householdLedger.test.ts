import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { allocateShares, householdLedger, suggestSettlements } from './householdLedger.js';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('suggested settlements (SPL-01)', () => {
  const people = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('pairs debtors with creditors in person order', () => {
    expect(suggestSettlements(people, { a: 3000, b: -1000, c: -2000 })).toEqual([
      { fromId: 'b', toId: 'a', amount: 1000 },
      { fromId: 'c', toId: 'a', amount: 2000 },
    ]);
  });

  it('suggests nothing when everyone is settled', () => {
    expect(suggestSettlements(people, { a: 0, b: 0, c: 0 })).toEqual([]);
  });

  it('never turns what is owed to the household account into a transfer between people', () => {
    // a put in $100; the account paid $300 for all three: b and c owe it, nobody owes a
    const ledger = householdLedger(
      people,
      [
        { id: 'c1', kind: 'contribution', amount: 10000, payerId: 'a', recipientId: null },
        { id: 'p', kind: 'expense', amount: 30000, payerId: null, recipientId: null },
      ],
      people.map((x) => ({ eventId: 'p', personId: x.id, amount: 10000 })),
    );
    expect(ledger.settlements).toEqual([]);
    expect(ledger.poolOwed).toEqual([
      { personId: 'b', amount: 10000 },
      { personId: 'c', amount: 10000 },
    ]);
  });

  it('zeroes the direct balances, in at most n - 1 transfers, each within both balances', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100000, max: 100000 }), { minLength: 2, maxLength: 7 }),
        (raw) => {
          const ids = raw.map((_, i) => ({ id: `p${i}` }));
          const direct = Object.fromEntries(ids.map((p, i) => [p.id, raw[i]]));
          // Direct balances add up to zero: the last person takes the difference
          direct[ids[ids.length - 1].id] -= sum(raw);
          const transfers = suggestSettlements(ids, direct);
          expect(transfers.length).toBeLessThanOrEqual(ids.length - 1);
          const left = { ...direct };
          for (const t of transfers) {
            expect(t.amount).toBeGreaterThan(0);
            expect(t.amount).toBeLessThanOrEqual(-left[t.fromId]);
            expect(t.amount).toBeLessThanOrEqual(left[t.toId]);
            left[t.fromId] += t.amount;
            left[t.toId] -= t.amount;
          }
          expect(Object.values(left).every((v) => v === 0)).toBe(true);
        },
      ),
    );
  });

  it('leaves the other suggestions unchanged once one is recorded', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100000, max: 100000 }), { minLength: 3, maxLength: 7 }),
        (raw) => {
          const ids = raw.map((_, i) => ({ id: `p${i}` }));
          const direct = Object.fromEntries(ids.map((p, i) => [p.id, raw[i]]));
          direct[ids[ids.length - 1].id] -= sum(raw);
          const [first, ...rest] = suggestSettlements(ids, direct);
          if (!first) return;
          direct[first.fromId] += first.amount;
          direct[first.toId] -= first.amount;
          expect(suggestSettlements(ids, direct)).toEqual(rest);
        },
      ),
    );
  });
});

describe('rotating the spare cent (SPL-06)', () => {
  it('without an offset breaks ties by input order, as before', () => {
    expect(allocateShares(10000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
  });

  it('starts the spare cent at the offset, wrapping', () => {
    expect(allocateShares(10000, [1, 1, 1], 1)).toEqual([3333, 3334, 3333]);
    expect(allocateShares(10000, [1, 1, 1], 5)).toEqual([3333, 3333, 3334]);
  });

  it('always adds up to the amount, whatever the offset', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e9 }),
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 0, max: 2 ** 32 }),
        (amount, weights, offset) => {
          fc.pre(weights.some((w) => w > 0));
          expect(sum(allocateShares(amount, weights, offset))).toBe(amount);
        },
      ),
    );
  });
});
