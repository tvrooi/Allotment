import { describe, expect, it } from 'vitest';
import {
  PER_GROUP,
  paletteCanSearch,
  paletteResultCount,
  fold,
  matchRank,
  paletteSections,
  paletteTransactionNote,
  type PaletteEntry,
} from './commandPalette';

const entry = (group: PaletteEntry['group'], label: string): PaletteEntry => ({
  id: `${group}:${label}`,
  group,
  label,
});

describe('paletteTransactionNote', () => {
  const tx = {
    payeeName: 'Corner Store',
    notes: 'Weekly shop',
    children: [{ notes: 'Food' }, { notes: 'Palette secret café note' }],
  };

  it('shows the matching split child note, including when the parent has no note', () => {
    expect(paletteTransactionNote(tx, 'SECRET CAFE')).toBe('Palette secret café note');
    expect(paletteTransactionNote({ ...tx, notes: null }, 'secret')).toBe(
      'Palette secret café note',
    );
  });

  it('uses a matching parent note, but leaves account details for payee-only or absent matches', () => {
    expect(paletteTransactionNote(tx, 'weekly')).toBe('Weekly shop');
    expect(paletteTransactionNote(tx, 'corner')).toBeUndefined();
    expect(paletteTransactionNote(tx, 'missing')).toBeUndefined();
    expect(paletteTransactionNote({ ...tx, payeeName: 'Secret shop' }, 'secret')).toBeUndefined();
  });
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

describe('server search groups', () => {
  const transactions = Array.from({ length: 8 }, (_, i) => entry('transactions', `Unmatched ${i}`));
  const files = [entry('files', 'Unmatched file')];
  it('keeps server order and all eight rows after cached groups, without label matching', () => {
    const all = [
      ...files,
      ...transactions,
      entry('transactions', 'See all in Transactions'),
      entry('goals', 'Coffee goal'),
    ];
    const sections = paletteSections(all, 'coffee');
    expect(sections.map((s) => s.group)).toEqual(['goals', 'transactions', 'files']);
    expect(sections[1].items).toEqual([...transactions, all[9]]);
    expect(sections[2].items).toEqual(files);
  });
  it('omits server groups below two trimmed characters', () => {
    for (const q of ['', ' ', ' a ']) {
      expect(paletteCanSearch(q)).toBe(false);
      expect(paletteSections([...transactions, ...files], q)).toEqual([]);
    }
    expect(paletteCanSearch(' ab ')).toBe(true);
  });
  it('does not count message rows', () => {
    const sections = paletteSections(
      [
        entry('transactions', 'Coffee'),
        { ...entry('files', 'Searching…'), message: true, unavailable: 'Searching…' },
      ],
      'coffee',
    );
    expect(sections.map((s) => s.group)).toEqual(['transactions', 'files']);
    expect(paletteResultCount(sections)).toBe(1);
  });
});
