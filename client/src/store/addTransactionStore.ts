import { create } from 'zustand';

// The one Add transaction dialog, mounted by the app shell (layout/AppShell.tsx). Every way in
// opens it here: the sidebar button, the phone tab bar, the N key, a page's own Add button and
// links ending in ?add=1 on Transactions. Not saved.

interface AddTransactionState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useAddTransactionStore = create<AddTransactionState>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
