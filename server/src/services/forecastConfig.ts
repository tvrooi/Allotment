import { z } from 'zod';
import { isoDate } from '../utils/validation.js';

const money = z.number().int().min(0).max(1e13);

/** One labelled set of assumptions. Scenarios are never stored and never allocate money. */
export const scenarioSchema = z.object({
  name: z.string().trim().min(1).max(40),
  /** Scales the historical variable-spending average (100 = unchanged). */
  spendingPercent: z.number().int().min(0).max(500).default(100),
  /** Scales expected pay or scheduled income (100 = as planned). */
  incomePercent: z.number().int().min(0).max(200).default(100),
  /** Replaces the historical average with an explicit amount per day. */
  dailySpending: money.nullable().default(null),
  /** Nominal annual return on goal balances in basis points, credited monthly. */
  annualReturnBasisPoints: z.number().int().min(-10000).max(5000).default(0),
  /** Replaces the planned per-pay contribution for a goal. */
  goalContributions: z
    .array(z.object({ goalId: z.string().min(1).max(64), amountPerPay: money }))
    .max(100)
    .default([]),
  /** Signed one-off cash movements, e.g. −$800 car service or +$500 tax refund. */
  oneOffs: z
    .array(
      z.object({
        date: isoDate,
        amount: z.number().int().min(-1e13).max(1e13),
        description: z.string().trim().min(1).max(100),
      }),
    )
    .max(50)
    .default([]),
  /** Date ranges in which no income arrives: a lost job or career break (phase 7C). */
  incomePauses: z
    .array(z.object({ from: isoDate, to: isoDate }))
    .max(10)
    .default([]),
  /** A signed monthly cost from a date, on that day each month: a rent rise (phase 7C). */
  costChanges: z
    .array(
      z.object({
        from: isoDate,
        monthlyAmount: z.number().int().min(-1e13).max(1e13),
        description: z.string().trim().min(1).max(100),
      }),
    )
    .max(20)
    .default([]),
});
export type ForecastScenario = z.infer<typeof scenarioSchema>;

export const DEFAULT_SCENARIOS: ForecastScenario[] = [
  { ...scenarioSchema.parse({ name: 'Base' }) },
  { ...scenarioSchema.parse({ name: 'Conservative', spendingPercent: 120, incomePercent: 95 }) },
  { ...scenarioSchema.parse({ name: 'Stretch', spendingPercent: 85 }) },
];

export const forecastRequestSchema = z
  .object({
    horizonDays: z.number().int().min(7).max(730).default(90),
    lookbackDays: z.number().int().min(14).max(365).default(90),
    /** Default: payday plans when an active plan exists, otherwise scheduled income. */
    incomeSource: z.enum(['payday', 'schedules']).nullable().default(null),
    /** Default: on, unless contributions into a household pool are already scheduled. */
    includeHousehold: z.boolean().nullable().default(null),
    scenarios: z.array(scenarioSchema).min(1).max(3).default(DEFAULT_SCENARIOS),
  })
  .superRefine((request, ctx) => {
    if (
      new Set(request.scenarios.map((s) => s.name.toLowerCase())).size !== request.scenarios.length
    )
      ctx.addIssue({ code: 'custom', message: 'Use distinct scenario names', path: ['scenarios'] });
    for (const scenario of request.scenarios)
      if (
        new Set(scenario.goalContributions.map((g) => g.goalId)).size !==
        scenario.goalContributions.length
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Use one contribution per goal',
          path: ['scenarios'],
        });
  });
export type ForecastRequest = z.infer<typeof forecastRequestSchema>;
