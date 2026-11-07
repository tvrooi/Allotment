import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Loader2, UserPlus, Users } from 'lucide-react';
import * as peopleApi from '../../api/people';
import type { AuthStatus, Destination } from '../../api/auth';
import { Button } from '../ui/Button';

// Multi-user mode (docs/MULTI-USER-PLAN.md), Settings → Server. Everyone chooses where their
// password codes go (their phone, email or both); the administrator adds people and lets them back in. Nobody can open
// anyone else's budget from here: invitation and reset codes only let that person choose a
// password.

const inputClass =
  'w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600';

export function PeopleSettings({ status }: { status: AuthStatus }) {
  return (
    <>
      <PasswordCodes status={status} />
      {status.person?.isAdmin && <People />}
    </>
  );
}

type Message = { ok: boolean; text: string } | null;

/**
 * Where this person's password codes go: their phone (a Home Assistant notify service), an
 * email address, or both. A new phone or address is saved only once the code sent there is
 * typed back (docs/MULTI-USER-EMAIL-AND-REMINDERS.md).
 */
function PasswordCodes({ status }: { status: AuthStatus }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState<Message>(null);
  const person = status.person;
  const channel = useMutation({
    mutationFn: peopleApi.setCodeChannel,
    onSuccess: () => {
      setMessage({ ok: true, text: 'Saved.' });
      void qc.invalidateQueries({ queryKey: ['auth-status'] });
    },
    onError: (e: Error) => setMessage({ ok: false, text: e.message }),
  });
  const headingId = useId();
  if (!person || (!status.canNotify && !status.canEmail)) return null;
  const both = Boolean(status.canNotify && status.canEmail && person.notifyService && person.email);
  return (
    <section aria-labelledby={headingId} className="pt-6 border-t border-border-light max-w-md">
      <h2 id={headingId} className="text-sm font-semibold text-text flex items-center gap-1.5">
        <BellRing size={14} className="text-text-tertiary" aria-hidden /> Password codes
      </h2>
      <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
        If you forget your password, a six-digit code is sent here. A new phone or address is saved
        once you type back the code sent to it.
      </p>
      {status.canNotify && (
        <DestinationField destination="phone" saved={person.notifyService} onMessage={setMessage} />
      )}
      {status.canEmail && (
        <DestinationField destination="email" saved={person.email} onMessage={setMessage} />
      )}
      {both && (
        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-text-secondary">Send codes to</legend>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text">
            {(['phone', 'email', 'both'] as const).map((c) => (
              <label key={c} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="code-channel"
                  checked={(person.codeChannel ?? 'both') === c}
                  disabled={channel.isPending}
                  onChange={() => {
                    setMessage(null);
                    channel.mutate(c);
                  }}
                />
                {c === 'phone' ? 'My phone' : c === 'email' ? 'My email' : 'Both'}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {message && (
        <p
          role="status"
          className={`text-xs mt-2 break-words ${message.ok ? 'text-text-secondary' : 'text-negative'}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}

const DESTINATION = {
  phone: {
    label: 'Phone',
    input: 'Notify service',
    placeholder: 'notify.mobile_app_my_phone',
    hint: (
      <>
        Your phone's notify service, as in Home Assistant's Developer tools → Actions, for example{' '}
        <code className="font-mono">notify.mobile_app_my_phone</code>.
      </>
    ),
    shown: (v: string) => `notify.${v}`,
    sentTo: 'your phone',
  },
  email: {
    label: 'Email',
    input: 'Email address',
    placeholder: 'you@example.com',
    hint: null,
    shown: (v: string) => v,
    sentTo: 'that address',
  },
} as const;

/** One destination: what is saved, or a form to add one and confirm it with its code */
function DestinationField({
  destination,
  saved,
  onMessage,
}: {
  destination: Destination;
  saved: string | null;
  onMessage: (m: Message) => void;
}) {
  const qc = useQueryClient();
  const d = DESTINATION[destination];
  const [editing, setEditing] = useState(!saved);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState('');
  const fail = (e: Error) => onMessage({ ok: false, text: e.message });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['auth-status'] });
  const send = useMutation({
    mutationFn: () => peopleApi.addDestination(destination, value.trim()),
    onSuccess: (r) => {
      if (!r.pending) {
        setEditing(false);
        return onMessage({ ok: true, text: 'That one is already saved.' });
      }
      setPending(true);
      setCode('');
      onMessage({
        ok: true,
        text: `A code is on its way to ${d.sentTo}. It works for 10 minutes.`,
      });
    },
    onError: fail,
  });
  const confirm = useMutation({
    mutationFn: () => peopleApi.confirmDestination(destination, code.trim()),
    onSuccess: () => {
      setPending(false);
      setEditing(false);
      setValue('');
      onMessage({ ok: true, text: 'Saved. Password codes can come here.' });
      refresh();
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => peopleApi.removeDestination(destination),
    onSuccess: () => {
      setEditing(true);
      onMessage({ ok: true, text: `${d.label} removed. Codes won't go there.` });
      refresh();
    },
    onError: fail,
  });
  const id = `code-${destination}`;

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-text-secondary" id={`${id}-label`}>
        {d.label}
      </p>
      {saved && !editing ? (
        <div
          className="mt-1 flex flex-wrap items-center gap-2"
          role="group"
          aria-labelledby={`${id}-label`}
        >
          <span className="text-sm text-text font-mono break-all">{d.shown(saved)}</span>
          <span className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Change
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => {
                onMessage(null);
                remove.mutate();
              }}
            >
              Remove
            </Button>
          </span>
        </div>
      ) : pending ? (
        <form
          className="mt-1 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onMessage(null);
            confirm.mutate();
          }}
        >
          <input
            aria-label={`Code sent to ${destination === 'phone' ? 'your phone' : 'your email'}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} font-mono flex-1 min-w-0`}
          />
          <Button type="submit" variant="secondary" disabled={confirm.isPending || !code.trim()}>
            Confirm
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPending(false);
              onMessage(null);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <>
          {d.hint && <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{d.hint}</p>}
          <form
            className="mt-1 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onMessage(null);
              if (value.trim()) send.mutate();
            }}
          >
            <input
              aria-label={d.input}
              type={destination === 'email' ? 'email' : 'text'}
              autoComplete={destination === 'email' ? 'email' : 'off'}
              placeholder={d.placeholder}
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`${inputClass} font-mono flex-1 min-w-0`}
            />
            <Button type="submit" variant="secondary" disabled={send.isPending || !value.trim()}>
              Send code
            </Button>
            {saved && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </form>
        </>
      )}
    </div>
  );
}

