import { useEffect } from 'react';
import { useGuideStore } from '../store/guideStore';

/** ? opens the list of guides, unless someone is typing or a dialog is open */
export function useGuideKeyboard() {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable)
        return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      useGuideStore.getState().setListOpen(true);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
