import { useUpConnection } from '../../hooks/useUp';
import { bankFeeds, bankSyncLabel, type BankFeed } from '../../utils/bankSync';
import { StatusPill } from '../ui/StatusPill';

const SYNC_DOT = { good: 'good', syncing: 'busy', attention: 'attention' } as const;

/** One bank feed's state as a pill linking to Settings → Connections */
export function BankSyncPill({ feed, className }: { feed: BankFeed; className?: string }) {
  return (
    <StatusPill to="/settings?tab=connections" dot={SYNC_DOT[feed.state]} className={className}>
      {bankSyncLabel(feed)}
    </StatusPill>
  );
}

/**
 * "Synced from Up 4 minutes ago": a small status pill wherever balances are shown, so it's
 * clear the numbers come straight from Up and how fresh they are. Nothing without Up.
 */
export function UpSyncBadge({ className = '' }: { className?: string }) {
  const { data: up } = useUpConnection();
  if (!up) return null;
  const [feed] = bankFeeds([{ provider: 'Up', ...up }]);
  return <BankSyncPill feed={feed} className={className} />;
}
