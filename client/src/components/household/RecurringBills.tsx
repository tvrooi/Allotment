import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSchedules } from '../../hooks/useSchedules';
import {
  shareBillPayments,
  shareRecurringBills,
  unshareRecurringBill,
  updateRecurringBill,
  type HouseholdSplit,
  type SharedRecurringBill,
} from '../../api/households';
import { SplitEditor, describeSplit } from './SplitEditor';
import { FREQ_LABEL } from '../recurring/scheduleFormat';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { Button } from '../ui/Button';

// Household → Recurring bills: items from Recurring (power, gas, internet, water…) shared with
// the household. Each shows its next date, everyone's share with its split (its own or the
// household's default), and its recent payments. Past payments are shared with one click; new
// ones are shared as they arrive only when the bill is set to.

const card = 'bg-surface rounded-lg shadow-card border border-border-light p-4';
const plural = (n: number) => (n === 1 ? 'payment' : `${n} payments`);
const count = (n: number) => `${n} ${n === 1 ? 'payment' : 'payments'}`;

interface Props {
  groupId: string;
  currency: string;
  people: { id: string; name: string; isSelf: number }[];
  bills: SharedRecurringBill[];
}

export function RecurringBills({ groupId, currency, people, bills }: Props) {
  const qc = useQueryClient();
  const { data: schedules = [] } = useSchedules();
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const refresh = async () => {
    setError('');
    await qc.invalidateQueries({ queryKey: ['households'] });
    await qc.invalidateQueries({ queryKey: ['shared-households'] });
    await qc.invalidateQueries({ queryKey: ['repayments', groupId] });
  };
  const onError = (e: Error) => setError(e.message);
  const add = useMutation({
    mutationFn: (ids: string[]) => shareRecurringBills(groupId, ids),
    onSuccess: async () => {
      setPicked([]);
      setAdding(false);
      await refresh();
    },
    onError,
  });
  const stop = useMutation({
    mutationFn: (scheduleId: string) => unshareRecurringBill(groupId, scheduleId),
    onSuccess: refresh,
    onError,
  });
  const [splitting, setSplitting] = useState('');
  const update = useMutation({
    mutationFn: (v: {
      scheduleId: string;
      changes: { split?: HouseholdSplit | null; autoShare?: boolean };
    }) => updateRecurringBill(groupId, v.scheduleId, v.changes),
    onSuccess: async () => {
      setSplitting('');
      await refresh();
    },
    onError,
  });
  const share = useMutation({
    mutationFn: (v: { scheduleId: string; ids: string[] }) =>
      shareBillPayments(groupId, v.scheduleId, v.ids),
    onSuccess: async (r) => {
      await refresh();
      const failed = r.results.find((x) => !x.ok);
      if (failed) setError(failed.error ?? 'Some payments could not be shared');
    },
    onError,
  });
  const money = (n: number) => formatMoney(n, currency);
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? '?';
  const shownIds = new Set(bills.map((b) => b.scheduleId));
  const candidates = schedules.filter(
    (s) =>
      s.amount < 0 &&
      s.status === 'active' &&
      s.recurrenceType !== 'once' &&
      !s.transferAccountId &&
      !shownIds.has(s.id),
  );
  const busy = add.isPending || stop.isPending || share.isPending || update.isPending;

  return (
    <section className={card} aria-labelledby="household-recurring">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="household-recurring" className="text-sm font-semibold text-text">
            Recurring bills
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Bills from Recurring that you split with the household, and each person's share.
          </p>
        </div>
        {!adding && candidates.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add recurring bills
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-negative mt-2">
          {error}
        </p>
      )}

      {bills.length === 0 && !adding && (
        <p className="text-sm text-text-tertiary mt-3">
          {candidates.length > 0 ? (
            <>No recurring bills shared yet. Add the ones you split, like power, gas or internet.</>
          ) : (
            <>
              Nothing to add yet: set up your bills in <Link to="/recurring">Recurring</Link> first.
            </>
          )}
        </p>
      )}

      {bills.length > 0 && (
        <ul className="mt-3 divide-y divide-border-light border-t border-border-light">
          {bills.map((b) => {
            const unshared = b.payments.filter((p) => !p.shared);
            return (
              <li key={b.scheduleId} className="py-3 space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-medium text-text">{b.name}</p>
                  <p className="text-sm tabular-nums text-text">{money(b.amount)}</p>
                </div>
                <p className="text-xs text-text-tertiary">
                  {FREQ_LABEL.get(b.recurrenceType as never) ?? b.recurrenceType}
                  {b.status !== 'active'
                    ? ` · ${b.status}`
                    : b.nextDate
                      ? ` · next ${formatDay(b.nextDate)}`
                      : ''}
                  {b.paidFromPool ? ' · paid from the household account' : ''}
                </p>
                <p className="text-xs text-text-secondary">
                  {b.shares.map((s, i) => (
                    <span key={s.personId}>
                      {i > 0 && ' · '}
                      {name(s.personId)} <span className="tabular-nums">{money(s.amount)}</span>
                    </span>
                  ))}
                  <span className="text-text-tertiary">
                    {' '}
                    ({b.split ? describeSplit(b.split, people) : "household's default split"})
                  </span>
                </p>
                {splitting === b.scheduleId ? (
                  <div className="rounded-md bg-surface-alt p-2.5">
                    <SplitEditor
                      people={people}
                      current={b.split}
                      equalLabel="The household's default split"
                      saving={update.isPending}
                      onSave={(split) =>
                        update.mutate({ scheduleId: b.scheduleId, changes: { split } })
                      }
                      onCancel={() => setSplitting('')}
                    />
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-xs text-text-secondary min-h-8">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600"
                    checked={!!b.autoShareFrom}
                    disabled={busy}
                    onChange={(e) =>
                      update.mutate({
                        scheduleId: b.scheduleId,
                        changes: { autoShare: e.target.checked },
                      })
                    }
                  />
                  Share new payments automatically
                  {b.autoShareFrom && (
                    <span className="text-text-tertiary">(from {formatDay(b.autoShareFrom)})</span>
                  )}
                </label>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <p className="text-xs text-text-tertiary">
                    {b.payments.length === 0
                      ? 'No payments in the last six months'
                      : unshared.length === 0
                        ? `Last ${plural(b.payments.length)} shared`
                        : `${unshared.length === b.payments.length ? count(unshared.length) : `${unshared.length} of the last ${plural(b.payments.length)}`} not shared yet (latest ${formatDay(unshared[0].date)}, ${money(unshared[0].amount)})`}
                  </p>
                  <div className="flex gap-1">
                    {unshared.length > 0 && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          share.mutate({
                            scheduleId: b.scheduleId,
                            ids: unshared.map((p) => p.transactionId),
                          })
                        }
                      >
                        {unshared.length === 1
                          ? 'Share payment'
                          : `Share ${unshared.length} payments`}
                      </Button>
                    )}
                    {splitting !== b.scheduleId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setSplitting(b.scheduleId)}
                      >
                        Change split
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => stop.mutate(b.scheduleId)}
                    >
                      Stop sharing
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <div className="mt-3 border-t border-border-light pt-3">
          <fieldset className="grid gap-1">
            <legend className="text-xs font-semibold text-text-secondary mb-1">
              Which bills do you share?
            </legend>
            {candidates.map((s) => (
              <label key={s.id} className="flex items-center gap-3 text-sm text-text min-h-9">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={picked.includes(s.id)}
                  onChange={(e) =>
                    setPicked(
                      e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id),
                    )
                  }
                />
                <span className="flex-1">{s.name}</span>
                <span className="tabular-nums text-text-secondary">{money(-s.amount)}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!picked.length || busy} onClick={() => add.mutate(picked)}>
              Share {picked.length || ''} with household
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
