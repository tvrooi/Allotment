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

/**
 * The accounts a transaction can be a transfer to ("Transfer: name"): every open account other
 * than its own. With no account given (a register over several accounts), every open account.
 */
export function transferTargets<A extends Pick<Account, 'id' | 'closedAt'>>(
  accounts: A[] | undefined,
  fromAccountId?: string | null,
): A[] {
  return (accounts ?? []).filter((a) => a.id !== fromAccountId && !a.closedAt);
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
