/**
 * Saved long-term forecast plans (docs/LONG-TERM-FORECAST.md §14). A plan is saved as one
 * unit in one transaction: its settings, events, per-account choices and savings splits. A
 * save or delete names the version it started from and is refused (409, nothing written)
 * when another device changed it since, exactly like saved cash-forecast scenarios.
 *
 * Nothing here touches the ledger: it never reads or writes transactions, schedules, goals,
 * assignments or account balances, and deleting a plan deletes only the plan.
 */
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accounts,
  longTermAccountAssumptions,
  longTermEvents,
  longTermPlans,
  longTermSplits,
} from '../db/schema.js';
import { ForecastError } from './forecastService.js';
import {
  eventSchema,
  MAX_PLANS,
  planSchema,
  settingsSchema,
  type PlanInput,
} from './longTermConfig.js';
import { isLiabilityType } from '../utils/accountTypes.js';

export interface SavedPlan {
  id: string;
  version: number;
  sortOrder: number;
  updatedAt: string;
  plan: PlanInput;
}

export interface PlanSummary {
  id: string;
  name: string;
  version: number;
  sortOrder: number;
  updatedAt: string;
  eventCount: number;
}

/** Refused because the saved copy changed; carries it so the client can show or reload it */
export class PlanConflict extends ForecastError {
  constructor(public current: SavedPlan | null) {
    super(
      current
        ? `"${current.plan.name}" was changed on another device`
        : 'This plan was deleted on another device',
      409,
    );
  }
}

type PlanRow = typeof longTermPlans.$inferSelect;

function load(row: PlanRow): SavedPlan {
  const events = db
    .select()
    .from(longTermEvents)
    .where(eq(longTermEvents.planId, row.id))
    .orderBy(asc(longTermEvents.position))
    .all();
  const assumptions = db
    .select()
    .from(longTermAccountAssumptions)
    .where(eq(longTermAccountAssumptions.planId, row.id))
    .all();
  const splits = db
    .select()
    .from(longTermSplits)
    .where(eq(longTermSplits.planId, row.id))
    .orderBy(asc(longTermSplits.position))
    .all();
  return {
    id: row.id,
    version: row.version,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
    // Older saves get any assumption added since at its default
    plan: planSchema.parse({
      name: row.name,
      settings: settingsSchema.parse(JSON.parse(row.settingsJson)),
      accounts: assumptions.map((a) => ({
        accountId: a.accountId,
        included: a.included === 1,
        cls: a.cls,
        growthBps: a.growthBps,
      })),
      splits: splits.map((s) => ({
        accountId: s.accountId,
        mode: s.mode,
        ...(s.bps !== null ? { bps: s.bps } : {}),
        ...(s.amount !== null ? { amount: s.amount } : {}),
      })),
      events: events.map((e) =>
        eventSchema.parse({
          ...JSON.parse(e.paramsJson),
          id: e.id,
          kind: e.kind,
          name: e.name,
          enabled: e.enabled === 1,
        }),
      ),
    }),
  };
}

const rowById = (id: string) =>
  db.select().from(longTermPlans).where(eq(longTermPlans.id, id)).get();

function assertNameFree(name: string, exceptId?: string) {
  const clash = db
    .select({ id: longTermPlans.id })
    .from(longTermPlans)
    .where(sql`${longTermPlans.name} = ${name} COLLATE NOCASE`)
    .get();
  if (clash && clash.id !== exceptId)
    throw new ForecastError(`A plan is already called "${name}"`, 409);
}

/** Every account a plan names must exist, and a pay-off must name a loan */
function assertReferences(plan: PlanInput) {
  const wanted = new Set<string>([
    ...plan.accounts.map((a) => a.accountId),
    ...plan.splits.map((s) => s.accountId),
  ]);
  const loans = plan.events.flatMap((e) => (e.kind === 'payOff' ? [e.loanId] : []));
  const ids = [...new Set([...wanted, ...loans])];
  const found = ids.length
    ? db
        .select({ id: accounts.id, type: accounts.type })
        .from(accounts)
        .where(inArray(accounts.id, ids))
        .all()
    : [];
  const byId = new Map(found.map((a) => [a.id, a.type]));
  for (const id of wanted) {
    if (!byId.has(id)) throw new ForecastError('A plan names an account that does not exist', 400);
  }
  for (const id of loans) {
    const type = byId.get(id);
    if (type === undefined || !isLiabilityType(type))
      throw new ForecastError('A pay-off must name a loan or other debt account', 400);
  }
}

