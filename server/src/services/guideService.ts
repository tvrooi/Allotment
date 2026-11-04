import { z } from 'zod';
import { count } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db } from '../db/index.js';
import {
  documents,
  guideProgress,
  holdings,
  householdGroups,
  paymentPlans,
  receipts,
  securities,
  taxClaims,
} from '../db/schema.js';

// Guides and tips (docs/GUIDES.md): which guides the person whose budget this is has seen,
// and whether tips are on. Each person in multi-user mode has their own budget, so this is
// per person and follows them to every device. Presentation only: it never touches money,
// is not in backups and no access token can reach it.

const ROW_ID = 'default';
export const WELCOME_STATES = ['offer', 'done', 'dismissed'] as const;
/** Guide and tip ids are written by the app: client/src/guides */
const idSchema = z.string().regex(/^[a-z0-9][a-z0-9.-]{0,63}$/);
const MAX_ENTRIES = 300;

/**
 * The sidebar's optional features (audit decision I-4): hidden until they hold something or the
 * person turns them on, so a new budget's menu stays short. Their pages always open by link.
 */
export const NAV_FEATURES = ['pay-later', 'household', 'investments', 'tax', 'files'] as const;
export type NavFeature = (typeof NAV_FEATURES)[number];
const NAV_CHOICES = ['shown', 'hidden'] as const;
type NavChoice = (typeof NAV_CHOICES)[number];

export interface GuideState {
  tipsEnabled: boolean;
  pageGuidesEnabled: boolean;
  welcomeTour: (typeof WELCOME_STATES)[number];
  guidesNotice: boolean;
  /** Guide id → the version seen */
  seenGuides: Record<string, number>;
  dismissedTips: string[];
  /** The person's choice per optional sidebar feature; none = shown once in use */
  navFeatures: Partial<Record<NavFeature, NavChoice>>;
  /** Optional features holding something (read-only, worked out from the budget) */
  featuresInUse: NavFeature[];
}

/**
 * A change. Seen guides and dismissed tips are added to what's there, never replace it, so two
 * devices marking different guides can't undo each other.
 */
export const guideUpdateSchema = z
  .object({
    tipsEnabled: z.boolean(),
    pageGuidesEnabled: z.boolean(),
    welcomeTour: z.enum(WELCOME_STATES),
    guidesNotice: z.literal(false),
    seenGuides: z.record(idSchema, z.number().int().min(1).max(1000)),
    dismissedTips: z.array(idSchema).max(MAX_ENTRIES),
    /** Per feature: shown, hidden, or 'auto' to forget the choice */
    navFeatures: z.partialRecord(z.enum(NAV_FEATURES), z.enum([...NAV_CHOICES, 'auto'])),
  })
  .partial()
  .strict();
export type GuideUpdate = z.infer<typeof guideUpdateSchema>;

const NEW_BUDGET: GuideState = {
  tipsEnabled: true,
  pageGuidesEnabled: true,
  welcomeTour: 'offer',
  guidesNotice: false,
  seenGuides: {},
  dismissedTips: [],
  navFeatures: {},
  featuresInUse: [],
};

/** Stored JSON read back leniently: anything that isn't what we wrote counts as nothing seen */
function parseSeen(json: string): Record<string, number> {
  try {
    const parsed = z.record(idSchema, z.number().int()).safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

function parseTips(json: string): string[] {
  try {
    const parsed = z.array(idSchema).safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function parseNav(json: string): GuideState['navFeatures'] {
  try {
    const parsed = z
      .partialRecord(z.enum(NAV_FEATURES), z.enum(NAV_CHOICES))
      .safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/** Optional features that hold something in this budget */
export function featuresInUse(): NavFeature[] {
  const has = (table: SQLiteTable) => (db.select({ n: count() }).from(table).get()?.n ?? 0) > 0;
  const used: Record<NavFeature, boolean> = {
    'pay-later': has(paymentPlans),
    household: has(householdGroups),
    investments: has(securities) || has(holdings),
    tax: has(taxClaims) || has(receipts),
    files: has(documents),
  };
  return NAV_FEATURES.filter((f) => used[f]);
}

export function guideState(): GuideState {
  const row = db.select().from(guideProgress).get();
  if (!row)
    return {
      ...NEW_BUDGET,
      seenGuides: {},
      dismissedTips: [],
      navFeatures: {},
      featuresInUse: featuresInUse(),
    };
  return {
    tipsEnabled: row.tipsEnabled === 1,
    pageGuidesEnabled: row.pageGuidesEnabled === 1,
    welcomeTour: (WELCOME_STATES as readonly string[]).includes(row.welcomeTour)
      ? (row.welcomeTour as GuideState['welcomeTour'])
      : 'dismissed',
    guidesNotice: row.guidesNotice === 1,
    seenGuides: parseSeen(row.seenGuides),
    dismissedTips: parseTips(row.dismissedTips),
    navFeatures: parseNav(row.navFeatures),
    featuresInUse: featuresInUse(),
  };
}

function save(state: GuideState) {
  const row = {
    id: ROW_ID,
    tipsEnabled: state.tipsEnabled ? 1 : 0,
    pageGuidesEnabled: state.pageGuidesEnabled ? 1 : 0,
    welcomeTour: state.welcomeTour,
    guidesNotice: state.guidesNotice ? 1 : 0,
    seenGuides: JSON.stringify(state.seenGuides),
    dismissedTips: JSON.stringify(state.dismissedTips),
    navFeatures: JSON.stringify(state.navFeatures),
    updatedAt: new Date().toISOString(),
  };
  db.insert(guideProgress)
    .values(row)
    .onConflictDoUpdate({ target: guideProgress.id, set: row })
    .run();
}

export function updateGuides(update: GuideUpdate): GuideState {
  return db.transaction(() => {
    const state = guideState();
    if (update.tipsEnabled !== undefined) state.tipsEnabled = update.tipsEnabled;
    if (update.pageGuidesEnabled !== undefined) state.pageGuidesEnabled = update.pageGuidesEnabled;
    if (update.welcomeTour !== undefined) state.welcomeTour = update.welcomeTour;
    if (update.guidesNotice === false) state.guidesNotice = false;
    for (const [id, version] of Object.entries(update.seenGuides ?? {})) {
      // A newer version seen elsewhere stays
      state.seenGuides[id] = Math.max(state.seenGuides[id] ?? 0, version);
    }
    for (const [feature, choice] of Object.entries(update.navFeatures ?? {}) as [
      NavFeature,
      NavChoice | 'auto',
    ][]) {
      if (choice === 'auto') delete state.navFeatures[feature];
      else state.navFeatures[feature] = choice;
    }
    const tips = new Set([...state.dismissedTips, ...(update.dismissedTips ?? [])]);
    state.dismissedTips = [...tips];
    // Kept small: the oldest go first (a guide seen long ago may be offered again)
    const seen = Object.entries(state.seenGuides);
    if (seen.length > MAX_ENTRIES) state.seenGuides = Object.fromEntries(seen.slice(-MAX_ENTRIES));
    if (state.dismissedTips.length > MAX_ENTRIES)
      state.dismissedTips = state.dismissedTips.slice(-MAX_ENTRIES);
    save(state);
    return state;
  });
}

/** "Reset tips and guides": everything shows again, including the welcome tour. Settings stay. */
export function resetGuides(): GuideState {
  return db.transaction(() => {
    const state = guideState();
    save({
      ...state,
      welcomeTour: 'offer',
      guidesNotice: false,
      seenGuides: {},
      dismissedTips: [],
    });
    return guideState();
  });
}
