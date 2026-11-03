import { apiFetch } from './client';

// Guides and tips (docs/GUIDES.md): the signed-in person's progress, kept in their budget so it
// follows them to every device. Presentation only.
export type WelcomeTourState = 'offer' | 'done' | 'dismissed';

export interface GuideProgress {
  tipsEnabled: boolean;
  pageGuidesEnabled: boolean;
  welcomeTour: WelcomeTourState;
  /** Once, for budgets in use before guides existed: where to find them */
  guidesNotice: boolean;
  /** Guide id → the version seen */
  seenGuides: Record<string, number>;
  dismissedTips: string[];
}

/** Seen guides and dismissed tips are added to what's stored, never replace it */
export interface GuideUpdate {
  tipsEnabled?: boolean;
  pageGuidesEnabled?: boolean;
  welcomeTour?: WelcomeTourState;
  guidesNotice?: false;
  seenGuides?: Record<string, number>;
  dismissedTips?: string[];
}

export const getGuideProgress = () => apiFetch<GuideProgress>('/guides');
export const updateGuideProgress = (update: GuideUpdate) =>
  apiFetch<GuideProgress>('/guides', { method: 'PUT', body: JSON.stringify(update) });
export const resetGuideProgress = () =>
  apiFetch<GuideProgress>('/guides/reset', { method: 'POST' });
