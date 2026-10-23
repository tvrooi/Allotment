/**
 * Saved forecast scenarios. Each one is its assumptions as JSON plus a version: a save or
 * delete names the version it was based on and is refused (409, nothing written) when another
 * device changed it since, so nobody's tuning is silently overwritten. Saving never runs or
 * allocates anything; the forecast stays read-only.
 */
import { asc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { forecastScenarios } from '../db/schema.js';
import { scenarioSchema, type ForecastScenario } from './forecastConfig.js';
import { ForecastError } from './forecastService.js';

export const MAX_SAVED_SCENARIOS = 20;

export interface SavedScenario {
  id: string;
  version: number;
  sortOrder: number;
  updatedAt: string;
  scenario: ForecastScenario;
}

/** Refused because the saved copy changed; carries it so the client can show or reload it */
export class ScenarioConflict extends ForecastError {
  constructor(public current: SavedScenario | null) {
    super(
      current
        ? `"${current.scenario.name}" was changed on another device`
        : 'This scenario was deleted on another device',
      409,
    );
  }
}

type Row = typeof forecastScenarios.$inferSelect;

function toSaved(row: Row): SavedScenario {
  return {
    id: row.id,
    version: row.version,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
    // Older saves get any assumption added since at its default
    scenario: scenarioSchema.parse({ ...JSON.parse(row.assumptions), name: row.name }),
  };
}

/** The assumptions column: everything but the name, which has its own */
const assumptionsOf = ({ name: _name, ...rest }: ForecastScenario) => JSON.stringify(rest);

const byId = (id: string) =>
  db.select().from(forecastScenarios).where(eq(forecastScenarios.id, id)).get();

function assertNameFree(name: string, exceptId?: string) {
  const clash = db
    .select({ id: forecastScenarios.id })
    .from(forecastScenarios)
    .where(sql`${forecastScenarios.name} = ${name} COLLATE NOCASE`)
    .get();
  if (clash && clash.id !== exceptId)
    throw new ForecastError(`A saved scenario is already called "${name}"`, 409);
}

export const listSavedScenarios = (): SavedScenario[] =>
  db
    .select()
    .from(forecastScenarios)
    .orderBy(asc(forecastScenarios.sortOrder), asc(forecastScenarios.createdAt))
    .all()
    .map(toSaved);

export function createSavedScenario(scenario: ForecastScenario): SavedScenario {
  return db.transaction(() => {
    const { count, last } = db
      .select({
        count: sql<number>`count(*)`,
        last: sql<number>`coalesce(max(${forecastScenarios.sortOrder}), -1)`,
      })
      .from(forecastScenarios)
      .get()!;
    if (count >= MAX_SAVED_SCENARIOS)
      throw new ForecastError(`Keep at most ${MAX_SAVED_SCENARIOS} saved scenarios`, 409);
    assertNameFree(scenario.name);
    const id = nanoid();
    const now = new Date().toISOString();
    db.insert(forecastScenarios)
      .values({
        id,
        name: scenario.name,
        assumptions: assumptionsOf(scenario),
        sortOrder: last + 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return toSaved(byId(id)!);
  });
}

export function updateSavedScenario(
  id: string,
  scenario: ForecastScenario,
  expectedVersion: number,
): SavedScenario {
  return db.transaction(() => {
    const row = byId(id);
    if (!row || row.version !== expectedVersion)
      throw new ScenarioConflict(row ? toSaved(row) : null);
    assertNameFree(scenario.name, id);
    db.update(forecastScenarios)
      .set({
        name: scenario.name,
        assumptions: assumptionsOf(scenario),
        version: row.version + 1,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(forecastScenarios.id, id))
      .run();
    return toSaved(byId(id)!);
  });
}

export function deleteSavedScenario(id: string, expectedVersion: number) {
  db.transaction(() => {
    const row = byId(id);
    if (!row) return;
    if (row.version !== expectedVersion) throw new ScenarioConflict(toSaved(row));
    db.delete(forecastScenarios).where(eq(forecastScenarios.id, id)).run();
  });
}
