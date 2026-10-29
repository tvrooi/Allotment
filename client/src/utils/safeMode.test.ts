import { afterEach, describe, expect, it } from 'vitest';
import { usePreferencesStore } from '../store/preferencesStore';
import { useSafeModeStore } from '../store/safeModeStore';
import { formatAmount, formatAxisAmount, formatCurrency, formatMoney } from './currency';
import { HIDDEN_AMOUNT, hidesAllAmounts, safeModeHides } from './safeMode';

const style = { format: 'dot', position: 'before', symbol: '$' } as const;

afterEach(() => {
  useSafeModeStore.setState({ on: false });
  usePreferencesStore.setState({ safeModeLevel: 'balances' });
});

describe('safeModeHides', () => {
  it('hides nothing while off, whatever the level', () => {
    expect(safeModeHides(false, 'balances')).toEqual({ balances: false, all: false });
    expect(safeModeHides(false, 'all')).toEqual({ balances: false, all: false });
  });

  it('hides balances and totals by default', () => {
    expect(safeModeHides(true, 'balances')).toEqual({ balances: true, all: false });
    // A level saved by a newer version, or none at all, means the default
    expect(safeModeHides(true, undefined)).toEqual({ balances: true, all: false });
  });

  it('hides every amount at the all level, balances included', () => {
    expect(safeModeHides(true, 'all')).toEqual({ balances: true, all: true });
  });
});

describe('money formatters in Safe mode', () => {
  it('write amounts as usual while Safe mode is off', () => {
    expect(formatAmount(123_456, style)).toBe('$1,234.56');
    expect(hidesAllAmounts()).toBe(false);
  });

  it('still write amounts when only balances are hidden', () => {
    useSafeModeStore.setState({ on: true });
    expect(formatAmount(-123_456, style)).toBe('-$1,234.56');
    expect(formatAxisAmount(1_250_000, style)).toBe('$12.5k');
  });

  it('write no figure at all when every amount is hidden', () => {
    useSafeModeStore.setState({ on: true });
    usePreferencesStore.setState({ safeModeLevel: 'all' });
    for (const text of [
      formatAmount(-123_456, style),
      formatAxisAmount(1_250_000, style),
      formatCurrency(500),
      formatMoney(990, 'EUR'),
    ]) {
      expect(text).toBe(HIDDEN_AMOUNT);
      expect(text).not.toMatch(/\d/);
    }
  });
});
