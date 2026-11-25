import { apiFetch } from './client';

// Guides and tips (docs/GUIDES.md): the signed-in person's progress, kept in their budget so it
// follows them to every device. Presentation only.
export type WelcomeTourState = 'offer' | 'done' | 'dismissed';
/** The sidebar's optional features (utils/navFeatures.ts) */
export type NavFeature = 'pay-later' | 'household' | 'investments' | 'tax' | 'files';
export type NavChoice = 'shown' | 'hidden';

export interface GuideProgress {
  tipsEnabled: boolean;
  pageGuidesEnabled: boolean;
  welcomeTour: WelcomeTourState;
  /** Once, for budgets in use before guides existed: where to find them */
  guidesNotice: boolean;
  /** Guide id → the version seen */
  seenGuides: Record<string, number>;
  dismissedTips: string[];
  /** The person's choice per optional sidebar feature; none = the default in utils/navFeatures.ts (older servers: absent) */
  navFeatures?: Partial<Record<NavFeature, NavChoice>>;
  /** Optional features holding something, worked out by the server (older servers: absent) */
  featuresInUse?: NavFeature[];
}

/** Seen guides and dismissed tips are added to what's stored, never replace it */
export interface GuideUpdate {
  tipsEnabled?: boolean;
  pageGuidesEnabled?: boolean;
  welcomeTour?: WelcomeTourState;
  guidesNotice?: false;
  seenGuides?: Record<string, number>;
  dismissedTips?: string[];
  /** 'auto' forgets the choice and restores the feature's default */
  navFeatures?: Partial<Record<NavFeature, NavChoice | 'auto'>>;
}

export const getGuideProgress = () => apiFetch<GuideProgress>('/guides');
export const updateGuideProgress = (update: GuideUpdate) =>
  apiFetch<GuideProgress>('/guides', { method: 'PUT', body: JSON.stringify(update) });
export const resetGuideProgress = () =>
  apiFetch<GuideProgress>('/guides/reset', { method: 'POST' });
