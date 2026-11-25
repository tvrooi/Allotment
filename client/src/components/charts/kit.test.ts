import { describe, expect, it } from 'vitest';
import { chartColors } from '../../utils/chartColors';
import { currencyTooltip, INCOME_EXPENSE_COLORS, incomeExpenseRows } from './kit';

describe('currencyTooltip', () => {
  const points = [
    { groupLabel: 'Household', yValue: 12345, xValue: 'Oct', color: '#000' },
    { groupLabel: 'Other', yValue: 0, xValue: 'Oct', color: '#111' },
  ];
  const ctx = { xLabel: '', formatX: (v: unknown) => String(v) };

  it("writes amounts the way the chart's own currency does, when given a format", () => {
    const { content } = currencyTooltip({ format: (n) => `AUD ${n / 100}` });
    expect(content(points, ctx).rows[0]).toMatchObject({
      label: 'Household',
      value: 'AUD 123.45',
    });
  });

  it('keeps the budget currency without one', () => {
    const { content } = currencyTooltip({});
    expect(content(points, ctx).rows[0].value).not.toContain('AUD');
  });

  it('drops zero rows when asked and adds the summary line last', () => {
    const { content } = currencyTooltip({
      hideZero: true,
      summary: () => ({ label: 'Total', value: 12345 }),
    });
    const rows = content(points, ctx).rows;
    expect(rows.map((r) => r.label)).toEqual(['Household', 'Total']);
  });

  it('uses a series colour override over the palette colour', () => {
    const { content } = currencyTooltip({ colors: { Household: '#abc' } });
    expect(content(points, ctx).rows[0].color).toBe('#abc');
  });
});

describe('income and expenses', () => {
  it('draws expenses in the muted colour everywhere: red is kept for overspending', () => {
    expect(INCOME_EXPENSE_COLORS.Expenses).toBe(chartColors.negativeLight);
    expect(INCOME_EXPENSE_COLORS.Expenses).not.toBe(chartColors.negative);
    expect(INCOME_EXPENSE_COLORS.Income).toBe(chartColors.positive);
  });

  it('turns months into one Income and one Expenses bar each, keeping the net', () => {
    expect(
      incomeExpenseRows([
        { month: 'Oct', income: 500, expenses: 200, net: 300 },
        { month: 'Nov', income: 0, expenses: 50, net: -50 },
      ]),
    ).toEqual([
      { month: 'Oct', series: 'Income', value: 500, net: 300 },
      { month: 'Oct', series: 'Expenses', value: 200, net: 300 },
      { month: 'Nov', series: 'Income', value: 0, net: -50 },
      { month: 'Nov', series: 'Expenses', value: 50, net: -50 },
    ]);
  });
});
