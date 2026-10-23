import { create } from 'zustand';

/** After a transaction's category changes: fix the payee's other transactions too? */
export interface CategoryFollowup {
  /** New for every offer, so a newer one replaces the older */
  key: number;
  payeeId: string;
  payeeName: string;
  categoryId: string;
  categoryName: string;
  /** This payee's other transactions that would change, and how many the payee has in all */
  others: number;
  matched: number;
  /** The payee already defaults to this category */
  isDefault: boolean;
}

interface FollowupState {
  offer: CategoryFollowup | null;
  show: (offer: Omit<CategoryFollowup, 'key'>) => void;
  clear: () => void;
}

let next = 0;
export const useFollowupStore = create<FollowupState>((set) => ({
  offer: null,
  show: (offer) => set({ offer: { ...offer, key: ++next } }),
  clear: () => set({ offer: null }),
}));
