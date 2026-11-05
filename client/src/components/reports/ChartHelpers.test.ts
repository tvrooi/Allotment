import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CurrencyTooltip } from './ChartHelpers';

describe('CurrencyTooltip', () => {
  const payload = [{ name: 'Household', value: 12345, color: '#000' }];

  it("writes amounts the way the chart's own currency does, when given a format", () => {
    const html = renderToStaticMarkup(
      createElement(CurrencyTooltip, {
        active: true,
        payload,
        label: 'Oct',
        format: (n: number) => `AUD ${n / 100}`,
      }),
    );
    expect(html).toContain('Household: AUD 123.45');
  });

  it('keeps the budget currency without one', () => {
    const html = renderToStaticMarkup(
      createElement(CurrencyTooltip, { active: true, payload, label: 'Oct' }),
    );
    expect(html).toContain('Household: ');
    expect(html).not.toContain('AUD');
  });
});
