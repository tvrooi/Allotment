import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ExternalLink } from '../ui/ExternalLink';
import { useCanSave } from '../../hooks/useConnection';
import { useAccounts } from '../../hooks/useAccounts';
import { useRefreshUp } from '../../hooks/useUp';
import {
  getUpConnection,
  mapUpAccounts,
  setupUp,
  syncUp,
  type UpDiscoveredAccount,
  type UpMappingChoice,
  type UpSyncResult,
} from '../../api/up';
import { formatMoney } from '../../utils/currency';
import { IS_DEMO } from '../../demo/demoApi';
import { NotInDemoModal } from '../demo/NotInDemo';
import { Private } from '../ui/Private';
import { SortUncategorised } from '../review/SortUncategorised';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}
export function UpConnectModal(props: Props) {
  return IS_DEMO ? (
    <NotInDemoModal {...props} />
  ) : props.isOpen ? (
    <UpConnectDialog {...props} />
  ) : null;
}

function UpConnectDialog({ isOpen, onClose }: Props) {
  const [token, setToken] = useState('');
  const [discovered, setDiscovered] = useState<UpDiscoveredAccount[] | null>(null);
  const [choices, setChoices] = useState<UpMappingChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UpSyncResult | null>(null);
  const { data: accounts = [] } = useAccounts();
  const canSave = useCanSave();
  const refresh = useRefreshUp();
  const update = (upAccountId: string, fields: Partial<UpMappingChoice>) =>
    setChoices((prev) =>
      prev.map((m) => (m.upAccountId === upAccountId ? { ...m, ...fields } : m)),
    );

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      // Do not put the bearer token into TanStack's mutation cache or local storage.
      const data = await setupUp(token.trim());
      setToken('');
      setDiscovered(data.accounts);
      setChoices(
        data.accounts.map((a) => ({
          upAccountId: a.upAccountId,
          action: a.accountId ? (a.isEnabled ? 'link' : 'skip') : 'create',
          accountId: a.accountId ?? undefined,
          accountName: a.name,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to Up.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await mapUpAccounts(choices);
      // Keep retry choices idempotent even if the subsequent network request fails.
      const mapped = await getUpConnection();
      setChoices((prev) =>
        prev.map((m) => {
          const id = mapped?.accounts.find((a) => a.upAccountId === m.upAccountId)?.accountId;
          return id && m.action !== 'skip' ? { ...m, action: 'link', accountId: id } : m;
        }),
      );
      const synced = await syncUp();
      setResult(synced);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish the Up connection.');
    } finally {
      setBusy(false);
    }
  }

  const invalidChoice =
    choices.every((m) => m.action === 'skip') ||
    choices.some(
      (m) =>
        (m.action === 'link' && !m.accountId) || (m.action === 'create' && !m.accountName?.trim()),
    );
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Connect Up"
      size="lg"
    >
      <div className="space-y-4">
        {!discovered && (
          <>
            <p className="text-sm text-text-secondary">
              Connect directly to Up using your personal access token. FlyBudget imports settled AUD
              transactions from the accounts you choose, including Savers and 2Up accounts available
              to your token.
            </p>
            <p className="text-xs text-text-secondary">
              Create a token at{' '}
              <ExternalLink href="https://api.up.com.au/" className="text-brand-600 underline">
                Up’s developer portal
              </ExternalLink>
              , then paste it below.
            </p>
            <label className="block text-sm text-text">
              Up personal access token
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-text"
              />
            </label>
            <p className="text-xs text-text-tertiary">
              Your token stays on this FlyBudget installation and is excluded from exported backups.
            </p>
            <Button onClick={connect} disabled={!canSave || busy || !token.trim()}>
              {busy && <Loader2 size={14} className="animate-spin" />} Connect
            </Button>
          </>
        )}
        {discovered && !result && (
          <>
            <p className="text-xs text-text-secondary">
              Create accounts or link empty AUD accounts. Transactions already imported from CSV
              cannot be matched to Up’s transaction IDs.
            </p>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {discovered.map((a) => {
                const choice = choices.find((m) => m.upAccountId === a.upAccountId)!;
                const eligible = accounts.filter(
                  (local) =>
                    !local.closedAt &&
                    (!a.accountId || local.id === a.accountId) &&
                    local.currency === 'AUD' &&
                    (!local.hasTransactions || local.id === choice.accountId) &&
                    !choices.some(
                      (other) =>
                        other.upAccountId !== a.upAccountId &&
                        other.action === 'link' &&
                        other.accountId === local.id,
                    ),
                );
                return (
                  <fieldset
                    key={a.upAccountId}
                    className="border border-border rounded-lg p-3 space-y-2"
                  >
                    <legend className="text-sm text-text px-1">{a.name}</legend>
                    <p className="text-xs text-text-secondary">
                      Available: <Private>{formatMoney(a.balance, 'AUD')}</Private>
                    </p>
                    <label className="block text-xs text-text-secondary">
                      Set up {a.name}
                      <select
                        aria-label={`Set up ${a.name}`}
                        value={choice.action}
                        disabled={busy}
                        onChange={(e) =>
                          update(a.upAccountId, {
                            action: e.target.value as UpMappingChoice['action'],
                          })
                        }
                        className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-text"
                      >
                        {!a.accountId && <option value="create">Create a new account</option>}
                        <option value="link" disabled={!eligible.length}>
                          Link an existing account
                        </option>
                        <option value="skip">Skip this account</option>
                      </select>
                    </label>
                    {choice.action === 'create' && (
                      <label className="block text-xs text-text-secondary">
                        Account name
                        <input
                          aria-label={`Name for ${a.name}`}
                          value={choice.accountName ?? ''}
                          disabled={busy}
                          onChange={(e) => update(a.upAccountId, { accountName: e.target.value })}
                          className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-text"
                        />
                      </label>
                    )}
                    {choice.action === 'link' && (
                      <select
                        aria-label={`Link ${a.name} to account`}
                        value={choice.accountId ?? ''}
                        disabled={busy}
                        onChange={(e) => update(a.upAccountId, { accountId: e.target.value })}
                        className="w-full rounded-md border border-border bg-surface px-2 py-2 text-text"
                      >
                        <option value="">Choose an account</option>
                        {eligible.map((local) => (
                          <option key={local.id} value={local.id}>
                            {local.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </fieldset>
                );
              })}
            </div>
            <p className="text-xs text-text-tertiary">
              The first sync reads all available history. After importing, review transfers between
              your accounts in the register.
            </p>
            <Button onClick={save} disabled={!canSave || busy || invalidChoice}>
              {busy && <Loader2 size={14} className="animate-spin" />}{' '}
              {busy ? 'Importing Up transactions…' : 'Save & Sync'}
            </Button>
          </>
        )}
        {result && (
          <>
            <p className="text-sm text-text">
              Imported {result.added} transaction{result.added === 1 ? '' : 's'}.
            </p>
            {result.errors.length > 0 && (
              <p role="alert" className="text-sm text-negative">
                {result.errors.join(' ')} Retry using Sync Now in Connected Banks.
              </p>
            )}
            {result.added > 0 ? (
              // Up's own categories are used where they match; sort what is left, a payee at a time
              <SortUncategorised onDone={onClose} />
            ) : (
              <Button onClick={onClose}>Done</Button>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <SavingPausedHint />
      </div>
    </Modal>
  );
}
