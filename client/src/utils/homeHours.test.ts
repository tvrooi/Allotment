import { describe, expect, it } from 'vitest';
import { formatDuration, formatRate, parseDuration, parseRateTenths } from './homeHours';

describe('parseDuration', () => {
  it('reads decimal hours, clock times and h/min forms as whole minutes', () => {
    expect(parseDuration('7.5')).toBe(450);
    expect(parseDuration('8')).toBe(480);
    expect(parseDuration('7:30')).toBe(450);
    expect(parseDuration('7h30')).toBe(450);
    expect(parseDuration('7h')).toBe(420);
    expect(parseDuration(' 0.25 ')).toBe(15);
  });
  it('refuses nothing, zero, over 24 hours and words', () => {
    for (const bad of ['', '0', '24.5', '25', 'abc', '7.555', '-1', '7:75x', '7:75', '7h60'])
      expect(parseDuration(bad), bad).toBeNull();
    expect(parseDuration('24')).toBe(1440);
  });
});

describe('formatDuration', () => {
  it('writes hours and minutes', () => {
    expect(formatDuration(450)).toBe('7 h 30 min');
    expect(formatDuration(480)).toBe('8 h');
    expect(formatDuration(20)).toBe('20 min');
    expect(formatDuration(0)).toBe('0 min');
  });
});

describe('rates', () => {
  it('reads cents per hour to one decimal as tenths of a cent', () => {
    expect(parseRateTenths('70')).toBe(700);
    expect(parseRateTenths('71.5c')).toBe(715);
    expect(parseRateTenths('0.1')).toBe(1);
  });
  it('refuses zero, a second decimal and non-numbers', () => {
    for (const bad of ['', '0', '70.55', 'x', '1001', '-5'])
      expect(parseRateTenths(bad), bad).toBeNull();
  });
  it('writes a rate back the way it was typed', () => {
    expect(formatRate(700)).toBe('70c');
    expect(formatRate(715)).toBe('71.5c');
  });
});
