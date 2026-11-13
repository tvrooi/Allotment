import { describe, expect, it } from 'vitest';
import { movedSettingsTab } from './movedSections';

describe('movedSettingsTab (#244)', () => {
  it('sends the old Connected banks and Categories tabs to their new pages', () => {
    expect(movedSettingsTab('connections')).toBe('/accounts?banks=up');
    expect(movedSettingsTab('categories')).toBe('/budget?view=categories');
  });

  it('leaves the remaining tabs, no tab and inherited names alone', () => {
    expect(movedSettingsTab('preferences')).toBeNull();
    expect(movedSettingsTab(null)).toBeNull();
    expect(movedSettingsTab('constructor')).toBeNull();
    expect(movedSettingsTab('toString')).toBeNull();
  });
});