function writeChildren(tx: Pick<typeof db, 'insert' | 'delete'>, id: string, plan: PlanInput) {
  tx.delete(longTermEvents).where(eq(longTermEvents.planId, id)).run();
  tx.delete(longTermAccountAssumptions).where(eq(longTermAccountAssumptions.planId, id)).run();
  tx.delete(longTermSplits).where(eq(longTermSplits.planId, id)).run();
  plan.events.forEach((event, position) => {
    const { id: eventId, kind, name, enabled, ...params } = event;
    tx.insert(longTermEvents)
      .values({
        planId: id,
        id: eventId,
        kind,
        name,
        position,
        enabled: enabled ? 1 : 0,
        paramsJson: JSON.stringify(params),
      })
      .run();
  });
  for (const a of plan.accounts) {
    tx.insert(longTermAccountAssumptions)
      .values({
        planId: id,
        accountId: a.accountId,
        included: a.included ? 1 : 0,
        cls: a.cls,
        growthBps: a.growthBps,
      })
      .run();
  }
  plan.splits.forEach((s, position) => {
    tx.insert(longTermSplits)
      .values({
        planId: id,
        position,
        accountId: s.accountId,
        mode: s.mode,
        bps: s.bps ?? null,
        amount: s.amount ?? null,
      })
      .run();
  });
}

export function listPlans(): PlanSummary[] {
  return db
    .select({
      id: longTermPlans.id,
      name: longTermPlans.name,
      version: longTermPlans.version,
      sortOrder: longTermPlans.sortOrder,
      updatedAt: longTermPlans.updatedAt,
      eventCount: sql<number>`(select count(*) from long_term_events e where e.plan_id = long_term_plans.id)`,
    })
    .from(longTermPlans)
    .orderBy(asc(longTermPlans.sortOrder), asc(longTermPlans.createdAt))
    .all();
}

export function getPlan(id: string): SavedPlan {
  const row = rowById(id);
  if (!row) throw new ForecastError('Plan not found', 404);
  return load(row);
}

export function createPlan(plan: PlanInput): SavedPlan {
  assertReferences(plan);
  return db.transaction((tx) => {
    const { count, last } = tx
      .select({
        count: sql<number>`count(*)`,
        last: sql<number>`coalesce(max(${longTermPlans.sortOrder}), -1)`,
      })
      .from(longTermPlans)
      .get()!;
    if (count >= MAX_PLANS) throw new ForecastError(`Keep at most ${MAX_PLANS} plans`, 409);
    assertNameFree(plan.name);
    const id = nanoid();
    const now = new Date().toISOString();
    tx.insert(longTermPlans)
      .values({
        id,
        name: plan.name,
        settingsJson: JSON.stringify(plan.settings),
        sortOrder: last + 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    writeChildren(tx, id, plan);
    return load(rowById(id)!);
  });
}

export function updatePlan(id: string, plan: PlanInput, expectedVersion: number): SavedPlan {
  assertReferences(plan);
  return db.transaction((tx) => {
    const row = rowById(id);
    if (!row || row.version !== expectedVersion) throw new PlanConflict(row ? load(row) : null);
    assertNameFree(plan.name, id);
    tx.update(longTermPlans)
      .set({
        name: plan.name,
        settingsJson: JSON.stringify(plan.settings),
        version: row.version + 1,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(longTermPlans.id, id))
      .run();
    writeChildren(tx, id, plan);
    return load(rowById(id)!);
  });
}

/** Deletes only the plan (its events, choices and splits go with it) */
export function deletePlan(id: string, expectedVersion: number) {
  db.transaction((tx) => {
    const row = rowById(id);
    if (!row) return;
    if (row.version !== expectedVersion) throw new PlanConflict(load(row));
    tx.delete(longTermPlans).where(eq(longTermPlans.id, id)).run();
  });
}

/** A copy under a new name, saved as a new plan; the original is untouched */
export function duplicatePlan(id: string, name: string): SavedPlan {
  const source = getPlan(id);
  return createPlan({ ...source.plan, name });
}
