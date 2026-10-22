import { and, eq, isNull, lte, ne } from 'drizzle-orm';
import { addDays, format, parseISO } from 'date-fns';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  categoryTargets,
  paydayPlans,
  scheduleOccurrences,
  schedules,
  transactions,
  categories,
  categoryGroups,
} from '../db/schema.js';
import { LIQUID_ACCOUNT_TYPES, fundingState, receivedActivity } from './budgetService.js';
import { budgetActivity, mainAmount, personalBudgetAccount } from './balances.js';
import { budgetWithTargets, targetStatus } from './targetService.js';
import { addMonthsTo, monthEnd } from './fundingMath.js';
import { todayIso } from './mainAmountService.js';
import { billCoverage, paydays, PaydayError } from './paydayService.js';
import { paydayConfigSchema } from './paydayConfig.js';
import { computeOccurrenceDates, type RecurrenceDefinition } from '../utils/recurrence.js';

// Buffer (6F), review (6G) and the guided setup (6G) are read-only views over the shared
// funding service: every total here is a figure fundingState already reports, broken down
// so it can be resolved. Nothing in this file writes. See docs/BUDGET-REVIEW.md.

const day = (date: string, count: number) => format(addDays(parseISO(date), count), 'yyyy-MM-dd');
const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);
/** Targets for money set aside for a known future bill rather than everyday spending. */
const TRUE_EXPENSE_TARGETS = new Set(['by-date', 'recurring']);
/** Complete months of history behind the runway's spending rate. */
const SPENDING_MONTHS = 3;

function expenseCategories(month: string, today: string) {
  return budgetWithTargets(month, today)
    .filter((g) => !g.isIncome)
    .flatMap((g) => g.categories.map((c) => ({ ...c, groupName: g.name })));
}
type ExpenseCategory = ReturnType<typeof expenseCategories>[number];

function futureAssignments(month: string, ids: Set<string>) {
  return db
    .select()
    .from(budgetMonths)
    .all()
    .filter((r) => r.month > month && ids.has(r.categoryId) && r.budgeted > 0);
}

/** Uncategorised debits counted by fundingState, listed so each can be categorised. */
function uncategorisedDebits(asOf: string) {
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      payee: transactions.payeeName,
      amount: mainAmount,
      accountId: transactions.accountId,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(and(receivedActivity, lte(transactions.date, asOf), isNull(transactions.categoryId)))
    .all()
    .filter((r) => r.amount < 0)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/** Everything that keeps the budget from being fully resolved, each with its category group
 * so a person's own spending categories can be reviewed on their own. Totals reconcile with
 * the monthly summary: they come from the same fundingState call. */
export function reviewState(today = todayIso()) {
  const state = fundingState(today);
  const month = today.slice(0, 7);
  const cats = expenseCategories(month, today);
  const byId = new Map(cats.map((c) => [c.id, c]));
  const uncategorised = uncategorisedDebits(today);
  const deficits = cats
    .filter((c) => !c.paymentAccountId && c.balance < 0)
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      groupId: c.groupId,
      groupName: c.groupName,
      amount: -c.balance,
    }));
  const targetShortfalls = cats
    .filter((c) => c.target && c.target.underfunded > 0)
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      groupId: c.groupId,
      groupName: c.groupName,
      amount: c.target!.underfunded,
      dueDate: c.target!.dueDate,
    }));
  const future = futureAssignments(month, new Set(cats.map((c) => c.id)));
  const commitments = [...new Set(future.map((r) => r.month))].sort().map((m) => ({
    month: m,
    amount: sum(future.filter((r) => r.month === m).map((r) => r.budgeted)),
    categories: future
      .filter((r) => r.month === m)
      .map((r) => ({
        categoryId: r.categoryId,
        name: byId.get(r.categoryId)!.name,
        groupId: byId.get(r.categoryId)!.groupId,
        groupName: byId.get(r.categoryId)!.groupName,
        amount: r.budgeted,
      })),
  }));
  const cards = state.cards
    .filter((p) => p.shortfall > 0 || p.uncoveredPayments > 0)
    .map((p) => ({
      accountId: p.accountId,
      categoryId: p.categoryId,
      name: p.name,
      shortfall: p.shortfall,
      uncoveredPayments: p.uncoveredPayments,
    }));
  return {
    asOf: state.asOf,
    month,
    revision: state.revision,
    complete: state.complete,
    resolved: state.resolved,
    unassigned: state.unassigned,
    totals: {
      uncategorised: state.uncategorized,
      deficits: state.overspent,
      targetShortfalls: sum(targetShortfalls.map((t) => t.amount)),
      futureCommitments: state.futureAssigned,
      cardShortfall: state.paymentShortfall,
      uncoveredCardPayments: state.uncoveredCardPayments,
    },
    uncategorised: uncategorised.slice(0, 100),
    uncategorisedCount: uncategorised.length,
    deficits,
    targetShortfalls,
    commitments,
    cards,
    groups: [...new Map(cats.map((c) => [c.groupId, c.groupName])).entries()].map(([id, name]) => ({
      id,
      name,
    })),
  };
}

