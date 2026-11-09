import { describe, it, expect } from 'vitest';
import { billFromPayments, frequencyOf, ruleFor } from './householdBillSuggestions.js';

const pay = (date: string, dollars: number, i = 0) => ({
  id: `t${date}${i}`,
  date,
  amount: Math.round(-dollars * 100),
  payeeId: 'p',
  payeeName: 'CovaU Energy',
  categoryId: 'power',
});

describe('household bill suggestions', () => {
  it('reads a power bill about every two months, like the live CovaU payments', () => {
    const bill = billFromPayments(
      [
        pay('2026-05-04', 265.53),
        pay('2026-06-25', 288.89),
        pay('2026-08-28', 536.92),
        pay('2026-10-27', 292.48),
      ],
      '2026-11-08',
    );
    expect(bill).toMatchObject({
      frequency: 'every 2 months',
      count: 4,
      lastDate: '2026-10-27',
      // Median of the last three: 288.89, 536.92, 292.48
      amount: 29248,
      minAmount: 26553,
      maxAmount: 53692,
      categoryId: 'power',
    });
    expect(bill!.nextDate > '2026-12-15').toBe(true);
  });

  it('reads quarterly water from two payments', () => {
    expect(
      billFromPayments([pay('2026-07-16', 183.53), pay('2026-10-09', 167.98)], '2026-11-08'),
    ).toMatchObject({ frequency: 'quarterly', count: 2, amount: 17576 });
  });

  it('ignores one payment, irregular payments and a bill that stopped', () => {
    expect(billFromPayments([pay('2026-10-09', 100)], '2026-11-08')).toBeNull();
    expect(
      billFromPayments(
        [pay('2026-01-02', 50), pay('2026-01-05', 50), pay('2026-06-30', 50)],
        '2026-07-01',
      ),
    ).toBeNull();
    // Monthly until April, nothing since
    expect(
      billFromPayments(
        [pay('2026-02-01', 80), pay('2026-03-01', 80), pay('2026-04-01', 80)],
        '2026-11-08',
      ),
    ).toBeNull();
  });

  it('turns each frequency into a recurrence anchored on the last payment', () => {
    expect(frequencyOf(30)?.label).toBe('monthly');
    expect(frequencyOf(61)?.label).toBe('every 2 months');
    expect(frequencyOf(91)?.label).toBe('quarterly');
    expect(frequencyOf(182)?.label).toBe('every 6 months');
    expect(frequencyOf(365)?.label).toBe('yearly');
    expect(frequencyOf(14)).toBeNull();
    expect(ruleFor('every 2 months', '2026-10-27')).toEqual({
      recurrenceType: 'monthly',
      recurrenceRule: { type: 'monthly', interval: 2, anchorDay: 27 },
    });
    expect(ruleFor('quarterly', '2026-10-09').recurrenceType).toBe('quarterly');
  });
});
