// Working from home on Tax time (docs/TAX-CAR-AND-HOME.md, D4a): the daily hours log, a year's own
// rate, and the snapshot a lodged year keeps of these figures. Record keeping: it adds up the
// hours the owner records and never guesses an amount, a rate or a number of hours.
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  documentLinks,
  documents,
  taxHomeHours,
  taxHomeYears,
  taxLodgedFigures,
} from '../db/schema.js';
import { financialYearName, financialYearOf, financialYearRange } from './financialYear.js';
import { eachDayIso } from '../utils/date.js';
import { homeYear } from './homeHours.js';
import { amendments, type CurrentPart, type LodgedPart } from './lodgedFigures.js';
import { HOME_HOURLY, RATES_SOURCE, rateFor } from './taxRates.js';

export class HomeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const now = () => new Date().toISOString();

/** Most days one fill may span */
export const MAX_FILL_DAYS = 400;

/** The part name a lodged year's working-from-home figures are kept under */
export const HOME_PART = 'home';

/** One financial year's days, rate and claim */
export function homeData(fy: number) {
  const { from, to } = financialYearRange(fy);
  const days = db
    .select({
      date: taxHomeHours.workDate,
      minutes: taxHomeHours.minutes,
      notes: taxHomeHours.notes,
    })
    .from(taxHomeHours)
    .where(and(gte(taxHomeHours.workDate, from), lte(taxHomeHours.workDate, to)))
    .orderBy(asc(taxHomeHours.workDate))
    .all();
  const row = db.select().from(taxHomeYears).where(eq(taxHomeYears.financialYear, fy)).get();
  const override = row?.rateTenths ?? null;
  const rate = rateFor(HOME_HOURLY, fy, override);
  return {
    days,
    year: {
      ...homeYear(days, rate),
      rateSource: (override !== null ? 'override' : rate !== null ? 'table' : null) as
        'override' | 'table' | null,
      notes: row?.notes ?? null,
    },
    rate: {
      table: HOME_HOURLY[fy] ?? null,
      override,
      source: RATES_SOURCE.homeHourly,
      checked: RATES_SOURCE.checked,
    },
  };
}
export type HomeYearFigures = ReturnType<typeof homeData>['year'];

/** The year's bills and other files linked to it (Files, link kind homeYear) */
export function homeFiles(fy: number) {
  return db
    .select({ id: documents.id, fileName: documents.fileName })
    .from(documentLinks)
    .innerJoin(documents, eq(documents.id, documentLinks.documentId))
    .where(eq(documentLinks.homeYearId, fy))
    .orderBy(asc(documents.fileName))
    .all();
}

/** The detail route's answer: days, the year's figures, the rate and its source, linked files */
export function homeDetail(fy: number) {
  const { days, year, rate } = homeData(fy);
  return { days, year, rate, files: homeFiles(fy) };
}

export function setHomeDay(date: string, minutes: number, notes: string | null) {
  const stamp = now();
  db.insert(taxHomeHours)
    .values({ workDate: date, minutes, notes, createdAt: stamp, updatedAt: stamp })
    .onConflictDoUpdate({
      target: taxHomeHours.workDate,
      set: { minutes, notes, updatedAt: stamp },
    })
    .run();
  return db.select().from(taxHomeHours).where(eq(taxHomeHours.workDate, date)).get()!;
}

export function removeHomeDay(date: string) {
  db.delete(taxHomeHours).where(eq(taxHomeHours.workDate, date)).run();
}

/** Every date from `from` to `to` inclusive, with its weekday (1 Monday to 7 Sunday) */
const eachDay = (from: string, to: string) =>
  eachDayIso(from, to).map((date) => ({
    date,
    weekday: new Date(`${date}T00:00:00Z`).getUTCDay() || 7,
  }));

/**
 * The days a pattern would fill: the chosen weekdays between two dates inside one financial year.
 * Days that already have hours are skipped, never overwritten.
 */
export function fillPlan(input: { from: string; to: string; weekdays: number[] }) {
  if (input.to < input.from) throw new HomeError('The end date is before the start date');
  if (financialYearOf(input.from) !== financialYearOf(input.to))
    throw new HomeError('Fill one financial year at a time (1 July to 30 June)');
  const range = eachDay(input.from, input.to);
  if (range.length > MAX_FILL_DAYS)
    throw new HomeError(`Fill at most ${MAX_FILL_DAYS} days at a time`);
  const wanted = range.filter((d) => input.weekdays.includes(d.weekday)).map((d) => d.date);
  const have = new Set(
    db
      .select({ date: taxHomeHours.workDate })
      .from(taxHomeHours)
      .where(and(gte(taxHomeHours.workDate, input.from), lte(taxHomeHours.workDate, input.to)))
      .all()
      .map((r) => r.date),
  );
  return {
    add: wanted.filter((d) => !have.has(d)),
    skipped: wanted.filter((d) => have.has(d)).length,
  };
}

