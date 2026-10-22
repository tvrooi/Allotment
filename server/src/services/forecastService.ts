import { addMonthsTo, monthEnd, perPeriodNeed } from './fundingMath.js';
import { resilienceState } from './resilienceService.js';
import { and, eq, gt, inArray, isNotNull, lte, notInArray, sql } from 'drizzle-orm';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  goals,
  householdBills,
  householdEvents,
  householdGroups,
  paydayPlans,
  scheduleOccurrences,
  schedules,
  transactions,
  upConnections,
} from '../db/schema.js';
import { budgetActivity, inAccountBalance, mainAmount, personalBudgetAccount } from './balances.js';
import { fundingState, LIQUID_ACCOUNT_TYPES } from './budgetService.js';
import { convertAmount, currencyContext, todayIso } from './mainAmountService.js';
import { loadPlan, paydays, paydaysInYear } from './paydayService.js';
import type { PaydayConfig } from './paydayConfig.js';
import { computeOccurrenceDates, type RecurrenceDefinition } from '../utils/recurrence.js';
import type { ForecastRequest, ForecastScenario } from './forecastConfig.js';

// Read-only projection. Every input comes from the same definitions as the budget and
// payday planner: personal on-budget liquid accounts, pending schedule occurrences,
// active payday plans and the household bill ledger. Nothing here writes to the database.

export class ForecastError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const day = (date: string, count: number) => format(addDays(parseISO(date), count), 'yyyy-MM-dd');
const floorDiv = (a: bigint, b: bigint) => {
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
};

export type ForecastEvent = {
  id: string;
  date: string;
  kind: 'income' | 'bill' | 'scheduled' | 'household' | 'register' | 'one-off' | 'cost-change';
  description: string;
  amount: number;
  categoryId: string | null;
  estimated: boolean;
};

function personalAccountIds() {
  return new Set(
    db
      .select({ id: accounts.id })
      .from(accounts)
      .where(personalBudgetAccount)
      .all()
      .map((a) => a.id),
  );
}

function incomeCategoryIds() {
  return new Set(
    db
      .select({ id: categories.id })
      .from(categories)
      .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
      .where(eq(categoryGroups.isIncome, 1))
      .all()
      .map((c) => c.id),
  );
}

/** Spendable personal cash today, using the same liquid-account and received-income rules
 * as funding. Future-dated register rows are returned as events instead. */
function cashPosition(today: string, warnings: string[]) {
  const ctx = currencyContext();
  const rows: { id: string; name: string; balance: number }[] = [];
  const future: ForecastEvent[] = [];
  const history = new Map<string, number>();
  for (const account of db.select().from(accounts).where(personalBudgetAccount).all()) {
    if (account.closedAt || !LIQUID_ACCOUNT_TYPES.includes(account.type)) continue;
    const currency = account.currency ?? ctx.budget;
    const entries = db
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, account.id), inAccountBalance))
      .all()
      .filter((r) => !(r.amount > 0 && r.importedId?.startsWith('schedule:') && !r.reconciled));
    const native = entries
      .filter((r) => r.date <= today)
      .reduce((s, r) => s + r.amount, account.startingBalance);
    const balance = convertAmount(native, currency, ctx.budget, today, ctx);
    if (balance === null) {
      warnings.push(`${account.name} is excluded: add an exchange rate for ${currency}.`);
      continue;
    }
    rows.push({ id: account.id, name: account.name, balance });
    for (const r of entries) {
      const value = convertAmount(r.amount, currency, ctx.budget, today, ctx) ?? 0;
      if (r.date > today)
        future.push({
          id: `register:${r.id}`,
          date: r.date,
          kind: 'register',
          description: r.payeeName ?? 'Future-dated transaction',
          amount: value,
          categoryId: r.categoryId,
          estimated: false,
        });
      else history.set(r.date, (history.get(r.date) ?? 0) + value);
    }
  }
  return { rows, future, history };
}

/** Pending, unmatched schedule occurrences on the personal side of the budget boundary.
 * A matched or created transaction replaces its occurrence, so nothing is counted twice. */
