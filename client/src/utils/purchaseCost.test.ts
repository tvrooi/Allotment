import { describe, expect, it } from 'vitest';
import { purchaseCost } from './purchaseCost';

describe('purchaseCost', () => {
  it("is in the budget's currency", () => {
    // Same currency as the budget
    expect(purchaseCost({ amount: -199_900 })).toBe(199_900);
    // USD 1,000 worth AUD 1,500: the asset costs AUD 1,500
    expect(purchaseCost({ amount: -100_000, mainAmount: -150_000, mainAmountSource: 'rate' })).toBe(
      150_000,
    );
    expect(
      purchaseCost({ amount: -100_000, mainAmount: -149_000, mainAmountSource: 'manual' }),
    ).toBe(149_000);
  });

  it('is unknown while the day has no rate', () => {
    expect(purchaseCost({ amount: -100_000, mainAmount: null, mainAmountSource: 'missing' })).toBe(
      null,
    );
  });
});
