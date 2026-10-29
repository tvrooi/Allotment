import { useEffect } from 'react';
import { useSafeModeStore } from '../store/safeModeStore';

/** Alt+Shift+H (Option+Shift+H on a Mac) switches Safe mode, from anywhere but a text field */
export function useSafeModeKeyboard() {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      // The key, not the character: Option+Shift+H types Ó on a Mac
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey || e.code !== 'KeyH') return;
      e.preventDefault();
      useSafeModeStore.getState().toggle();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
