import { describe, expect, it } from 'vitest';
import { CATEGORY_ICONS, categoryIconName } from './categoryIcons';

describe('categoryIconName', () => {
  it('keeps an icon name the app has', () => {
    expect(categoryIconName('ShoppingCart')).toBe('ShoppingCart');
  });

  it('shows an older budget’s emoji as the nearest icon', () => {
    expect(categoryIconName('🛒')).toBe('ShoppingCart');
    // With and without the emoji variation selector
    expect(categoryIconName('🛡️')).toBe('Shield');
    expect(categoryIconName('🛡')).toBe('Shield');
    expect(categoryIconName('🏋️‍♀️')).toBe('Dumbbell');
  });

  it('shows any other emoji or text as a plain tag, and nothing for none', () => {
    expect(categoryIconName('🦄')).toBe('Tag');
    expect(categoryIconName('')).toBeNull();
    expect(categoryIconName(null)).toBeNull();
  });

  it('only maps to icons it can draw', () => {
    for (const e of ['💵', '🏠', '⚡', '☕', '✈️', '🐶', '🛟', '📁']) {
      expect(CATEGORY_ICONS[categoryIconName(e)!], e).toBeTruthy();
    }
  });
});
