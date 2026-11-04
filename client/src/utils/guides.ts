import type { GuideProgress, GuideUpdate } from '../api/guides';
import type { Guide } from '../guides/types';

// The rules behind guides and tips (docs/GUIDES.md), kept free of React so they can be tested.

/** The guide that belongs to a page, if it has one */
export function guideForPage(pathname: string, guides: Guide[]): Guide | undefined {
  const path = pathname.replace(/\/+$/, '') || '/';
  return guides.find((g) => g.page === path);
}

/** new: never seen; updated: seen, but its steps changed since; seen */
export function guideStatus(guide: Guide, progress: GuideProgress): 'new' | 'updated' | 'seen' {
  const seen = progress.seenGuides[guide.id];
  if (!seen) return 'new';
  return seen < guide.version ? 'updated' : 'seen';
}

export type Banner =
  | { kind: 'notice' }
  | { kind: 'page'; guide: Guide; updated: boolean; intro?: string }
  | { kind: 'intro'; id: string; text: string };

/**
 * The one guide banner a page shows, if any: the welcome tour offer (a new budget, on the
 * dashboard; nothing else is offered until it's taken or turned down), then the note for people
 * who used Allotment before guides, then the guide for this page when page guides are on and it
 * hasn't been seen.
 */
export function bannerFor(
  pathname: string,
  progress: GuideProgress | undefined,
  guides: Guide[],
  touring: boolean,
  intros: Record<string, { id: string; text: string }> = {},
): Banner | null {
  if (!progress || touring) return null;
  // The welcome tour is offered once, in the Get started checklist (or the demo's bar), not
  // as a banner of its own: one onboarding system at a time
  if (progress.welcomeTour === 'offer') return null;
  if (progress.guidesNotice) return { kind: 'notice' };
  if (!progress.pageGuidesEnabled) return null;
  const path = pathname.replace(/\/+$/, '') || '/';
  const intro = intros[path];
  const guide = guideForPage(pathname, guides);
  if (!guide) {
    // A page without a guide still says what it's for, once
    return intro && !progress.seenGuides[intro.id]
      ? { kind: 'intro', id: intro.id, text: intro.text }
      : null;
  }
  const status = guideStatus(guide, progress);
  return status === 'seen'
    ? null
    : { kind: 'page', guide, updated: status === 'updated', intro: intro?.text };
}

/**
 * What leaving a page records for the banner it showed: page guides and intros are offered on
 * the first visit only, then wait under the ? button. The note for people who used Allotment
 * before guides stays until it is answered.
 */
export function bannerSeenUpdate(banner: Banner): GuideUpdate | null {
  if (banner.kind === 'intro') return { seenGuides: { [banner.id]: 1 } };
  if (banner.kind === 'page') return { seenGuides: { [banner.guide.id]: banner.guide.version } };
  return null;
}

/** Tips wait until a new person has taken or turned down the welcome tour: one thing at a time */
export function tipVisible(id: string, progress: GuideProgress | undefined): boolean {
  return (
    !!progress?.tipsEnabled &&
    progress.welcomeTour !== 'offer' &&
    !progress.dismissedTips.includes(id)
  );
}

/** What the server will answer to an update (services/guideService.ts), to show it straight away */
export function applyGuideUpdate(progress: GuideProgress, update: GuideUpdate): GuideProgress {
  const seenGuides = { ...progress.seenGuides };
  for (const [id, version] of Object.entries(update.seenGuides ?? {})) {
    seenGuides[id] = Math.max(seenGuides[id] ?? 0, version);
  }
  return {
    tipsEnabled: update.tipsEnabled ?? progress.tipsEnabled,
    pageGuidesEnabled: update.pageGuidesEnabled ?? progress.pageGuidesEnabled,
    welcomeTour: update.welcomeTour ?? progress.welcomeTour,
    guidesNotice: update.guidesNotice === false ? false : progress.guidesNotice,
    seenGuides,
    dismissedTips: [...new Set([...progress.dismissedTips, ...(update.dismissedTips ?? [])])],
    navFeatures: mergeNavFeatures(progress.navFeatures ?? {}, update.navFeatures),
    featuresInUse: progress.featuresInUse,
  };
}

function mergeNavFeatures(
  current: NonNullable<GuideProgress['navFeatures']>,
  update: GuideUpdate['navFeatures'],
): NonNullable<GuideProgress['navFeatures']> {
  const next = { ...current };
  for (const [feature, choice] of Object.entries(update ?? {}) as [
    keyof typeof next,
    'shown' | 'hidden' | 'auto',
  ][]) {
    if (choice === 'auto') delete next[feature];
    else next[feature] = choice;
  }
  return next;
}

/** What finishing or leaving a guide records */
export function guideClosedUpdate(guide: Guide, finished: boolean): GuideUpdate {
  return {
    seenGuides: { [guide.id]: guide.version },
    ...(guide.id === 'welcome' && { welcomeTour: finished ? 'done' : 'dismissed' }),
  };
}

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}

export type CardPlacement =
  | { mode: 'center' }
  | { mode: 'sheet'; edge: 'top' | 'bottom' }
  | { mode: 'float'; top: number; left: number; side: 'below' | 'above' | 'right' | 'left' };

const MARGIN = 16;
const GAP = 12;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)));

/**
 * Where a step's card goes. No target: the middle of the screen. Phones: a sheet on the edge
 * away from the highlighted element. Otherwise beside the element, below by preference, and
 * kept on screen; an element that leaves no room anywhere gets the card over its lower part.
 */
export function placeCard(
  target: Rect | null,
  card: Size,
  viewport: Size,
  phone: boolean,
): CardPlacement {
  if (!target) return { mode: 'center' };
  if (phone) {
    const middle = target.top + target.height / 2;
    return { mode: 'sheet', edge: middle > viewport.height / 2 ? 'top' : 'bottom' };
  }
  const bottom = target.top + target.height;
  const right = target.left + target.width;
  const centredLeft = clamp(
    target.left + target.width / 2 - card.width / 2,
    MARGIN,
    viewport.width - card.width - MARGIN,
  );
  const centredTop = clamp(
    target.top + target.height / 2 - card.height / 2,
    MARGIN,
    viewport.height - card.height - MARGIN,
  );
  if (viewport.height - bottom - MARGIN >= card.height + GAP)
    return { mode: 'float', side: 'below', top: bottom + GAP, left: centredLeft };
  if (target.top - MARGIN >= card.height + GAP)
    return { mode: 'float', side: 'above', top: target.top - GAP - card.height, left: centredLeft };
  if (viewport.width - right - MARGIN >= card.width + GAP)
    return { mode: 'float', side: 'right', top: centredTop, left: right + GAP };
  if (target.left - MARGIN >= card.width + GAP)
    return { mode: 'float', side: 'left', top: centredTop, left: target.left - GAP - card.width };
  return {
    mode: 'float',
    side: 'below',
    top: clamp(viewport.height - card.height - MARGIN, MARGIN, viewport.height),
    left: centredLeft,
  };
}

/** The highlight around an element, padded and kept within the screen */
export function spotlightRect(target: Rect, viewport: Size, pad = 6): Rect {
  const top = Math.max(target.top - pad, 0);
  const left = Math.max(target.left - pad, 0);
  const bottom = Math.min(target.top + target.height + pad, viewport.height);
  const right = Math.min(target.left + target.width + pad, viewport.width);
  return { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
}
