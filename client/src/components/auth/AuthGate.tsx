import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';
import { AUTH_REQUIRED_EVENT, NetworkError } from '../../api/client';
import * as authApi from '../../api/auth';
import {
  PERSON_CHANGED_EVENT,
  PERSON_STORAGE_KEY,
  setSignedInPerson,
  signedInPerson,
} from '../../api/person';
import { appModeFrom } from '../../hooks/useServer';
import { loadOutbox } from '../../offline/outbox';
import { OutboxSender } from '../../offline/OutboxSender';
import { useBudgetCurrencySync } from '../../hooks/useCurrency';
import { clearOfflineCopy, useOfflineCopy } from '../../offline/snapshot';
import { useConnectionStore } from '../../store/connectionStore';
import { connectionSecurity } from '../../utils/connection';
import { ReconnectScreen } from '../connection/ReconnectScreen';
import { Button } from '../ui/Button';
import { AuthScreen } from './AuthScreen';
import { MIN_PASSWORD_LENGTH } from './passwordRules';

/** Multi-user mode: the person whose budget this page has shown since it loaded */
let shownPerson: string | null = null;
let restarting = false;

/**
 * Loads this page again from nothing, dropping everything it held for the last person.
 * Their offline copy is deleted first.
 */
function restart() {
  if (restarting) return;
  restarting = true;
  void clearOfflineCopy().finally(() => window.location.reload());
}

/**
 * Shows the login (or first-run setup) screen when FlyBudget runs as a server and
 * this browser isn't signed in. In the desktop app and dev mode login is disabled,
 * so this renders the app straight away. If the server can't be reached on startup it
 * opens with this device's offline copy (read-only, see offline/snapshot.ts) or, without
 * one, shows a reconnect screen that keeps retrying; the app loads once it answers.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const {
    data: status,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['auth-status'],
    queryFn: authApi.getAuthStatus,
    staleTime: Infinity,
    // Can't reach the server: show the reconnect screen straight away (it retries itself)
    retry: (failures, err) => !(err instanceof NetworkError) && failures < 1,
  });

  // Back online (after a failed start or mid-session): refresh everything on screen
  const reconnectedAt = useConnectionStore((s) => s.reconnectedAt);
  useEffect(() => {
    if (reconnectedAt !== null) void qc.invalidateQueries();
  }, [reconnectedAt, qc]);

  const hasOfflineCopy = useOfflineCopy((s) => s.restored);
  const loginRequired = !!status && status.enabled && !status.authenticated;
  // Signed out (expired, signed out elsewhere, password changed): forget this device's copy
  useEffect(() => {
    if (!loginRequired) return;
    setSignedInPerson(null);
    // Multi-user mode: someone used this page, and the next person may sign in on it. Start
    // again, so nothing of theirs stays in memory (undo history, toasts, stores, cache).
    if (shownPerson) restart();
    else void clearOfflineCopy();
  }, [loginRequired]);

  // Multi-user mode: remember who signed in, so requests, the offline copy and waiting
  // transactions belong to them (api/person.ts). Someone else's data never stays on screen.
  const personId = status?.authenticated ? status.person?.id : undefined;
  useEffect(() => {
    if (!personId) return;
    const before = signedInPerson();
    setSignedInPerson(personId);
    shownPerson = personId;
    if (before === personId) return;
    // The page opened with someone else's offline copy (their session ended elsewhere)
    if (before) return restart();
    void loadOutbox();
  }, [personId]);

  // Multi-user mode: another person signed in on this browser (in another tab, which shares
  // the session cookie), so this page's data is someone else's. Start again as them.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PERSON_STORAGE_KEY || e.newValue === signedInPerson()) return;
      if (e.newValue && signedInPerson()) restart();
      // Signed out, or signed in from this page's sign-in screen: ask who it is now
      else void qc.invalidateQueries({ queryKey: ['auth-status'] });
    };
    window.addEventListener(PERSON_CHANGED_EVENT, restart);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PERSON_CHANGED_EVENT, restart);
      window.removeEventListener('storage', onStorage);
    };
  }, [qc]);

  // A request came back "login required" (session expired or signed out elsewhere)
  useEffect(() => {
    const onAuthRequired = () => {
      void clearOfflineCopy();
      void qc.invalidateQueries({ queryKey: ['auth-status'] });
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
  }, [qc]);

  const app = (
    <>
      {children}
      <OutboxSender />
      <BudgetCurrencySync />
    </>
  );

  // Can't reach the server (or still asking) but this device has a copy: open with it.
  // Saving waits for the connection, except new transactions (they wait on the device).
  if ((isLoading || isError || !status) && hasOfflineCopy) return app;
  // Multi-user mode: a page that showed someone reloads before the sign-in screen (restart)
  if (isLoading || (loginRequired && shownPerson)) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-alt">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }
  if (isError || !status) {
    return <ReconnectScreen mode={appModeFrom(status)} onRetry={() => void refetch()} />;
  }
  if (!status.enabled || status.authenticated) return app;

  const onSignedIn = () => {
    // Everything cached before signing in is stale. Not qc.clear(): that would also detach
    // the auth-status query this component is subscribed to, and the update below would
    // never reach it (the sign-in screen stayed up until a reload).
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth-status' });
    qc.setQueryData(['auth-status'], { ...status, needsSetup: false, authenticated: true });
    // Then who signed in (multi-user mode: their name and whether they administer people)
    void qc.invalidateQueries({ queryKey: ['auth-status'] });
  };
  return (
    <PasswordForm
      mode={status.needsSetup ? 'setup' : 'login'}
      multiUser={Boolean(status.multiUser)}
      onDone={onSignedIn}
    />
  );
}

type FormMode = 'setup' | 'login' | 'invite' | 'forgot' | 'reset';

const TITLES: Record<FormMode, string> = {
  setup: 'Set up your FlyBudget server',
  login: 'Sign in to FlyBudget',
  invite: 'Join this FlyBudget server',
  forgot: 'Forgot your password?',
  reset: 'Choose a new password',
};

/**
 * Sign-in, first-run setup and, in multi-user mode (the gateway), signing in by name,
 * accepting an invitation and resetting a forgotten password with a code.
 */
