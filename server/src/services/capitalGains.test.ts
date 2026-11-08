import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  apportion,
  discountEligible,
  fifoParcels,
  netCapitalGain,
  saleFigures,
  type AvailableLot,
} from './capitalGains.js';

// D3a (docs/INVESTMENT-SALES-AND-INCOME.md §3 and §7): the ATO's capital gains rules, each on its
// own. Quantities are millionths of a unit; amounts are cents. Mock figures only.

const U = 1_000_000;
const RUNS = Number(process.env.PROPERTY_RUNS ?? 100);
const same = (amount: number) => amount;

describe('the 12-month discount', () => {
  it('needs 12 months not counting the days bought and sold', () => {
    expect(discountEligible('2025-01-01', '2026-01-01')).toBe(false);
    expect(discountEligible('2025-01-01', '2026-01-02')).toBe(true);
    expect(discountEligible('2025-06-30', '2025-12-31')).toBe(false);
  });

  it('counts 29 February to the end of February a year later', () => {
    expect(discountEligible('2024-02-29', '2025-02-28')).toBe(false);
    expect(discountEligible('2024-02-29', '2025-03-01')).toBe(true);
    // Bought the day before a leap day: the leap day is the day after a full year
    expect(discountEligible('2023-02-28', '2024-02-28')).toBe(false);
    expect(discountEligible('2023-02-28', '2024-02-29')).toBe(true);
  });
});

describe('first in, first out', () => {
  const lots: AvailableLot[] = [
    { id: 'late', acquiredOn: '2025-03-01', createdAt: '1', remaining: 5 * U },
    { id: 'b', acquiredOn: '2024-01-01', createdAt: '2', remaining: 3 * U },
    { id: 'a', acquiredOn: '2024-01-01', createdAt: '1', remaining: 2 * U },
    { id: 'after', acquiredOn: '2026-01-01', createdAt: '1', remaining: 9 * U },
  ];

  it('takes the oldest purchases first, ties by when they were entered', () => {
    expect(fifoParcels(lots, 6 * U, '2025-06-01')).toEqual({
      parcels: [
        { lotId: 'a', quantity: 2 * U },
        { lotId: 'b', quantity: 3 * U },
        { lotId: 'late', quantity: U },
      ],
      uncovered: 0,
    });
  });

  it('never takes from a purchase made after the sale, and says what is left uncovered', () => {
    expect(fifoParcels(lots, 12 * U, '2025-12-31')).toEqual({
      parcels: [
        { lotId: 'a', quantity: 2 * U },
        { lotId: 'b', quantity: 3 * U },
        { lotId: 'late', quantity: 5 * U },
      ],
      uncovered: 2 * U,
    });
  });
});

describe('a sale, parcel by parcel', () => {
  const old = { id: 'old', acquiredOn: '2023-07-01', quantity: 100 * U, costBasis: 500_000 };
  const recent = { id: 'recent', acquiredOn: '2025-03-01', quantity: 50 * U, costBasis: 400_000 };
  const sale = { soldOn: '2025-09-01', quantity: 120 * U, proceeds: 1_210_000, fees: 10_000 };

  it("splits the proceeds after brokerage by units and takes each lot's share of cost", () => {
    const f = saleFigures(
      sale,
      [
        { lot: old, quantity: 100 * U },
        { lot: recent, quantity: 20 * U },
      ],
      same,
    );
    expect(f.proceeds).toBe(1_200_000);
    expect(f.parcels.map((p) => [p.proceeds, p.cost, p.gain, p.discountable])).toEqual([
      [1_000_000, 500_000, 500_000, true],
      [200_000, 160_000, 40_000, false],
    ]);
    expect(f).toMatchObject({ cost: 660_000, gain: 540_000, discountableGain: 500_000 });
  });

  it("leaves a gain unknown, never zero, when a cost or a lot isn't there", () => {
    const f = saleFigures(sale, [{ lot: { ...old, costBasis: null }, quantity: 100 * U }], same);
    expect(f.parcels.map((p) => [p.lotId, p.unknown, p.gain])).toEqual([
      ['old', 'no_cost', null],
      [null, 'no_lot', null],
    ]);
    expect(f.gain).toBeNull();
    expect(f.cost).toBeNull();
  });

  it('converts cost on the purchase date and proceeds on the sale date', () => {
    // A US security: 1.5 when bought, 1.6 when sold
    const rate = (amount: number, date: string) =>
      Math.round(amount * (date < '2025-01-01' ? 1.5 : 1.6));
    const f = saleFigures(
      { soldOn: '2025-09-01', quantity: 10 * U, proceeds: 100_000, fees: 0 },
      [{ lot: { ...old, quantity: 10 * U, costBasis: 100_000 }, quantity: 10 * U }],
      rate,
    );
    // The same 1,000 USD each way is a gain only through the rate
    expect(f).toMatchObject({ proceeds: 160_000, cost: 150_000, gain: 10_000 });

    const noRate = saleFigures(
      { soldOn: '2025-09-01', quantity: 10 * U, proceeds: 100_000, fees: 0 },
      [{ lot: { ...old, quantity: 10 * U, costBasis: 100_000 }, quantity: 10 * U }],
      (amount, date) => (date < '2025-01-01' ? null : amount),
    );
    expect(noRate.parcels[0].unknown).toBe('no_rate');
    expect(noRate.gain).toBeNull();
  });
});

