import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { formatMoney } from '../../utils/currency';

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
 * The budget refused an assignment. When the cause is an account that disagrees with its bank
 * (or a closed account with a balance left), name each account and link to the fixes: look at
 * its transactions (delete or move a hand-entered row), or reconcile it.
 */
export function AssignBlockError({ error }: { error: Error }) {
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
                : FlyBudget has {formatMoney(i.registerBalance, i.currency)}, the bank says{' '}
                {formatMoney(i.bankBalance, i.currency)} (
                {formatMoney(Math.abs(i.difference), i.currency)}{' '}
                {i.difference < 0 ? 'more in FlyBudget' : 'less in FlyBudget'}).
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
          </li>
        ))}
      </ul>
    </div>
  );
}
