import { z } from 'zod';
import { isoDate } from '../utils/validation.js';

// Phase 7 inputs. Every field is optional: an empty profile keeps the budget as it was.

const positive = z.number().int().min(1).max(1e13);

export const PURPOSES = ['essential', 'enjoyment', 'flexibility'] as const;
export const CADENCES = ['payday', 'monthly', 'quarterly', 'off'] as const;

export const prioritiesSchema = z
  .object({
    /** The revision the user loaded; a save from an older one is refused. */
    revision: z.number().int().min(0),
    purpose: z.string().trim().max(500).nullable().default(null),
    essentialMonthlyAmount: positive.nullable().default(null),
    reserveTarget: z
      .discriminatedUnion('type', [
        z.object({ type: z.literal('amount'), amount: positive }),
        z.object({ type: z.literal('months'), months: z.number().int().min(1).max(60) }),
      ])
      .nullable()
      .default(null),
    reserveMinimum: positive.nullable().default(null),
    reviewCadence: z.enum(CADENCES).default('off'),
    purposes: z
      .array(z.object({ categoryId: z.string().min(1).max(64), purpose: z.enum(PURPOSES) }))
      .max(10_000)
      .default([]),
  })
  .superRefine((p, ctx) => {
    if (new Set(p.purposes.map((x) => x.categoryId)).size !== p.purposes.length)
      ctx.addIssue({ code: 'custom', message: 'Give each category one purpose' });
  });
export type PrioritiesInput = z.infer<typeof prioritiesSchema>;

export const snoozeSchema = z.object({ until: isoDate.nullable() });

export const incomeReviewSchema = z.object({
  transactionId: z.string().min(1).max(64),
  /** Usual pay for a raise; 0 for a windfall. */
  baseline: z.number().int().min(0).max(1e13),
  reservePercent: z.number().int().min(0).max(100),
  categoryId: z.string().min(1).max(64),
});
export type IncomeReviewInput = z.infer<typeof incomeReviewSchema>;

/** What a completed review saw, compared at the next one (phase 7E/7F). */
export const reviewSnapshotSchema = z.object({
  complete: z.boolean(),
  resolved: z.boolean(),
  flexibilityIds: z.array(z.string()),
  flexibilityAvailable: z.number().int(),
  /** Everything ever assigned to the flexibility categories through the snapshot month. */
  flexibilityAssigned: z.number().int(),
  essentialsMonthly: z.number().int().nullable(),
  unfunded: z.number().int(),
});
export type ReviewSnapshot = z.infer<typeof reviewSnapshotSchema>;
