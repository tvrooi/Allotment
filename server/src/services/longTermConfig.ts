// Saved long-term forecast plans (docs/LONG-TERM-FORECAST.md): what a plan stores and the
// defaults every assumption starts from. The engine (longTermForecast.ts) stays pure; this
// file only describes and validates the stored shape. Every rate and age here is an
// assumption the owner can change, and the UI shows the default beside it.
import { z } from 'zod';
import {
  EXTRA_SAVINGS_ID,
  SALARY_SOURCE_ID,
  SUPER_NEW_ID,
  type AccountClass,
} from './longTermForecast.js';

const RESERVED_IDS = [EXTRA_SAVINGS_ID, SALARY_SOURCE_ID, SUPER_NEW_ID];

const MONEY_MAX = 10_000_000_000_000;
const money = z.number().int().min(0).max(MONEY_MAX);
const signedMoney = z.number().int().min(-MONEY_MAX).max(MONEY_MAX);
const bps = (min = 0, max = 10_000) => z.number().int().min(min).max(max);
const name = z.string().trim().min(1).max(100);
/** Event ids are chosen by the client so events can refer to each other; ':' is reserved */
export const eventId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,40}$/, 'Use letters, digits, - and _')
  .refine((id) => !RESERVED_IDS.includes(id), 'That id is reserved');

export const MAX_PLANS = 20;
export const MAX_EVENTS = 50;
export const MAX_SPLITS = 50;
export const MAX_ACCOUNTS = 200;

export const ACCOUNT_CLASSES = [
  'cash',
  'investments',
  'super',
  'property',
  'vehicles',
  'other',
] as const satisfies readonly AccountClass[];

/** Default yearly growth by class, in basis points (assumptions, shown beside each input) */
export const DEFAULT_CLASS_GROWTH_BPS: Record<(typeof ACCOUNT_CLASSES)[number], number> = {
  cash: 200,
  investments: 700,
  super: 650,
  property: 300,
  vehicles: -1500,
  other: 0,
};

/** How much each kind of account's yearly return swings (a standard deviation), in basis points:
 * assumptions for the simulation only. Shared by investments and super (one market), then property. */
export const DEFAULT_CLASS_VOLATILITY_BPS: Record<(typeof ACCOUNT_CLASSES)[number], number> = {
  cash: 0,
  investments: 1600,
  super: 1600,
  property: 1000,
  vehicles: 0,
  other: 0,
};

/**
 * Super beyond the guarantee, with Australian defaults for 2026–27: caps are in today's
 * dollars and only warned about. Earnings tax defaults to 0 because fund returns are usually
 * quoted after tax; enter a rate when the growth assumption is before tax.
 */
export const DEFAULT_SUPER = {
  salarySacrifice: 0,
  personalContribution: 0,
  feesAnnual: 0,
  earningsTaxBps: 0,
  minimumDrawdown: true,
  concessionalCap: 3_250_000,
  nonConcessionalCap: 13_000_000,
  transferBalanceCap: 210_000_000,
};

const escalation = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }).strict(),
  z.object({ mode: z.literal('inflation') }).strict(),
  z.object({ mode: z.literal('rate'), rateBps: bps(-5000, 1500) }).strict(),
]);

export const whenSchema = z.union([
  z.object({ year: z.number().int().min(1900).max(2300) }).strict(),
  z.object({ age: z.number().int().min(0).max(130) }).strict(),
]);

const reductions = z
  .record(z.string().regex(/^[A-Za-z0-9_-]{1,40}$/), bps())
  .refine((r) => Object.keys(r).length <= 20, 'At most 20 income sources');

const common = { id: eventId, name, enabled: z.boolean().default(true), start: whenSchema };

export const eventSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...common,
      kind: z.literal('home'),
      price: money,
      deposit: z.union([
        z.object({ kind: z.literal('amount'), cents: money }).strict(),
        z.object({ kind: z.literal('percent'), bps: bps() }).strict(),
      ]),
      loanRateBps: bps(),
      termYears: z.number().int().min(1).max(50),
      purchaseCosts: money,
      annualRates: money,
      annualInsurance: money,
      rentMonthly: money,
      replaceRent: z.boolean(),
      repaymentOverride: money.optional(),
      propertyGrowthBps: bps(-5000, 1500),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('newJob'),
      takeHome: money,
      escalation,
      signingBonus: money,
      grossSalary: money,
      reductions,
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('careerBreak'),
      durationYears: z.number().int().min(1).max(100),
      spendingMultiplierBps: bps(0, 50_000),
      reductions,
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('child'),
      years: z.number().int().min(1).max(100),
      annualCost: money,
      upfrontCost: money,
      escalation,
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('oneOff'),
      amount: signedMoney,
      todaysDollars: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('recurring'),
      amount: signedMoney,
      endYear: z.number().int().min(1900).max(2300).nullable(),
      everyYears: z.number().int().min(1).max(100),
      escalation,
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('retirement'),
      spendingMultiplierBps: bps(0, 50_000),
      reductions,
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('payOff'),
      loanId: z.string().min(1).max(64),
      amount: money.nullable(),
    })
    .strict(),
]);
export type PlanEvent = z.infer<typeof eventSchema>;

