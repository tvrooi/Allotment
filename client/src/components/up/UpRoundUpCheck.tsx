import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  disableUpRoundUpDebits,
  enableUpRoundUpDebits,
  getUpRoundUpCheck,
  type UpRoundUpCheck as Check,
} from '../../api/up';
import { formatMoney } from '../../utils/currency';
import { Button } from '../ui/Button';

const VERDICT: Record<Check['verdict'], string> = {
  unknown: 'Sync once to compare this account with Up.',
  matches: 'The register matches Up’s settled balance. Round-ups need no repair.',
  'round-ups':
    'The register is higher than Up by exactly the round-ups settled since the first sync. Up does not list those debits for this account.',
  unexplained:
    'The difference is not explained by round-ups alone. Review transactions and reconcile; nothing will be added automatically.',
};

/** Balance-proven round-up debits. Purchases are never paired with Saver credits here. */
export function UpRoundUpCheck({ canSave }: { canSave: boolean }) {
  const qc = useQueryClient();
  const checks = useQuery({ queryKey: ['up-round-up-check'], queryFn: getUpRoundUpCheck });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update round-up debits.');
    } finally {
      setBusy(false);
      await qc.invalidateQueries();
    }
  }
  if (!checks.data?.length) return null;
  return (
    <section
      aria-label="Round-up accounting check"
      className="rounded-lg border border-border bg-surface p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-text">Round-up accounting check</h3>
      <p className="text-xs text-text-secondary">
        Compares each account’s register with Up’s settled balance from the last sync. Purchases
        settled before the first sync are part of the opening balance.
      </p>
      {checks.data.map((c) => (
        <div
          key={c.accountId}
          className="text-xs text-text-secondary border-t border-border pt-2 space-y-1"
        >
          <p className="font-medium text-text">{c.accountName}</p>
          {c.difference !== null && (
            <p>
              Up {formatMoney(c.settledBalance ?? 0, 'AUD')} · Register{' '}
              {formatMoney(c.register, 'AUD')} · Difference {formatMoney(c.difference, 'AUD')}
            </p>
          )}
          <p>{VERDICT[c.verdict]}</p>
          {c.enabledAt ? (
            <>
              <p>
                Round-up debits are added on each sync since{' '}
                {new Date(c.enabledAt).toLocaleDateString()}. Link each one to its Saver credit with
                the transfer suggestions in the register.
              </p>
              <Button
                size="sm"
                variant="secondary"
                disabled={!canSave || busy}
                onClick={() => run(() => disableUpRoundUpDebits(c.accountId))}
              >
                Stop adding round-up debits
              </Button>
            </>
          ) : (
            c.verdict === 'round-ups' && (
              <Button
                size="sm"
                disabled={!canSave || busy}
                onClick={() =>
                  run(() => enableUpRoundUpDebits(c.accountId, c.missing.count, c.missing.total))
                }
              >
                Add {c.missing.count} round-up debit{c.missing.count === 1 ? '' : 's'} (
                {formatMoney(c.missing.total, 'AUD')})
              </Button>
            )
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
    </section>
  );
}