describe('netting and the discount', () => {
  it('uses losses on gains with no discount first, then discounts what is left', () => {
    const net = netCapitalGain(
      [
        { gain: 10_000, discountable: true },
        { gain: 4_000, discountable: false },
        { gain: -6_000, discountable: true },
      ],
      0,
    );
    // 6,000 of losses: 4,000 against the undiscounted gain, 2,000 against the discountable one,
    // then half of the 8,000 left
    expect(net).toMatchObject({
      totalGains: 14_000,
      currentLosses: 6_000,
      lossesApplied: 6_000,
      discount: 4_000,
      netGain: 4_000,
      lossesCarriedForward: 0,
    });
  });

  it("uses this year's losses before earlier years', and carries the rest forward", () => {
    const net = netCapitalGain(
      [
        { gain: 3_000, discountable: false },
        { gain: -1_000, discountable: false },
      ],
      5_000,
    );
    expect(net).toMatchObject({
      totalGains: 3_000,
      lossesApplied: 3_000,
      netGain: 0,
      lossesCarriedForward: 3_000,
    });
  });

  it('carries a net loss forward and never goes below zero', () => {
    const net = netCapitalGain([{ gain: -2_500, discountable: true }], 1_000);
    expect(net).toMatchObject({ netGain: 0, lossesCarriedForward: 3_500, lossesApplied: 0 });
  });

  it('leaves unknown gains out and counts them', () => {
    const net = netCapitalGain(
      [
        { gain: null, discountable: true },
        { gain: 1_001, discountable: true },
      ],
      0,
    );
    // Half of an odd cent: the discount rounds down, so the net gain is never understated
    expect(net).toMatchObject({ unknownParcels: 1, discount: 500, netGain: 501 });
  });
});

