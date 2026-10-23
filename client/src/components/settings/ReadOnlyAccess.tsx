import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Copy, KeyRound } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { formatDay } from '../../utils/dates';
import {
  createAccessToken,
  getAccessTokens,
  revokeAccessToken,
  type AccessToken,
  type CreatedAccessToken,
} from '../../api/accessTokens';

// Settings → Server → Read-only access: tokens that let another tool, such as an AI assistant
// or an MCP client, read this budget. They can't change anything, sign in, download backups or
// see bank connections (docs/READ-ONLY-ACCESS.md).

const DAYS = [7, 30, 90];
const inputClass =
  'w-full px-3 py-1.5 text-sm border border-border rounded-md bg-surface text-text focus:border-brand-600 focus:outline-none';

function status(t: AccessToken) {
  if (t.revokedAt) return 'Revoked';
  if (!t.active) return 'Expired';
  const used = t.lastUsedAt
    ? `used ${formatDistanceToNow(new Date(t.lastUsedAt), { addSuffix: true })}`
    : 'not used yet';
  return `Expires ${formatDay(t.expiresAt.slice(0, 10))} · ${used}`;
}

export function ReadOnlyAccess() {
  const qc = useQueryClient();
  const { data: tokens = [] } = useQuery({ queryKey: ['access-tokens'], queryFn: getAccessTokens });
  const refresh = () => qc.invalidateQueries({ queryKey: ['access-tokens'] });
  const create = useMutation({ mutationFn: createAccessToken, onSuccess: refresh });
  const revoke = useMutation({ mutationFn: revokeAccessToken, onSuccess: refresh });
  const [name, setName] = useState('');
  const [days, setDays] = useState(30);
  const [created, setCreated] = useState<CreatedAccessToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<AccessToken | null>(null);
  const mcpUrl = `${window.location.origin}/api/mcp`;
  // Every active token (at most 10) stays listed so it can be revoked; then recent expired ones
  const shown = [
    ...tokens.filter((t) => t.active),
    ...tokens.filter((t) => !t.active && !t.revokedAt).slice(0, 10),
  ];

  return (
    <section className="pt-6 border-t border-border-light">
      <h2 className="text-sm font-semibold text-text">Read-only access</h2>
      <p className="text-xs text-text-tertiary mt-1">
        Let another tool, such as an AI assistant, read this budget with a token. A token can only
        read: it can't change anything, sign in, download backups or see bank connections. It
        expires, you can revoke it here, and changing the password revokes them all.
      </p>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setCopied(false);
          create.mutate(
            { name: name.trim(), days },
            {
              onSuccess: (t) => {
                setCreated(t);
                setName('');
              },
            },
          );
        }}
      >
        <label className="flex-1 min-w-40">
          <span className="block text-xs font-medium text-text-secondary mb-1">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Claude"
            maxLength={60}
            className={inputClass}
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-text-secondary mb-1">Expires after</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className={inputClass}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          <KeyRound size={14} /> Create token
        </Button>
      </form>
      {create.error && <p className="text-xs text-negative mt-2">{create.error.message}</p>}

      {created && (
        <div
          role="status"
          className="mt-3 rounded-md border border-caution/40 bg-caution/10 p-3 space-y-2"
        >
          <p className="text-xs text-text">
            Copy <strong>{created.name}</strong>'s token now: it won't be shown again. Store it as a
            secret (for example an environment secret), never in chat or a repository.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded bg-surface px-2 py-1 text-xs">
              {created.token}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(created.token).then(() => setCopied(true));
              }}
            >
              <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-text-tertiary">
            Send it as <code>Authorization: Bearer &lt;token&gt;</code>. MCP clients connect to{' '}
            <code>{mcpUrl}</code>.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>
            Done
          </Button>
        </div>
      )}

      {shown.length > 0 && (
        <ul aria-label="Access tokens" className="mt-3 divide-y divide-border-light">
          {shown.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text truncate">{t.name}</p>
                <p className="text-xs text-text-tertiary">{status(t)}</p>
              </div>
              {t.active && (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Revoke ${t.name}`}
                  onClick={() => setRevoking(t)}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        isOpen={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          if (revoking) revoke.mutate(revoking.id);
          setRevoking(null);
        }}
        title="Revoke token"
        message={`Revoke "${revoking?.name ?? ''}"? Anything using it loses access immediately.`}
        confirmLabel="Revoke"
        danger
      />
    </section>
  );
}
