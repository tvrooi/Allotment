import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useUpConnection, useRefreshUp } from '../../hooks/useUp';
import {
  syncUp,
  disconnectUp,
  setUpPolling,
  addUpOpeningBalance,
  type UpSyncResult,
} from '../../api/up';
import { useCanSave } from '../../hooks/useConnection';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { UpConnectModal } from './UpConnectModal';
import { formatDay } from '../../utils/dates';
import { formatMoney } from '../../utils/currency';
import { UpReview } from './UpReview';

const dayBefore = (day: string) => {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
export function UpSettings() {
  const { data: connection, isLoading, error: loadError } = useUpConnection();
  const [showConnect, setShowConnect] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [settle, setSettle] = useState<{
    accountId: string;
    name: string;
    date: string;
    amount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UpSyncResult | null>(null);
  const canSave = useCanSave();
  const refresh = useRefreshUp();
  async function sync() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await syncUp());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync Up.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-xs text-text-secondary">
        Connect directly to Up in Australia with a personal access token. No bank-feed subscription
        is required. Sync runs at startup and with Sync Now. Optional background sync runs on your
        server, including when this window is closed.
      </p>
      {isLoading && <Loader2 size={20} className="animate-spin" />}
      {connection && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text">Up</h3>
          {connection.accounts
            .filter((a) => a.isEnabled)
            .map((a) => (
              <p key={a.upAccountId} className="text-xs text-text-secondary">
                {a.name} → {a.accountName ?? 'Not linked'}
                {a.cutoverDate && (
                  <span className="block text-text-tertiary">
                    Your history before {formatDay(a.cutoverDate)} stays as it is; Up’s starts then.
                    {!!a.cutoverDifference &&
                      ` Up’s balance the day before is ${formatMoney(Math.abs(a.cutoverDifference), 'AUD')} ${a.cutoverDifference > 0 ? 'more' : 'less'} than your register’s: check the older transactions, or add the difference as an opening balance.`}
                    {!!a.cutoverDifference && a.accountId && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-1"
                        disabled={!canSave || busy}
                        onClick={() =>
                          setSettle({
                            accountId: a.accountId!,
                            name: a.accountName ?? a.name,
                            date: dayBefore(a.cutoverDate!),
                            amount: a.cutoverDifference!,
                          })
                        }
                      >
                        Add an opening balance dated {formatDay(dayBefore(a.cutoverDate))}
                      </Button>
                    )}
                  </span>
                )}
              </p>
            ))}
          {connection.syncError && (
            <p role="alert" className="text-xs text-negative">
              {connection.syncError}
            </p>
          )}
          {connection.lastSyncedAt && (
            <p className="text-xs text-text-tertiary">
              Last synced: {new Date(connection.lastSyncedAt).toLocaleString()}
            </p>
          )}
          <label className="block text-xs text-text-secondary">
            Background sync
            <select
              aria-label="Background sync"
              className="block mt-1 rounded border border-border bg-surface p-2 text-text"
              value={connection.pollIntervalMinutes ?? 0}
              disabled={!canSave || busy || connection.syncStatus === 'syncing'}
              onChange={async (e) => {
                setBusy(true);
                setError(null);
                try {
                  await setUpPolling(Number(e.target.value));
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not save background sync.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <option value={0}>Off · startup and manual only</option>
              {[15, 30, 60, 240].map((minutes) => (
                <option key={minutes} value={minutes}>
                  Every {minutes} minutes
                </option>
              ))}
            </select>
          </label>
          {connection.nextSyncAt && (
            <p className="text-xs text-text-tertiary">
              Next background attempt: {new Date(connection.nextSyncAt).toLocaleString()}. Failures
              delay retries.
            </p>
          )}
          {connection.syncStatus === 'syncing' && (
            <p role="status" className="text-xs text-text-secondary">
              Syncing with Up…
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={sync} disabled={!canSave || busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync
              Now
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowConnect(true)}
              disabled={!canSave || busy}
            >
              Reconnect / choose accounts
            </Button>
            <Button
              variant="danger"
              onClick={() => setShowDisconnect(true)}
              disabled={!canSave || busy}
            >
              Disconnect Up
            </Button>
          </div>
        </div>
      )}
      {!connection && !isLoading && (
        <Button onClick={() => setShowConnect(true)} disabled={!canSave}>
          Connect Up
        </Button>
      )}
      {result && (
        <p
          role="status"
          className={`text-sm ${result.errors.length ? 'text-negative' : result.notices?.length ? 'text-caution' : 'text-positive'}`}
        >
          Imported {result.added} new transactions.{' '}
          {[...result.errors, ...(result.notices ?? [])].join(' ')}
        </p>
      )}
      {(error || loadError) && (
        <p role="alert" className="text-sm text-negative">
          {error ?? loadError?.message}
        </p>
      )}
      <SavingPausedHint />
      {connection && <UpReview canSave={canSave} />}
      <ConfirmModal
        isOpen={!!settle}
        onClose={() => setSettle(null)}
        title="Add an opening balance?"
        message={
          settle
            ? `This adds one balance adjustment of ${formatMoney(settle.amount, 'AUD')} to ${settle.name}, dated ${formatDay(settle.date)}, so its balance on that day matches Up's. It is a correction, not income or spending, and nothing else changes. You can delete it from the register.`
            : ''
        }
        confirmLabel="Add opening balance"
        onConfirm={() => {
          if (!settle) return;
          void addUpOpeningBalance(settle.accountId, settle.amount)
            .then(() => refresh())
            .catch((err) =>
              setError(err instanceof Error ? err.message : 'Could not add the opening balance.'),
            );
        }}
      />
      <UpConnectModal
        isOpen={showConnect}
        onClose={() => {
          setShowConnect(false);
          void refresh();
        }}
      />
      <ConfirmModal
        isOpen={showDisconnect}
        onClose={() => setShowDisconnect(false)}
        title="Disconnect Up"
        danger
        confirmLabel="Disconnect"
        message="Allotment will forget your token and account links. Your accounts, transactions and observed bank details stay. To revoke the token itself, also revoke it in Up’s developer portal."
        onConfirm={async () => {
          await disconnectUp();
          setResult(null);
          await refresh();
        }}
      />
    </div>
  );
}
