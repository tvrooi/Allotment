import { create } from 'zustand';

// The search palette, mounted once by the app shell (layout/AppShell.tsx). Opened by ⌘K or
// Ctrl+K, by / (hooks/useCommandPaletteKeyboard.ts) and by the phone header's Search. Not saved.

interface CommandPaletteState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
