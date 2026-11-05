import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fc from 'fast-check';
import {
  addDaysIso,
  addMonthsIso,
  daysBetweenIso,
  eachDayIso,
  isIsoDay,
  localDayIso,
  utcDayIso,
} from './date.js';

describe('calendar-day arithmetic', () => {
  it('adds days across month, year and leap boundaries', () => {
    expect(addDaysIso('2026-11-03', 14)).toBe('2026-11-17');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysIso('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysIso('2026-11-03', 0)).toBe('2026-11-03');
  });

  it('refuses days that do not exist rather than rolling them over', () => {
    expect(isIsoDay('2026-02-30')).toBe(false);
    expect(isIsoDay('2026-13-01')).toBe(false);
    expect(isIsoDay('2026-1-1')).toBe(false);
    expect(isIsoDay('2026-02-28T00:00:00Z')).toBe(false);
    expect(isIsoDay(20260228)).toBe(false);
    expect(isIsoDay('2028-02-29')).toBe(true);
    expect(() => addDaysIso('2026-02-30', 1)).toThrow(RangeError);
    expect(() => daysBetweenIso('nope', '2026-01-01')).toThrow(RangeError);
  });

  it('adds months, cutting to the last day of a shorter month', () => {
    expect(addMonthsIso('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsIso('2028-03-31', -1)).toBe('2028-02-29');
    expect(addMonthsIso('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonthsIso('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonthsIso('2026-11-05', -12)).toBe('2025-11-05');
  });

  it('walks every day inclusive, and none when the range is backwards', () => {
    expect(eachDayIso('2026-02-27', '2026-03-02')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
    expect(eachDayIso('2026-05-01', '2026-05-01')).toEqual(['2026-05-01']);
    expect(eachDayIso('2026-05-02', '2026-05-01')).toEqual([]);
  });

  it('reads the UTC day of an instant', () => {
    expect(utcDayIso(Date.parse('2026-11-02T23:59:59Z'))).toBe('2026-11-02');
    expect(utcDayIso(new Date('2026-11-03T00:00:00Z'))).toBe('2026-11-03');
    expect(utcDayIso(Date.parse('1969-12-31T23:00:00Z'))).toBe('1969-12-31');
  });

  it('is its own inverse and agrees with the day count (property-based)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20_000 }),
        fc.integer({ min: -4000, max: 4000 }),
        (start, n) => {
          const day = utcDayIso(start * 86_400_000);
          const moved = addDaysIso(day, n);
          expect(daysBetweenIso(day, moved)).toBe(n);
          expect(addDaysIso(moved, -n)).toBe(day);
          if (n >= 0) {
            const days = eachDayIso(day, moved);
            expect(days).toHaveLength(n + 1);
            expect(new Set(days).size).toBe(n + 1);
          }
        },
      ),
    );
  });

  it('reads the machine zone only for "today"', () => {
    // A local wall-clock date is what a person calls the day
    expect(localDayIso(new Date(2026, 10, 3, 0, 5))).toBe('2026-11-03');
    expect(localDayIso(new Date(2026, 10, 3, 23, 55))).toBe('2026-11-03');
  });
});

// The helpers must give the same answer in every zone. These run the module in a child process
// per zone, since Node reads TZ once at start: Sydney (east of UTC, where the old
// toISOString().slice(0, 10) came out a day short), UTC, Montevideo (west of UTC, and it moved
// its clocks at midnight in 2014) and Havana and Beirut (clocks that change at midnight today).
const ZONES = ['UTC', 'Australia/Sydney', 'America/Montevideo', 'America/Havana', 'Asia/Beirut'];

const probe = `
  const d = await import(process.argv[1]);
  const out = {
    lookback: d.addDaysIso('2026-11-03', 14),
    back: d.addDaysIso('2026-11-03', -400),
    // 20:00 UTC on 2 November: already the 3rd in Sydney, still the 2nd in Montevideo
    local: d.localDayIso(new Date('2026-11-02T20:00:00Z')),
    utc: d.utcDayIso(Date.parse('2026-11-02T20:00:00Z')),
    spring: d.eachDayIso('2026-10-01', '2026-10-08'),
    havana: d.eachDayIso('2026-03-05', '2026-03-12'),
    beirut: d.eachDayIso('2026-03-26', '2026-04-02'),
    montevideo: d.eachDayIso('2014-10-02', '2014-10-09'),
    month: d.addMonthsIso('2026-03-31', -1),
  };
  console.log(JSON.stringify(out));
`;

describe.each(ZONES)('calendar days in %s', (zone) => {
  it('does not depend on the zone', () => {
    const file = new URL('./date.ts', import.meta.url).href;
    const out = JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '-e', probe, file], {
        env: { ...process.env, TZ: zone },
        encoding: 'utf8',
      }),
    );
    expect(out.lookback).toBe('2026-11-17');
    expect(out.back).toBe('2025-09-29');
    expect(out.utc).toBe('2026-11-02');
    expect(out.month).toBe('2026-02-28');
    expect(out.local).toBe(zone === 'Australia/Sydney' ? '2026-11-03' : '2026-11-02');
    expect(out.spring).toEqual(eachDayIso('2026-10-01', '2026-10-08'));
    expect(out.spring).toHaveLength(8);
    expect(out.havana).toHaveLength(8);
    expect(out.havana.at(-1)).toBe('2026-03-12');
    expect(out.beirut).toHaveLength(8);
    expect(out.beirut.at(-1)).toBe('2026-04-02');
    expect(out.montevideo).toHaveLength(8);
    expect(out.montevideo.at(-1)).toBe('2014-10-09');
  });
});