/** The administrator's list of people */
function People() {
  const qc = useQueryClient();
  const { data: people = [], isLoading } = useQuery({
    queryKey: ['people'],
    queryFn: peopleApi.getPeople,
  });
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const done = (text: string) => {
    setMessage({ ok: true, text });
    void qc.invalidateQueries({ queryKey: ['people'] });
  };
  const fail = (e: Error) => setMessage({ ok: false, text: e.message });
  const add = useMutation({
    mutationFn: () => peopleApi.addPerson(name.trim()),
    onSuccess: ({ person, inviteCode }) => {
      setName('');
      done(
        `${person.name} has a budget of their own. Give them this invitation code (it works once, for 7 days): ${inviteCode}`,
      );
    },
    onError: fail,
  });
  const invite = useMutation({
    mutationFn: (p: peopleApi.PersonSummary) => peopleApi.newInvite(p.id),
    onSuccess: ({ inviteCode }, p) => done(`New invitation code for ${p.name}: ${inviteCode}`),
    onError: fail,
  });
  const reset = useMutation({
    mutationFn: (p: peopleApi.PersonSummary) => peopleApi.resetCodeToLog(p.id),
    onSuccess: (_r, p) =>
      done(
        `A reset code for ${p.name} is in the server's log (the app's Log in Home Assistant). It works once, for 24 hours, and only lets them choose a new password.`,
      ),
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (p: peopleApi.PersonSummary) => peopleApi.setPersonDisabled(p.id, !p.disabled),
    onSuccess: (p) =>
      done(p.disabled ? `${p.name} can no longer sign in.` : `${p.name} can sign in again.`),
    onError: fail,
  });

  return (
    <section className="pt-6 border-t border-border-light">
      <h2 className="text-sm font-semibold text-text flex items-center gap-1.5">
        <Users size={14} className="text-text-tertiary" aria-hidden /> People
      </h2>
      <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
        Each person has a budget only they can open, with its own password. You can add people, give
        them an invitation code and let them back in if they're locked out, but not open their
        budget.
      </p>
      {isLoading ? (
        <Loader2 size={16} className="mt-3 animate-spin text-text-tertiary" />
      ) : (
        <ul
          aria-label="People"
          className="mt-3 divide-y divide-border-light border border-border-light rounded-md"
        >
          {people.map((p) => (
            <li key={p.id} className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-text">{p.name}</span>
              <span className="text-xs text-text-tertiary">
                {p.isAdmin
                  ? 'administrator'
                  : p.disabled
                    ? 'can’t sign in'
                    : p.hasPassword
                      ? 'signed up'
                      : 'invited'}
              </span>
              {!p.isAdmin && (
                <span className="ml-auto flex flex-wrap gap-1">
                  {!p.hasPassword && !p.disabled && (
                    <Button size="sm" variant="ghost" onClick={() => invite.mutate(p)}>
                      New invitation
                    </Button>
                  )}
                  {p.hasPassword && !p.disabled && (
                    <Button size="sm" variant="ghost" onClick={() => reset.mutate(p)}>
                      Reset password
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(p)}>
                    {p.disabled ? 'Allow sign-in' : 'Stop sign-in'}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 flex gap-2 max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          if (name.trim()) add.mutate();
        }}
      >
        <input
          aria-label="New person's name"
          placeholder="Name"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <Button type="submit" disabled={add.isPending || !name.trim()}>
          <UserPlus size={14} /> Add person
        </Button>
      </form>
      {message && (
        <p
          role="status"
          className={`text-xs mt-2 leading-relaxed break-words ${message.ok ? 'text-text-secondary' : 'text-negative'}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
