import { describe, expect, it } from 'vitest';
import { bankFeedLink, connectedBanksLink, movedSettingsTab, parseProvider } from './movedSections';

describe('movedSettingsTab (#244)', () => {
  const moved = (query: string) => movedSettingsTab(new URLSearchParams(query));

  it('sends the old Connected banks and Categories tabs to their new pages', () => {
    expect(moved('tab=connections')).toBe('/accounts/connections');
    expect(moved('tab=categories')).toBe('/budget/categories');
  });

  it('keeps every other query parameter and drops the tab', () => {
    expect(moved('tab=connections&x=1')).toBe('/accounts/connections?x=1');
    expect(moved('x=1&tab=categories&y=2')).toBe('/budget/categories?x=1&y=2');
    expect(moved('tab=connections&provider=plaid')).toBe('/accounts/connections?provider=plaid');
  });

  it('leaves the remaining tabs, no tab and inherited names alone', () => {
    for (const query of ['tab=preferences', '', 'tab=constructor', 'tab=toString']) {
      expect(moved(query)).toBeNull();
    }
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

describe('moved sections (#244)', () => {
  it("the moved sections' addresses are written in one place", () => {
    // Every client source file, as text (as guides.test.ts reads them), apart from this module
    // and the tests: a link written out by hand would miss the next move or a ?provider=
    const sources = import.meta.glob<string>('../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const files = Object.keys(sources).filter(
      (file) => file !== './movedSections.ts' && !/\.test\.tsx?$/.test(file),
    );
    expect(files.length).toBeGreaterThan(50);
    for (const file of files) {
      for (const address of [
        '/accounts/connections',
        '/budget/categories',
        'tab=connections',
        'tab=categories',
      ]) {
        expect(sources[file], `${file} spells ${address}`).not.toContain(address);
      }
    }
  });
});
