import { monthEnd, perPeriodNeed } from './fundingMath.js';
import { fundingState } from './budgetService.js';
import { budgetWithTargets } from './targetService.js';
import { inactiveGoalCategories } from './goalLifecycle.js';
import { personalBudgetAccount } from './balances.js';
import { and, eq, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  categories,
  categoryGroups,
  transactions,
  schedules,
  scheduleOccurrences,
  paydayPlans,
  paydayFundingEvents,
  paydayFundingReceipts,
  incomeReviews,
} from '../db/schema.js';
import { budgetActivity, mainAmount } from './balances.js';
import { currencyContext, convertAmount } from './mainAmountService.js';
import {
  buildRecurrenceRule,
  computeOccurrenceDates,
  type RecurrenceDefinition,
} from '../utils/recurrence.js';
import {
  dateInZone,
  paydayConfigSchema,
  type PaydayConfig,
  type PaydayRequest,
} from './paydayConfig.js';

const day = (date: string, count: number) => format(addDays(parseISO(date), count), 'yyyy-MM-dd');
export class PaydayError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function loadPlan(id: string) {
  const row = db.select().from(paydayPlans).where(eq(paydayPlans.id, id)).get();
  if (!row) throw new PaydayError('Payday plan not found', 404);
  return {
    ...paydayConfigSchema.parse(JSON.parse(row.configJson)),
    id: row.id,
    archived: row.archived,
  };
}
export function paydays(config: PaydayConfig, from: string, to: string) {
  return computeOccurrenceDates(
    {
      startDate: config.anchorDate,
      endDate: null,
      recurrenceType: 'biweekly',
      recurrenceRule: buildRecurrenceRule('biweekly', config.anchorDate),
      weekendAdjust: config.weekendAdjust,
    },
    day(from, -3),
    day(to, 3),
  ).filter((p) => p.expectedDate >= from && p.expectedDate <= to);
}
/** Count the whole calendar-year cycle, even when a plan starts midyear. A rolling
 * year beginning on payday always includes 27 dates and would underfund annual costs.
 */
export function paydaysInYear(config: PaydayConfig, date: string) {
  const from = `${date.slice(0, 4)}-01-01`;
  const to = `${date.slice(0, 4)}-12-31`;
  const periods = Math.floor(
    differenceInCalendarDays(parseISO(from), parseISO(config.anchorDate)) / 14,
  );
  return paydays({ ...config, anchorDate: day(config.anchorDate, (periods - 1) * 14) }, from, to);
}
export function expenseCategories() {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(eq(categoryGroups.isIncome, 0))
    .all();
}
export function validateCategories(config: PaydayConfig) {
  const ids = new Set(expenseCategories().map((c) => c.id));
  if (config.rules.some((r) => !ids.has(r.categoryId)))
    throw new PaydayError('Funding rules must use existing expense or savings categories');
}
export function incomeOptions(today: string) {
  // A deposit funds one payday event or one extra-income split (phase 7F), never both.
  const used = new Set([
    ...db
      .select()
      .from(paydayFundingReceipts)
      .all()
      .map((r) => r.transactionId),
    ...db
      .select()
      .from(incomeReviews)
      .all()
      .map((r) => r.transactionId),
  ]);
  return (
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        name: transactions.payeeName,
        amount: mainAmount,
        importedId: transactions.importedId,
        reconciled: transactions.reconciled,
      })
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .innerJoin(categoryGroups, eq(categoryGroups.id, categories.groupId))
      .where(and(budgetActivity, eq(categoryGroups.isIncome, 1), lte(transactions.date, today)))
      .all()
      // Auto-created schedule rows are expectations until reviewed as received. They must
      // not unlock spending just because a schedule's date has arrived.
      .filter(
        (r) =>
          r.amount > 0 &&
          !used.has(r.id) &&
          !(r.importedId?.startsWith('schedule:') && !r.reconciled),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
  );
}

