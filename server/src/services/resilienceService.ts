import { and, eq, gt, inArray, isNull, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { addMonths, format, parseISO } from 'date-fns';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  cardFunding,
  categories,
  categoryGroups,
  categoryPurposes,
  categoryTargets,
  financialPriorities,
  goals,
  incomeReviews,
  paydayFundingReceipts,
  paydayPlans,
  reviewCompletions,
  transactions,
  upConnections,
  upSourceRecords,
} from '../db/schema.js';
import {
  LIQUID_ACCOUNT_TYPES,
  fundingRevision,
  fundingState,
  receivedActivity,
} from './budgetService.js';
import { BudgetError, fundedWrite } from './budgetMoves.js';
import { mainAmount, personalBudgetAccount } from './balances.js';
import { budgetWithTargets } from './targetService.js';
import { todayIso } from './mainAmountService.js';
import { paydays } from './paydayService.js';
import { paydayConfigSchema } from './paydayConfig.js';
import { TRUE_EXPENSE_TARGETS, measureSpending, reviewState } from './reviewService.js';
import {
  reviewSnapshotSchema,
  type IncomeReviewInput,
  type PrioritiesInput,
  type ReviewSnapshot,
} from './resilienceConfig.js';

// Phase 7: an optional priorities profile (7A), a resilience view that partitions the
// shared funding resources (7B), a resume-after-a-lapse review with reminders (7E), and an
// extra-income split with progress between reviews (7F). Every money figure comes from
// fundingState and the envelope balances; nothing here forecasts or keeps another ledger.
// See docs/RESILIENCE.md.

const PROFILE_ID = 'default';
const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

// ── 7A: priorities ────────────────────────────────────────────────────────────

export function prioritiesState() {
  const row = db.select().from(financialPriorities).get();
  return {
    revision: row?.revision ?? 0,
    purpose: row?.purpose ?? null,
    essentialMonthlyAmount: row?.essentialMonthlyAmount ?? null,
    reserveTarget:
      row?.reserveTargetType === 'amount'
        ? { type: 'amount' as const, amount: row.reserveTargetAmount! }
        : row?.reserveTargetType === 'months'
          ? { type: 'months' as const, months: row.reserveTargetMonths! }
          : null,
    reserveMinimum: row?.reserveMinimum ?? null,
    reviewCadence: (row?.reviewCadence ?? 'off') as PrioritiesInput['reviewCadence'],
    reminderSnoozedUntil: row?.reminderSnoozedUntil ?? null,
    updatedAt: row?.updatedAt ?? null,
    purposes: db
      .select()
      .from(categoryPurposes)
      .all()
      .map((p) => ({ categoryId: p.categoryId, purpose: p.purpose as 'essential' })),
  };
}

/** Why a category cannot take a purpose, or null. Shared with backup restore. */
export function purposeError(
  categoryId: string,
  purpose: string,
  lookup = {
    category: (id: string) => db.select().from(categories).where(eq(categories.id, id)).get(),
    group: (id: string) => db.select().from(categoryGroups).where(eq(categoryGroups.id, id)).get(),
    isCardReserve: (id: string) =>
      !!db.select().from(cardFunding).where(eq(cardFunding.categoryId, id)).get(),
    fundsGoal: (id: string) => !!db.select().from(goals).where(eq(goals.categoryId, id)).get(),
    targetType: (id: string) =>
      db.select().from(categoryTargets).where(eq(categoryTargets.categoryId, id)).get()?.type,
  },
) {
  const category = lookup.category(categoryId);
  const group = category && lookup.group(category.groupId);
  if (!category || !group || group.isIncome) return 'Purposes need an expense category';
  if (lookup.isCardReserve(categoryId)) return 'Card payment reserves cannot take a purpose';
  if (purpose === 'flexibility') {
    if (lookup.fundsGoal(categoryId))
      return `${category.name} funds a goal; choose another category for the flexibility reserve`;
    if (TRUE_EXPENSE_TARGETS.has(lookup.targetType(categoryId) ?? ''))
      return `${category.name} has a date target; a flexibility reserve has no deadline`;
  }
  return null;
}

