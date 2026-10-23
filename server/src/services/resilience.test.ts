import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  budgetMoves,
  budgetSettings,
  categories,
  categoryGroups,
  categoryPurposes,
  categoryTargets,
  financialPriorities,
  goals,
  goalStatusEvents,
  incomeReviews,
  paydayFundingEvents,
  paydayFundingReceipts,
  paydayPlans,
  reviewCompletions,
  transactions,
} from '../db/schema.js';
import { fundingRevision, fundingState } from './budgetService.js';
import { applyMove, previewMove } from './budgetMoves.js';
import { previewTargetFunding, saveTarget } from './targetService.js';
import { incomeOptions, previewPayday } from './paydayService.js';
import { reviewState, bufferState } from './reviewService.js';
import { ratesChanged } from './mainAmountService.js';
import {
  applyIncomeReview,
  completeReview,
  incomeCandidates,
  prioritiesState,
  previewIncomeReview,
  resilienceState,
  resumeState,
  savePriorities,
  snoozeReminder,
} from './resilienceService.js';
import { prioritiesSchema } from './resilienceConfig.js';
import { changeGoalStatus, goalHistory } from './goalLifecycle.js';
import { createBackup, parseBackup, restoreBackup } from './backupService.js';
import { prioritiesRouter } from '../routes/priorities.js';
import { reviewRouter } from '../routes/review.js';
import { goalsRouter } from '../routes/goals.js';

// Synthetic budget only. "Today" is 21 October 2026. July–September are the three complete
// months behind the essentials average: $3,000 of food a month, each month fully funded.
const MONTH = '2026-10';
const assign = (categoryId: string, budgeted: number, month = MONTH) =>
  db
    .insert(budgetMonths)
    .values({ id: `${categoryId}:${month}`, categoryId, month, budgeted })
    .onConflictDoUpdate({
      target: [budgetMonths.month, budgetMonths.categoryId],
      set: { budgeted },
    })
    .run();
let n = 0;
const tx = (date: string, amount: number, categoryId: string | null, extra = {}) => {
  const id = `t${++n}`;
  db.insert(transactions)
    .values({ id, accountId: 'cash', date, amount, categoryId, ...extra })
    .run();
  return id;
};
const profile = (input: Record<string, unknown> = {}) =>
  savePriorities(prioritiesSchema.parse({ revision: prioritiesState().revision, ...input }));
const flex = (extra: Record<string, unknown> = {}) =>
  profile({
    purposes: [
      { categoryId: 'rainy', purpose: 'flexibility' },
      { categoryId: 'food', purpose: 'essential' },
    ],
    ...extra,
  });
const goal = (id: string, categoryId: string | null, extra = {}) => {
  db.insert(goals)
    .values({ id, name: id, targetAmount: 500000, categoryId, ...extra })
    .run();
  return db.select().from(goals).where(eq(goals.id, id)).get()!;
};