export function billCoverage(from: string, to: string, today: string) {
  const accountRows = db.select().from(accounts).all();
  const personalIds = new Set(
    db
      .select({ id: accounts.id })
      .from(accounts)
      .where(personalBudgetAccount)
      .all()
      .map((a) => a.id),
  );
  const expenseIds = new Set(expenseCategories().map((c) => c.id));
  const ctx = currencyContext();
  const bills: {
    id: string;
    name: string;
    categoryId: string;
    date: string;
    amount: number;
    estimated: boolean;
  }[] = [];
  for (const schedule of db.select().from(schedules).where(eq(schedules.status, 'active')).all()) {
    if (schedule.amount >= 0 || !schedule.categoryId || !expenseIds.has(schedule.categoryId))
      continue;
    const account = accountRows.find((a) => a.id === schedule.accountId);
    if (account && !personalIds.has(account.id)) continue;
    if (schedule.transferAccountId && personalIds.has(schedule.transferAccountId)) continue;
    const stored = db
      .select()
      .from(scheduleOccurrences)
      .where(eq(scheduleOccurrences.scheduleId, schedule.id))
      .all();
    const def = {
      ...schedule,
      recurrenceRule: JSON.parse(schedule.recurrenceRule),
    } as RecurrenceDefinition;
    const pairs = computeOccurrenceDates(def, day(from, -3), day(to, 3));
    const candidates = new Map(
      pairs.map((p) => [
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
      if (
        occurrence.status !== 'pending' ||
        occurrence.matchedTransactionId ||
        occurrence.expectedDate < from ||
        occurrence.expectedDate >= to
      )
        continue;
      // A created/linked schedule transaction is already represented in category activity.
      const amount = convertAmount(
        Math.abs(occurrence.expectedAmount),
        account?.currency ?? ctx.budget,
        ctx.budget,
        today,
        ctx,
      );
      if (amount === null) throw new PaydayError(`Add an exchange rate for ${schedule.name}`);
      bills.push({
        id: `${schedule.id}:${scheduledDate}`,
        name: schedule.name,
        categoryId: schedule.categoryId,
        date: occurrence.expectedDate,
        amount,
        estimated: schedule.amountType !== 'exact',
      });
    }
  }
  return bills.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function previewPayday(planId: string, request: PaydayRequest) {
  const plan = loadPlan(planId);
  if (plan.archived) throw new PaydayError('This plan is archived');
  validateCategories(plan);
  const today = dateInZone(plan.timeZone);
  const occurrence = paydays(
    plan,
    day(request.scheduledDate, -3),
    day(request.scheduledDate, 3),
  ).find((p) => p.scheduledDate === request.scheduledDate);
  if (!occurrence) throw new PaydayError('Choose a payday from this plan');
  if (
    Math.abs(
      differenceInCalendarDays(parseISO(request.actualPayDate), parseISO(occurrence.expectedDate)),
    ) > 13
  )
    throw new PaydayError('Adjusted payday must be within 13 days of the expected date');
  const next = paydays(plan, day(request.actualPayDate, 1), day(request.actualPayDate, 30)).find(
    (p) => p.scheduledDate > request.scheduledDate,
  );
  if (!next) throw new PaydayError('Could not find the next payday');
  const existing = db
    .select()
    .from(paydayFundingEvents)
    .where(
      and(
        eq(paydayFundingEvents.planId, planId),
        eq(paydayFundingEvents.scheduledDate, request.scheduledDate),
      ),
    )
    .get();
  const options = incomeOptions(today);
  const selected = request.incomeIds.map((id) => {
    const income = options.find((r) => r.id === id);
    if (!income)
      throw new PaydayError(
        'Selected income is unavailable or already funded; refresh the preview',
        409,
      );
    return income;
  });
  const received = selected.reduce((sum, r) => sum + r.amount, 0);
  const state = fundingState(today);
  if (!state.complete) throw new PaydayError('Add missing account exchange rates before funding');
  const future = request.actualPayDate > today;
  // Ready to Assign doesn't count this month's overspending until next month (like YNAB);
  // an automatic allocation leaves enough to cover it rather than spend it twice
  const available =
    future || existing ? 0 : Math.min(Math.max(0, state.available - state.cashOverspent), received);
  const bills = billCoverage(
    request.actualPayDate < occurrence.expectedDate
      ? request.actualPayDate
      : occurrence.expectedDate,
    next.expectedDate,
    today,
  );
  const cats = expenseCategories();
  const automaticRules: PaydayConfig['rules'] = [];
  for (const bill of bills)
    if (![...plan.rules, ...automaticRules].some((r) => r.categoryId === bill.categoryId))
      automaticRules.push({
        categoryId: bill.categoryId,
        method: 'bills',
        amount: 0,
        dueDate: null,
        percent: 0,
      });
  const rules = [...automaticRules, ...plan.rules];
  // Category targets (6D) say what each category still needs this month; a target rule
  // spreads that over this and the month's remaining paydays instead of redefining it.
  const month = today.slice(0, 7);
  const targets = new Map(
    budgetWithTargets(month, today)
      .flatMap((g) => g.categories)
      .map((c) => [c.id, c.target]),
  );
  const paysLeftInMonth =
    1 +
    paydays(
      plan,
      day(request.actualPayDate > today ? request.actualPayDate : today, 1),
      monthEnd(month),
    ).filter((p) => p.scheduledDate > request.scheduledDate).length;
  // A paused, completed or retired goal (7D) gets no new funding from any rule.
  const inactive = inactiveGoalCategories();
  let remaining = available;
  const rows = rules
    .filter((r) => r.method !== 'remainder')
    .concat(rules.filter((r) => r.method === 'remainder'))
    .map((rule) => {
      const balance = state.balances.get(rule.categoryId) ?? 0;
      const billsDue = bills
        .filter((b) => b.categoryId === rule.categoryId)
        .reduce((sum, b) => sum + b.amount, 0);
      let needed = 0;
      if (rule.method === 'bills') needed = Math.max(0, billsDue - balance);
      if (rule.method === 'fixed') needed = rule.amount;
      if (rule.method === 'due') {
        const remainingPays =
          1 +
          (rule.dueDate! > request.actualPayDate
            ? paydays(plan, day(request.actualPayDate, 1), rule.dueDate!).filter(
                (p) => p.scheduledDate > request.scheduledDate,
              ).length
            : 0);
        needed = perPeriodNeed(rule.amount, balance, remainingPays);
      }
      if (rule.method === 'monthly') {
        const pays = paydaysInYear(plan, request.actualPayDate).length;
        needed = Math.max(Math.ceil((rule.amount * 12) / pays), billsDue - balance, 0);
      }
      if (rule.method === 'percentage')
        needed = Number((BigInt(received) * BigInt(rule.percent)) / 100n);
      const target = rule.method === 'target' ? targets.get(rule.categoryId) : null;
      if (target && !target.ended) needed = perPeriodNeed(target.underfunded, 0, paysLeftInMonth);
      if (rule.method === 'remainder') needed = remaining;
      if (inactive.has(rule.categoryId)) needed = 0;
      const allocated = Math.min(needed, remaining);
      remaining -= allocated;
      return {
        categoryId: rule.categoryId,
        name: cats.find((c) => c.id === rule.categoryId)!.name,
        method: rule.method,
        balance,
        billsDue,
        needed,
        allocated,
        shortfall: needed - allocated,
        uncoveredBills: Math.max(0, billsDue - balance - allocated),
        targetUnderfunded: rule.method === 'target' ? (target?.underfunded ?? null) : null,
        goalInactive: inactive.has(rule.categoryId),
      };
    });
  return {
    planId,
    planName: plan.name,
    scheduledDate: request.scheduledDate,
    actualPayDate: request.actualPayDate,
    nextPayday: next.expectedDate,
    today,
    month,
    expectedIncome: plan.expectedIncome,
    received,
    available,
    unallocated: remaining,
    totalAllocated: available - remaining,
    shortfall: rows.reduce((sum, r) => sum + r.shortfall, 0),
    future,
    existingEventId: existing?.id ?? null,
    incomeIds: request.incomeIds,
    rows,
    bills,
    config: plan,
  };
}

export function applyPayday(planId: string, request: PaydayRequest, previewKey: string) {
  // Read, validate, allocate and record receipts in one synchronous DB transaction.
  // Unique pay/receipt constraints also protect concurrent clients and other plans.
  return db.transaction(() => {
    const existing = db
      .select()
      .from(paydayFundingEvents)
      .where(
        and(
          eq(paydayFundingEvents.planId, planId),
          eq(paydayFundingEvents.scheduledDate, request.scheduledDate),
        ),
      )
      .get();
    if (existing) return { ...existing, alreadyApplied: true };
    const preview = previewPayday(planId, request);
    if (JSON.stringify(preview) !== previewKey)
      throw new PaydayError(
        'Your budget or plan changed. Refresh the preview before applying.',
        409,
      );
    if (preview.future || preview.totalAllocated <= 0)
      throw new PaydayError('Select received income and a funded allocation before applying');
    const event = {
      id: nanoid(),
      planId,
      scheduledDate: request.scheduledDate,
      appliedDate: preview.today,
      snapshotJson: JSON.stringify(preview),
    };
    for (const row of preview.rows) {
      if (!row.allocated) continue;
      const existing = db
        .select()
        .from(budgetMonths)
        .where(
          and(eq(budgetMonths.month, preview.month), eq(budgetMonths.categoryId, row.categoryId)),
        )
        .get();
      const budgeted = (existing?.budgeted ?? 0) + row.allocated;
      if (!Number.isSafeInteger(budgeted) || Math.abs(budgeted) > 1e13)
        throw new PaydayError('Category allocation is too large');
      if (existing)
        db.update(budgetMonths).set({ budgeted }).where(eq(budgetMonths.id, existing.id)).run();
      else
        db.insert(budgetMonths)
          .values({ id: nanoid(), month: preview.month, categoryId: row.categoryId, budgeted })
          .run();
    }
    db.insert(paydayFundingEvents).values(event).run();
    for (const transactionId of request.incomeIds)
      db.insert(paydayFundingReceipts).values({ transactionId, eventId: event.id }).run();
    return { ...event, alreadyApplied: false };
  });
}
