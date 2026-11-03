import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Safe mode: hides balances and totals (or every amount) while someone else looks at the
 * screen. A courtesy for the screen, not access control: whoever has the device can switch it
 * off. Kept for this window's session only, so it's off again the next time the app opens.
 * What it hides is a preference (safeModeLevel in preferencesStore).
 */
interface SafeModeState {
  on: boolean;
  setOn: (on: boolean) => void;
  toggle: () => void;
}

export const useSafeModeStore = create<SafeModeState>()(
  persist(
    (set) => ({
      on: false,
      setOn: (on) => set({ on }),
      toggle: () => set((s) => ({ on: !s.on })),
    }),
    {
      name: 'budget-safe-mode',
      // Survives a reload, not closing the app or tab
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