/** Next month's commitments and needs, and an optional cash runway (6F). */
export function bufferState(today = todayIso()) {
  const state = fundingState(today);
  const month = today.slice(0, 7);
  const next = addMonthsTo(month, 1);
  const cats = expenseCategories(month, today);
  const ids = new Set(cats.map((c) => c.id));
  const targets = new Map(
    db
      .select()
      .from(categoryTargets)
      .all()
      .map((t) => [t.categoryId, t]),
  );
  const future = futureAssignments(month, ids);
  const assignedIn = (m: string, id: string) =>
    future.find((r) => r.month === m && r.categoryId === id)?.budgeted ?? 0;
  const nextAssigned = sum(future.filter((r) => r.month === next).map((r) => r.budgeted));

  // Next month's targets start from today's availability, as if nothing more is spent or
  // assigned this month. Overspending carries, as it does in the budget.
  const nextNeeds = cats
    .filter((c) => targets.has(c.id))
    .map((c) => {
      const status = targetStatus(
        targets.get(c.id)!,
        { budgeted: assignedIn(next, c.id), carryOver: c.balance },
        next,
      );
      return {
        categoryId: c.id,
        name: c.name,
        required: status.required,
        assigned: status.assigned,
        underfunded: status.underfunded,
      };
    })
    .filter((r) => r.required > 0);

  const restrictedKind = (c: ExpenseCategory) =>
    c.paymentAccountId
      ? ('card' as const)
      : TRUE_EXPENSE_TARGETS.has(targets.get(c.id)?.type ?? '')
        ? ('true-expense' as const)
        : null;
  const restrictedRows = cats
    .filter((c) => restrictedKind(c))
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      kind: restrictedKind(c)!,
      amount:
        Math.max(0, c.balance) +
        sum(future.filter((r) => r.categoryId === c.id).map((r) => r.budgeted)),
    }))
    .filter((r) => r.amount > 0);
  const restricted = sum(restrictedRows.map((r) => r.amount));

  const runway = cashRunway(today, state, cats, new Set(restrictedRows.map((r) => r.categoryId)));
  // Borrowing never adds to unrestricted money: unreviewed debt already nets against cash,
  // and reviewed card debt without a payment reserve is subtracted here.
  const unrestricted = state.complete
    ? Math.max(0, state.resources - restricted - state.paymentShortfall)
    : null;
  const incomplete = [...runway.incomplete];
  if (!state.complete)
    incomplete.unshift('Some account or transaction exchange rates are missing.');
  const daily = runway.days ? runway.total / runway.days : 0;
  return {
    asOf: state.asOf,
    month,
    nextMonth: next,
    complete: state.complete,
    nextAssigned,
    laterAssigned: state.futureAssigned - nextAssigned,
    nextNeeds,
    nextUnderfunded: sum(nextNeeds.map((r) => r.underfunded)),
    unresolved: {
      overspent: state.overspent,
      uncategorised: state.uncategorized,
      cardShortfall: state.paymentShortfall,
      uncoveredCardPayments: state.uncoveredCardPayments,
      overAssigned: Math.max(0, -state.unassigned),
    },
    runway: {
      resources: state.complete ? state.resources : null,
      restricted,
      restrictedRows,
      cardDebtWithoutReserve: state.paymentShortfall,
      unrestricted,
      spending: { from: runway.from, to: runway.to, total: runway.total, days: runway.days },
      monthlySpending: Math.round((daily * 365) / 12),
      days:
        unrestricted !== null && !incomplete.length && daily > 0
          ? Math.floor(unrestricted / daily)
          : null,
      incomplete,
      assumptions: [
        'Counts cash in personal, on-budget checking, savings, cash and card accounts; debts reduce it.',
        'Investment, retirement, property and off-budget accounts are not cash and are excluded.',
        'Money set aside for bills with a date target and card payment reserves is restricted and excluded.',
        `Spending continues at its average over the last ${SPENDING_MONTHS} complete months, excluding restricted categories; uncategorised spending is included.`,
        'No income is assumed to arrive.',
      ],
    },
  };
}

