import { describe, expect, it } from 'vitest';
import { bankFeedLink, connectedBanksLink, movedSettingsTab, parseProvider } from './movedSections';

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

describe('bankFeedLink (#244)', () => {
  it("opens Connected banks on the feed's own bank", () => {
    expect(bankFeedLink('Up')).toBe('/accounts/connections?provider=up');
    expect(bankFeedLink('Plaid')).toBe('/accounts/connections?provider=plaid');
    expect(bankFeedLink('SimpleFIN')).toBe('/accounts/connections?provider=simplefin');
    expect(bankFeedLink('Enable Banking')).toBe('/accounts/connections?provider=enablebanking');
  });

  it('opens the page with no provider for a label it does not know', () => {
    for (const label of ['Monzo', 'constructor', 'up', '']) {
      expect(bankFeedLink(label)).toBe('/accounts/connections');
    }
  });
});
