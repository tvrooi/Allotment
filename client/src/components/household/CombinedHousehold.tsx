import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Link2 } from 'lucide-react';
import {
  acceptCombine,
  askToCombine,
  endCombine,
  getCombinedRegister,
  getSharing,
  saveSharedNote,
  type CombinedEntry,
  type CombinedRegister,
  type HouseholdLink,
} from '../../api/sharedHouseholds';
import { useAuthStatus } from '../../hooks/useServer';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';
import { ConfirmModal } from '../ui/ConfirmModal';
import { PayeeIcon } from '../payees/PayeeIcon';

// Household → Combine (multi-user mode only): join this household with one another person
// keeps in their own budget. Each sees both households' entries, splits and merchants, and
// edits only their own; the one note on each entry is shared and either can edit it.

const card = 'bg-surface rounded-lg shadow-card border border-border-light p-4';

const KIND: Record<CombinedEntry['kind'], string> = {
  expense: 'Expense',
  contribution: 'Contribution',
  settlement: 'Repayment',
  refund: 'Refund',
};

interface Props {
  group: { id: string; name: string; currency: string };
  people: { id: string; name: string; isSelf: number }[];
}

export function CombinedHousehold({ group, people }: Props) {
  const { data: auth } = useAuthStatus();
  const multiUser = Boolean(auth?.multiUser);
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [partnerPersonId, setPartnerPersonId] = useState('');
  const [stopping, setStopping] = useState<HouseholdLink | null>(null);
  const { data } = useQuery({
    queryKey: ['shared-households'],
    queryFn: getSharing,
    enabled: multiUser,
  });
  const refresh = async () => {
    setError('');
    await qc.invalidateQueries({ queryKey: ['shared-households'] });
  };
  const onError = (e: Error) => setError(e.message);
  const ask = useMutation({ mutationFn: askToCombine, onSuccess: refresh, onError });
  const accept = useMutation({
    mutationFn: (link: HouseholdLink) =>
      acceptCombine(link.id, { groupId: group.id, partnerPersonId }),
    onSuccess: refresh,
    onError,
  });
  const end = useMutation({
    mutationFn: (l: HouseholdLink) => endCombine(l.id),
    onSuccess: refresh,
    onError,
  });

  // Only with separate sign-ins: without them there's nobody else to combine with
  if (!multiUser || !data) return null;
  const others = people.filter((p) => !p.isSelf);
  const link = data.links.find((l) => l.groupId === group.id);
  const asked = data.links.filter((l) => l.role === 'invitee' && l.status === 'pending');
  const whoIsThem = (label: string) => (
    <Select
      aria-label={label}
      value={partnerPersonId}
      onChange={(e) => setPartnerPersonId(e.target.value)}
    >
      <option value="">Who are they in {group.name}?</option>
      {others.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </Select>
  );

  return (
    <section className={card} aria-labelledby="household-combine">
      <h2
        id="household-combine"
        className="text-sm font-semibold text-text flex items-center gap-1.5"
      >
        <Link2 size={14} aria-hidden /> Combine with another FlyBudget user
      </h2>
      <p className="text-xs text-text-tertiary mt-0.5">
        Join this household with the one another person keeps in their own budget. You each see both
        households' entries, splits and merchants, and share one note on each entry. Nobody sees
        your accounts, categories, balances or other transactions, and either of you can stop at any
        time.
      </p>
      {error && (
        <p role="alert" className="text-xs text-negative mt-2">
          {error}
        </p>
      )}

      {!link &&
        asked.map((l) => (
          <div key={l.id} className="mt-3 rounded-md bg-surface-alt p-3 space-y-2">
            <p className="text-sm text-text">
              <strong>{l.partner.name}</strong> asked to combine one of their households with yours.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-56">{whoIsThem(`Who ${l.partner.name} is in ${group.name}`)}</div>
              <Button
                size="sm"
                disabled={!partnerPersonId || accept.isPending}
                onClick={() => accept.mutate(l)}
              >
                Combine with {group.name}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => end.mutate(l)}>
                Decline
              </Button>
            </div>
          </div>
        ))}

      {!link && asked.length === 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {data.people.length === 0 ? (
            <p className="text-xs text-text-secondary">
              Nobody else uses FlyBudget on this server yet. The administrator adds people in
              Settings → Server → People.
            </p>
          ) : (
            <>
              <div className="w-48">
                <Select
                  aria-label="Combine with"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  <option value="">Combine with…</option>
                  {data.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-56">{whoIsThem('Who they are in this household')}</div>
              <Button
                size="sm"
                disabled={!partnerId || !partnerPersonId || ask.isPending}
                onClick={() => ask.mutate({ partnerId, groupId: group.id, partnerPersonId })}
              >
                Ask to combine
              </Button>
            </>
          )}
        </div>
      )}

      {link?.status === 'pending' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-text-secondary">
            Waiting for <strong>{link.partner.name}</strong> to accept.
          </p>
          <Button size="sm" variant="secondary" onClick={() => end.mutate(link)}>
            Cancel
          </Button>
        </div>
      )}

      {link?.status === 'active' && (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text">
              Combined with <strong>{link.partner.name}</strong>.
            </p>
            <Button size="sm" variant="secondary" onClick={() => setStopping(link)}>
              Stop combining
            </Button>
          </div>
          <Register linkId={link.id} />
        </>
      )}

      <ConfirmModal
        isOpen={stopping !== null}
        onClose={() => setStopping(null)}
        onConfirm={() => {
          if (stopping) end.mutate(stopping);
          setStopping(null);
        }}
        title="Stop combining"
        message={`${stopping?.partner.name ?? 'They'} will no longer see this household's entries, and you won't see theirs. The shared notes are deleted. Both households keep their own entries.`}
        confirmLabel="Stop combining"
        danger
      />
    </section>
  );
}