function PasswordForm({
  mode: startMode,
  multiUser,
  onDone,
}: {
  mode: 'setup' | 'login';
  multiUser: boolean;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<FormMode>(startMode);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSetup = mode === 'setup';
  // Choosing a new password: first-run setup, an invitation or a reset code
  const choosing = mode === 'setup' || mode === 'invite' || mode === 'reset';
  const needsCode = mode === 'setup' || mode === 'invite' || mode === 'reset';
  const needsName = multiUser;

  function go(next: FormMode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setCode('');
    setPassword('');
    setConfirm('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (choosing && password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (choosing && password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const { message } = await authApi.forgotPassword(name);
        setBusy(false);
        setMode('reset');
        setNotice(message);
        return;
      }
      if (mode === 'setup')
        await authApi.setupPassword(password, code, multiUser ? name : undefined);
      else if (mode === 'login') await authApi.login(password, multiUser ? name : undefined);
      else if (mode === 'invite') await authApi.acceptInvite(name, code, password);
      else await authApi.resetPassword(name, code, password);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const inputClass =
    'w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600';
  const labelClass = 'block text-sm font-medium text-text-secondary mb-1';
  const linkClass = 'text-xs text-brand-600 hover:text-brand-700 font-medium';
  const { host, hostname, protocol } = window.location;
  const unencrypted = connectionSecurity(protocol, hostname) === 'unencrypted';
  const submitLabel = {
    setup: 'Create password',
    login: 'Sign in',
    invite: 'Set password and sign in',
    forgot: 'Send me a code',
    reset: 'Set password and sign in',
  }[mode];

  return (
    <AuthScreen
      title={TITLES[mode]}
      subtitle={
        <>
          <span className="block font-mono text-xs break-all" aria-label="Server address">
            {host}
          </span>
          {isSetup && (
            <span className="block mt-2">
              {multiUser
                ? 'You become the administrator, and the budget already on this server becomes yours. You can add other people afterwards; each gets a budget only they can open.'
                : 'Create the password that protects this server. Anyone who can reach it will need this password.'}
            </span>
          )}
          {mode === 'invite' && (
            <span className="block mt-2">
              Enter your name as the administrator added it, and the invitation code they gave you.
            </span>
          )}
          {mode === 'forgot' && (
            <span className="block mt-2">
              A code goes to the phone you chose in Settings. The administrator's code is also
              written to the server's log (the app's Log in Home Assistant).
            </span>
          )}
        </>
      }
    >
      {unencrypted && (
        <div
          role="note"
          className="flex gap-2 mb-4 p-3 rounded-md bg-caution-subtle border border-caution/30 text-xs text-text leading-relaxed"
        >
          <AlertTriangle size={14} className="text-caution shrink-0 mt-0.5" aria-hidden />
          <p>
            <span className="font-semibold">Not a secure connection.</span> Your password would
            travel unencrypted. Only continue on a network you trust.
          </p>
        </div>
      )}
      {notice && (
        <p role="status" className="mb-4 text-xs text-text-secondary leading-relaxed">
          {notice}
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        {needsName && (
          <div>
            <label htmlFor="name" className={labelClass}>
              {isSetup ? 'Your name' : 'Name'}
            </label>
            <input
              id="name"
              autoComplete="username"
              autoFocus={!isSetup}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
        {needsCode && (
          <div>
            <label htmlFor="setup-code" className={labelClass}>
              {isSetup ? 'Setup code' : mode === 'invite' ? 'Invitation code' : 'Code'}
            </label>
            <input
              id="setup-code"
              autoComplete="one-time-code"
              spellCheck={false}
              autoFocus={isSetup}
              placeholder={
                mode === 'reset' ? '123456 or XXXX-XXXX-XXXX-XXXX' : 'XXXX-XXXX-XXXX-XXXX'
              }
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} font-mono uppercase`}
            />
            {isSetup && (
              <p className="text-xs text-text-tertiary mt-1">
                Printed in the server log. With Docker, run{' '}
                <code className="font-mono">docker logs flybudget</code>.
              </p>
            )}
          </div>
        )}
        {mode !== 'forgot' && (
          <div>
            <label htmlFor="password" className={labelClass}>
              {choosing ? 'New password' : 'Password'}
            </label>
            <input
              id="password"
              type="password"
              autoComplete={choosing ? 'new-password' : 'current-password'}
              autoFocus={!isSetup && !needsName}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
        {choosing && (
          <div>
            <label htmlFor="confirm" className={labelClass}>
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
        {error && <p className="text-xs text-negative">{error}</p>}
        <Button
          type="submit"
          className="w-full"
          disabled={
            busy ||
            (needsName && !name.trim()) ||
            (mode !== 'forgot' && !password) ||
            (needsCode && !code)
          }
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
          {submitLabel}
        </Button>
      </form>
      {multiUser && !isSetup && (
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {mode !== 'login' && (
            <button type="button" className={linkClass} onClick={() => go('login')}>
              Back to sign in
            </button>
          )}
          {mode === 'login' && (
            <>
              <button type="button" className={linkClass} onClick={() => go('forgot')}>
                Forgot password?
              </button>
              <button type="button" className={linkClass} onClick={() => go('invite')}>
                I have an invitation
              </button>
            </>
          )}
          {mode === 'forgot' && (
            <button type="button" className={linkClass} onClick={() => go('reset')}>
              I already have a code
            </button>
          )}
        </div>
      )}
    </AuthScreen>
  );
}

/** Keeps the budget's currency where amounts are formatted (see useBudgetCurrencySync) */
function BudgetCurrencySync() {
  useBudgetCurrencySync();
  return null;
}
