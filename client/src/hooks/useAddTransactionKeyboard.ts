import { useEffect, useRef } from 'react';
import { useAddTransactionStore } from '../store/addTransactionStore';
import { dialogOpen, isPageShortcut } from '../utils/pageShortcut';
import { useCanAddTransaction } from './useOffline';

/**
 * N opens Add transaction from any page, unless someone is typing, a dialog is open, or
 * nothing can be saved right now (the Add buttons are disabled then too).
 */
export function useAddTransactionKeyboard() {
  const { allowed } = useCanAddTransaction();
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!allowedRef.current || !isPageShortcut(e, 'n', dialogOpen())) return;
      e.preventDefault();
      useAddTransactionStore.getState().show();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
