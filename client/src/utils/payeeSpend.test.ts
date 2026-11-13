import { describe, expect, it } from 'vitest';
import { spendByMonth, spendWithoutRate } from './payeeSpend';

const tx = (date: string, amount: number, extra: Record<string, unknown> = {}) => ({
  date,
  amount,
  mainAmount: null,
  mainAmountSource: null,
  parentTransactionId: null,
  ...extra,
});

describe("a payee's spending by month (#235)", () => {
  it('sums money out per month over the last 12 months, oldest first, with empty months', () => {
    const months = spendByMonth(
      [
        tx('2026-11-03', -1_250),
        tx('2026-11-20', -750),
        tx('2026-09-01', -500),
        // A refund is money in, not spending
        tx('2026-09-02', 300),
        // Older than the twelve months shown
        tx('2025-11-30', -9_999),
      ] as never,
      '2026-11-13',
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ month: '2025-12', amount: 0 });
    expect(months.at(-1)).toEqual({ month: '2026-11', amount: 2_000 });
    expect(months.find((m) => m.month === '2026-09')!.amount).toBe(500);
  });

  it("counts a split once and uses the budget currency's value", () => {
    const months = spendByMonth(
      [
        tx('2026-11-01', -1_000, { mainAmount: -650, mainAmountSource: 'rate' }),
        tx('2026-11-01', -400, { parentTransactionId: 'p' }),
        tx('2026-11-02', -800, { mainAmountSource: 'missing' }),
      ] as never,
      '2026-11-13',
    );
    expect(months.at(-1)!.amount).toBe(650);
  });
});

describe('spending the chart leaves out for a missing rate (#235)', () => {
  it('counts exactly the rows the chart would sum: top-level money out in the window', () => {
    const missing = { mainAmount: null, mainAmountSource: 'missing' };
    expect(
      spendWithoutRate(
        [
          tx('2026-11-01', -1_000, missing), // counted
          tx('2026-11-01', -400, { ...missing, parentTransactionId: 'p' }), // a split's part
          tx('2026-11-02', 2_000, missing), // money in
          tx('2025-09-01', -800, missing), // older than the window
          tx('2026-10-01', -500), // has a value
        ] as never,
        '2026-11-13',
      ),
    ).toBe(1);
  });
});
