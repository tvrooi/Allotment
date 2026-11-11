import { describe, expect, it } from 'vitest';
import { currencyTooltip } from './kit';

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