function cashRunway(
  today: string,
  state: ReturnType<typeof fundingState>,
  cats: ExpenseCategory[],
  restricted: Set<string>,
) {
  const month = today.slice(0, 7);
  const from = `${addMonthsTo(month, -SPENDING_MONTHS)}-01`;
  const to = monthEnd(addMonthsTo(month, -1));
  const days = Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000) + 1;
  const counted = new Set(cats.filter((c) => !restricted.has(c.id)).map((c) => c.id));
  const rows = db
    .select({
      date: transactions.date,
      categoryId: transactions.categoryId,
      amount: mainAmount,
      source: transactions.mainAmountSource,
    })
    .from(transactions)
    .where(and(receivedActivity, lte(transactions.date, to)))
    .all();
  const inWindow = rows.filter((r) => r.date >= from);
  const window = inWindow.filter((r) => (r.categoryId ? counted.has(r.categoryId) : r.amount < 0));
  const incomplete: string[] = [];
  // History begins when the earliest personal budget account took effect: its creation or
  // its first transaction, whichever is earlier (the same date policy as opening funds).
  const firstTransaction = db
    .select({ date: transactions.date })
    .from(transactions)
    .where(budgetActivity)
    .orderBy(transactions.date)
    .limit(1)
    .get()?.date;
  const first = [
    firstTransaction,
    ...db
      .select()
      .from(accounts)
      .where(personalBudgetAccount)
      .all()
      .map((a) => a.createdAt.slice(0, 10)),
  ]
    .filter((d): d is string => !!d)
    .sort()[0];
  if (!first || first > from)
    incomplete.push(
      `History starts ${first ? `on ${first}` : 'nowhere yet'}; the runway needs every day from ${from}.`,
    );
  if (inWindow.some((r) => r.source === 'missing'))
    incomplete.push('Some spending in the history has no exchange rate.');
  const total = Math.max(0, -sum(window.map((r) => r.amount)));
  if (!incomplete.length && state.complete && total === 0)
    incomplete.push('No spending in the history to measure a runway against.');
  return { from, to, days, total, incomplete };
}

type Step = {
  id: 'balances' | 'before-income' | 'assign' | 'irregular' | 'before-spending' | 'priorities';
  status: 'done' | 'todo' | 'attention' | 'info';
  summary: string;
};

/** The earliest income the user has said to expect, without treating it as received. */
function nextIncomeDate(today: string) {
  const dates: string[] = [];
  for (const row of db.select().from(paydayPlans).where(eq(paydayPlans.archived, 0)).all()) {
    const plan = paydayConfigSchema.parse(JSON.parse(row.configJson));
    const next = paydays(plan, day(today, 1), day(today, 45))[0];
    if (next) dates.push(next.expectedDate);
  }
  const incomeIds = new Set(
    db
      .select({ id: categories.id })
      .from(categories)
      .innerJoin(categoryGroups, eq(categoryGroups.id, categories.groupId))
      .where(eq(categoryGroups.isIncome, 1))
      .all()
      .map((c) => c.id),
  );
  for (const schedule of db.select().from(schedules).where(eq(schedules.status, 'active')).all()) {
    if (schedule.amount <= 0 || !schedule.categoryId || !incomeIds.has(schedule.categoryId))
      continue;
    const handled = new Set(
      db
        .select()
        .from(scheduleOccurrences)
        .where(
          and(
            eq(scheduleOccurrences.scheduleId, schedule.id),
            ne(scheduleOccurrences.status, 'pending'),
          ),
        )
        .all()
        .map((o) => o.scheduledDate),
    );
    const def = {
      ...schedule,
      recurrenceRule: JSON.parse(schedule.recurrenceRule),
    } as RecurrenceDefinition;
    const next = computeOccurrenceDates(def, day(today, 1), day(today, 62)).find(
      (o) => !handled.has(o.scheduledDate) && o.expectedDate > today,
    );
    if (next) dates.push(next.expectedDate);
  }
  return dates.sort()[0] ?? null;
}

/** Guided setup (6G): each step's state is derived from the budget, never stored, so it
 * agrees with every other view and needs no expected salary entered as money. */
