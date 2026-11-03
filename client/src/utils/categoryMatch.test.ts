import { describe, expect, it } from 'vitest';
import { matchCategory } from './categoryMatch';
import type { CategoryGroup } from '../types';

const group = (id: string, name: string, cats: [string, string][]): CategoryGroup =>
  ({
    id,
    name,
    isIncome: 0,
    sortOrder: 0,
    createdAt: '',
    categories: cats.map(([cid, cname]) => ({ id: cid, name: cname, groupId: id })),
  }) as unknown as CategoryGroup;
const groups = [
  group('g1', 'Transportation', [
    ['fuel', 'Gas / Fuel'],
    ['transit', 'Public Transit'],
  ]),
  group('g2', 'Housing', [['rent', 'Rent / Mortgage']]),
  group('g3', 'Food & Dining', [
    ['groc', 'Groceries'],
    ['rest', 'Restaurants'],
  ]),
  group('g4', 'Bills', [['gasnat', 'Gas (Natural)']]),
];
const pick = (name: string, g: string | null = null) =>
  matchCategory({ group: g, name }, groups)?.id ?? 'new';

describe('suggested category matches', () => {
  it('matches the same name ignoring case and punctuation', () => {
    expect(pick('groceries')).toBe('groc');
    expect(pick('Rent - Mortgage')).toBe('rent');
  });
  it('matches one part of a "Gas / Fuel" style name and obvious equivalents', () => {
    expect(pick('Fuel')).toBe('fuel');
    expect(pick('Public Transport', 'Transport')).toBe('transit');
    expect(pick('Rent')).toBe('rent');
    expect(pick('Dining out')).toBe('rest');
  });
  it('prefers the full name over a part, and suggests a new category when nothing is close', () => {
    expect(pick('Gas (Natural)')).toBe('gasnat');
    expect(pick('Pet food')).toBe('new');
  });
});