describe('properties', () => {
  const lotArb = fc.record({
    id: fc.uuid(),
    acquiredOn: fc
      .integer({ min: 0, max: 900 })
      .map((d) => new Date(Date.UTC(2023, 0, 1 + d)).toISOString().slice(0, 10)),
    createdAt: fc.string({ maxLength: 4 }),
    remaining: fc.integer({ min: 0, max: 1_000 * U }),
  });

  it('first in, first out never takes more than a lot has, and covers all it can', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(lotArb, { selector: (l) => l.id, maxLength: 8 }),
        fc.integer({ min: 1, max: 5_000 * U }),
        (lots, quantity) => {
          const { parcels, uncovered } = fifoParcels(lots, quantity, '2026-01-01');
          const taken = parcels.reduce((s, p) => s + p.quantity, 0);
          expect(taken + uncovered).toBe(quantity);
          for (const p of parcels) {
            expect(p.quantity).toBeGreaterThan(0);
            expect(p.quantity).toBeLessThanOrEqual(lots.find((l) => l.id === p.lotId)!.remaining);
          }
          const available = lots
            .filter((l) => l.acquiredOn <= '2026-01-01')
            .reduce((s, l) => s + l.remaining, 0);
          expect(uncovered).toBe(Math.max(0, quantity - available));
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('first in, first out is the owner choosing the oldest lots by hand', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(lotArb, { selector: (l) => l.id, minLength: 1, maxLength: 8 }),
        fc.integer({ min: 1, max: 5_000 * U }),
        (lots, quantity) => {
          const { parcels } = fifoParcels(lots, quantity, '2026-01-01');
          // Every lot older than the newest one used is used up
          const used = new Set(parcels.map((p) => p.lotId));
          const newest = parcels.at(-1);
          if (!newest) return;
          const cut = lots.find((l) => l.id === newest.lotId)!;
          for (const l of lots)
            if (l.remaining > 0 && l.acquiredOn < cut.acquiredOn) expect(used.has(l.id)).toBe(true);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('apportioned parts always add up to the whole', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1e12, max: 1e12 }),
        fc.array(fc.integer({ min: 1, max: 1e12 }), { minLength: 1, maxLength: 10 }),
        (total, weights) => {
          const parts = apportion(total, weights);
          expect(parts.reduce((s, p) => s + p, 0)).toBe(total);
          for (const p of parts) expect(Math.sign(p) * Math.sign(total)).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it("a sale's parcels add up to the sale", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            lotUnits: fc.integer({ min: 1, max: 1_000 * U }),
            cost: fc.option(fc.integer({ min: 0, max: 1e9 }), { nil: null }),
            share: fc.integer({ min: 1, max: 100 }),
          }),
          { minLength: 1, maxLength: 6 },
        ),
        fc.integer({ min: 0, max: 1e10 }),
        fc.integer({ min: 0, max: 1e6 }),
        fc.integer({ min: 0, max: 100 * U }),
        (lots, proceeds, fees, extra) => {
          const parcels = lots.map((l, i) => ({
            lot: {
              id: String(i),
              acquiredOn: '2024-01-01',
              quantity: l.lotUnits,
              costBasis: l.cost,
            },
            quantity: Math.max(1, Math.floor((l.lotUnits * l.share) / 100)),
          }));
          const quantity = parcels.reduce((s, p) => s + p.quantity, 0) + extra;
          const f = saleFigures({ soldOn: '2025-06-01', quantity, proceeds, fees }, parcels, same);
          expect(f.parcels.reduce((s, p) => s + p.quantity, 0)).toBe(quantity);
          expect(f.parcels.reduce((s, p) => s + p.proceeds!, 0)).toBe(proceeds - fees);
          if (f.gain !== null) expect(f.gain).toBe(f.proceeds! - f.cost!);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('losses never make the net gain negative, and the discount is taken once', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            gain: fc.option(fc.integer({ min: -1e9, max: 1e9 }), { nil: null }),
            discountable: fc.boolean(),
          }),
          { maxLength: 12 },
        ),
        fc.integer({ min: 0, max: 1e9 }),
        (parcels, carriedIn) => {
          const net = netCapitalGain(parcels, carriedIn);
          expect(net.netGain).toBeGreaterThanOrEqual(0);
          expect(net.lossesCarriedForward).toBeGreaterThanOrEqual(0);
          // Nothing is lost or made up: what's left of the gains plus what's left of the losses
          // is the gains less the losses, before the discount
          expect(net.netGain + net.discount - net.lossesCarriedForward).toBe(
            net.totalGains - net.currentLosses - carriedIn,
          );
          // The discount is at most half the discountable gains
          const discountable = parcels
            .filter((p) => p.discountable && p.gain !== null && p.gain > 0)
            .reduce((s, p) => s + p.gain!, 0);
          expect(net.discount).toBeLessThanOrEqual(Math.floor(discountable / 2));
          // Only one of a net gain and losses to carry forward
          expect(net.netGain > 0 && net.lossesCarriedForward > 0).toBe(false);
        },
      ),
      { numRuns: RUNS },
    );
  });
});