export function savePriorities(input: PrioritiesInput) {
  return db.transaction(() => {
    const current = db.select().from(financialPriorities).get();
    if ((current?.revision ?? 0) !== input.revision)
      throw new BudgetError('Your priorities changed elsewhere. Reload them before saving.');
    for (const p of input.purposes) {
      const error = purposeError(p.categoryId, p.purpose);
      if (error) throw new BudgetError(error, 400);
    }
    const row = {
      id: PROFILE_ID,
      purpose: input.purpose || null,
      essentialMonthlyAmount: input.essentialMonthlyAmount,
      reserveTargetType: input.reserveTarget?.type ?? null,
      reserveTargetAmount:
        input.reserveTarget?.type === 'amount' ? input.reserveTarget.amount : null,
      reserveTargetMonths:
        input.reserveTarget?.type === 'months' ? input.reserveTarget.months : null,
      reserveMinimum: input.reserveMinimum,
      reviewCadence: input.reviewCadence,
      revision: input.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    db.insert(financialPriorities)
      .values(row)
      .onConflictDoUpdate({ target: financialPriorities.id, set: row })
      .run();
    db.delete(categoryPurposes).run();
    if (input.purposes.length) db.insert(categoryPurposes).values(input.purposes).run();
    return prioritiesState();
  });
}

/** Snoozing a reminder stores a date and nothing else: not a profile edit, no revision. */
export function snoozeReminder(until: string | null) {
  const exists = db.select().from(financialPriorities).get();
  if (!exists)
    db.insert(financialPriorities).values({ id: PROFILE_ID, reminderSnoozedUntil: until }).run();
  else db.update(financialPriorities).set({ reminderSnoozedUntil: until }).run();
  return resumeState();
}

function purposeIds(purpose: string) {
  return new Set(
    db
      .select()
      .from(categoryPurposes)
      .all()
      .filter((p) => p.purpose === purpose)
      .map((p) => p.categoryId),
  );
}

// ── 7B: resilience ────────────────────────────────────────────────────────────

type Bucket = 'card' | 'committed' | 'goals' | 'flexibility' | 'other';

/** Monthly essentials: the user's estimate, or net spending in essential categories over
 * 6F's window (the last three complete months) ÷ 3. Null with a reason when unknown. */
function essentials(today: string, estimate: number | null) {
  if (estimate)
    return { monthly: estimate, source: 'estimate' as const, window: null, reasons: [] };
  const ids = purposeIds('essential');
  if (!ids.size)
    return {
      monthly: null,
      source: 'measured' as const,
      window: null,
      reasons: ['Mark essential categories, or enter a monthly estimate, to measure coverage.'],
    };
  const measured = measureSpending(today, (r) => !!r.categoryId && ids.has(r.categoryId));
  const reasons = [...measured.incomplete];
  if (!reasons.length && measured.total === 0)
    reasons.push('No essential spending in the history; enter a monthly estimate instead.');
  return {
    monthly: reasons.length ? null : Math.round(measured.total / measured.months),
    source: 'measured' as const,
    window: { from: measured.from, to: measured.to, total: measured.total },
    reasons,
  };
}

/** Partitions today's resources by purpose. Each category's positive availability plus its
 * later assignments lands in exactly one bucket, so the buckets, cash already spent beyond
 * envelopes this month (negative) and unassigned money add up to fundingState.resources
 * and nothing is counted twice. */
export function resilienceState(today = todayIso()) {
  const state = fundingState(today);
  const complete = state.complete && state.accountIssues.length === 0;
  const profile = prioritiesState();
  const month = today.slice(0, 7);
  const cats = budgetWithTargets(month, today)
    .filter((g) => !g.isIncome)
    .flatMap((g) => g.categories);
  const flexible = purposeIds('flexibility');
  const goalCategories = new Set(
    db
      .select({ categoryId: goals.categoryId })
      .from(goals)
      .all()
      .map((g) => g.categoryId)
      .filter((id): id is string => !!id),
  );
  const later = new Map<string, number>();
  for (const r of db.select().from(budgetMonths).all())
    if (r.month > month && r.budgeted > 0)
      later.set(r.categoryId, (later.get(r.categoryId) ?? 0) + r.budgeted);

  const bucketOf = (c: (typeof cats)[number]): Bucket =>
    c.paymentAccountId
      ? 'card'
      : TRUE_EXPENSE_TARGETS.has(c.target?.type ?? '')
        ? 'committed'
        : goalCategories.has(c.id)
          ? 'goals'
          : flexible.has(c.id)
            ? 'flexibility'
            : 'other';
  const buckets: Record<Bucket, number> = {
    card: 0,
    committed: 0,
    goals: 0,
    flexibility: 0,
    other: 0,
  };
  for (const c of cats) buckets[bucketOf(c)] += Math.max(0, c.balance) + (later.get(c.id) ?? 0);

  const flexCats = cats.filter((c) => bucketOf(c) === 'flexibility');
  const available = sum(flexCats.map((c) => Math.max(0, c.balance)));
  const future = sum(flexCats.map((c) => later.get(c.id) ?? 0));
  const essential = essentials(today, profile.essentialMonthlyAmount);

  const committedShortfall = sum(
    cats.filter((c) => bucketOf(c) === 'committed').map((c) => c.target?.underfunded ?? 0),
  );
  const unfunded = {
    overspent: state.overspent,
    cardWithoutReserve: state.paymentShortfall + state.uncoveredCardPayments,
    committedShortfall,
    // This month's overspending is negative Available, not yet out of unassigned money
    overAssigned: Math.max(0, -state.unassigned),
  };
  const unfundedTotal = sum(Object.values(unfunded));

  const target =
    profile.reserveTarget?.type === 'amount'
      ? profile.reserveTarget.amount
      : profile.reserveTarget?.type === 'months' && essential.monthly !== null
        ? profile.reserveTarget.months * essential.monthly
        : null;
  const incomplete: string[] = [];
  if (!state.complete) incomplete.push('Some account or transaction exchange rates are missing.');
  for (const issue of state.accountIssues)
    incomplete.push(
      `${issue.accountName}: reconcile the account balance before relying on funding figures.`,
    );
  if (profile.reserveTarget?.type === 'months' && essential.monthly === null)
    incomplete.push('A months-based target needs monthly essentials.');

  const status = !flexCats.length
    ? 'not-set-up'
    : incomplete.length
      ? 'incomplete'
      : profile.reserveMinimum && available < profile.reserveMinimum
        ? 'below-minimum'
        : target !== null && available < target
          ? 'below-target'
          : target !== null
            ? 'on-target'
            : 'no-target';
  return {
    asOf: today,
    month,
    complete: complete,
    status,
    healthy: status === 'on-target' && unfundedTotal === 0,
    resources: complete ? state.resources : null,
    partition: complete
      ? {
          ...buckets,
          overspent: state.cashOverspent ? -state.cashOverspent : 0,
          unassigned: state.unassigned,
        }
      : null,
    flexibility: {
      categories: flexCats.map((c) => ({
        categoryId: c.id,
        name: c.name,
        available: Math.max(0, c.balance),
        later: later.get(c.id) ?? 0,
      })),
      available: complete ? available : null,
      later: future,
      minimum: profile.reserveMinimum,
      minimumGap: profile.reserveMinimum ? Math.max(0, profile.reserveMinimum - available) : null,
      target,
      targetSource: profile.reserveTarget,
      targetGap: target !== null ? Math.max(0, target - available) : null,
    },
    essentials: essential,
    /** Months of essentials in tenths (20 = 2.0 months); null when it cannot be measured. */
    coverageTenths:
      complete && essential.monthly ? Math.floor((available * 10) / essential.monthly) : null,
    unfunded,
    unfundedTotal,
    incomplete,
    assumptions: [
      'Flexibility counts only money available today in your flexibility categories, not the balance of the account it sits in.',
      'Money assigned to later months is reserved now but not counted as coverage.',
      'Investment, retirement, property, off-budget and household pool accounts are not cash; expected pay and money owed to you are not counted.',
      'Coverage is an approximation: the reserve divided by monthly essentials, with no income assumed.',
    ],
  };
}

// ── 7E: resume and reminders ──────────────────────────────────────────────────

function lastCompletion() {
  const row = db
    .select()
    .from(reviewCompletions)
    .all()
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  return row
    ? { ...row, snapshot: reviewSnapshotSchema.parse(JSON.parse(row.snapshotJson)) }
    : null;
}

const plusMonths = (date: string, months: number) =>
  format(addMonths(parseISO(date), months), 'yyyy-MM-dd');

function reminderState(today: string, last: ReturnType<typeof lastCompletion>) {
  const profile = prioritiesState();
  if (profile.reviewCadence === 'off') return null;
  let dueSince: string | null = null;
  if (!last) dueSince = today;
  else if (profile.reviewCadence === 'monthly') dueSince = plusMonths(last.asOf, 1);
  else if (profile.reviewCadence === 'quarterly') dueSince = plusMonths(last.asOf, 3);
  else {
    // After a payday that came after the last review
    const dates: string[] = [];
    for (const row of db.select().from(paydayPlans).where(eq(paydayPlans.archived, 0)).all()) {
      const plan = paydayConfigSchema.parse(JSON.parse(row.configJson));
      const next = paydays(plan, last.asOf, plusMonths(last.asOf, 2)).find(
        (p) => p.expectedDate > last.asOf,
      );
      if (next) dates.push(next.expectedDate);
    }
    dueSince = dates.sort()[0] ?? null;
  }
  const snoozed = !!profile.reminderSnoozedUntil && profile.reminderSnoozedUntil >= today;
  return {
    cadence: profile.reviewCadence,
    dueSince,
    due: !!dueSince && dueSince <= today && !snoozed,
    snoozedUntil: snoozed ? profile.reminderSnoozedUntil : null,
  };
}

function flexibilityAssigned(ids: Set<string>, through: string) {
  return sum(
    db
      .select()
      .from(budgetMonths)
      .all()
      .filter((r) => ids.has(r.categoryId) && r.month <= through)
      .map((r) => r.budgeted),
  );
}

function snapshot(today: string): ReviewSnapshot {
  const resilience = resilienceState(today);
  const ids = new Set(resilience.flexibility.categories.map((c) => c.categoryId));
  return {
    complete: resilience.complete,
    resolved: reviewState(today).resolved,
    flexibilityIds: [...ids].sort(),
    flexibilityAvailable: resilience.flexibility.available ?? 0,
    flexibilityAssigned: flexibilityAssigned(ids, today.slice(0, 7)),
    essentialsMonthly: resilience.essentials.monthly,
    unfunded: resilience.unfundedTotal,
  };
}

/** Progress since the last review (7F): the reserve's change split into assignments in and
 * net spending from it, and the change in unfunded obligations. */
function sinceLastReview(today: string, last: NonNullable<ReturnType<typeof lastCompletion>>) {
  const now = snapshot(today);
  const ids = new Set(now.flexibilityIds);
  if (JSON.stringify(now.flexibilityIds) !== JSON.stringify(last.snapshot.flexibilityIds))
    return {
      comparable: false as const,
      reason:
        'Your flexibility categories changed since the last review, so the reserve is not compared.',
      unfundedChange: now.unfunded - last.snapshot.unfunded,
    };
  const activity = sum(
    db
      .select({ categoryId: transactions.categoryId, amount: mainAmount, date: transactions.date })
      .from(transactions)
      .where(and(receivedActivity, gt(transactions.date, last.asOf), lte(transactions.date, today)))
      .all()
      .filter((r) => r.categoryId && ids.has(r.categoryId))
      .map((r) => r.amount),
  );
  const assignedIn = now.flexibilityAssigned - last.snapshot.flexibilityAssigned;
  const change = now.flexibilityAvailable - last.snapshot.flexibilityAvailable;
  return {
    comparable: true as const,
    reserveChange: change,
    assignedIn,
    /** Net spending from the reserve (refunds reduce it); planned use is not a failure. */
    reserveUse: Math.max(0, -activity),
    refunds: Math.max(0, activity),
    /** Non-zero when a reserve category went below zero, which is overspending, not reserve. */
    unexplained: change - assignedIn - activity,
    unfundedChange: now.unfunded - last.snapshot.unfunded,
  };
}

export function resumeState(today = todayIso()) {
  const last = lastCompletion();
  const review = reviewState(today);
  const since = last?.asOf ?? null;
  const transactionsSince = since
    ? db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            isNull(transactions.parentTransactionId),
            gt(transactions.date, since),
            lte(transactions.date, today),
          ),
        )
        .all().length
    : null;
  const unreconciledAccounts = db
    .select()
    .from(accounts)
    .where(personalBudgetAccount)
    .all()
    .filter((a) => !a.closedAt && LIQUID_ACCOUNT_TYPES.includes(a.type))
    .filter(
      (a) =>
        !!db
          .select({ id: transactions.id })
          .from(transactions)
          .where(
            and(
              eq(transactions.accountId, a.id),
              eq(transactions.reconciled, 0),
              lte(transactions.date, today),
            ),
          )
          .limit(1)
          .get(),
    ).length;
  const up = db.select().from(upConnections).get();
  const bankItems = up
    ? db
        .select({ id: upSourceRecords.importedId })
        .from(upSourceRecords)
        .where(inArray(upSourceRecords.reviewState, ['new', 'changed', 'missing', 'overlap']))
        .all().length
    : null;
  return {
    asOf: today,
    lastReview: last ? { completedAt: last.completedAt, asOf: last.asOf } : null,
    daysSince: since
      ? Math.round((parseISO(today).getTime() - parseISO(since).getTime()) / 86_400_000)
      : null,
    transactionsSince,
    uncategorisedCount: review.uncategorisedCount,
    unreconciledAccounts,
    bank: up ? { lastSyncedAt: up.lastSyncedAt, itemsToReview: bankItems } : null,
    complete: review.complete,
    resolved: review.resolved,
    reminder: reminderState(today, last),
    progress: last ? sinceLastReview(today, last) : null,
  };
}

