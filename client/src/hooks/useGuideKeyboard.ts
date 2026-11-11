import { useEffect } from 'react';
import { useGuideStore } from '../store/guideStore';
import { dialogOpen, isPageShortcut } from '../utils/pageShortcut';

/** ? opens the list of guides, unless someone is typing or a dialog is open */
export function useGuideKeyboard() {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!isPageShortcut(e, '?', dialogOpen())) return;
      e.preventDefault();
      useGuideStore.getState().setListOpen(true);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