/** Writes a pattern's new days in one transaction (the caller opens none) */
export function fillHome(input: { from: string; to: string; weekdays: number[]; minutes: number }) {
  const plan = fillPlan(input);
  const stamp = now();
  db.transaction(() => {
    for (const date of plan.add)
      db.insert(taxHomeHours)
        .values({
          workDate: date,
          minutes: input.minutes,
          notes: null,
          createdAt: stamp,
          updatedAt: stamp,
        })
        .run();
  });
  return { added: plan.add.length, skipped: plan.skipped };
}

/** A year's own rate (null goes back to the ATO's) and notes */
export function setHomeYear(fy: number, rateTenths: number | null, notes: string | null) {
  const stamp = now();
  db.insert(taxHomeYears)
    .values({ financialYear: fy, rateTenths, notes, createdAt: stamp, updatedAt: stamp })
    .onConflictDoUpdate({
      target: taxHomeYears.financialYear,
      set: { rateTenths, notes, updatedAt: stamp },
    })
    .run();
  return homeDetail(fy);
}

/** The year's row exists, so files can be linked to it; returns the year as the link's target id */
export function ensureHomeYear(fy: number): string | null {
  if (!Number.isInteger(fy) || fy < 1990 || fy > 2200) return null;
  const stamp = now();
  db.insert(taxHomeYears)
    .values({
      financialYear: fy,
      rateTenths: null,
      notes: null,
      createdAt: stamp,
      updatedAt: stamp,
    })
    .onConflictDoNothing()
    .run();
  return String(fy);
}

/** Financial years with hours or a year row of their own */
export function homeYears(): number[] {
  const years = new Set<number>();
  for (const r of db.select({ date: taxHomeHours.workDate }).from(taxHomeHours).all())
    years.add(financialYearOf(r.date));
  for (const r of db
    .select({ fy: taxHomeYears.financialYear, rate: taxHomeYears.rateTenths })
    .from(taxHomeYears)
    .all())
    if (r.rate !== null) years.add(r.fy);
  // A lodged snapshot keeps its year listed, so an amendment down to nothing stays reachable
  for (const r of db.select({ fy: taxLodgedFigures.financialYear }).from(taxLodgedFigures).all())
    years.add(r.fy);
  return [...years];
}

/** home-hours.csv rows for the ZIP: date, hours (decimal), notes */
export function homeDaysRows(fy: number): (string | number | null)[][] {
  return [
    ['Date', 'Hours', 'Notes'],
    ...homeData(fy).days.map((d) => [d.date, (d.minutes / 60).toFixed(2), d.notes]),
  ];
}

// ─── Lodged years ────────────────────────────────────────────────────────────

/** The parts of a year that are snapshotted when it is marked lodged, as they stand now */
export function currentParts(fy: number): CurrentPart[] {
  const { year } = homeData(fy);
  return [
    {
      part: HOME_PART,
      label: 'working from home',
      figures: { minutes: year.minutes, rateTenths: year.rateTenths, claim: year.claim },
    },
  ];
}

/** Records what the year claims now, replacing any earlier snapshot (the caller's transaction) */
export function recordLodgedFigures(fy: number) {
  const stamp = now();
  db.delete(taxLodgedFigures).where(eq(taxLodgedFigures.financialYear, fy)).run();
  for (const p of currentParts(fy))
    db.insert(taxLodgedFigures)
      .values({
        financialYear: fy,
        part: p.part,
        figures: JSON.stringify(p.figures),
        recordedAt: stamp,
      })
      .run();
}

function recordedParts(fy: number): LodgedPart[] {
  return db
    .select()
    .from(taxLodgedFigures)
    .where(eq(taxLodgedFigures.financialYear, fy))
    .all()
    .flatMap((r) => {
      try {
        const figures = JSON.parse(r.figures) as { claim?: unknown };
        return typeof figures.claim === 'number'
          ? [{ part: r.part, figures: { claim: figures.claim } }]
          : [];
      } catch {
        return [];
      }
    });
}

/** The year's amendments: parts whose claim moved since the year was marked lodged */
export function yearAmendments(fy: number, isLodged: boolean) {
  return amendments(recordedParts(fy), currentParts(fy), isLodged, financialYearName(fy));
}