/** Records that the user reviewed today. It reconciles nothing, acknowledges no bank item and
 * moves no money; it only stores what the review saw, for the next comparison. */
export function completeReview(today = todayIso()) {
  const row = {
    id: nanoid(),
    completedAt: new Date().toISOString(),
    asOf: today,
    snapshotJson: JSON.stringify(snapshot(today)),
  };
  db.insert(reviewCompletions).values(row).run();
  return resumeState(today);
}

// ── 7F: extra income ──────────────────────────────────────────────────────────

export function previewIncomeReview(input: IncomeReviewInput, today = todayIso()) {
  const tx = db
    .select({
      id: transactions.id,
      date: transactions.date,
      payee: transactions.payeeName,
      categoryId: transactions.categoryId,
      amount: mainAmount,
      source: transactions.mainAmountSource,
    })
    .from(transactions)
    .where(and(receivedActivity, eq(transactions.id, input.transactionId)))
    .get();
  const incomeCategory = !tx?.categoryId
    ? null
    : db
        .select({ isIncome: categoryGroups.isIncome })
        .from(categories)
        .innerJoin(categoryGroups, eq(categoryGroups.id, categories.groupId))
        .where(eq(categories.id, tx.categoryId))
        .get();
  if (!tx || !incomeCategory?.isIncome || tx.amount <= 0 || tx.date > today)
    throw new BudgetError('Choose a received deposit in an income category', 400);
  if (tx.source === 'missing') throw new BudgetError('Add the missing exchange rate first');
  if (db.select().from(incomeReviews).where(eq(incomeReviews.transactionId, tx.id)).get())
    throw new BudgetError('This deposit was already distributed');
  if (
    db
      .select()
      .from(paydayFundingReceipts)
      .where(eq(paydayFundingReceipts.transactionId, tx.id))
      .get()
  )
    throw new BudgetError('This deposit was used by a payday plan');
  if (!purposeIds('flexibility').has(input.categoryId))
    throw new BudgetError('Choose a flexibility reserve category', 400);
  const state = fundingState(today);
  const extra = Math.max(0, tx.amount - input.baseline);
  const share = Math.floor((extra * input.reservePercent) / 100);
  const proposed = Math.min(share, state.available);
  return {
    transaction: { id: tx.id, date: tx.date, payee: tx.payee, amount: tx.amount },
    month: today.slice(0, 7),
    baseline: input.baseline,
    extra,
    reservePercent: input.reservePercent,
    categoryId: input.categoryId,
    share,
    proposed,
    shortfall: share - proposed,
    remainsUnassigned: Math.max(0, state.available - proposed),
    complete: state.complete,
    revision: fundingRevision(),
  };
}