function scheduledEvents(
  today: string,
  end: string,
  incomeSource: 'payday' | 'schedules',
  incomePercent: number,
  notes: Set<string>,
  warnings: string[],
) {
  const personal = personalAccountIds();
  const incomeIds = incomeCategoryIds();
  const ctx = currencyContext();
  const accountRows = db.select().from(accounts).all();
  const events: ForecastEvent[] = [];
  let overdue = 0;
  for (const schedule of db.select().from(schedules).where(eq(schedules.status, 'active')).all()) {
    // Same scope as bill coverage: a schedule without an account belongs to the budget.
    const fromPersonal = !schedule.accountId || personal.has(schedule.accountId);
    const toPersonal = !!schedule.transferAccountId && personal.has(schedule.transferAccountId);
    // Internal transfers net to zero; the far side of the budget boundary is not personal cash.
    if (fromPersonal === toPersonal) continue;
    const sign = fromPersonal ? 1 : -1;
    const isIncome =
      sign * schedule.amount > 0 && !!schedule.categoryId && incomeIds.has(schedule.categoryId);
    if (isIncome && incomeSource === 'payday') {
      notes.add(
        'Scheduled income is excluded because payday plans supply expected pay; switch the income source to use schedules.',
      );
      continue;
    }
    const account = accountRows.find((a) => a.id === schedule.accountId);
    const stored = db
      .select()
      .from(scheduleOccurrences)
      .where(eq(scheduleOccurrences.scheduleId, schedule.id))
      .all();
    const def = {
      ...schedule,
      recurrenceRule: JSON.parse(schedule.recurrenceRule),
    } as RecurrenceDefinition;
    const candidates = new Map(
      computeOccurrenceDates(def, day(today, -31), day(end, 3)).map((p) => [
        p.scheduledDate,
        {
          ...p,
          status: 'pending',
          expectedAmount: schedule.amount,
          matchedTransactionId: null as string | null,
        },
      ]),
    );
    for (const occurrence of stored) candidates.set(occurrence.scheduledDate, occurrence);
    for (const [scheduledDate, occurrence] of candidates) {
      if (occurrence.status !== 'pending' || occurrence.matchedTransactionId) continue;
      if (occurrence.expectedDate < today) {
        if (occurrence.expectedDate >= day(today, -31)) overdue++;
        continue;
      }
      if (occurrence.expectedDate > end) continue;
      const converted = convertAmount(
        sign * occurrence.expectedAmount,
        (fromPersonal
          ? account?.currency
          : accountRows.find((a) => a.id === schedule.transferAccountId)?.currency) ?? ctx.budget,
        ctx.budget,
        today,
        ctx,
      );
      if (converted === null) {
        warnings.push(`${schedule.name} is excluded: add an exchange rate.`);
        break;
      }
      const amount = isIncome
        ? Number(floorDiv(BigInt(converted) * BigInt(incomePercent), 100n))
        : converted;
      events.push({
        id: `schedule:${schedule.id}:${scheduledDate}`,
        date: occurrence.expectedDate,
        kind: isIncome ? 'income' : amount < 0 ? 'bill' : 'scheduled',
        description: schedule.name,
        amount,
        categoryId: schedule.categoryId,
        estimated: schedule.amountType !== 'exact',
      });
    }
  }
  if (overdue)
    warnings.push(
      `${overdue} scheduled occurrence${overdue === 1 ? ' is' : 's are'} overdue and unmatched. Match or skip ${overdue === 1 ? 'it' : 'them'} in Recurring; overdue items are not forecast.`,
    );
  return events;
}

function activePlans() {
  return db
    .select()
    .from(paydayPlans)
    .where(eq(paydayPlans.archived, 0))
    .all()
    .map((p) => loadPlan(p.id));
}

function paydayEvents(
  plans: (PaydayConfig & { id: string })[],
  today: string,
  end: string,
  incomePercent: number,
) {
  return plans.flatMap((plan) =>
    paydays(plan, day(today, 1), end).map((p): ForecastEvent => ({
      id: `payday:${plan.id}:${p.scheduledDate}`,
      date: p.expectedDate,
      kind: 'income',
      description: `${plan.name} pay`,
      amount: Number(floorDiv(BigInt(plan.expectedIncome) * BigInt(incomePercent), 100n)),
      categoryId: null,
      estimated: true,
    })),
  );
}

/** Pool accounts receiving scheduled personal transfers already forecast as outflows. */
function scheduledHouseholdContributions() {
  const pools = new Set(
    db
      .select({ accountId: householdGroups.accountId })
      .from(householdGroups)
      .where(isNotNull(householdGroups.accountId))
      .all()
      .map((g) => g.accountId!),
  );
  const personal = personalAccountIds();
  return db
    .select()
    .from(schedules)
    .where(eq(schedules.status, 'active'))
    .all()
    .some(
      (s) =>
        (s.accountId &&
          personal.has(s.accountId) &&
          s.transferAccountId &&
          pools.has(s.transferAccountId)) ||
        (s.transferAccountId &&
          personal.has(s.transferAccountId) &&
          s.accountId &&
          pools.has(s.accountId)),
    );
}

