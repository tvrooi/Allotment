import { describe, expect, it } from 'vitest';
import type { HouseholdSplit } from '../../api/households';
import { SPLIT_STEP, defaultShare, sliderSplit } from './sliderSplit';

const percent = (me: number): HouseholdSplit => ({
  mode: 'percentage',
  shares: [
    { personId: 'a', value: me * 100 },
    { personId: 'b', value: (100 - me) * 100 },
  ],
});

describe('sliderSplit', () => {
  it('sends an equal split at 50, as an expense without the slider would', () => {
    expect(sliderSplit(50, 'a', 'b')).toBeNull();
  });

  it('sends percentages in basis points that add up to 100%', () => {
    expect(sliderSplit(65, 'a', 'b')).toEqual(percent(65));
    expect(sliderSplit(0, 'a', 'b')).toEqual(percent(0));
    expect(sliderSplit(100, 'a', 'b')).toEqual(percent(100));
  });

  it('gives every step from 0 to 100 shares that total 10000', () => {
    for (let v = 0; v <= 100; v += SPLIT_STEP) {
      const split = sliderSplit(v, 'a', 'b');
      if (v === 50) continue;
      expect(split?.shares.reduce((n, s) => n + s.value, 0)).toBe(10000);
    }
  });
});

describe('defaultShare', () => {
  it('starts at 50 with no default split or an equal one', () => {
    expect(defaultShare(null, 'a')).toBe(50);
    expect(defaultShare({ mode: 'equal', shares: [] }, 'a')).toBe(50);
  });

  it('starts at 50 for a weighted default, which is not a percentage', () => {
    expect(
      defaultShare(
        {
          mode: 'weight',
          shares: [
            { personId: 'a', value: 2 },
            { personId: 'b', value: 1 },
          ],
        },
        'a',
      ),
    ).toBe(50);
  });

  it('starts at your percentage in a percentage default, on a 5% step', () => {
    expect(defaultShare(percent(70), 'a')).toBe(70);
    expect(defaultShare(percent(70), 'b')).toBe(30);
    expect(defaultShare(percent(62), 'a')).toBe(60);
  });

  it('falls back to 50 for a percentage that is not a whole number', () => {
    const split: HouseholdSplit = {
      mode: 'percentage',
      shares: [
        { personId: 'a', value: 3333 },
        { personId: 'b', value: 6667 },
      ],
    };
    expect(defaultShare(split, 'a')).toBe(50);
  });
});
