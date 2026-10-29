import { usePreferencesStore, type SafeModeLevel } from '../store/preferencesStore';
import { useSafeModeStore } from '../store/safeModeStore';

/** What a hidden amount shows instead. The real figure isn't on the page at all. */
export const HIDDEN_AMOUNT = '•••••';

export interface SafeMode {
  /** Balances and totals: account balances, net worth, savings, super, investments */
  balances: boolean;
  /** Every amount, transactions and budget included */
  all: boolean;
}

/** What Safe mode hides, from whether it's on and its level */
export function safeModeHides(on: boolean, level: SafeModeLevel | undefined): SafeMode {
  if (!on) return { balances: false, all: false };
  return { balances: true, all: level === 'all' };
}

/** For the money formatters: whether every amount is hidden right now */
export function hidesAllAmounts(): boolean {
  return safeModeHides(useSafeModeStore.getState().on, usePreferencesStore.getState().safeModeLevel)
    .all;
}

/** What Safe mode hides, re-rendering the component when it's switched */
export function useSafeMode(): SafeMode {
  const on = useSafeModeStore((s) => s.on);
  const level = usePreferencesStore((s) => s.safeModeLevel);
  return safeModeHides(on, level);
}

/** Whether balances and totals are hidden (true whenever Safe mode is on) */
export const useHideBalances = () => useSafeMode().balances;
