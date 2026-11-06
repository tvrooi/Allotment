import { create } from 'zustand';
import { format } from 'date-fns';

/**
 * A budget row asking the Move money panel to open with its envelope filled in (BUD-06): money
 * to move out of an envelope that has some (`from`), or an overspent one to cover (`cover`, the
 * amount is what it is short). The panel reads it once and clears it; `id` makes a second click on the same
 * row count as a new request.
 */
export interface MoveRequest {
  id: number;
  categoryId: string;
  mode: 'from' | 'cover';
  /** Cents; 0 leaves the amount for the person to type */
  amount: number;
}

interface MoveRequestState {
  request: MoveRequest | null;
  ask: (categoryId: string, available: number) => void;
  /** The panel has taken the request: it must not be replayed by a remount or a later visit */
  clear: () => void;
}

let next = 0;
export const useMoveRequest = create<MoveRequestState>((set) => ({
  request: null,
  clear: () => set({ request: null }),
  ask: (categoryId, available) =>
    set({
      request: {
        id: ++next,
        categoryId,
        mode: available < 0 ? 'cover' : 'from',
        amount: available < 0 ? -available : 0,
      },
    }),
}));

/** Existing money moves in this month or an earlier one, never a future month (the server
 * refuses it too) */
export const canMoveIn = (month: string) => month <= format(new Date(), 'yyyy-MM');
