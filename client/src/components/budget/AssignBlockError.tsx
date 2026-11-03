import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { getUpReview, restoreUpDeleted } from '../../api/up';
import { formatMoney } from '../../utils/currency';
import { formatAsOfDay } from '../../utils/dates';
import { Button } from '../ui/Button';

interface AccountIssue {
  accountId: string;
  accountName: string;
  currency: string | null;
  reason: 'closed-balance' | 'bank-mismatch' | 'bank-balance-unavailable';
  registerBalance: number;
  bankBalance: number | null;
  difference: number | null;
}

function issuesOf(error: Error): AccountIssue[] {
  if (!(error instanceof ApiError)) return [];
  const list = (error.details as { accountIssues?: AccountIssue[] } | undefined)?.accountIssues;
  return Array.isArray(list) ? list : [];
}

/**
 * Up transactions the owner deleted from this account that Up still has: the usual reason an
 * Up account disagrees with Up. Each can be restored in one step (the next sync brings it back).
 */
function DeletedAtUp({
  accountId,
  currency,
  onRestored,
}: {
  accountId: string;
  currency: string | null;
  onRestored: () => void;
}) {
  const qc = useQueryClient();
  const review = useQuery({ queryKey: ['up-review', 0], queryFn: () => getUpReview(0) });
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const rows = (review.data?.deleted ?? []).filter((d) => d.accountId === accountId);
  if (!rows.length) return null;
  const restore = async (importedId: string) => {
    setBusy(importedId);
    setFailed(null);
    try {
      const result = await restoreUpDeleted(accountId, importedId);
      if (result.sync.errors.length) setFailed(result.sync.errors.join(' '));
      // A sync changes balances, the register and the budget
      await qc.invalidateQueries();
      onRestored();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Could not restore it. Try again.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mt-2 space-y-1.5 text-text">
      <p>
        You deleted {rows.length === 1 ? 'a transaction' : `${rows.length} transactions`} that Up
        still has. Restoring {rows.length === 1 ? 'it' : 'one'} brings it back and the balances
        match again:
      </p>
      <ul className="space-y-1.5">
        {rows.map((d) => (
          <li key={d.importedId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {d.description ?? 'Up transaction'}
              {d.date && <> · {formatAsOfDay(d.date)}</>}
              {d.amount !== null && <> · {formatMoney(d.amount, currency)}</>}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy !== null}
              onClick={() => void restore(d.importedId)}
            >
              {busy === d.importedId ? 'Restoring…' : 'Restore'}
            </Button>
          </li>
        ))}
      </ul>
      {failed && <p className="text-negative">{failed}</p>}
    </div>
  );
}

/**
 * The budget refused an assignment. When the cause is an account that disagrees with its bank
 * (or a closed account with a balance left), name each account and link to the fixes: look at
 * its transactions (delete or move a hand-entered row), or reconcile it.
 */
export function AssignBlockError({
  error,
  onResolved = () => {},
}: {
  error: Error;
  /** A fix was applied here (a deleted Up transaction restored): clear the error */
  onResolved?: () => void;
}) {
  const issues = issuesOf(error);
  if (!issues.length)
    return (
      <p role="alert" className="px-6 py-3 text-negative">
        {error.message}
      </p>
    );
  return (
    <div role="alert" className="px-6 py-3 text-negative space-y-2">
      <p>
        Money can't be assigned while {issues.length === 1 ? 'an account' : 'accounts'} disagree
        {issues.length === 1 ? 's' : ''} with the bank.
      </p>
      <ul className="space-y-2 text-sm">
        {issues.map((i) => (
          <li key={i.accountId}>
            <strong>{i.accountName}</strong>
            {i.reason === 'bank-mismatch' && i.difference !== null && i.bankBalance !== null ? (
              <>
                : Allotment has {formatMoney(i.registerBalance, i.currency)}, the bank says{' '}
                {formatMoney(i.bankBalance, i.currency)} (
                {formatMoney(Math.abs(i.difference), i.currency)}{' '}
                {i.difference < 0 ? 'more in Allotment' : 'less in Allotment'}).
              </>
            ) : i.reason === 'closed-balance' ? (
              <>: closed with {formatMoney(i.registerBalance, i.currency)} still in it.</>
            ) : (
              <>: sync it to get the bank's balance.</>
            )}{' '}
            <Link className="underline" to={`/accounts/${i.accountId}`}>
              Review {i.accountName}'s transactions
            </Link>{' '}
            (delete or move a row you added by hand) or{' '}
            <Link className="underline" to={`/accounts/${i.accountId}/reconcile`}>
              reconcile it
            </Link>
            .
            {i.reason === 'bank-mismatch' && (
              <DeletedAtUp accountId={i.accountId} currency={i.currency} onRestored={onResolved} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
