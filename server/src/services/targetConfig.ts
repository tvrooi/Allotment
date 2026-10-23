import { z } from 'zod';
import { isoDate } from '../utils/validation.js';

const amount = z.number().int().min(1).max(1e13);
/** One persistent target per expense category. Targets suggest funding; they never assign it. */
export const targetSchema = z.discriminatedUnion('type', [
  /** Assign the same amount every month. */
  z.object({ type: z.literal('monthly'), amount }),
  /** Have this balance by a date. */
  z.object({ type: z.literal('by-date'), amount, dueDate: isoDate }),
  /** A bill of this amount every N months, next due on a date. */
  z.object({
    type: z.literal('recurring'),
    amount,
    dueDate: isoDate,
    cycleMonths: z.number().int().min(1).max(60),
  }),
  /** Top the balance back up to this amount each month. */
  z.object({ type: z.literal('refill'), amount }),
]);
export type TargetInput = z.infer<typeof targetSchema>;
export const TARGET_TYPES = ['monthly', 'by-date', 'recurring', 'refill'] as const;
