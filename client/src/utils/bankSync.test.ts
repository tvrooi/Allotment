import { describe, expect, it } from 'vitest';
import { bankFeeds, bankSyncLabel } from './bankSync';

const now = new Date('2026-11-12T10:00:00Z');
const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000).toISOString();

describe('bankFeeds', () => {
  it('is empty without a bank connection', () => {
    expect(bankFeeds([])).toEqual([]);
  });

  it('gives each provider one feed: its worst state and its least recent sync', () => {
    const feeds = bankFeeds([
      { provider: 'Plaid', syncStatus: 'good', lastSyncedAt: minutesAgo(5) },
      { provider: 'Up', syncStatus: 'good', lastSyncedAt: minutesAgo(2) },
      { provider: 'Plaid', syncStatus: 'login_required', lastSyncedAt: minutesAgo(90) },
    ]);
    expect(feeds).toEqual([
      { provider: 'Plaid', state: 'attention', lastSyncedAt: minutesAgo(90) },
      { provider: 'Up', state: 'good', lastSyncedAt: minutesAgo(2) },
    ]);
  });

  it('counts a connection that never synced as not synced', () => {
    const [feed] = bankFeeds([
      { provider: 'SimpleFIN', syncStatus: 'good', lastSyncedAt: minutesAgo(3) },
      { provider: 'SimpleFIN', syncStatus: 'syncing', lastSyncedAt: null },
    ]);
    expect(feed).toEqual({ provider: 'SimpleFIN', state: 'syncing', lastSyncedAt: null });
  });
});

describe('bankSyncLabel', () => {
  it('names the provider and how fresh it is', () => {
    expect(bankSyncLabel({ provider: 'Up', state: 'good', lastSyncedAt: minutesAgo(4) }, now)).toBe(
      'Synced from Up 4 minutes ago',
    );
    expect(bankSyncLabel({ provider: 'Up', state: 'good', lastSyncedAt: null }, now)).toBe(
      'Connected to Up',
    );
  });

  it('says when a sync is running or needs attention', () => {
    expect(bankSyncLabel({ provider: 'Up', state: 'syncing', lastSyncedAt: null }, now)).toBe(
      'Syncing with Up…',
    );
    expect(
      bankSyncLabel(
        { provider: 'Enable Banking', state: 'attention', lastSyncedAt: minutesAgo(9) },
        now,
      ),
    ).toBe('Enable Banking sync needs attention');
  });
});
