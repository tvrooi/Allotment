import { describe, it, expect } from 'vitest';
import { billFromPayments, frequencyOf, ruleFor } from './householdBillSuggestions.js';

const pay = (date: string, dollars: number, i = 0) => ({
  id: `t${date}${i}`,
  date,
  amount: Math.round(-dollars * 100),
  payeeId: 'p',
  payeeName: 'Northwind Power',
  categoryId: 'power',
});

describe('household bill suggestions', () => {
  it('reads a power bill about every two months', () => {
    const bill = billFromPayments(
      [
        pay('2026-05-04', 241.1),
        pay('2026-06-25', 263.4),
        pay('2026-08-28', 498.75),
        pay('2026-10-27', 270.2),
      ],
      '2026-11-08',
    );
    expect(bill).toMatchObject({
      frequency: 'every 2 months',
      count: 4,
      lastDate: '2026-10-27',
      // Median of the last three: 263.40, 498.75, 270.20
      amount: 27020,
      minAmount: 24110,
      maxAmount: 49875,
      categoryId: 'power',
    });
    expect(bill!.nextDate > '2026-12-15').toBe(true);
  });

  it('reads quarterly water from two payments', () => {
    expect(
      billFromPayments([pay('2026-07-16', 172.4), pay('2026-10-09', 158.9)], '2026-11-08'),
    ).toMatchObject({ frequency: 'quarterly', count: 2, amount: 16565 });
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
