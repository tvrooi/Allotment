import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAccountSyncStatus } from '../../api/accounts';
import { formatMoney } from '../../utils/currency';

// Like YNAB's "your bank says": when a synced account's register differs from the bank's
// settled balance at the last sync, show the bank's figure beside it with a way to reconcile.
// A difference never stops a sync; it is the owner's to review.
export function BankBalanceHint({ accountId }: { accountId: string }) {
  const { data = [] } = useQuery({
    queryKey: ['accounts', 'sync-status'],
    queryFn: getAccountSyncStatus,
    staleTime: 60_000,
  });
  const status = data.find((s) => s.accountId === accountId);
  if (!status || status.bankBalance === null || !status.difference) return null;
  return (
    <span className="text-xs text-caution">
      Up says {formatMoney(status.bankBalance, 'AUD')} (
      {status.verdict === 'round-ups' ? (
        <Link to="/settings?tab=connections" className="underline">
          missing round-ups
        </Link>
      ) : (
        <Link to={`/accounts/${accountId}/reconcile`} className="underline">
          reconcile
        </Link>
      )}
      )
    </span>
  );
}
