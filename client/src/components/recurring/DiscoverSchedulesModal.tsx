import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useDiscoverSchedules, useCreateDiscoveredSchedules } from '../../hooks/useSchedules';
import { formatScheduleAmount } from './scheduleFormat';
import { nearMissReason } from '../../utils/nearMiss';
import { formatDay } from '../../utils/dates';
import type { DiscoveredSchedule, NearMiss } from '../../types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Human description like Actual's getRecurringDescription. */
function describe(item: DiscoveredSchedule): string {
  const r = item.recurrenceRule;
  const approx = item.exactDate ? '' : ' (approx.)';
  if (r.type === 'weekly') return `Every week on ${WEEKDAYS[r.anchorDay]}${approx}`;
  if (r.type === 'biweekly') return `Every 2 weeks on ${WEEKDAYS[r.anchorDay]}${approx}`;
  if (r.type === 'monthly') {
    const day = r.anchorDay >= 31 ? 'the last day' : `the ${ordinal(r.anchorDay)}`;
    return `Every month on ${day}${approx}`;
  }
  return item.recurrenceType;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Track a near miss anyway: opens the recurring form filled in from it */
  onAddAnyway: (miss: NearMiss) => void;
}

const NO_RESULTS = { found: [] as DiscoveredSchedule[], nearMisses: [] as NearMiss[] };

export default function DiscoverSchedulesModal({ isOpen, onClose, onAddAnyway }: Props) {
  const { data = NO_RESULTS, isLoading, isFetching } = useDiscoverSchedules(isOpen);
  const { found, nearMisses } = data;
  const createMut = useCreateDiscoveredSchedules();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelected(new Set());
      setLastClicked(null);
    }
  }, [isOpen]);

  const loading = isLoading || isFetching;
  const allSelected = found.length > 0 && selected.size === found.length;
  const selectedItems = useMemo(() => found.filter((f) => selected.has(f.id)), [found, selected]);

  // Click toggles; shift+click selects a range, like Actual's useSelected
  function toggle(idx: number, shift: boolean) {
    const next = new Set(selected);
    if (shift && lastClicked !== null) {
      const [a, b] = [Math.min(lastClicked, idx), Math.max(lastClicked, idx)];
      for (let i = a; i <= b; i++) next.add(found[i].id);
    } else {
      const id = found[idx].id;
      next.has(id) ? next.delete(id) : next.add(id);
    }
    setSelected(next);
    setLastClicked(idx);
  }

  function handleCreate() {
    createMut.mutate(selectedItems, { onSuccess: onClose });
  }

  const cols =
    'grid grid-cols-[28px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.6fr)_110px] items-center gap-3';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search for recurring transactions" size="xl">
      <div className="space-y-3 text-sm text-text-secondary">
        <p>
          Your transaction history was scanned for payments from the same payee, for a similar
          amount, on a regular weekly, biweekly, or monthly schedule. Select any you'd like to
          track. Matching past transactions will be linked to each new recurring item.
        </p>
        <p className="text-xs text-text-tertiary">
          Missing something? Transactions are only grouped when they share the same payee, so
          renaming payees to match may help. Payees you already track aren't listed, and payees that
          almost qualified are shown below with the reason.
        </p>
      </div>

      <div className="mt-4 border border-border-light rounded-lg overflow-hidden">
        <div
          className={`${cols} px-3 py-2 bg-surface-alt border-b border-border-light text-xs font-medium text-text-tertiary`}
        >
          <input
            type="checkbox"
            aria-label="Select all"
            disabled={loading || found.length === 0}
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(found.map((f) => f.id)))}
            className="accent-brand-600 cursor-pointer"
          />
          <span>Payee</span>
          <span>Account</span>
          <span>When</span>
          <span className="text-right">Amount</span>
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 bg-surface-alt rounded animate-pulse" />
              ))}
              <p className="text-xs text-center text-text-tertiary pt-1">
                Scanning your transactions…
              </p>
            </div>
          ) : found.length === 0 ? (
            <p className="py-12 text-center text-sm italic text-text-tertiary">
              No recurring transactions found
            </p>
          ) : (
            found.map((item, idx) => {
              const isSel = selected.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={(e) => toggle(idx, e.shiftKey)}
                  className={`${cols} px-3 py-2.5 border-b border-border-light last:border-b-0 cursor-pointer select-none transition-colors ${
                    isSel ? 'bg-brand-50' : 'hover:bg-hover'
                  }`}
                >
                  {/* Focusable so the list works from the keyboard: Space clicks it, and the
                      click reaches the row's handler */}
                  <input
                    type="checkbox"
                    aria-label={`Track ${item.payeeName}`}
                    checked={isSel}
                    readOnly
                    className="accent-brand-600 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{item.payeeName}</p>
                    <p className="text-xs text-text-tertiary">
                      {item.transactionIds.length} past · since{' '}
                      {format(parseISO(item.startDate), 'MMM yyyy')}
                    </p>
                  </div>
                  <span className="text-sm text-text-secondary truncate">{item.accountName}</span>
                  <span className="text-sm text-text-secondary truncate" title={describe(item)}>
                    {describe(item)}
                  </span>
                  <span
                    className={`text-sm font-medium tabular-nums text-right ${item.amount > 0 ? 'text-positive' : 'text-text'}`}
                  >
                    {formatScheduleAmount(item.amount, item.amountType)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {!loading && nearMisses.length > 0 && (
        <section aria-labelledby="near-misses" className="mt-4">
          <h3 id="near-misses" className="text-sm font-semibold text-text">
            Almost recurring
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            These look regular but didn't qualify. Add one anyway to track it; it starts from the
            next expected payment.
          </p>
          <ul className="mt-2 border border-border-light rounded-lg divide-y divide-border-light max-h-[220px] overflow-y-auto">
            {nearMisses.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5 max-md:flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate">
                    {m.payeeName}
                    <span className="font-normal text-text-tertiary"> · {m.accountName}</span>
                  </p>
                  <p className="text-xs text-text-secondary">{nearMissReason(m)}</p>
                  <p className="text-xs text-text-tertiary">
                    {m.count} in the last 4 months · latest {formatDay(m.lastDate)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onAddAnyway(m)}
                  aria-label={`Add ${m.payeeName} anyway`}
                >
                  Add anyway
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-text-tertiary">
          {selected.size > 0
            ? `${selected.size} selected`
            : found.length > 0
              ? 'Shift+click to select a range'
              : ''}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0 || createMut.isPending}
            onClick={handleCreate}
          >
            {createMut.isPending
              ? 'Creating…'
              : selected.size > 0
                ? `Create ${selected.size} recurring`
                : 'Create recurring'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