export function guideState(today = todayIso()) {
  const state = fundingState(today);
  const month = today.slice(0, 7);
  const cats = expenseCategories(month, today);

  const accountRows = db
    .select()
    .from(accounts)
    .where(personalBudgetAccount)
    .all()
    .filter((a) => !a.closedAt && LIQUID_ACCOUNT_TYPES.includes(a.type));
  const balances = accountRows.map((a) => {
    const rows = db
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, a.id), isNull(transactions.parentTransactionId)))
      .all()
      .filter((r) => r.date <= today);
    return {
      accountId: a.id,
      name: a.name,
      currency: a.currency,
      balance: a.startingBalance + sum(rows.map((r) => r.amount)),
      unreconciled: rows.filter((r) => !r.reconciled).length,
    };
  });

  const nextIncome = nextIncomeDate(today);
  const until = nextIncome ?? day(today, 14);
  let bills: ReturnType<typeof billCoverage> = [];
  let billsComplete = true;
  try {
    bills = billCoverage(today, until, today);
  } catch (error) {
    if (!(error instanceof PaydayError)) throw error;
    billsComplete = false;
  }
  const needs = [...new Set(bills.map((b) => b.categoryId))].map((categoryId) => {
    const category = cats.find((c) => c.id === categoryId);
    const due = sum(bills.filter((b) => b.categoryId === categoryId).map((b) => b.amount));
    const available = category?.balance ?? 0;
    return {
      categoryId,
      name: category?.name ?? '',
      due,
      available,
      uncovered: Math.max(0, due - Math.max(0, available)),
      bills: bills.filter((b) => b.categoryId === categoryId),
    };
  });

  const scheduled = new Set(
    db
      .select()
      .from(schedules)
      .where(eq(schedules.status, 'active'))
      .all()
      .filter(
        (s) => s.amount < 0 && ['quarterly', 'semiannually', 'yearly'].includes(s.recurrenceType),
      )
      .map((s) => s.categoryId),
  );
  const irregular = cats
    .filter((c) => !c.paymentAccountId && (c.budgetType === 'non_monthly' || scheduled.has(c.id)))
    .map((c) => ({ categoryId: c.id, name: c.name, hasTarget: !!c.target }));

  const uncovered = sum(needs.map((n) => n.uncovered));
  const steps: Step[] = [
    {
      id: 'balances',
      status: balances.some((b) => b.unreconciled) ? 'todo' : 'done',
      summary: balances.some((b) => b.unreconciled)
        ? `${balances.filter((b) => b.unreconciled).length} account(s) have unreconciled transactions.`
        : 'Every cash and card account is reconciled.',
    },
    {
      id: 'before-income',
      status: !billsComplete ? 'attention' : uncovered > 0 ? 'todo' : 'done',
      summary: !billsComplete
        ? 'Add missing exchange rates to see bills before your next income.'
        : uncovered > 0
          ? 'Some bills before your next income are not covered yet.'
          : 'Bills before your next income are covered.',
    },
    {
      id: 'assign',
      status: !state.complete
        ? 'attention'
        : state.unassigned > 0
          ? 'todo'
          : state.unassigned < 0
            ? 'attention'
            : 'done',
      summary: !state.complete
        ? 'Add missing exchange rates before assigning money.'
        : state.unassigned > 0
          ? 'Some money you already have is not assigned yet.'
          : state.unassigned < 0
            ? 'More is assigned than you have; reduce an assignment.'
            : 'Every dollar you have is assigned.',
    },
    {
      id: 'irregular',
      status: irregular.some((c) => !c.hasTarget) ? 'todo' : 'done',
      summary: irregular.some((c) => !c.hasTarget)
        ? 'Some irregular expenses have no target yet.'
        : irregular.length
          ? 'Every irregular expense has a target.'
          : 'No irregular expense categories found.',
    },
    {
      id: 'before-spending',
      status: state.overspent > 0 || state.uncategorized > 0 ? 'attention' : 'done',
      summary:
        state.overspent > 0 || state.uncategorized > 0
          ? 'Some spending is overspent or uncategorised.'
          : 'No overspending or uncategorised spending.',
    },
    {
      id: 'priorities',
      status: 'info',
      summary: 'When priorities change, move money between categories instead of overspending.',
    },
  ];
  return {
    asOf: today,
    month,
    unassigned: state.unassigned,
    complete: state.complete,
    steps,
    balances,
    nextIncome,
    needsUntil: until,
    needs,
    billsComplete,
    irregular,
  };
}
