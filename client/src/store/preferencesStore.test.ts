import { describe, expect, it } from 'vitest';
import { PREFERENCES_VERSION, dateFormatForLocale, migratePreferences } from './preferencesStore';

describe('migratePreferences', () => {
  it('keeps 1,234.56 with the symbol first for installs from before the amount format', () => {
    expect(migratePreferences({ currencySymbol: '€', theme: 'dark' }, 0)).toEqual({
      currencySymbol: '€',
      theme: 'dark',
      amountFormat: 'dot',
      symbolPosition: 'before',
    });
  });

  it('leaves preferences saved by this version alone', () => {
    const saved = { amountFormat: 'auto', symbolPosition: 'after', currencySymbol: '€' };
    expect(migratePreferences(saved, PREFERENCES_VERSION)).toEqual(saved);
  });

  it('copes with nothing usable saved', () => {
    expect(migratePreferences(null, 0)).toEqual({ amountFormat: 'dot', symbolPosition: 'before' });
  });
});

describe('Safe mode level migration', () => {
  it('drops a level the owner never chose, so the new default applies', () => {
    expect(migratePreferences({ safeModeLevel: 'balances', theme: 'dark' }, 2)).toEqual({
      theme: 'dark',
    });
  });

  it('keeps a level the owner chose', () => {
    const saved = { safeModeLevel: 'balances', safeModeLevelChosen: true };
    expect(migratePreferences(saved, 2)).toEqual(saved);
  });
});

describe('dateFormatForLocale', () => {
  it('follows the browser language', () => {
    expect(dateFormatForLocale('en-AU')).toBe('dd/MM/yyyy');
    expect(dateFormatForLocale('en-GB')).toBe('dd/MM/yyyy');
    expect(dateFormatForLocale('de-DE')).toBe('dd.MM.yyyy');
    expect(dateFormatForLocale('sv-SE')).toBe('yyyy-MM-dd');
  });

  it('keeps the written-out US style for US English and unknown languages', () => {
    expect(dateFormatForLocale('en-US')).toBe('MMM d, yyyy');
    expect(dateFormatForLocale('not a locale')).toBe('MMM d, yyyy');
  });
});
