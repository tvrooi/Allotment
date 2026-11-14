import { describe, expect, it } from 'vitest';
import { connectedBanksLink, movedSettingsTab, parseProvider } from './movedSections';

describe('movedSettingsTab (#244)', () => {
  it('sends the old Connected banks and Categories tabs to their new pages', () => {
    expect(movedSettingsTab('connections')).toBe('/accounts/connections');
    expect(movedSettingsTab('categories')).toBe('/budget?view=categories');
  });

  it('leaves the remaining tabs, no tab and inherited names alone', () => {
    expect(movedSettingsTab('preferences')).toBeNull();
    expect(movedSettingsTab(null)).toBeNull();
    expect(movedSettingsTab('constructor')).toBeNull();
    expect(movedSettingsTab('toString')).toBeNull();
  });
});

describe('parseProvider (#244)', () => {
  it('accepts the four bank providers by their exact ids', () => {
    expect(parseProvider('up')).toBe('up');
    expect(parseProvider('plaid')).toBe('plaid');
    expect(parseProvider('simplefin')).toBe('simplefin');
    expect(parseProvider('enablebanking')).toBe('enablebanking');
  });

  it('refuses anything else, so a link cannot choose what the page shows', () => {
    for (const value of ['UP', 'Up', '../x', 'constructor', '', null]) {
      expect(parseProvider(value)).toBeNull();
    }
  });
});

describe('connectedBanksLink (#244)', () => {
  it('opens Connected banks, on a provider when one is named', () => {
    expect(connectedBanksLink()).toBe('/accounts/connections');
    expect(connectedBanksLink('plaid')).toBe('/accounts/connections?provider=plaid');
  });
});
