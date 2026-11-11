import { describe, expect, it } from 'vitest';
import { PER_GROUP, fold, matchRank, paletteSections, type PaletteEntry } from './commandPalette';

const entry = (group: PaletteEntry['group'], label: string): PaletteEntry => ({
  id: `${group}:${label}`,
  group,
  label,
});

describe('matchRank', () => {
  it('ranks a prefix, then a word start, then anywhere inside', () => {
    expect(matchRank('Groceries', 'gro')).toBe(0);
    expect(matchRank('Weekly groceries', 'gro')).toBe(1);
    expect(matchRank('Cash flow', 'flow')).toBe(1);
    expect(matchRank('Overflow', 'flow')).toBe(2);
    expect(matchRank('Rent', 'gro')).toBeNull();
  });

  it('counts a word start after punctuation, and keeps looking past an inner match', () => {
    expect(matchRank('Gas/Fuel', 'fuel')).toBe(1);
    expect(matchRank('Coffee (coffee shop)', 'coffee s')).toBe(1);
  });

  it('ignores case, accents and surrounding spaces', () => {
    expect(matchRank('Café Bleu', 'cafe')).toBe(0);
    expect(matchRank('CAFE', 'café')).toBe(0);
    expect(matchRank('Crème brûlée', '  BRULEE ')).toBe(1);
    expect(fold('Ñandú')).toBe('nandu');
  });
});

describe('paletteSections', () => {
  const entries = [
    entry('pages', 'Dashboard'),
    entry('pages', 'Budget'),
    entry('actions', 'Add a transaction'),
    entry('accounts', 'Everyday'),
    entry('categories', 'Dining out'),
    entry('payees', 'Daily Grind Coffee'),
    entry('goals', 'Holiday'),
  ];

  it('lists recents, then every page and action, when nothing is typed', () => {
    const recent = [entry('recent', 'Everyday')];
    const sections = paletteSections(entries, ' ', recent);
    expect(sections.map((s) => [s.group, s.items.map((i) => i.label)])).toEqual([
      ['recent', ['Everyday']],
      ['pages', ['Dashboard', 'Budget']],
      ['actions', ['Add a transaction']],
    ]);
  });

  it('searches every group, pages and actions first, and leaves out empty groups', () => {
    const sections = paletteSections(entries, 'd', [entry('recent', 'Dashboard')]);
    expect(sections.map((s) => [s.label, s.items.map((i) => i.label)])).toEqual([
      ['Pages', ['Dashboard', 'Budget']],
      ['Actions', ['Add a transaction']],
      ['Accounts', ['Everyday']],
      ['Categories', ['Dining out']],
      ['Payees', ['Daily Grind Coffee']],
      ['Goals', ['Holiday']],
    ]);
  });

  it('puts the best matches first and keeps the list order among equals', () => {
    const payees = ['Bean counter', 'Beans & Co', 'Green bean', 'Has a bean', 'Jellybean'].map(
      (n) => entry('payees', n),
    );
    const [section] = paletteSections(payees, 'bean');
    expect(section.items.map((i) => i.label)).toEqual([
      'Bean counter',
      'Beans & Co',
      'Green bean',
      'Has a bean',
      'Jellybean',
    ]);
    const shuffled = [payees[4], payees[2], payees[0]];
    expect(paletteSections(shuffled, 'bean')[0].items.map((i) => i.label)).toEqual([
      'Bean counter',
      'Green bean',
      'Jellybean',
    ]);
  });

  it(`shows at most ${PER_GROUP} results a group`, () => {
    const many = Array.from({ length: 12 }, (_, i) => entry('accounts', `Saver ${i}`));
    const [section] = paletteSections([...many, entry('pages', 'Savings report')], 'sav');
    expect(section.group).toBe('pages');
    expect(paletteSections(many, 'sav')[0].items).toHaveLength(PER_GROUP);
  });

  it('finds nothing for a query nothing matches', () => {
    expect(paletteSections(entries, 'zzz')).toEqual([]);
  });
});