export function applyIncomeReview(
  input: IncomeReviewInput,
  expected: { revision: string; proposed: number },
  today = todayIso(),
) {
  let result: ReturnType<typeof previewIncomeReview> | null = null;
  fundedWrite(() => {
    const preview = previewIncomeReview(input, today);
    if (preview.revision !== expected.revision || preview.proposed !== expected.proposed)
      throw new BudgetError('Your budget changed. Review the split again.');
    if (!preview.complete)
      throw new BudgetError('Add missing exchange rates before assigning money.');
    db.insert(incomeReviews)
      .values({
        id: nanoid(),
        transactionId: input.transactionId,
        month: preview.month,
        categoryId: input.categoryId,
        received: preview.transaction.amount,
        baseline: input.baseline,
        reservePercent: input.reservePercent,
        assigned: preview.proposed,
        createdAt: new Date().toISOString(),
      })
      .run();
    if (preview.proposed > 0) {
      const existing = db
        .select()
        .from(budgetMonths)
        .where(
          and(eq(budgetMonths.month, preview.month), eq(budgetMonths.categoryId, input.categoryId)),
        )
        .get();
      const budgeted = (existing?.budgeted ?? 0) + preview.proposed;
      db.insert(budgetMonths)
        .values({ id: nanoid(), month: preview.month, categoryId: input.categoryId, budgeted })
        .onConflictDoUpdate({
          target: [budgetMonths.month, budgetMonths.categoryId],
          set: { budgeted },
        })
        .run();
    }
    result = preview;
  });
  return { ...result!, applied: true, revision: fundingRevision() };
}

/** Recent received income deposits that neither a payday plan nor an income review used. */
export function incomeCandidates(today = todayIso()) {
  const used = new Set([
    ...db
      .select()
      .from(incomeReviews)
      .all()
      .map((r) => r.transactionId),
    ...db
      .select()
      .from(paydayFundingReceipts)
      .all()
      .map((r) => r.transactionId),
  ]);
  const incomeIds = new Set(
    db
      .select({ id: categories.id })
      .from(categories)
      .innerJoin(categoryGroups, eq(categoryGroups.id, categories.groupId))
      .where(eq(categoryGroups.isIncome, 1))
      .all()
      .map((c) => c.id),
  );
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      payee: transactions.payeeName,
      categoryId: transactions.categoryId,
      amount: mainAmount,
    })
    .from(transactions)
    .where(and(receivedActivity, lte(transactions.date, today)))
    .all()
    .filter((t) => t.categoryId && incomeIds.has(t.categoryId) && t.amount > 0 && !used.has(t.id))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .slice(0, 50);
}