let server: Server, url: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
  const app = express();
  app.use(express.json());
  app.use('/priorities', prioritiesRouter);
  app.use('/review', reviewRouter);
  app.use('/goals', goalsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  vi.useRealTimers();
  server.close();
});
beforeEach(() => {
  for (const table of [
    incomeReviews,
    reviewCompletions,
    goalStatusEvents,
    goals,
    budgetMoves,
    categoryPurposes,
    financialPriorities,
    categoryTargets,
    paydayFundingReceipts,
    paydayFundingEvents,
    paydayPlans,
    transactions,
    budgetMonths,
    categories,
    categoryGroups,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
  ratesChanged();
  db.insert(accounts)
    .values([
      {
        id: 'cash',
        name: 'Everyday',
        type: 'checking',
        startingBalance: 2_100_000,
        createdAt: '2026-06-01',
      },
      {
        id: 'savings',
        name: 'Saver',
        type: 'savings',
        startingBalance: 0,
        createdAt: '2026-06-01',
      },
    ])
    .run();
  db.insert(categoryGroups)
    .values([
      { id: 'income', name: 'Income', isIncome: 1 },
      { id: 'needs', name: 'Needs', sortOrder: 1 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'salary', name: 'Pay', groupId: 'income' },
      { id: 'food', name: 'Food', groupId: 'needs' },
      { id: 'bills', name: 'Bills', groupId: 'needs' },
      { id: 'annual', name: 'Annual', groupId: 'needs' },
      { id: 'rainy', name: 'Rainy day', groupId: 'needs' },
      { id: 'holiday', name: 'Holiday', groupId: 'needs' },
      { id: 'car', name: 'Car', groupId: 'needs' },
    ])
    .run();
  for (const m of ['07', '08', '09']) {
    assign('food', 300_000, `2026-${m}`);
    tx(`2026-${m}-15`, -300_000, 'food');
  }
  // $12,000 of resources: $4,000 committed bills, $2,000 annual reserves, $6,000 flexibility.
  saveTarget('bills', {
    type: 'recurring',
    amount: 400_000,
    dueDate: '2026-11-01',
    cycleMonths: 1,
  });
  saveTarget('annual', { type: 'by-date', amount: 200_000, dueDate: '2027-06-30' });
  assign('bills', 400_000);
  assign('annual', 200_000);
  assign('rainy', 600_000);
});

describe('7A priorities', () => {
  it('changes nothing until set up, and a target changes only the gap', () => {
    const before = { review: reviewState(), funding: fundingState(), buffer: bufferState() };
    expect(resilienceState().status).toBe('not-set-up');
    flex({ reserveTarget: { type: 'amount', amount: 900_000 } });
    expect(fundingState()).toEqual(before.funding);
    expect(reviewState()).toEqual(before.review);
    expect(resilienceState().flexibility).toMatchObject({ available: 600_000, targetGap: 300_000 });
    profile({
      purposes: prioritiesState().purposes,
      reserveTarget: { type: 'amount', amount: 700_000 },
    });
    expect(resilienceState().flexibility).toMatchObject({ available: 600_000, targetGap: 100_000 });
    expect(fundingState().resources).toBe(before.funding.resources);
  });

  it('refuses a stale save without changing the stored profile', () => {
    flex({ purpose: 'Career flexibility' });
    expect(() =>
      savePriorities(prioritiesSchema.parse({ revision: 0, purpose: 'Something else' })),
    ).toThrow(/changed elsewhere/);
    expect(prioritiesState()).toMatchObject({ revision: 1, purpose: 'Career flexibility' });
  });

  it('rejects purposes that would blur funding definitions', () => {
    expect(() => profile({ purposes: [{ categoryId: 'salary', purpose: 'essential' }] })).toThrow(
      /expense category/,
    );
    expect(() => profile({ purposes: [{ categoryId: 'annual', purpose: 'flexibility' }] })).toThrow(
      /no deadline/,
    );
    goal('trip', 'holiday');
    expect(() =>
      profile({ purposes: [{ categoryId: 'holiday', purpose: 'flexibility' }] }),
    ).toThrow(/funds a goal/);
    flex();
    expect(() =>
      saveTarget('rainy', { type: 'by-date', amount: 100_000, dueDate: '2027-01-31' }),
    ).toThrow(/no deadline/);
    expect(() => saveTarget('rainy', { type: 'refill', amount: 600_000 })).not.toThrow();
  });

  it('serves the profile over HTTP with revision checks', async () => {
    const put = (body: unknown) =>
      fetch(`${url}/priorities`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await put({ revision: 0, reviewCadence: 'monthly' })).status).toBe(200);
    expect((await put({ revision: 0, reviewCadence: 'off' })).status).toBe(409);
    expect((await put({ revision: 1, reviewCadence: 'weekly' })).status).toBe(400);
    expect(await (await fetch(`${url}/priorities`)).json()).toMatchObject({
      revision: 1,
      reviewCadence: 'monthly',
    });
  });
});

describe('7B resilience', () => {
  it('partitions resources once and estimates coverage from essentials', () => {
    flex();
    const r = resilienceState();
    expect(r.resources).toBe(1_200_000);
    expect(r.partition).toEqual({
      card: 0,
      committed: 600_000,
      goals: 0,
      flexibility: 600_000,
      other: 0,
      unassigned: 0,
    });
    const { unassigned, ...buckets } = r.partition!;
    expect(Object.values(buckets).reduce((s, v) => s + v, 0) + unassigned).toBe(r.resources);
    expect(r.essentials).toMatchObject({ monthly: 300_000, source: 'measured' });
    expect(r.coverageTenths).toBe(20);
    expect(r.status).toBe('no-target');
  });

  it('follows money moves, not bank location', () => {
    flex();
    applyMove(
      MONTH,
      { sourceId: 'rainy', destinationId: 'holiday', amount: 100_000 },
      fundingRevision(),
    );
    expect(resilienceState().flexibility.available).toBe(500_000);
    const out = tx('2026-10-20', -100_000, null, { transferTransactionId: 'pair' });
    db.insert(transactions)
      .values({
        id: 'pair',
        accountId: 'savings',
        date: '2026-10-20',
        amount: 100_000,
        transferTransactionId: out,
      })
      .run();
    expect(resilienceState().flexibility.available).toBe(500_000);
    expect(resilienceState().resources).toBe(1_200_000);
  });

  it('never counts retirement assets, off-budget money or credit as reserve', () => {
    flex();
    const before = resilienceState();
    db.insert(accounts)
      .values([
        {
          id: 'super',
          name: 'Super',
          type: 'retirement',
          isOffBudget: 1,
          startingBalance: 9_000_000,
        },
        { id: 'shares', name: 'Shares', type: 'investment', startingBalance: 500_000 },
      ])
      .run();
    const after = resilienceState();
    expect(after.flexibility.available).toBe(before.flexibility.available);
    expect(after.coverageTenths).toBe(before.coverageTenths);
  });

  it('shows a gap below the minimum and warns on the move without blocking it', () => {
    flex({ reserveMinimum: 100_000 });
    assign('rainy', 80_000);
    assign('holiday', 520_000);
    const r = resilienceState();
    expect(r.status).toBe('below-minimum');
    expect(r.flexibility.minimumGap).toBe(20_000);
    assign('rainy', 120_000);
    assign('holiday', 480_000);
    const preview = previewMove(MONTH, { sourceId: 'rainy', destinationId: 'car', amount: 50_000 });
    expect(preview.reserveNotice).toMatchObject({ minimum: 100_000, belowBy: 30_000 });
    expect(() =>
      applyMove(
        MONTH,
        { sourceId: 'rainy', destinationId: 'car', amount: 50_000 },
        preview.revision,
      ),
    ).not.toThrow();
    expect(resilienceState().flexibility.available).toBe(70_000);
  });

  it('is healthy only on target, complete and with nothing unfunded', () => {
    flex({ reserveTarget: { type: 'months', months: 2 } });
    expect(resilienceState()).toMatchObject({ status: 'on-target', healthy: true });
    tx('2026-10-10', -5_000, 'car');
    expect(resilienceState()).toMatchObject({
      status: 'on-target',
      healthy: false,
      unfundedTotal: 5_000,
    });
    db.update(accounts).set({ currency: 'NZD' }).where(eq(accounts.id, 'savings')).run();
    db.insert(budgetSettings).values({ id: 'settings', currency: 'AUD' }).run();
    ratesChanged();
    expect(resilienceState()).toMatchObject({ status: 'incomplete', healthy: false });
  });

  it('reports coverage as unavailable, never infinite, without essentials', () => {
    profile({ purposes: [{ categoryId: 'rainy', purpose: 'flexibility' }] });
    expect(resilienceState()).toMatchObject({ coverageTenths: null });
    expect(resilienceState().essentials.reasons[0]).toMatch(/Mark essential categories/);
    profile({
      purposes: prioritiesState().purposes,
      essentialMonthlyAmount: 400_000,
      reserveTarget: { type: 'months', months: 1 },
    });
    expect(resilienceState()).toMatchObject({
      coverageTenths: 15,
      status: 'on-target',
      essentials: { source: 'estimate', monthly: 400_000 },
    });
  });
});

describe('7D goal lifecycle', () => {
  beforeEach(() => saveTarget('car', { type: 'by-date', amount: 500_000, dueDate: '2027-03-31' }));
  const change = (id: string, body: Record<string, unknown>) =>
    changeGoalStatus(id, {
      reason: null,
      replacementGoalId: null,
      move: null,
      expectedUpdatedAt: db.select().from(goals).where(eq(goals.id, id)).get()!.updatedAt,
      ...body,
    } as never);

  it('keeps funding but stops suggestions while paused', () => {
    goal('car-goal', 'car');
    assign('rainy', 0);
    assign('car', 80_000);
    expect(previewTargetFunding(MONTH).rows.map((r) => r.categoryId)).toContain('car');
    change('car-goal', { status: 'paused', reason: 'Saving for a house first' });
    expect(fundingState().balances.get('car')).toBe(80_000);
    expect(previewTargetFunding(MONTH).rows.map((r) => r.categoryId)).not.toContain('car');
    expect(reviewState().targetShortfalls.map((t) => t.categoryId)).not.toContain('car');
    expect(bufferState().nextNeeds.map((t) => t.categoryId)).not.toContain('car');
    change('car-goal', { status: 'active' });
    expect(previewTargetFunding(MONTH).rows.map((r) => r.categoryId)).toContain('car');
  });

  it('proposes nothing from payday rules for a goal that is not active', () => {
    goal('car-goal', 'car');
    db.insert(paydayPlans)
      .values({
        id: 'plan',
        configJson: JSON.stringify({
          name: 'Work',
          anchorDate: '2026-10-15',
          expectedIncome: 300_000,
          weekendAdjust: 'none',
          timeZone: 'Australia/Sydney',
          rules: [
            { categoryId: 'car', method: 'fixed', amount: 50_000, dueDate: null, percent: 0 },
          ],
        }),
      })
      .run();
    const pay = tx('2026-10-15', 300_000, 'salary');
    const preview = () =>
      previewPayday('plan', {
        scheduledDate: '2026-10-15',
        actualPayDate: '2026-10-15',
        incomeIds: [pay],
      }).rows.find((r) => r.categoryId === 'car')!;
    expect(preview()).toMatchObject({ needed: 50_000, goalInactive: false });
    change('car-goal', { status: 'retired' });
    expect(preview()).toMatchObject({ needed: 0, allocated: 0, goalInactive: true });
  });

  it('retires and moves money in one action, with resources unchanged', () => {
    flex();
    goal('car-goal', 'car');
    assign('rainy', 0);
    assign('car', 80_000);
    assign('holiday', 520_000);
    const resources = fundingState().resources;
    const { move } = change('car-goal', {
      status: 'retired',
      move: { destinationId: 'rainy', amount: 50_000, revision: fundingRevision() },
    });
    expect(move).toMatchObject({ sourceId: 'car', destinationId: 'rainy', amount: 50_000 });
    expect(fundingState().balances.get('car')).toBe(30_000);
    expect(resilienceState().flexibility.available).toBe(50_000);
    expect(fundingState().resources).toBe(resources);
    expect(goalHistory('car-goal')).toMatchObject([
      { fromStatus: 'active', toStatus: 'retired', moveId: move!.id },
    ]);
  });

  it('rejects a stale budget or goal edit with no partial change', () => {
    goal('car-goal', 'car');
    assign('car', 80_000);
    const stale = fundingRevision();
    assign('holiday', 1);
    expect(() =>
      change('car-goal', {
        status: 'retired',
        move: { destinationId: 'rainy', amount: 50_000, revision: stale },
      }),
    ).toThrow(/budget changed/);
    expect(() =>
      changeGoalStatus('car-goal', {
        status: 'paused',
        reason: null,
        replacementGoalId: null,
        move: null,
        expectedUpdatedAt: 'old',
      }),
    ).toThrow(/goal changed/);
    expect(db.select().from(goals).get()!.status).toBe('active');
    expect(fundingState().balances.get('car')).toBe(80_000);
    expect(goalHistory('car-goal')).toEqual([]);
  });

  it('links a replacement that cannot claim the same money', () => {
    goal('car-goal', 'car');
    goal('bike', null);
    expect(() => change('car-goal', { status: 'retired', replacementGoalId: 'car-goal' })).toThrow(
      /another goal/,
    );
    change('car-goal', { status: 'retired', replacementGoalId: 'bike' });
    expect(db.select().from(goals).where(eq(goals.id, 'car-goal')).get()).toMatchObject({
      status: 'retired',
      replacedByGoalId: 'bike',
    });
    expect(() =>
      db.update(goals).set({ categoryId: 'car' }).where(eq(goals.id, 'bike')).run(),
    ).toThrow();
  });

  it('serves status changes over HTTP and survives backup and restore', async () => {
    const g = goal('car-goal', 'car');
    const res = await fetch(`${url}/goals/car-goal/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'paused', expectedUpdatedAt: g.updatedAt }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).goal).toMatchObject({ status: 'paused' });
    flex();
    completeReview();
    const backup = createBackup();
    expect(backup.version).toBe(14);
    db.delete(goals).run();
    restoreBackup(parseBackup(JSON.parse(JSON.stringify(backup))));
    expect(db.select().from(goals).get()).toMatchObject({ status: 'paused' });
    expect(goalHistory('car-goal')).toHaveLength(1);
    expect(prioritiesState().purposes).toHaveLength(2);
    expect(resumeState().lastReview).not.toBeNull();
  });

  it('restores older backups with active goals and rejects invalid phase 7 rows', () => {
    goal('car-goal', 'car');
    const backup = createBackup() as Record<string, unknown>;
    const legacy = JSON.parse(JSON.stringify(backup));
    legacy.version = 10;
    for (const g of legacy.goals) for (const k of ['status', 'statusReason']) delete g[k];
    for (const t of ['goalStatusEvents', 'financialPriorities', 'categoryPurposes'])
      delete legacy[t];
    restoreBackup(parseBackup(legacy));
    expect(db.select().from(goals).get()!.status).toBe('active');
    const bad = JSON.parse(JSON.stringify(backup));
    bad.goals[0].status = 'abandoned';
    expect(() => parseBackup(bad)).toThrow(/goal status/);
    const purpose = JSON.parse(JSON.stringify(backup));
    purpose.categoryPurposes = [{ categoryId: 'annual', purpose: 'flexibility' }];
    expect(() => parseBackup(purpose)).toThrow(/category purpose/);
  });
});

describe('7E resume and reminders', () => {
  it('summarises what changed since the last review without changing anything', () => {
    flex({ reviewCadence: 'monthly' });
    expect(resumeState()).toMatchObject({ lastReview: null, reminder: { due: true } });
    vi.setSystemTime(new Date('2026-09-05T02:00:00Z'));
    const revision = fundingRevision().split(':')[1];
    completeReview();
    expect(fundingRevision().split(':')[1]).toBe(revision);
    vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
    tx('2026-10-01', -2_000, null);
    const resume = resumeState();
    expect(resume).toMatchObject({
      lastReview: { asOf: '2026-09-05' },
      daysSince: 46,
      uncategorisedCount: 1,
      reminder: { due: true, dueSince: '2026-10-05' },
    });
    expect(resume.transactionsSince).toBe(2);
  });

  it('snoozes the reminder and changes nothing else', () => {
    flex({ reviewCadence: 'quarterly' });
    const before = fundingState();
    snoozeReminder('2026-10-28');
    expect(resumeState().reminder).toMatchObject({ due: false, snoozedUntil: '2026-10-28' });
    expect(fundingState()).toEqual(before);
    expect(prioritiesState().revision).toBe(1);
    vi.setSystemTime(new Date('2026-10-29T02:00:00Z'));
    expect(resumeState().reminder).toMatchObject({ due: true });
    vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
    completeReview();
    expect(resumeState().reminder).toMatchObject({ due: false, dueSince: '2027-01-21' });
  });
});

describe('7F extra income and progress', () => {
  const split = { baseline: 200_000, reservePercent: 50, categoryId: 'rainy' };

  it('previews the reserve share of a raise and applies it once', () => {
    flex();
    const deposit = tx('2026-10-15', 220_000, 'salary');
    const preview = previewIncomeReview({ transactionId: deposit, ...split });
    expect(preview).toMatchObject({ extra: 20_000, share: 10_000, proposed: 10_000 });
    expect(fundingState().balances.get('rainy')).toBe(600_000);
    applyIncomeReview({ transactionId: deposit, ...split }, preview);
    expect(fundingState().balances.get('rainy')).toBe(610_000);
    expect(() =>
      applyIncomeReview(
        { transactionId: deposit, ...split },
        { ...preview, revision: fundingRevision() },
      ),
    ).toThrow(/already distributed/);
    expect(incomeOptions('2026-10-21').map((r) => r.id)).not.toContain(deposit);
    expect(incomeCandidates().map((r) => r.id)).not.toContain(deposit);
  });

  it('refuses transfers, payday-used deposits and stale previews', () => {
    flex();
    const transfer = tx('2026-10-15', 100_000, null);
    expect(() => previewIncomeReview({ transactionId: transfer, ...split })).toThrow(
      /income category/,
    );
    expect(incomeCandidates().map((r) => r.id)).not.toContain(transfer);
    const deposit = tx('2026-10-16', 220_000, 'salary');
    const preview = previewIncomeReview({ transactionId: deposit, ...split });
    assign('holiday', 1);
    expect(() => applyIncomeReview({ transactionId: deposit, ...split }, preview)).toThrow(
      /changed/,
    );
    expect(db.select().from(incomeReviews).all()).toEqual([]);
  });

  it('compares the reserve with the last review, separating use from assignments', () => {
    flex();
    vi.setSystemTime(new Date('2026-10-01T02:00:00Z'));
    completeReview();
    vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
    assign('rainy', 650_000);
    tx('2026-10-12', -120_000, 'rainy');
    tx('2026-10-14', 20_000, 'rainy');
    expect(resumeState().progress).toMatchObject({
      comparable: true,
      reserveChange: -50_000,
      assignedIn: 50_000,
      reserveUse: 100_000,
      unexplained: 0,
    });
    db.insert(accounts)
      .values({
        id: 'super',
        name: 'Super',
        type: 'retirement',
        isOffBudget: 1,
        startingBalance: 1,
      })
      .run();
    expect(resumeState().progress).toMatchObject({ reserveChange: -50_000 });
  });
});
