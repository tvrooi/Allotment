import { formatDistance } from 'date-fns';

/** A bank connection's sync state, as Up, Plaid, SimpleFIN and Enable Banking report it */
export interface BankConnectionState {
  provider: string;
  syncStatus: 'good' | 'syncing' | 'error' | 'login_required';
  lastSyncedAt: string | null;
}

export interface BankFeed {
  provider: string;
  state: 'attention' | 'syncing' | 'good';
  /** The least recent of its connections' last syncs; null when one never synced */
  lastSyncedAt: string | null;
}

const STATE = { error: 'attention', login_required: 'attention', syncing: 'syncing', good: 'good' };
const RANK = { attention: 2, syncing: 1, good: 0 } as const;

/** One feed per provider, in the order first seen: its worst state and its stalest sync */
export function bankFeeds(connections: BankConnectionState[]): BankFeed[] {
  const feeds = new Map<string, BankFeed>();
  for (const c of connections) {
    const state = STATE[c.syncStatus] as BankFeed['state'];
    const seen = feeds.get(c.provider);
    if (!seen) {
      feeds.set(c.provider, { provider: c.provider, state, lastSyncedAt: c.lastSyncedAt });
      continue;
    }
    if (RANK[state] > RANK[seen.state]) seen.state = state;
    if (seen.lastSyncedAt && (!c.lastSyncedAt || c.lastSyncedAt < seen.lastSyncedAt))
      seen.lastSyncedAt = c.lastSyncedAt;
  }
  return [...feeds.values()];
}

/** "Synced from Up 4 minutes ago", or that it's syncing or needs attention */
export function bankSyncLabel(feed: BankFeed, now = new Date()): string {
  if (feed.state === 'syncing') return `Syncing with ${feed.provider}…`;
  if (feed.state === 'attention') return `${feed.provider} sync needs attention`;
  return feed.lastSyncedAt
    ? `Synced from ${feed.provider} ${formatDistance(new Date(feed.lastSyncedAt), now, { addSuffix: true })}`
    : `Connected to ${feed.provider}`;
}