/** Your unreserved share of unpaid household bills, due on the bill date. The pool's own
 * cash is outside the personal budget, so only the personal contribution is forecast. */
function householdEventsFor(today: string, end: string, warnings: string[]) {
  const budget = currencyContext().budget;
  const out: ForecastEvent[] = [];
  for (const group of db.select().from(householdGroups).all()) {
    const bills = db
      .select()
      .from(householdBills)
      .where(eq(householdBills.groupId, group.id))
      .all();
    const paid = new Set(
      db
        .select({ billId: householdEvents.billId })
        .from(householdEvents)
        .where(and(eq(householdEvents.groupId, group.id), eq(householdEvents.kind, 'expense')))
        .all()
        .map((e) => e.billId),
    );
    const due = bills.filter((b) => !paid.has(b.id) && b.dueDate >= today && b.dueDate <= end);
    if (!due.length) continue;
    if (budget && group.currency !== budget) {
      warnings.push(
        `${group.name} bills are excluded: the household currency differs from the budget.`,
      );
      continue;
    }
    for (const bill of due) {
      const covered =
        bill.amount > 0
          ? Number(
              (BigInt(bill.personalShare) * BigInt(Math.min(bill.reserved, bill.amount))) /
                BigInt(bill.amount),
            )
          : 0;
      const outstanding = bill.personalShare - covered;
      if (outstanding <= 0) continue;
      out.push({
        id: `household:${bill.id}`,
        date: bill.dueDate,
        kind: 'household',
        description: `${bill.description} (my share)`,
        amount: -outstanding,
        categoryId: null,
        estimated: true,
      });
    }
  }
  return out;
}

/** Net personal variable spending: expense-category budget activity, excluding scheduled
 * payments, generated rows and (when shares are forecast) household-linked payments. */
function variableSpending(today: string, lookbackDays: number, excludeHousehold: boolean) {
  const from = day(today, 1 - lookbackDays);
  const matched = db
    .select({ id: scheduleOccurrences.matchedTransactionId })
    .from(scheduleOccurrences)
    .where(isNotNull(scheduleOccurrences.matchedTransactionId));
  const linked = db
    .select({ id: householdEvents.transactionId })
    .from(householdEvents)
    .where(isNotNull(householdEvents.transactionId));
  const expenseCategories = db
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
        gt(transactions.date, day(from, -1)),
        lte(transactions.date, today),
        inArray(transactions.categoryId, expenseCategories),
        notInArray(transactions.id, matched),
        notInArray(sql`coalesce(${transactions.parentTransactionId}, '')`, matched),
        sql`coalesce(${transactions.importedId}, '') not like 'schedule:%'`,
        excludeHousehold ? notInArray(transactions.id, linked) : undefined,
        excludeHousehold
          ? notInArray(sql`coalesce(${transactions.parentTransactionId}, '')`, linked)
          : undefined,
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
  const net = rows.reduce((s, r) => s + r.amount, 0);
  return { from: coveredFrom, to: today, days, total: Math.max(0, -net), count: rows.length };
}

type GoalPlan = {
  id: string;
  name: string;
  status: string;
  source: 'category' | 'manual';
  categoryId: string | null;
  start: number | null;
  target: number;
  targetDate: string | null;
};

function goalPlans(today: string, warnings: string[]): GoalPlan[] {
  const rows = db.select().from(goals).orderBy(goals.sortOrder).all();
  const state = rows.some((g) => g.categoryId) ? fundingState(today) : null;
  if (state && !state.complete)
    warnings.push(
      'Category-funded goal progress is unknown until missing exchange rates are added.',
    );
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
    source: g.categoryId ? 'category' : 'manual',
    categoryId: g.categoryId,
    start: g.categoryId
      ? state!.complete
        ? Math.max(0, state!.balances.get(g.categoryId) ?? 0)
        : null
      : g.currentAmount,
    target: g.targetAmount,
    targetDate: g.targetDate,
  }));
}

