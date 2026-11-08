import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { HOME_HOURLY, RATES_SOURCE, rateFor } from './taxRates.js';
import { homeClaim, homeYear } from './homeHours.js';

describe('working-from-home rates', () => {
  it('holds the ATO fixed rate for every year it publishes, in tenths of a cent', () => {
    expect(HOME_HOURLY).toEqual({ 2022: 670, 2023: 670, 2024: 700, 2025: 700 });
    expect(RATES_SOURCE.homeHourly).toMatch(/^https:\/\/www\.ato\.gov\.au\/.*fixed-rate-method$/);
    expect(RATES_SOURCE.checked).toBe('2026-11-08');
  });

  it('uses the table, lets a typed rate win, and never guesses a missing year', () => {
    expect(rateFor(HOME_HOURLY, 2024, null)).toBe(700);
    expect(rateFor(HOME_HOURLY, 2024, 650)).toBe(650);
    expect(rateFor(HOME_HOURLY, 2026, null)).toBeNull();
    expect(rateFor(HOME_HOURLY, 2026, 710)).toBe(710);
  });
});

describe('homeYear', () => {
  it("matches the ATO's example: 843 hours at 70c is $590.10", () => {
    const year = homeYear([{ minutes: 843 * 60 }], 700);
    expect(year.claim).toBe(59_010);
    expect(year.minutes).toBe(50_580);
    expect(year.missing).toEqual([]);
  });

  it('claims nothing, and says the rate is missing, for a year with no rate', () => {
    const year = homeYear([{ minutes: 480 }, { minutes: 60 }], null);
    expect(year).toMatchObject({ claim: 0, days: 2, minutes: 540, missing: ['rate'] });
  });

  it('rounds half a cent away from zero', () => {
    // 1 minute at 70c an hour is 1.1667c
    expect(homeClaim(1, 700)).toBe(1);
    // 30 minutes at 1 tenth-cent... 30 × 10 ÷ 600 = 0.5 exactly
    expect(homeClaim(30, 10)).toBe(1);
    expect(homeClaim(29, 10)).toBe(0);
    expect(homeClaim(0, 700)).toBe(0);
  });

  it('adding a day never lowers the claim', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1440 }), { maxLength: 60 }),
        fc.integer({ min: 1, max: 1440 }),
        fc.integer({ min: 1, max: 10_000 }),
        (minutes, extra, rate) => {
          const before = homeYear(
            minutes.map((m) => ({ minutes: m })),
            rate,
          ).claim;
          const after = homeYear(
            [...minutes, extra].map((m) => ({ minutes: m })),
            rate,
          ).claim;
          expect(after).toBeGreaterThanOrEqual(before);
        },
      ),
    );
  });
});
