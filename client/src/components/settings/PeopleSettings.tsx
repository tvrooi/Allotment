import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Loader2, UserPlus, Users } from 'lucide-react';
import * as peopleApi from '../../api/people';
import type { AuthStatus } from '../../api/auth';
import { Button } from '../ui/Button';

// Multi-user mode (docs/MULTI-USER-PLAN.md), Settings → Server. Everyone chooses where their
// password codes go; the administrator adds people and lets them back in. Nobody can open
// anyone else's budget from here: invitation and reset codes only let that person choose a
// password.

const inputClass =
  'w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600';

export function PeopleSettings({ status }: { status: AuthStatus }) {
  return (
    <>
      <PhoneCodes status={status} />
      {status.person?.isAdmin && <People />}
    </>
  );
}

/** Where this person's password codes go: a Home Assistant notify service */
function PhoneCodes({ status }: { status: AuthStatus }) {
  const qc = useQueryClient();
  const [service, setService] = useState(status.person?.notifyService ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const save = useMutation({
    mutationFn: () => peopleApi.setMyNotifyService(service.trim() || null),
    onSuccess: ({ notifyService }) => {
      setService(notifyService ?? '');
      setMessage({ ok: true, text: notifyService ? 'Saved.' : 'Codes will not be sent.' });
      void qc.invalidateQueries({ queryKey: ['auth-status'] });
    },
    onError: (e: Error) => setMessage({ ok: false, text: e.message }),
  });
  const test = useMutation({
    mutationFn: peopleApi.testMyNotifyService,
    onSuccess: () => setMessage({ ok: true, text: 'Sent. Check your phone.' }),
    onError: (e: Error) => setMessage({ ok: false, text: e.message }),
  });
  if (!status.canNotify) return null;
  return (
    <section className="pt-6 border-t border-border-light max-w-md">
      <h2 className="text-sm font-semibold text-text flex items-center gap-1.5">
        <BellRing size={14} className="text-text-tertiary" aria-hidden /> Password codes to your
        phone
      </h2>
      <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
        If you forget your password, a code is sent as a Home Assistant notification. Enter your
        phone's notify service, as in Home Assistant's Developer tools → Actions, for example{' '}
        <code className="font-mono">notify.mobile_app_my_phone</code>.
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          save.mutate();
        }}
      >
        <input
          aria-label="Notify service"
          placeholder="notify.mobile_app_my_phone"
          spellCheck={false}
          value={service}
          onChange={(e) => setService(e.target.value)}
          className={`${inputClass} font-mono`}
        />
        <Button type="submit" variant="secondary" disabled={save.isPending}>
          Save
        </Button>
        {status.person?.notifyService && (
          <Button
            type="button"
            variant="ghost"
            disabled={test.isPending}
            onClick={() => {
              setMessage(null);
              test.mutate();
            }}
          >
            Test
          </Button>
        )}
      </form>
      {message && (
        <p
          role="status"
          className={`text-xs mt-2 ${message.ok ? 'text-text-secondary' : 'text-negative'}`}
        >
          {message.text}
        </p>
      )}
    </section>
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