/** Planned per-pay contribution from payday rules for the goal's category. */
function plannedContribution(
  goal: GoalPlan,
  plan: PaydayConfig,
  payDate: string,
  scheduledDate: string,
  balance: number,
  incomePercent: number,
) {
  const rule = plan.rules.find((r) => r.categoryId === goal.categoryId);
  // A paused, completed or retired goal (7D) receives no planned contributions.
  if (!rule || goal.status !== 'active') return 0;
  if (rule.method === 'fixed') return rule.amount;
  if (rule.method === 'percentage')
    return Number(
      floorDiv(BigInt(plan.expectedIncome) * BigInt(incomePercent) * BigInt(rule.percent), 10000n),
    );
  if (rule.method === 'monthly')
    return Math.ceil((rule.amount * 12) / paydaysInYear(plan, payDate).length);
  if (rule.method === 'due' && rule.dueDate && payDate <= rule.dueDate) {
    const left =
      1 +
      paydays(plan, day(payDate, 1), rule.dueDate).filter((p) => p.scheduledDate > scheduledDate)
        .length;
    return perPeriodNeed(rule.amount, balance, left);
  }
  return 0;
}

function projectScenario(
  scenario: ForecastScenario,
  ctx: {
    today: string;
    dates: string[];
    startBalance: number;
    baseEvents: ForecastEvent[];
    plans: (PaydayConfig & { id: string })[];
    incomeSource: 'payday' | 'schedules';
    spending: { total: number; days: number };
    goals: GoalPlan[];
    notes: Set<string>;
    warnings: string[];
    end: string;
    reserve: number | null;
  },
) {
  const { today, dates } = ctx;
  const expectedIncome =
    ctx.incomeSource === 'payday'
      ? paydayEvents(ctx.plans, today, ctx.end, scenario.incomePercent)
      : scheduledEvents(today, ctx.end, 'schedules', scenario.incomePercent, new Set(), []).filter(
          (e) => e.kind === 'income',
        );
  const paused = (date: string) =>
    scenario.incomePauses.some((p) => p.from <= date && date <= p.to);
  const income = expectedIncome.filter((e) => !paused(e.date));
  const pausedIncome = expectedIncome
    .filter((e) => paused(e.date) && e.date >= today && e.date <= ctx.end)
    .reduce((s, e) => s + e.amount, 0);
  const costChanges = scenario.costChanges.flatMap((c, i) => {
    const events: ForecastEvent[] = [];
    for (let m = 0; ; m++) {
      const month = addMonthsTo(c.from.slice(0, 7), m);
      const last = Number(monthEnd(month).slice(8));
      const date = `${month}-${String(Math.min(Number(c.from.slice(8)), last)).padStart(2, '0')}`;
      if (date > ctx.end) break;
      events.push({
        id: `cost-change:${i}:${month}`,
        date,
        kind: 'cost-change',
        description: c.description,
        amount: -c.monthlyAmount,
        categoryId: null,
        estimated: true,
      });
    }
    return events;
  });
  const oneOffs = scenario.oneOffs.map((o, i): ForecastEvent => ({
    id: `one-off:${i}`,
    date: o.date,
    kind: 'one-off',
    description: o.description,
    amount: o.amount,
    categoryId: null,
    estimated: true,
  }));
  const events = [...ctx.baseEvents, ...income, ...oneOffs, ...costChanges].filter(
    (e) => e.date >= today && e.date <= ctx.end,
  );
  // Cumulative rounding: day k spends floor(rate × k), so totals never drift.
  const [num, den] =
    scenario.dailySpending !== null
      ? [BigInt(scenario.dailySpending), 1n]
      : [
          BigInt(ctx.spending.total) * BigInt(scenario.spendingPercent),
          BigInt(ctx.spending.days) * 100n,
        ];
  const byDate = new Map<string, ForecastEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  let balance = ctx.startBalance;
  let lowest = { date: today, balance };
  let firstShortfall: { date: string; balance: number } | null =
    balance < 0 ? { date: today, balance } : null;
  const nextPay = income.map((e) => e.date).sort()[0] ?? null;
  let lowestBeforePay: { date: string; balance: number } | null = nextPay
    ? { date: today, balance }
    : null;
  const days = dates.map((date, k) => {
    const todays = byDate.get(date) ?? [];
    const inflow = todays.filter((e) => e.kind === 'income').reduce((s, e) => s + e.amount, 0);
    const other = todays.filter((e) => e.kind !== 'income').reduce((s, e) => s + e.amount, 0);
    const variable =
      k === 0 ? 0 : Number(floorDiv(num * BigInt(k), den) - floorDiv(num * BigInt(k - 1), den));
    balance += inflow + other - variable;
    if (balance < lowest.balance) lowest = { date, balance };
    if (!firstShortfall && balance < 0) firstShortfall = { date, balance };
    if (lowestBeforePay && nextPay && date < nextPay && balance < lowestBeforePay.balance)
      lowestBeforePay = { date, balance };
    return { date, balance, income: inflow, scheduled: other, variable };
  });

  const overrides = new Map(scenario.goalContributions.map((g) => [g.goalId, g.amountPerPay]));
  const goalProjections = ctx.goals.map((goal) => {
    if (goal.start === null)
      return {
        ...goal,
        points: [],
        attainmentDate: null,
        onTrack: null,
        end: null,
        contributed: 0,
      };
    // No pay arrives during an income pause, so nothing is assigned from it either.
    const pays = ctx.plans
      .flatMap((plan) => paydays(plan, day(today, 1), ctx.end).map((p) => ({ plan, ...p })))
      .filter((p) => !paused(p.expectedDate));
    const withdrawals = new Map<string, number>();
    if (goal.categoryId)
      for (const e of ctx.baseEvents)
        if (
          e.categoryId === goal.categoryId &&
          e.amount < 0 &&
          e.date >= today &&
          e.date <= ctx.end
        )
          withdrawals.set(e.date, (withdrawals.get(e.date) ?? 0) + e.amount);
    const override = overrides.get(goal.id);
    // Without a plan, an override contributes every 14 days from tomorrow.
    const schedule =
      override !== undefined && !pays.length
        ? dates.filter((_, k) => k > 0 && k % 14 === 1).map((d) => ({ date: d, amount: override }))
        : null;
    let value = goal.start;
    let contributed = 0;
    let attainmentDate = value >= goal.target && goal.target > 0 ? today : null;
    const points = [{ date: today, balance: value }];
    for (const [k, date] of dates.entries()) {
      if (k === 0) continue;
      let added = 0;
      if (schedule) added = schedule.find((s) => s.date === date)?.amount ?? 0;
      else
        for (const p of pays.filter((p) => p.expectedDate === date))
          added +=
            override ??
            plannedContribution(goal, p.plan, date, p.scheduledDate, value, scenario.incomePercent);
      contributed += added;
      let change = added + (withdrawals.get(date) ?? 0);
      value += change;
      // Month-end credit: nominal annual rate ÷ 12 on a positive balance, rounded down.
      const monthEnd = k < dates.length - 1 && dates[k + 1].slice(0, 7) !== date.slice(0, 7);
      if (monthEnd && scenario.annualReturnBasisPoints && value > 0) {
        const growth = Number(
          floorDiv(BigInt(value) * BigInt(scenario.annualReturnBasisPoints), 120000n),
        );
        value += growth;
        change += growth;
      }
      if (change) points.push({ date, balance: value });
      if (!attainmentDate && goal.target > 0 && value >= goal.target) attainmentDate = date;
    }
    if (points[points.length - 1].date !== dates[dates.length - 1])
      points.push({ date: dates[dates.length - 1], balance: value });
    return {
      ...goal,
      points,
      end: value,
      contributed,
      attainmentDate,
      // A goal already funded today is reached, not late, even past its target date.
      onTrack:
        goal.target > 0 && goal.start >= goal.target
          ? true
          : goal.targetDate
            ? attainmentDate !== null && attainmentDate <= goal.targetDate
            : null,
    };
  });

  return {
    ...scenario,
    days,
    events: events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    endBalance: balance,
    lowest,
    /** The first day cash falls below zero within the horizon; null is "none within the
     * horizon", never a claim of safety beyond it. */
    firstShortfall,
    pausedIncome,
    /** How far the lowest balance falls into today's flexibility reserve (phase 7C). */
    reserveUse:
      ctx.reserve === null
        ? null
        : Math.min(ctx.reserve, Math.max(0, ctx.reserve - lowest.balance)),
    nextPayday: nextPay,
    lowestBeforeNextPayday: lowestBeforePay,
    variableTotal: days.reduce((s, d) => s + d.variable, 0),
    goals: goalProjections,
  };
}

