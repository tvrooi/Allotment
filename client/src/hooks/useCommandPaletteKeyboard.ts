import { useEffect } from 'react';
import { useCommandPaletteStore } from '../store/commandPaletteStore';
import { dialogOpen, isPaletteShortcut } from '../utils/pageShortcut';

/** ⌘K or Ctrl+K (from anywhere) and / (not while typing) open the search palette */
export function useCommandPaletteKeyboard() {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!isPaletteShortcut(e, dialogOpen())) return;
      e.preventDefault();
      useCommandPaletteStore.getState().show();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
