import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  fillHome,
  removeHomeDay,
  setHomeDay,
  setHomeYear,
  type HomeDay,
  type HomeDetail,
} from '../../api/tax';
import { useHome, useHomeMutation, useTaxYears } from '../../hooks/useTax';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { FilesSection } from '../files/FilesSection';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { ExternalLink } from '../ui/ExternalLink';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { fyName } from '../../api/assets';
import { formatCurrency } from '../../utils/currency';
import { todayIso } from '../../utils/calendarDay';
import { formatDay } from '../../utils/dates';
import { formatMonth } from '../../utils/dateRange';
import { formatDuration, formatRate, parseDuration, parseRateTenths } from '../../utils/homeHours';

// Tax time → Car and home (docs/TAX-CAR-AND-HOME.md). Working from home with the ATO's fixed rate
// method: the hours actually worked at home, day by day, times the year's rate. Record keeping,
// not tax advice: it never guesses an hour or a rate. The car section follows in D4b.

const fyStart = (fy: number) => `${fy}-07-01`;
const fyEnd = (fy: number) => `${fy + 1}-06-30`;
const hoursText = (minutes: number) => (minutes / 60).toFixed(2).replace(/\.?0+$/, '');
const WEEKDAYS = [
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
  [7, 'Sun'],
] as const;

export default function CarAndHome() {
  const { data: years = [] } = useTaxYears();
  const [fy, setFy] = useState<number | null>(null);
  useEffect(() => {
    if (fy === null && years.length) setFy(years[0].financialYear);
  }, [years, fy]);
  const { data: home } = useHome(fy);

  return (
    <div className="space-y-5 max-w-3xl">
      <label className="block text-xs font-medium text-text-secondary space-y-1">
        <span className="block">Financial year (1 July to 30 June)</span>
        <Select
          aria-label="Financial year"
          className="w-48"
          value={fy ?? ''}
          onChange={(e) => setFy(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y.financialYear} value={y.financialYear}>
              {y.name}
            </option>
          ))}
        </Select>
      </label>
      {fy !== null && home && <WorkingFromHome fy={fy} home={home} />}
    </div>
  );
}