export function buildForecast(request: ForecastRequest) {
  const today = todayIso();
  const end = day(today, request.horizonDays);
  const warnings: string[] = [];
  const notes = new Set<string>();
  const plans = activePlans();
  const incomeSource = request.incomeSource ?? (plans.length ? 'payday' : 'schedules');
  if (incomeSource === 'payday' && !plans.length)
    throw new ForecastError('Create a payday plan, or forecast income from schedules');
  const goalRows = goalPlans(today, warnings);
  const goalIds = new Set(goalRows.map((g) => g.id));
  for (const s of request.scenarios) {
    if (s.goalContributions.some((g) => !goalIds.has(g.goalId)))
      throw new ForecastError('A goal contribution refers to a goal that no longer exists');
    if (s.oneOffs.some((o) => o.date < today || o.date > end))
      throw new ForecastError('One-off amounts must fall within the forecast horizon');
    if (s.incomePauses.some((p) => p.from > p.to || p.from > end || p.to < today))
      throw new ForecastError('Income pauses must end after they start and overlap the horizon');
    if (s.costChanges.some((c) => c.from < today || c.from > end))
      throw new ForecastError('Cost changes must start within the forecast horizon');
  }
  const contributionsScheduled = scheduledHouseholdContributions();
  const includeHousehold = request.includeHousehold ?? !contributionsScheduled;
  if (request.includeHousehold === null && contributionsScheduled)
    notes.add(
      'Household bill shares are off by default because contributions into the household pool are already scheduled.',
    );
  const position = cashPosition(today, warnings);
  const startBalance = position.rows.reduce((s, a) => s + a.balance, 0);
  const baseEvents = [
    ...position.future.filter((e) => e.date <= end),
    ...scheduledEvents(today, end, incomeSource, 100, notes, warnings).filter(
      (e) => e.kind !== 'income',
    ),
    ...(includeHousehold ? householdEventsFor(today, end, warnings) : []),
  ];
  const spending = variableSpending(today, request.lookbackDays, includeHousehold);
  if (spending.days < request.lookbackDays)
    notes.add(`Variable spending uses ${spending.days} days of history, the most available.`);
  const dates = Array.from({ length: request.horizonDays + 1 }, (_, k) => day(today, k));
  // Actual history: walk today's balance backwards through dated rows (today's rates).
  const history: { date: string; balance: number }[] = [];
  let past = startBalance;
  for (let k = 0; k <= Math.min(30, request.horizonDays); k++) {
    const date = day(today, -k);
    history.unshift({ date, balance: past });
    past -= position.history.get(date) ?? 0;
  }
  const latest = db
    .select({ date: sql<string | null>`max(${transactions.date})` })
    .from(transactions)
    .where(and(lte(transactions.date, today), inAccountBalance))
    .get()?.date;
  // Today's flexibility reserve (7B), when one is set up and its figures are complete.
  const resilience = resilienceState(today);
  const reserve =
    resilience.status === 'not-set-up' ? null : (resilience.flexibility.available ?? null);
  const scenarios = request.scenarios.map((s) =>
    projectScenario(s, {
      today,
      dates,
      startBalance,
      baseEvents,
      plans,
      incomeSource,
      spending,
      goals: goalRows,
      notes,
      warnings,
      end,
      reserve,
    }),
  );
  return {
    today,
    end,
    horizonDays: request.horizonDays,
    currency: currencyContext().budget,
    incomeSource,
    includeHousehold,
    startBalance,
    accounts: position.rows,
    spending,
    history,
    freshness: {
      latestTransaction: latest ?? null,
      upLastSyncedAt:
        db.select({ at: upConnections.lastSyncedAt }).from(upConnections).get()?.at ?? null,
    },
    plans: plans.map((p) => ({ id: p.id, name: p.name, expectedIncome: p.expectedIncome })),
    assumptions: [
      'Starting cash is the current balance of open, on-budget personal cash and card accounts. Household pool cash is excluded.',
      incomeSource === 'payday'
        ? 'Income is expected take-home pay on each future payday in active payday plans.'
        : 'Income is pending scheduled income in income categories.',
      'Bills and other movements are pending, unmatched recurring occurrences and future-dated register entries. Matched payments replace their forecast.',
      'Variable spending is the net daily average of expense-category activity over the lookback, excluding transfers, uncategorized adjustments and scheduled payments.',
      includeHousehold
        ? 'Household bills add your unreserved personal share on each due date.'
        : 'Household bill shares are not added.',
      'Goal contributions are envelope assignments and do not move cash. Growth is credited at month end and starts at zero unless set.',
      ...notes,
    ],
    warnings,
    scenarios,
  };
}
