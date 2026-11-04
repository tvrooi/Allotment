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
  getAssistantActivity,
  getChangeSets,
  revokeAccessToken,
  redoChangeSet,
  undoChangeSet,
  type AccessToken,
  type AccessTokenScope,
  type CreatedAccessToken,
} from '../../api/accessTokens';

// Settings → Server → Read-only access: tokens that let another tool, such as an AI assistant
// or an MCP client, read this budget. They can't sign in, download backups or see bank
// connections. A categorise token can also set past transactions' categories and edit
// categories; an organise token can also propose rules (disabled until enabled here, in Rules),
// set payee default categories and logos, link suggested transfers and claim past transactions
// as tax deductions (docs/READ-ONLY-ACCESS.md). Their category changes are listed below, each one
// undoable, and an undone one can be redone.

const DAYS = [7, 30, 90];
const inputClass =
  'w-full px-3 py-1.5 text-sm border border-border rounded-md bg-surface text-text focus:border-brand-600 focus:outline-none';

function status(t: AccessToken) {
  if (t.revokedAt) return 'Revoked';
  if (!t.active) return 'Expired';
  const used = t.lastUsedAt
    ? `used ${formatDistanceToNow(new Date(t.lastUsedAt), { addSuffix: true })}`
    : 'not used yet';
  const scope =
    t.scope === 'organise'
      ? 'Read, categorise and organise · '
      : t.scope === 'categorise'
        ? 'Read and categorise · '
        : '';
  return `${scope}Expires ${formatDay(t.expiresAt.slice(0, 10))} · ${used}`;
}

export function ReadOnlyAccess() {
  const qc = useQueryClient();
  const { data: tokens = [] } = useQuery({ queryKey: ['access-tokens'], queryFn: getAccessTokens });
  const refresh = () => qc.invalidateQueries({ queryKey: ['access-tokens'] });
  const create = useMutation({ mutationFn: createAccessToken, onSuccess: refresh });
  const revoke = useMutation({ mutationFn: revokeAccessToken, onSuccess: refresh });
  const [name, setName] = useState('');
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState<AccessTokenScope>('read');
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
        read: it can't change anything, sign in, download backups or see bank connections. A{' '}
        <em>read and categorise</em> token can also set the category of past transactions and create
        or edit categories. A <em>read, categorise and organise</em> token can also propose rules
        (they stay off until you turn them on in Rules), set payee default categories, set payee
        logos, link transfers the app suggests and claim past transactions as tax deductions (it
        never changes or removes a claim). A token expires, you can revoke it here, and changing the
        password revokes them all.
      </p>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setCopied(false);
          create.mutate(
            { name: name.trim(), days, scope },
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
        <label>
          <span className="block text-xs font-medium text-text-secondary mb-1">Access</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as AccessTokenScope)}
            className={inputClass}
          >
            <option value="read">Read only</option>
            <option value="categorise">Read and categorise</option>
            <option value="organise">Read, categorise and organise</option>
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
      <AssistantChanges />
      <AssistantActivity />
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

/** Category changes made with tokens, newest first, each one undoable and then redoable */
function AssistantChanges() {
  const qc = useQueryClient();
  const { data: sets = [] } = useQuery({ queryKey: ['change-sets'], queryFn: getChangeSets });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['change-sets'] });
    void qc.invalidateQueries({ queryKey: ['transactions'] });
    void qc.invalidateQueries({ queryKey: ['budget'] });
  };
  const undo = useMutation({ mutationFn: undoChangeSet, onSuccess: refresh });
  const redo = useMutation({ mutationFn: redoChangeSet, onSuccess: refresh });
  const busy = undo.isPending || redo.isPending;
  if (!sets.length) return null;
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-text-secondary">Changes made with tokens</h3>
      <p className="text-xs text-text-tertiary mt-0.5">
        Undo puts back the previous categories, and Redo sets the token's again. A transaction you
        edited since keeps your change.
      </p>
      <ul aria-label="Changes made with tokens" className="mt-2 divide-y divide-border-light">
        {sets.slice(0, 20).map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text truncate">
                {c.tokenName}: {c.transactionCount} transaction
                {c.transactionCount === 1 ? '' : 's'} ({c.tool.replaceAll('_', ' ')})
              </p>
              <p className="text-xs text-text-tertiary">
                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                {c.undoneAt ? ' · undone' : ''}
              </p>
            </div>
            {c.undoneAt ? (
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Redo ${c.tokenName}'s change`}
                disabled={busy}
                onClick={() => redo.mutate(c.id)}
              >
                Redo
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Undo ${c.tokenName}'s change`}
                disabled={busy}
                onClick={() => undo.mutate(c.id)}
              >
                Undo
              </Button>
            )}
          </li>
        ))}
      </ul>
      {(undo.error ?? redo.error) && (
        <p className="text-xs text-negative mt-2">{(undo.error ?? redo.error)?.message}</p>
      )}
    </div>
  );
}

const OUTCOMES = {
  applied: { label: 'Done', className: 'text-positive' },
  failed: { label: 'Not done', className: 'text-text-tertiary' },
  refused: { label: 'Refused', className: 'text-negative' },
} as const;

/**
 * Everything a token asked to change, newest first: done, not done (the app's own rules said
 * no) or refused (not something a token may do). Audit decision I-11.
 */
function AssistantActivity() {
  const { data } = useQuery({
    queryKey: ['assistant-activity'],
    queryFn: () => getAssistantActivity(50),
  });
  const [open, setOpen] = useState(false);
  const actions = data?.actions ?? [];
  if (!actions.length) return null;
  const summaries = new Map((data?.policy ?? []).map((p) => [p.name, p.summary]));
  const refused = actions.filter((a) => a.outcome === 'refused').length;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-text-secondary">Assistant activity</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Every change a token asked for, with what happened.
            {refused ? ` ${refused} refused recently.` : ''}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide' : 'Show'}
        </Button>
      </div>
      {open && (
        <ul aria-label="Assistant activity" className="mt-2 divide-y divide-border-light">
          {actions.map((a) => {
            const outcome = OUTCOMES[a.outcome];
            return (
              <li key={a.id} className="py-2">
                <p className="text-sm text-text">
                  {a.tokenName}: {(a.action && summaries.get(a.action)) ?? `${a.method} ${a.path}`}
                  {a.tool ? (
                    <span className="text-text-tertiary"> ({a.tool.replaceAll('_', ' ')})</span>
                  ) : null}
                </p>
                <p className="text-xs text-text-tertiary">
                  <span className={`font-medium ${outcome.className}`}>{outcome.label}</span>
                  {' · '}
                  {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  {a.reason ? ` · ${a.reason}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
