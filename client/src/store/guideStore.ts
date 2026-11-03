import { create } from 'zustand';

// What's on screen right now for guides (docs/GUIDES.md): the guide being shown, the guides
// list, and which tip has the page's one tip slot. Progress itself is stored per person on the
// server (hooks/useGuides.ts); none of this is saved.

interface GuideUiState {
  active: { guideId: string; step: number } | null;
  listOpen: boolean;
  /** The one tip a page shows at a time */
  shownTip: string | null;
  start: (guideId: string) => void;
  goTo: (step: number) => void;
  stop: () => void;
  setListOpen: (open: boolean) => void;
  claimTip: (id: string) => void;
  releaseTip: (id: string) => void;
}

export const useGuideStore = create<GuideUiState>()((set) => ({
  active: null,
  listOpen: false,
  shownTip: null,
  start: (guideId) => set({ active: { guideId, step: 0 }, listOpen: false }),
  goTo: (step) => set((s) => (s.active ? { active: { ...s.active, step } } : {})),
  stop: () => set({ active: null }),
  setListOpen: (listOpen) => set({ listOpen }),
  claimTip: (id) => set((s) => (s.shownTip === null ? { shownTip: id } : {})),
  releaseTip: (id) => set((s) => (s.shownTip === id ? { shownTip: null } : {})),
}));
