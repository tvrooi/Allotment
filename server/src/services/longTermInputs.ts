/**
 * Today's figures for the long-term forecast (docs/LONG-TERM-FORECAST.md §4): real balances,
 * the budget's own income and spending as a starting point, and loan details. Read-only: it
 * only selects, and never writes to the ledger. buildEnginePlan then turns a saved plan plus
 * these figures into the pure engine's input.
 */
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accountLoanDetails,
  accounts,
  categories,
  categoryGroups,
  paydayPlans,
  transactions,
} from '../db/schema.js';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { budgetActivity, inAccountBalance, mainAmount } from './balances.js';
import { currencyContext, todayIso, valueToday } from './mainAmountService.js';
import { paydayConfigSchema } from './paydayConfig.js';
import { paydays } from './paydayService.js';
import { isLiabilityType } from '../utils/accountTypes.js';
import type { PlanEvent, PlanInput } from './longTermConfig.js';
import {
  forecastLongTerm,
  LongTermForecastError,
  mulDiv,
  type AccountClass,
  type ForecastPlan,
  type ForecastResult,
  type LifeEvent,
} from './longTermForecast.js';
import { simulate } from './longTermSimulation.js';

const day = (date: string, count: number) => format(addDays(parseISO(date), count), 'yyyy-MM-dd');

export interface StartingAccount {
  id: string;
  name: string;
  type: string;
  cls: AccountClass;
  /** Balance in the budget's currency, in cents */
  balance: number;
}

export interface StartingLoan {
  id: string;
  name: string;
  type: string;
  /** Negative, as in the ledger */
  balance: number;
  details: { rateBps: number; monthlyRepayment: number; termMonths: number | null } | null;
}

export interface StartingPoint {
  today: string;
  startYear: number;
  accounts: StartingAccount[];
  loans: StartingLoan[];
  /** Annual take-home from active payday plans (0 when there are none) */
  income: { annualTakeHome: number; source: 'payday' | 'none'; paydayPlans: number };
  /** Annual spending: the trailing year's net expense-category activity, annualised */
  spending: { annual: number; from: string; days: number };
  warnings: string[];
}

/** The class an account type starts in. Liabilities are handled separately. */
export function classOfType(type: string): AccountClass {
  switch (type) {
    case 'investment':
    case 'crypto':
      return 'investments';
    case 'retirement':
      return 'super';
    case 'real_estate':
      return 'property';
    case 'vehicle':
      return 'vehicles';
    case 'valuables':
    case 'other_asset':
      return 'other';
    default:
      return 'cash';
  }
}

/**
 * Net spending over the trailing year: expense-category activity and uncategorised debits on
 * the budget side, refunds netted. Unlike the cash runway it keeps payments matched to
 * schedules (bills are spending). Transfers are left out, including those to off-budget
 * accounts: loan repayments are modelled as loans, and savings go through the splits.
 */
function trailingSpending(today: string) {
  const from = day(today, -364);
  const expense = db
    .select({ id: categories.id })
    .from(categories)
    .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(eq(categoryGroups.isIncome, 0));
  const rows = db
    .select({ amount: mainAmount })
    .from(transactions)
    .where(
      and(
        budgetActivity,
        isNull(transactions.transferTransactionId),
        gt(transactions.date, day(from, -1)),
        lte(transactions.date, today),
        or(
          sql`${transactions.categoryId} in ${expense}`,
          and(isNull(transactions.categoryId), sql`${transactions.amount} < 0`),
        ),
      ),
    )
    .all();
  const first = db
    .select({ date: sql<string | null>`min(${transactions.date})` })
    .from(transactions)
    .where(budgetActivity)
    .get()?.date;
  const coveredFrom = first && first > from ? first : from;
  const days = Math.max(1, differenceInCalendarDays(parseISO(today), parseISO(coveredFrom)) + 1);
  const net = rows.reduce((sum, r) => sum + r.amount, 0);
  return { from: coveredFrom, days, total: Math.max(0, -net) };
}

