import { z } from 'zod';
import { isoDate, isoMonth } from '../utils/validation.js';

const money = z.number().int().min(0).max(1e13);
export const fundingRuleSchema = z
  .object({
    categoryId: z.string().min(1).max(64),
    method: z.enum(['bills', 'fixed', 'due', 'monthly', 'percentage', 'remainder']),
    amount: money.default(0),
    dueDate: isoDate.nullable().default(null),
    percent: z.number().int().min(0).max(100).default(0),
  })
  .refine((r) => r.method !== 'due' || r.dueDate !== null, 'A target needs a due date');

export const paydayConfigSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    anchorDate: isoDate,
    expectedIncome: money,
    weekendAdjust: z.enum(['none', 'before', 'after', 'closest']).default('none'),
    timeZone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Choose a valid time zone'),
    rules: z.array(fundingRuleSchema).max(100),
  })
  .superRefine((config, ctx) => {
    if (new Set(config.rules.map((r) => r.categoryId)).size !== config.rules.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Use one funding rule per category',
        path: ['rules'],
      });
    if (config.rules.filter((r) => r.method === 'remainder').length > 1)
      ctx.addIssue({ code: 'custom', message: 'Choose one remainder category', path: ['rules'] });
    if (config.rules.reduce((sum, r) => sum + (r.method === 'percentage' ? r.percent : 0), 0) > 100)
      ctx.addIssue({
        code: 'custom',
        message: 'Percentages must total at most 100',
        path: ['rules'],
      });
  });
export type PaydayConfig = z.infer<typeof paydayConfigSchema>;

export const paydayRequestSchema = z.object({
  scheduledDate: isoDate,
  actualPayDate: isoDate,
  incomeIds: z
    .array(z.string().min(1).max(64))
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length),
});
export type PaydayRequest = z.infer<typeof paydayRequestSchema>;

/** Validate the persisted history before restoring it or rendering its amounts. */
const aggregate = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const fundingSnapshotSchema = z.object({
  planId: z.string(),
  scheduledDate: isoDate,
  actualPayDate: isoDate,
  nextPayday: isoDate,
  today: isoDate,
  month: isoMonth,
  totalAllocated: aggregate,
  received: aggregate,
  rows: z.array(
    z.object({
      categoryId: z.string(),
      name: z.string(),
      method: z.string(),
      allocated: aggregate,
      needed: aggregate,
      shortfall: aggregate,
      balance: z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
      billsDue: aggregate,
      uncoveredBills: aggregate,
    }),
  ),
});

export function dateInZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