/** Both households' entries, newest first, with combined balances */
function Register({ linkId }: { linkId: string }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['shared-households', linkId, 'register'],
    queryFn: () => getCombinedRegister(linkId),
  });
  const [open, setOpen] = useState<string | null>(null);
  if (isLoading) return <div className="h-24 mt-3 bg-surface-alt rounded-lg animate-pulse" />;
  if (error)
    return (
      <p role="alert" className="text-xs text-negative mt-3">
        {(error as Error).message}
      </p>
    );
  if (!data) return null;
  const money = (n: number) => formatMoney(n, data.currency);
  const nameOf = (key: string | null, ownerId: string) =>
    key
      ? (data.people.find((p) => p.key === key)?.name ?? '?')
      : `Pool (${data.households.find((h) => h.ownerId === ownerId)?.name ?? 'household'})`;

  return (
    <div className="mt-3 space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-text-secondary">Balances, both households</h3>
        <ul className="mt-1 divide-y divide-border-light border-t border-border-light">
          {data.people.map((p) => (
            <li key={p.key} className="flex justify-between py-1.5 text-sm">
              <span className="text-text">
                {p.name}
                {p.isMe && <span className="text-text-tertiary"> (you)</span>}
              </span>
              <span
                className={`tabular-nums ${p.balance < 0 ? 'text-negative' : p.balance > 0 ? 'text-positive' : 'text-text-secondary'}`}
              >
                {money(p.balance)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-text-secondary">Entries</h3>
        {data.entries.length === 0 ? (
          <p className="text-xs text-text-tertiary mt-1">No entries in either household yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border-light border-t border-border-light">
            {data.entries.map((e) => (
              <li key={e.key}>
                <button
                  type="button"
                  aria-expanded={open === e.key}
                  onClick={() => setOpen(open === e.key ? null : e.key)}
                  className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-hover rounded"
                >
                  <PayeeIcon
                    name={e.merchant?.name ?? e.description}
                    logo={e.merchant?.logo ?? null}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-text truncate">
                      {e.merchant?.name ?? e.description}
                    </span>
                    <span className="block text-xs text-text-tertiary">
                      {formatDay(e.date)} · {KIND[e.kind]} ·{' '}
                      {e.mine ? 'Yours' : `${data.link.partner.name}'s`}
                      {e.note && ' · Note'}
                    </span>
                  </span>
                  {e.possibleDuplicate && (
                    <AlertTriangle
                      size={14}
                      className="text-caution shrink-0"
                      aria-label="Possible duplicate"
                    />
                  )}
                  <span className="text-sm tabular-nums text-text shrink-0">{money(e.amount)}</span>
                </button>
                {open === e.key && (
                  <EntryDetail
                    entry={e}
                    register={data}
                    linkId={linkId}
                    nameOf={nameOf}
                    money={money}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EntryDetail({
  entry: e,
  register,
  linkId,
  nameOf,
  money,
}: {
  entry: CombinedEntry;
  register: CombinedRegister;
  linkId: string;
  nameOf: (key: string | null, ownerId: string) => string;
  money: (n: number) => string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState(e.note?.text ?? '');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => saveSharedNote(linkId, { ownerId: e.ownerId, eventId: e.eventId, text }),
    onSuccess: async () => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['shared-households', linkId, 'register'] });
    },
    onError: (err: Error) => setError(err.message),
  });
  const original = e.reverses ? register.entries.find((o) => o.key === e.reverses) : undefined;
  return (
    <div className="mb-3 ml-9 rounded-md bg-surface-alt p-3 text-xs text-text-secondary space-y-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt>Description</dt>
        <dd className="text-text">{e.description}</dd>
        {e.merchant && (
          <>
            <dt>Merchant</dt>
            <dd className="text-text">{e.merchant.name}</dd>
          </>
        )}
        <dt>Date</dt>
        <dd className="text-text">{formatDay(e.date)}</dd>
        <dt>{e.kind === 'settlement' ? 'From' : 'Paid by'}</dt>
        <dd className="text-text">{nameOf(e.payer, e.ownerId)}</dd>
        {e.recipient && (
          <>
            <dt>To</dt>
            <dd className="text-text">{nameOf(e.recipient, e.ownerId)}</dd>
          </>
        )}
        <dt>Recorded by</dt>
        <dd className="text-text">
          {e.mine ? 'You' : register.link.partner.name}
          {e.fromBank ? ', from a bank payment' : ''}
        </dd>
        {original && (
          <>
            <dt>Refunds</dt>
            <dd className="text-text">
              {original.description}, {formatDay(original.date)}
            </dd>
          </>
        )}
      </dl>
      {e.shares.length > 0 && (
        <table className="w-full max-w-xs">
          <caption className="text-left font-semibold text-text-secondary mb-0.5">Split</caption>
          <tbody>
            {e.shares.map((s) => (
              <tr key={s.person}>
                <td className="py-0.5 text-text">{nameOf(s.person, e.ownerId)}</td>
                <td className="py-0.5 text-right tabular-nums text-text">{money(s.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {e.reviewReason && <p className="text-caution">Needs review: {e.reviewReason}</p>}
      {e.possibleDuplicate && (
        <p className="text-caution">
          You both recorded an expense of {money(e.amount)} on this day. If it's the same one,
          whoever didn't pay should remove theirs.
        </p>
      )}
      <div>
        <label className="block font-semibold text-text-secondary" htmlFor={`note-${e.key}`}>
          Shared note
        </label>
        <textarea
          id={`note-${e.key}`}
          value={text}
          maxLength={2000}
          rows={2}
          onChange={(ev) => setText(ev.target.value)}
          placeholder="What it was for: you can both edit this"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text focus:border-brand-600 focus:outline-none"
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-text-tertiary">
            {e.note && `Last changed by ${e.note.updatedBy}`}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={save.isPending || text.trim() === (e.note?.text ?? '')}
            onClick={() => save.mutate()}
          >
            Save note
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-negative mt-1">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