function WorkingFromHome({ fy, home }: { fy: number; home: HomeDetail }) {
  const canSave = useCanSave();
  const remove = useHomeMutation(removeHomeDay);
  const [adding, setAdding] = useState<HomeDay | 'new' | null>(null);
  const [filling, setFilling] = useState(false);
  const [rating, setRating] = useState(false);
  const [removing, setRemoving] = useState<HomeDay | null>(null);
  const { year, rate } = home;
  const months = useMemo(() => {
    const out = new Map<string, HomeDay[]>();
    for (const d of home.days)
      out.set(d.date.slice(0, 7), [...(out.get(d.date.slice(0, 7)) ?? []), d]);
    return [...out];
  }, [home.days]);

  return (
    <section aria-labelledby="home-heading" className="space-y-4">
      <div>
        <h2 id="home-heading" className="text-base font-semibold text-text">
          Working from home
        </h2>
        <p className="text-sm text-text-secondary mt-0.5">
          The ATO&rsquo;s fixed rate method: the hours you actually worked at home in {fyName(fy)},
          times a rate per hour. It goes in D5 on Deductions. Keep a timesheet, roster or diary that
          matches these hours, and one bill for each expense the rate covers.{' '}
          <ExternalLink href={rate.source}>ATO fixed rate method</ExternalLink>
        </p>
      </div>

      <dl className="grid grid-cols-3 max-sm:grid-cols-1 gap-3">
        <div className="rounded-md border border-border-light p-3">
          <dt className="text-xs text-text-tertiary">Hours this year</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {year.minutes ? formatDuration(year.minutes) : '0 h'}
          </dd>
          <dd className="text-xs text-text-tertiary">
            {year.days} day{year.days === 1 ? '' : 's'}
          </dd>
        </div>
        <div className="rounded-md border border-border-light p-3">
          <dt className="text-xs text-text-tertiary">
            Rate per hour
            {year.rateSource && ` (${year.rateSource === 'table' ? 'ATO rate' : 'your rate'})`}
          </dt>
          <dd className="text-lg font-semibold tabular-nums">
            {year.rateTenths === null ? 'Not set' : formatRate(year.rateTenths)}
          </dd>
          <dd>
            <button
              type="button"
              onClick={() => setRating(true)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Change
            </button>
          </dd>
        </div>
        <div className="rounded-md border border-border-light p-3">
          <dt className="text-xs text-text-tertiary">Claim in D5</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatCurrency(year.claim)}</dd>
        </div>
      </dl>

      {year.missing.includes('rate') && (
        <p role="note" className="rounded-md border border-caution p-3 text-sm text-caution">
          Type the ATO&rsquo;s rate for {fyName(fy)}. Nothing is claimed for it until you do.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAdding('new')} disabled={!canSave}>
          <Plus size={14} /> Add hours
        </Button>
        <Button variant="secondary" onClick={() => setFilling(true)} disabled={!canSave}>
          Fill a pattern
        </Button>
        <SavingPausedHint />
      </div>

      {months.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No hours recorded for {fyName(fy)} yet. Add a day, or fill a pattern such as Monday to
          Friday and then fix the days that differed.
        </p>
      ) : (
        months.map(([month, days]) => (
          <section key={month} aria-label={formatMonth(month)}>
            <h3 className="text-sm font-medium text-text mb-1">
              {formatMonth(month)}
              <span className="ml-2 text-xs font-normal text-text-tertiary">
                {formatDuration(days.reduce((s, d) => s + d.minutes, 0))}
              </span>
            </h3>
            <ul className="divide-y divide-border-light border-y border-border-light">
              {days.map((d) => (
                <li key={d.date} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="w-28 shrink-0 whitespace-nowrap">{formatDay(d.date)}</span>
                  <span className="w-24 shrink-0 tabular-nums">{formatDuration(d.minutes)}</span>
                  <span className="flex-1 min-w-0 truncate text-text-tertiary">{d.notes}</span>
                  <button
                    type="button"
                    aria-label={`Edit hours on ${formatDay(d.date)}`}
                    disabled={!canSave}
                    onClick={() => setAdding(d)}
                    className="p-2 text-text-tertiary hover:text-text disabled:opacity-40"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove hours on ${formatDay(d.date)}`}
                    disabled={!canSave}
                    onClick={() => setRemoving(d)}
                    className="p-2 text-text-tertiary hover:text-negative disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="rounded-md border border-border-light p-3">
        <FilesSection kind="homeYear" targetId={String(fy)} title="Bills" />
        <p className="text-xs text-text-tertiary mt-2">
          One bill for each expense the rate covers (energy, phone, internet, stationery), kept for
          five years. They go in the year&rsquo;s ZIP.
        </p>
      </div>

      {adding && (
        <DayModal fy={fy} day={adding === 'new' ? null : adding} onClose={() => setAdding(null)} />
      )}
      {filling && <FillModal fy={fy} onClose={() => setFilling(false)} />}
      {rating && <RateModal fy={fy} home={home} onClose={() => setRating(false)} />}
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await remove.mutateAsync(removing.date);
          setRemoving(null);
        }}
        title="Remove these hours?"
        message={
          removing
            ? `${formatDuration(removing.minutes)} on ${formatDay(removing.date)} will be removed from ${fyName(fy)}.`
            : ''
        }
        confirmLabel="Remove"
        danger
      />
    </section>
  );
}

/** Adds a day's hours, or edits one (its date stays) */
function DayModal({ fy, day, onClose }: { fy: number; day: HomeDay | null; onClose: () => void }) {
  const canSave = useCanSave();
  const save = useHomeMutation((a: { date: string; minutes: number; notes: string | null }) =>
    setHomeDay(a.date, { minutes: a.minutes, notes: a.notes }),
  );
  const [date, setDate] = useState(
    day?.date ?? (todayIso() >= fyStart(fy) && todayIso() <= fyEnd(fy) ? todayIso() : fyStart(fy)),
  );
  const [hours, setHours] = useState(day ? hoursText(day.minutes) : '');
  const [notes, setNotes] = useState(day?.notes ?? '');
  const [error, setError] = useState('');
  const minutes = parseDuration(hours);
  const valid = !!date && minutes !== null;
  return (
    <Modal isOpen onClose={onClose} title={day ? 'Edit hours' : 'Add hours'} size="sm">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          try {
            await save.mutateAsync({ date, minutes, notes: notes.trim() || null });
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save');
          }
        }}
      >
        <label className="block text-xs font-medium text-text-secondary space-y-1">
          <span className="block">Date</span>
          <Input
            type="date"
            value={date}
            disabled={!!day}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-text-secondary space-y-1">
          <span className="block">Hours worked at home</span>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="7.5 or 7:30"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-text-secondary space-y-1">
          <span className="block">Notes (optional)</span>
          <Input
            type="text"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {hours && minutes === null && (
          <p className="text-xs text-negative">
            Use hours between 0:01 and 24, such as 7.5 or 7:30.
          </p>
        )}
        {error && <p className="text-sm text-negative">{error}</p>}
        <SavingPausedHint className="text-right" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid || !canSave || save.isPending}>
            Save hours
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** The same hours on chosen weekdays across a range, after a confirmation; recorded days are kept */
function FillModal({ fy, onClose }: { fy: number; onClose: () => void }) {
  const canSave = useCanSave();
  const fill = useHomeMutation((a: Parameters<typeof fillHome>[0]) => fillHome(a));
  const today = todayIso();
  const [from, setFrom] = useState(fyStart(fy));
  const [to, setTo] = useState(today >= fyStart(fy) && today <= fyEnd(fy) ? today : fyEnd(fy));
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hours, setHours] = useState('');
  const [error, setError] = useState('');
  const minutes = parseDuration(hours);
  const input = { from, to, weekdays, minutes: minutes ?? 0 };
  const ready = !!from && !!to && weekdays.length > 0 && minutes !== null;
  const preview = useQuery({
    queryKey: ['tax', 'home', 'fill-preview', from, to, weekdays.join(), minutes],
    queryFn: () => fillHome(input, true),
    enabled: ready,
    retry: false,
  });
  const previewError = preview.error instanceof Error ? preview.error.message : '';
  return (
    <Modal isOpen onClose={onClose} title="Fill a pattern" size="sm">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ready || !preview.data) return;
          try {
            await fill.mutateAsync(input);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save');
          }
        }}
      >
        <p className="text-xs text-text-tertiary">
          Writes the same hours on the days you choose, within {fyName(fy)}. A day you already
          recorded is never changed. The hours must match what you actually worked.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-text-secondary space-y-1">
            <span className="block">From</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-text-secondary space-y-1">
            <span className="block">To</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <fieldset>
          <legend className="text-xs font-medium text-text-secondary mb-1">Days of the week</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {WEEKDAYS.map(([n, name]) => (
              <label key={n} className="flex items-center gap-1 text-sm min-h-8">
                <input
                  type="checkbox"
                  checked={weekdays.includes(n)}
                  onChange={(e) =>
                    setWeekdays(
                      e.target.checked ? [...weekdays, n].sort() : weekdays.filter((w) => w !== n),
                    )
                  }
                />
                {name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-xs font-medium text-text-secondary space-y-1">
          <span className="block">Hours each day</span>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="7.5 or 7:30"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </label>
        {preview.data && (
          <p role="status" className="text-sm text-text">
            Adds {preview.data.added} day{preview.data.added === 1 ? '' : 's'}, skips{' '}
            {preview.data.skipped} already recorded.
          </p>
        )}
        {(previewError || error) && (
          <p role="alert" className="text-sm text-negative">
            {error || previewError}
          </p>
        )}
        <SavingPausedHint className="text-right" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              !ready || !preview.data || preview.data.added === 0 || !canSave || fill.isPending
            }
          >
            {preview.data
              ? `Add ${preview.data.added} day${preview.data.added === 1 ? '' : 's'}`
              : 'Add days'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** The year's own rate, over the ATO's (or where the ATO has not published one) */
function RateModal({ fy, home, onClose }: { fy: number; home: HomeDetail; onClose: () => void }) {
  const canSave = useCanSave();
  const save = useHomeMutation((a: { rateTenths: number | null }) =>
    setHomeYear(fy, { rateTenths: a.rateTenths, notes: home.year.notes }),
  );
  const [text, setText] = useState(
    home.rate.override === null ? '' : String(home.rate.override / 10),
  );
  const [error, setError] = useState('');
  const tenths = parseRateTenths(text);
  const run = async (rateTenths: number | null) => {
    try {
      await save.mutateAsync({ rateTenths });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  };
  return (
    <Modal isOpen onClose={onClose} title={`Rate for ${fyName(fy)}`} size="sm">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (tenths !== null) void run(tenths);
        }}
      >
        <p className="text-xs text-text-tertiary">
          {home.rate.table === null
            ? `The ATO's rate for ${fyName(fy)} isn't built in. Type it from the ATO's page.`
            : `The ATO's rate for ${fyName(fy)} is ${formatRate(home.rate.table)} an hour (checked ${formatDay(home.rate.checked)}).`}{' '}
          <ExternalLink href={home.rate.source}>ATO fixed rate method</ExternalLink>
        </p>
        <label className="block text-xs font-medium text-text-secondary space-y-1">
          <span className="block">Your rate (cents per hour)</span>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="70"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {text && tenths === null && (
          <p className="text-xs text-negative">
            Use cents per hour with at most one decimal, such as 70 or 71.5.
          </p>
        )}
        {error && <p className="text-sm text-negative">{error}</p>}
        <SavingPausedHint className="text-right" />
        <div className="flex flex-wrap justify-end gap-2">
          {home.rate.override !== null && home.rate.table !== null && (
            <Button
              variant="secondary"
              disabled={!canSave || save.isPending}
              onClick={() => void run(null)}
            >
              Use the ATO rate
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={tenths === null || !canSave || save.isPending}>
            Save rate
          </Button>
        </div>
      </form>
    </Modal>
  );
}
