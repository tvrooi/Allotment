import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { useUpConnection } from '../../hooks/useUp';

/**
 * "Synced from Up 4 minutes ago": a small status pill wherever balances are shown, so it's
 * clear the numbers come straight from Up and how fresh they are. Nothing without Up.
 */
export function UpSyncBadge({ className = '' }: { className?: string }) {
  const { data: up } = useUpConnection();
  if (!up) return null;
  const failing = up.syncStatus === 'error';
  const syncing = up.syncStatus === 'syncing';
  const label = syncing
    ? 'Syncing with Up…'
    : failing
      ? 'Up sync needs attention'
      : up.lastSyncedAt
        ? `Synced from Up ${formatDistanceToNow(new Date(up.lastSyncedAt), { addSuffix: true })}`
        : 'Connected to Up';
  return (
    <Link
      to="/settings?tab=connections"
      className={`inline-flex items-center gap-1.5 rounded-full border border-border-light bg-surface px-2.5 py-0.5 text-xs text-text-secondary hover:text-text ${className}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${failing ? 'bg-negative' : syncing ? 'bg-brand-500' : 'bg-positive'}`}
      />
      {label}
    </Link>
  );
}
