import { fetch } from 'undici';
import { z } from 'zod';
import { upAccountSchema, upTransactionSchema, UpError } from './upTransactions.js';
export * from './upTransactions.js';
import { readTextLimited, safeFetch } from './safeFetch.js';

// Up's personal API: https://github.com/up-banking/api/blob/master/v1/openapi.json
const API = 'https://api.up.com.au/api/v1/';
const MAX_PAGES = 1_000;
const MAX_ROWS = 100_000;
/** The bank must never redirect the bearer token or provide a different pagination endpoint. */
export function validateUpPage(next: string, current: string): URL {
  const url = new URL(next, current);
  const previous = new URL(current);
  if (
    url.origin !== previous.origin ||
    url.pathname !== previous.pathname ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new UpError('Up returned an invalid pagination link.');
  return url;
}

async function getPage(url: URL, token: string): Promise<unknown> {
  try {
    const options = {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
      redirect: 'error' as const,
    };
    // Operator-controlled override, only for local API mocks, like Enable Banking's.
    const response = process.env.FLYBUDGET_UP_API
      ? await fetch(url, options)
      : await safeFetch(url, options, { maxRedirects: 0 });
    if (response.status === 401 || response.status === 403)
      throw new UpError(
        'Up did not accept your token. Reconnect with a valid personal access token.',
      );
    if (response.status === 429)
      throw new UpError('Up’s request limit was reached. Wait a few minutes before syncing again.');
    if (!response.ok) throw new UpError('Up could not complete the request. Try again later.');
    return JSON.parse(await readTextLimited(response, 10 * 1024 * 1024));
  } catch (err) {
    // Do not log raw network errors: they can contain request headers or bank data.
    throw err instanceof UpError
      ? err
      : new UpError('Could not read a response from Up. Try again later.');
  }
}

async function pages<T>(
  path: string,
  token: string,
  schema: z.ZodType<T>,
  filters: Record<string, string> = {},
): Promise<T[]> {
  const base = process.env.FLYBUDGET_UP_API || API;
  let url: URL | null = new URL(path, base.endsWith('/') ? base : base + '/');
  url.searchParams.set('page[size]', '100');
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  const pageSchema = z.object({
    data: z.array(schema).max(MAX_ROWS),
    links: z.object({ next: z.string().nullable() }),
  });
  const seen = new Set<string>();
  const rows: T[] = [];
  while (url) {
    if (seen.has(url.href) || seen.size >= MAX_PAGES)
      throw new UpError(
        'Up repeated a page or returned too much history. No partial account was imported.',
      );
    seen.add(url.href);
    const parsed = pageSchema.safeParse(await getPage(url, token));
    if (!parsed.success) throw new UpError('Up returned data in an unexpected format.');
    rows.push(...parsed.data.data);
    if (rows.length > MAX_ROWS) throw new UpError('Up returned too much history for one sync.');
    url = parsed.data.links.next ? validateUpPage(parsed.data.links.next, url.href) : null;
  }
  return rows;
}

export const getUpAccounts = (token: string) => pages('accounts', token, upAccountSchema);
/**
 * An account's transactions, holds included. With no filter, all history (a full sweep); `since`
 * (RFC 3339) limits it to rows created from then on, and `status: 'HELD'` to the open holds,
 * whatever their age (upSyncService.ts, audit F-10).
 */
export const getUpTransactions = (
  token: string,
  accountId: string,
  filter: { since?: string; status?: 'HELD' } = {},
) =>
  pages(`accounts/${encodeURIComponent(accountId)}/transactions`, token, upTransactionSchema, {
    ...(filter.since ? { 'filter[since]': filter.since } : {}),
    ...(filter.status ? { 'filter[status]': filter.status } : {}),
  });