/** Today's figures: balances count rows dated today or earlier. Read-only. */
export function startingPoint(today = todayIso()): StartingPoint {
  const warnings: string[] = [];
  const ctx = currencyContext();
  const open = db.select().from(accounts).where(isNull(accounts.closedAt)).all();
  const totals = new Map(
    db
      .select({
        accountId: transactions.accountId,
        total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(and(inAccountBalance, lte(transactions.date, today)))
      .groupBy(transactions.accountId)
      .all()
      .map((r) => [r.accountId, r.total]),
  );
  const details = new Map(
    db
      .select()
      .from(accountLoanDetails)
      .all()
      .map((d) => [d.accountId, d]),
  );

  const startAccounts: StartingAccount[] = [];
  const startLoans: StartingLoan[] = [];
  for (const account of open) {
    const own = account.startingBalance + (totals.get(account.id) ?? 0);
    const value = valueToday(own, account.currency ?? ctx.budget, ctx, today);
    if (value.mainBalance === null) {
      if (own !== 0)
        warnings.push(`${account.name} was left out: no exchange rate to the budget currency`);
      continue;
    }
    const balance = value.mainBalance;
    if (isLiabilityType(account.type) && balance <= 0) {
      const d = details.get(account.id);
      startLoans.push({
        id: account.id,
        name: account.name,
        type: account.type,
        balance,
        details: d
          ? { rateBps: d.rateBps, monthlyRepayment: d.monthlyRepayment, termMonths: d.termMonths }
          : null,
      });
    } else {
      // An overpaid card or loan is treated as cash; a balance of zero changes nothing
      startAccounts.push({
        id: account.id,
        name: account.name,
        type: account.type,
        cls: isLiabilityType(account.type) ? 'cash' : classOfType(account.type),
        balance,
      });
    }
  }

  // Income: expected take-home on each payday in the next 12 months, over active plans
  // 364 days hold exactly 26 fortnights, whatever today's date; 365 would give 27 on a payday
  const to = day(today, 363);
  let annualTakeHome = 0;
  let planCount = 0;
  for (const row of db.select().from(paydayPlans).where(eq(paydayPlans.archived, 0)).all()) {
    const parsed = paydayConfigSchema.safeParse(JSON.parse(row.configJson));
    if (!parsed.success) {
      warnings.push('A payday plan could not be read, so its income was left out');
      continue;
    }
    annualTakeHome += parsed.data.expectedIncome * paydays(parsed.data, today, to).length;
    planCount += 1;
  }
  if (planCount === 0)
    warnings.push('There is no payday plan, so income starts at 0. Enter your take-home pay.');

  // Spending: the trailing year, annualised
  const spend = trailingSpending(today);
  const annualSpending = mulDiv(spend.total, 365, spend.days);
  if (spend.days < 90)
    warnings.push('There are fewer than 90 days of spending history, so the average is rough.');

  return {
    today,
    startYear: Number(today.slice(0, 4)),
    accounts: startAccounts,
    loans: startLoans,
    income: {
      annualTakeHome,
      source: planCount ? 'payday' : 'none',
      paydayPlans: planCount,
    },
    spending: { annual: annualSpending, from: spend.from, days: spend.days },
    warnings,
  };
}

/** A saved plan and today's figures, as the engine's input */
export function buildEnginePlan(plan: PlanInput, point: StartingPoint) {
  const warnings = [...point.warnings];
  const s = plan.settings;
  const startAge = point.startYear - s.birthYear;
  if (s.endAge <= startAge)
    throw new LongTermForecastError('The end age must be after your age today');
  const choice = new Map(plan.accounts.map((a) => [a.accountId, a]));
  const included = (id: string) => choice.get(id)?.included !== false;

  const planAccounts = point.accounts
    .filter((a) => included(a.id))
    .map((a) => {
      const c = choice.get(a.id);
      const cls = c?.cls ?? a.cls;
      return {
        id: a.id,
        name: a.name,
        cls,
        balance: a.balance,
        growthBps: c?.growthBps ?? s.classGrowthBps[cls],
      };
    });
  const planLoans = point.loans
    .filter((l) => included(l.id))
    .map((l) => ({
      id: l.id,
      name: l.name,
      balance: l.balance,
      rateBps: l.details?.rateBps ?? 0,
      monthlyRepayment: l.details?.monthlyRepayment ?? 0,
      termMonths: l.details?.termMonths ?? null,
    }));

  const eligible = new Set(
    planAccounts.filter((a) => a.cls === 'cash' || a.cls === 'investments').map((a) => a.id),
  );
  const splits = plan.splits.filter((sp) => {
    if (eligible.has(sp.accountId)) return true;
    warnings.push(
      'A savings split names an account that is closed, left out or not cash or investments, and was skipped',
    );
    return false;
  });
  const loanIds = new Set(planLoans.map((l) => l.id));
  const events: LifeEvent[] = [];
  plan.events.forEach((event: PlanEvent, position) => {
    if (event.kind === 'payOff' && !loanIds.has(event.loanId)) {
      if (event.enabled)
        warnings.push(
          `${event.name} names a debt that is closed, left out or paid off, and was skipped`,
        );
      return;
    }
    events.push({ ...event, position } as unknown as LifeEvent);
  });
  const known = new Set([...planAccounts.map((a) => a.id)]);

  const enginePlan: ForecastPlan = {
    startYear: point.startYear,
    startAge,
    endAge: s.endAge,
    inflationBps: s.inflationBps,
    accounts: planAccounts,
    loans: planLoans,
    salary: {
      takeHome: s.income.takeHome ?? point.income.annualTakeHome,
      grossForSuper: s.income.grossForSuper,
      escalation: s.income.escalation,
    },
    spending: {
      annual: s.spending.annual ?? point.spending.annual,
      escalation: s.spending.escalation,
    },
    super: {
      guaranteeBps: s.superGuaranteeBps,
      contributionsTaxBps: s.contributionsTaxBps,
      preservationAge: s.preservationAge,
      ...s.super,
    },
    agePension: s.agePension,
    extraSavingsGrowthBps: s.extraSavingsGrowthBps,
    splits,
    withdrawalOrder: s.withdrawalOrder.filter((id) => known.has(id)),
    events,
  };
  return { plan: enginePlan, warnings };
}

export interface PlanResult extends ForecastResult {
  startYear: number;
  startAge: number;
  /** The figures the plan started from, so a reader can see what the result rests on */
  inputs: {
    income: number;
    incomeSource: 'payday' | 'override';
    spending: number;
    spendingSource: 'history' | 'override';
  };
  superAccountIds: string[];
  endAge: number;
  preservationAge: number;
  /** Age the enabled retirement event takes effect, or null without one */
  retirementAge: number | null;
}

/** Run a saved plan against today's figures */
export function runPlan(plan: PlanInput, point: StartingPoint = startingPoint()): PlanResult {
  const { plan: enginePlan, warnings } = buildEnginePlan(plan, point);
  const result = forecastLongTerm(enginePlan);
  return {
    ...result,
    warnings: [...warnings, ...result.warnings],
    startYear: enginePlan.startYear,
    startAge: enginePlan.startAge,
    inputs: {
      income: enginePlan.salary.takeHome,
      incomeSource: plan.settings.income.takeHome === null ? 'payday' : 'override',
      spending: enginePlan.spending.annual,
      spendingSource: plan.settings.spending.annual === null ? 'history' : 'override',
    },
    superAccountIds: enginePlan.accounts.filter((a) => a.cls === 'super').map((a) => a.id),
    endAge: enginePlan.endAge,
    preservationAge: enginePlan.super.preservationAge,
    retirementAge: retirementAgeOf(plan),
  };
}

/** Recent runs, so asking again for the same plan, figures and seed costs nothing */
const RECENT = new Map<string, ReturnType<typeof runSimulation>>();
const RECENT_MAX = 16;

/** Run a saved plan many times with random yearly returns (read-only; same seed, same answer) */
export function simulatePlan(
  plan: PlanInput,
  options: { seed: number; paths: number },
  point: StartingPoint = startingPoint(),
) {
  // Everything the answer depends on, so a changed balance or plan never returns an old run
  const key = JSON.stringify([plan, point, options.seed, options.paths]);
  const hit = RECENT.get(key);
  if (hit) {
    RECENT.delete(key);
    RECENT.set(key, hit);
    return hit;
  }
  const fresh = runSimulation(plan, options, point);
  RECENT.set(key, fresh);
  if (RECENT.size > RECENT_MAX) RECENT.delete(RECENT.keys().next().value as string);
  return fresh;
}

function runSimulation(
  plan: PlanInput,
  options: { seed: number; paths: number },
  point: StartingPoint,
) {
  const { plan: enginePlan, warnings } = buildEnginePlan(plan, point);
  const result = simulate(enginePlan, { ...options, volatilityBps: plan.settings.volatilityBps });
  return {
    ...result,
    warnings,
    startYear: enginePlan.startYear,
    startAge: enginePlan.startAge,
    endAge: enginePlan.endAge,
  };
}

/** The age an enabled retirement event takes effect, or null */
export function retirementAgeOf(plan: PlanInput): number | null {
  const event = plan.events.find((e) => e.kind === 'retirement' && e.enabled);
  if (!event) return null;
  return 'age' in event.start ? event.start.age : event.start.year - plan.settings.birthYear;
}
