import type { Account } from '../types';

/** The account the last transaction was added to, on this device (a stored identifier) */
export const LAST_ADD_ACCOUNT_KEY = 'flybudget:last-add-account';

/**
 * The account Add transaction starts on: the page's own account (an account's page), else
 * the last one used on this device, else none. A closed or deleted account is never chosen.
 */
export function defaultAddAccount(
  accounts: Pick<Account, 'id' | 'closedAt'>[],
  pageAccountId: string | null,
  lastUsedId: string | null,
): string {
  const usable = (id: string | null) =>
    !!id && accounts.some((a) => a.id === id && !a.closedAt) ? id : null;
  return usable(pageAccountId) ?? usable(lastUsedId) ?? '';
}

export function readLastAddAccount(): string | null {
  try {
    return localStorage.getItem(LAST_ADD_ACCOUNT_KEY);
  } catch {
    return null; // storage blocked: nothing is remembered
  }
}

export function rememberAddAccount(id: string) {
  try {
    localStorage.setItem(LAST_ADD_ACCOUNT_KEY, id);
  } catch {
    /* storage blocked: the next one starts with no account */
  }
}