export const settingsSchema = z
  .object({
    /** Age is this year minus the birth year: the plan starts today */
    birthYear: z.number().int().min(1900).max(2100),
    endAge: z.number().int().min(30).max(110).default(95),
    inflationBps: bps(-2000, 1500).default(250),
    superGuaranteeBps: bps().default(1200),
    contributionsTaxBps: bps().default(1500),
    preservationAge: z.number().int().min(40).max(75).default(60),
    super: z
      .object({
        salarySacrifice: money.default(0),
        personalContribution: money.default(0),
        feesAnnual: money.default(0),
        earningsTaxBps: bps(0, 4500).default(0),
        minimumDrawdown: z.boolean().default(true),
        concessionalCap: money.default(DEFAULT_SUPER.concessionalCap),
        nonConcessionalCap: money.default(DEFAULT_SUPER.nonConcessionalCap),
        transferBalanceCap: money.default(DEFAULT_SUPER.transferBalanceCap),
      })
      .strict()
      .default(DEFAULT_SUPER),
    agePension: z
      .object({
        enabled: z.boolean().default(false),
        annual: money.default(0),
        startAge: z.number().int().min(50).max(100).default(67),
      })
      .strict()
      .default({ enabled: false, annual: 0, startAge: 67 }),
    /** null = start from the budget's own figure */
    income: z
      .object({
        takeHome: money.nullable().default(null),
        grossForSuper: money.default(0),
        escalation: escalation.default({ mode: 'inflation' }),
      })
      .strict()
      .default({ takeHome: null, grossForSuper: 0, escalation: { mode: 'inflation' } }),
    spending: z
      .object({
        annual: money.nullable().default(null),
        escalation: escalation.default({ mode: 'inflation' }),
      })
      .strict()
      .default({ annual: null, escalation: { mode: 'inflation' } }),
    classGrowthBps: z
      .object({
        cash: bps(-5000, 1500),
        investments: bps(-5000, 1500),
        super: bps(-5000, 1500),
        property: bps(-5000, 1500),
        vehicles: bps(-5000, 1500),
        other: bps(-5000, 1500),
      })
      .strict()
      .default(DEFAULT_CLASS_GROWTH_BPS),
    volatilityBps: z
      .object({
        cash: bps(0, 5000),
        investments: bps(0, 5000),
        super: bps(0, 5000),
        property: bps(0, 5000),
        vehicles: bps(0, 5000),
        other: bps(0, 5000),
      })
      .strict()
      .default(DEFAULT_CLASS_VOLATILITY_BPS),
    extraSavingsGrowthBps: bps(-5000, 1500).default(200),
    /** Account ids drawn first when money runs short; the rest follow in the default order */
    withdrawalOrder: z
      .array(z.string().min(1).max(64))
      .max(MAX_ACCOUNTS)
      .default([])
      .refine((ids) => new Set(ids).size === ids.length, 'List each account once'),
  })
  .strict();
export type PlanSettings = z.infer<typeof settingsSchema>;

export const accountAssumptionSchema = z
  .object({
    accountId: z.string().min(1).max(64),
    included: z.boolean().default(true),
    cls: z.enum(ACCOUNT_CLASSES).nullable().default(null),
    growthBps: bps(-5000, 1500).nullable().default(null),
  })
  .strict();

export const splitSchema = z
  .object({
    accountId: z.string().min(1).max(64),
    mode: z.enum(['percent', 'fixed']),
    bps: bps().optional(),
    amount: money.optional(),
  })
  .strict();

export const planSchema = z
  .object({
    name,
    settings: settingsSchema,
    accounts: z.array(accountAssumptionSchema).max(MAX_ACCOUNTS).default([]),
    splits: z.array(splitSchema).max(MAX_SPLITS).default([]),
    events: z.array(eventSchema).max(MAX_EVENTS).default([]),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path });
    const ids = new Set<string>();
    plan.events.forEach((e, i) => {
      if (ids.has(e.id)) issue('Each event needs its own id', ['events', i, 'id']);
      ids.add(e.id);
    });
    if (new Set(plan.accounts.map((a) => a.accountId)).size !== plan.accounts.length)
      issue('List each account once', ['accounts']);
    if (plan.events.filter((e) => e.kind === 'retirement' && e.enabled).length > 1)
      issue('A plan has at most one retirement', ['events']);
    const sources = new Set(['salary']);
    for (const e of plan.events) {
      if (e.kind === 'newJob' || (e.kind === 'recurring' && e.amount > 0)) sources.add(e.id);
    }
    plan.events.forEach((e, i) => {
      if (!('reductions' in e)) return;
      for (const key of Object.keys(e.reductions)) {
        if (!sources.has(key))
          issue('Reduces an unknown income source', ['events', i, 'reductions']);
        if (key === e.id)
          issue('An event cannot reduce its own income', ['events', i, 'reductions']);
      }
    });
    plan.splits.forEach((s, i) => {
      if (s.accountId === EXTRA_SAVINGS_ID)
        issue('Extra savings always comes last', ['splits', i, 'accountId']);
    });
  });
export type PlanInput = z.infer<typeof planSchema>;

/** A fresh plan's settings: every assumption at its default */
export function defaultSettings(birthYear: number): PlanSettings {
  return settingsSchema.parse({ birthYear });
}
