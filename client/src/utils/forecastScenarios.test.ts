import { describe, expect, it } from 'vitest';
import { copyName, initialScenarios, sameScenario } from './forecastScenarios';
import type { ForecastScenarioInput } from '../api/forecast';

const base: ForecastScenarioInput = {
  name: 'Base',
  spendingPercent: 100,
  incomePercent: 100,
  dailySpending: null,
  annualReturnBasisPoints: 0,
  goalContributions: [],
  oneOffs: [{ date: '2026-11-01', amount: -5000, description: 'Car' }],
  incomePauses: [],
  costChanges: [],
};

describe('sameScenario', () => {
  it('ignores key order and trimmed whitespace, not values', () => {
    const reordered = Object.fromEntries(Object.entries(base).reverse()) as ForecastScenarioInput;
    expect(sameScenario(base, reordered)).toBe(true);
    expect(
      sameScenario(base, { ...base, oneOffs: [{ ...base.oneOffs[0], description: 'Car ' }] }),
    ).toBe(true);
    expect(sameScenario(base, { ...base, spendingPercent: 101 })).toBe(false);
  });
});

describe('copyName', () => {
  it('finds a free name within 40 characters', () => {
    expect(copyName('Base', ['Base'])).toBe('Base copy');
    expect(copyName('Base', ['Base', 'base COPY'])).toBe('Base copy 2');
    const long = 'x'.repeat(40);
    expect(copyName(long, [long])).toHaveLength(40);
  });
});

describe('initialScenarios', () => {
  const defaults = ['Base', 'Conservative', 'Stretch'].map((name) => ({ ...base, name }));
  const saved = (name: string, spendingPercent = 50) => ({
    scenario: { ...base, name, spendingPercent },
  });

  it('keeps the defaults, swapping in saved copies and filling from the end', () => {
    const names = (s: { scenario: ForecastScenarioInput }[]) => s.map((x) => x.scenario.name);
    expect(names(initialScenarios(defaults, [], 3))).toEqual(['Base', 'Conservative', 'Stretch']);
    const one = initialScenarios(defaults, [saved('conservative', 130)], 3);
    expect(one[1]).toMatchObject({ scenario: { spendingPercent: 130 }, saved: expect.anything() });
    expect(one[0].saved).toBeNull();
    expect(names(initialScenarios(defaults, [saved('Lean'), saved('Base')], 3))).toEqual([
      'Base',
      'Conservative',
      'Lean',
    ]);
    expect(
      names(
        initialScenarios(
          defaults,
          ['A', 'B', 'C', 'D'].map((n) => saved(n)),
          3,
        ),
      ),
    ).toEqual(['A', 'B', 'C']);
  });
});
