import { useState } from 'react';
import { addDays, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/review';
import { useCanSave } from '../../hooks/useConnection';
import { Card } from '../ui/Card';
import { Button, ButtonLink } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { formatCurrency, isUnreadableAmount, parseCents } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { FUNDING_VIEWS } from '../../utils/fundingViews';

// Phase 7 cards on the Review page: the flexibility reserve and resilience partition (7B), the
// resume-after-a-lapse summary with reminders (7E) and the extra-income split (7F). They read
// the same shared funding figures as the rest of the page.

function Row({ label, value, tone }: { label: string; value: string; tone?: 'neg' | 'pos' }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span
        className={`tabular-nums font-medium ${
          tone === 'neg' ? 'text-negative' : tone === 'pos' ? 'text-positive' : 'text-text'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

const STATUS_TEXT: Record<api.ResilienceStatus, string> = {
  'not-set-up': 'No flexibility reserve yet',
  incomplete: 'Incomplete',
  'below-minimum': 'Below your minimum',
  'below-target': 'Building toward your target',
  'on-target': 'At your target',
  'no-target': 'No comfort target set',
};

export function ResilienceCard({ data }: { data: api.ResilienceState }) {
  const f = data.flexibility;
  const p = data.partition;
  const coverage =
    data.coverageTenths !== null ? `${(data.coverageTenths / 10).toFixed(1)} months` : null;
  return (
    <Card>
      <div className="space-y-3" aria-label="Resilience">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-text">Flexibility and resilience</h2>
          <span
            role="status"
            className={`text-xs font-medium ${
              data.healthy
                ? 'text-positive'
                : data.status === 'below-minimum' || data.status === 'incomplete'
                  ? 'text-caution'
                  : 'text-text-secondary'
            }`}
          >
            {data.healthy ? 'Healthy' : STATUS_TEXT[data.status]}
          </span>
        </div>
        {data.status === 'not-set-up' ? (
          <p className="text-sm text-text-secondary">
            Money set aside for no particular deadline gives room to change plans. Mark a category
            as a <strong>Flexibility reserve</strong> in{' '}
            <Link to="/settings?tab=priorities" className="text-brand-600 font-medium">
              Settings → Priorities
            </Link>{' '}
            to see it here. This is optional.
          </p>
        ) : (
          <>
            <Row
              label="Flexibility available today"
              value={f.available !== null ? formatCurrency(f.available) : 'Unknown'}
              tone="pos"
            />
            {f.later > 0 && (
              <Row label="Assigned to it in later months" value={formatCurrency(f.later)} />
            )}
            {f.minimum !== null && (
              <Row
                label={`Minimum ${formatCurrency(f.minimum)}`}
                value={f.minimumGap ? `${formatCurrency(f.minimumGap)} short` : 'Met'}
                tone={f.minimumGap ? 'neg' : undefined}
              />
            )}
            {f.target !== null && (
              <Row
                label={`Comfort target ${formatCurrency(f.target)}${
                  f.targetSource?.type === 'months' ? ` (${f.targetSource.months} months)` : ''
                }`}
                value={f.targetGap ? `${formatCurrency(f.targetGap)} to go` : 'Reached'}
              />
            )}
            <p className="text-sm text-text">
              {coverage ? (
                <>
                  About <strong>{coverage}</strong> of essentials (
                  {data.essentials.monthly !== null && formatCurrency(data.essentials.monthly)} a
                  month, {data.essentials.source === 'estimate' ? 'your estimate' : 'measured'}).
                </>
              ) : (
                <span className="text-text-secondary">
                  Coverage unavailable. {data.essentials.reasons.join(' ')}
                </span>
              )}
            </p>
            {f.categories.length > 0 && (
              <p className="text-xs text-text-tertiary">
                {f.categories.map((c) => `${c.name} ${formatCurrency(c.available)}`).join(' · ')}
              </p>
            )}
          </>
        )}
        {data.unfundedTotal > 0 && (
          <div className="text-sm">
            <p className="font-medium text-negative">
              Funding needs attention: {formatCurrency(data.unfundedTotal)} unfunded
            </p>
            <ul className="text-xs text-text-secondary list-disc pl-5">
              {data.unfunded.overspent > 0 && (
                <li>Overspent {formatCurrency(data.unfunded.overspent)}</li>
              )}
              {data.unfunded.cardWithoutReserve > 0 && (
                <li>
                  Card debt without a reserve {formatCurrency(data.unfunded.cardWithoutReserve)}
                </li>
              )}
              {data.unfunded.committedShortfall > 0 && (
                <li>Bill targets underfunded {formatCurrency(data.unfunded.committedShortfall)}</li>
              )}
              {data.unfunded.overAssigned > 0 && (
                <li>Assigned more than you have {formatCurrency(data.unfunded.overAssigned)}</li>
              )}
            </ul>
          </div>
        )}
        {data.incomplete.length > 0 && (
          <ul className="text-xs text-caution list-disc pl-5">
            {data.incomplete.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {p && (
          <details className="text-xs text-text-secondary">
            <summary className="cursor-pointer select-none">Where today's money is</summary>
            <table className="w-full mt-1 tabular-nums">
              <caption className="sr-only">Today's resources by purpose</caption>
              <tbody>
                {(
                  [
                    ['Card payment reserves', p.card],
                    ['Bill reserves with dates', p.committed],
                    ['Goals', p.goals],
                    ['Flexibility reserve', p.flexibility],
                    ['Other envelopes', p.other],
                    ['Spent beyond envelopes', p.overspent],
                    ['Unassigned', p.unassigned],
                  ] as const
                )
                  .filter(([name, value]) => value !== 0 || name !== 'Spent beyond envelopes')
                  .map(([name, value]) => (
                    <tr key={name}>
                      <td className="py-0.5">{name}</td>
                      <td className="py-0.5 text-right">{formatCurrency(value)}</td>
                    </tr>
                  ))}
                <tr className="font-medium text-text border-t border-border-light">
                  <td className="py-0.5">Cash after debts</td>
                  <td className="py-0.5 text-right">{formatCurrency(data.resources ?? 0)}</td>
                </tr>
              </tbody>
            </table>
            <ul className="list-disc pl-5 pt-1 space-y-0.5">
              {data.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
              {data.essentials.window && (
                <li>
                  Essentials measured {formatDay(data.essentials.window.from)} to{' '}
                  {formatDay(data.essentials.window.to)} (
                  {formatCurrency(data.essentials.window.total)}).
                </li>
              )}
            </ul>
          </details>
        )}
      </div>
    </Card>
  );
}

export function ReminderBanner({ resume }: { resume: api.ResumeState }) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  if (!resume.reminder?.due) return null;
  const snooze = async (days: number) => {
    const until = format(addDays(new Date(), days), 'yyyy-MM-dd');
    qc.setQueryData(['review', 'resume'], await api.snoozeReminder(until));
  };
  return (
    <div
      role="status"
      aria-label="Review reminder"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-light bg-surface-alt px-4 py-3 text-sm"
    >
      <span className="text-text">
        Time for a review: check changed priorities and anything that needs funding.
      </span>
      <span className="flex gap-2">
        <ButtonLink size="sm" to="/review">
          Review now
        </ButtonLink>
        <Button size="sm" variant="secondary" disabled={!canSave} onClick={() => snooze(7)}>
          Remind me in a week
        </Button>
      </span>
    </div>
  );
}

export function ResumeCard({ resume }: { resume: api.ResumeState }) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = resume.progress;
  async function complete() {
    setBusy(true);
    setError(null);
    try {
      qc.setQueryData(['review', 'resume'], await api.completeReview());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the review.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <div className="space-y-3" aria-label="Resume budgeting">
        <h2 className="text-base font-semibold text-text">Resume budgeting</h2>
        <p className="text-sm text-text-secondary">
          {resume.lastReview
            ? `Last review ${formatDay(resume.lastReview.asOf)} (${resume.daysSince} days ago). Start with today's plan; older items stay listed below.`
            : "Start with today's plan. You don't need to sort out old transactions first."}
        </p>
        <ul className="text-sm space-y-1">
          {resume.transactionsSince !== null && (
            <li className="flex justify-between gap-2">
              <span className="text-text-secondary">Transactions since then</span>
              <span className="tabular-nums">{resume.transactionsSince}</span>
            </li>
          )}
          <li className="flex justify-between gap-2">
            <span className="text-text-secondary">Uncategorised spending</span>
            <a href="#needs-attention" className="tabular-nums text-brand-600">
              {resume.uncategorisedCount}
            </a>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-text-secondary">Accounts to reconcile</span>
            <span className="tabular-nums">{resume.unreconciledAccounts}</span>
          </li>
          {resume.bank && (
            <li className="flex justify-between gap-2">
              <span className="text-text-secondary">
                Bank changes to review
                {resume.bank.lastSyncedAt &&
                  ` · synced ${formatDay(resume.bank.lastSyncedAt.slice(0, 10))}`}
              </span>
              <Link to="/settings?tab=connections" className="tabular-nums text-brand-600">
                {resume.bank.itemsToReview ?? 0}
              </Link>
            </li>
          )}
        </ul>
        {progress && (
          <div className="text-sm rounded-lg bg-surface-alt p-3 space-y-1">
            <p className="font-medium text-text">Since your last review</p>
            {progress.comparable ? (
              <>
                <Row
                  label="Flexibility reserve change"
                  value={formatCurrency(progress.reserveChange)}
                />
                <Row label="Assigned to it" value={formatCurrency(progress.assignedIn)} />
                <Row
                  label="Used from it (net of refunds)"
                  value={formatCurrency(progress.reserveUse)}
                />
                <p className="text-xs text-text-tertiary">
                  Using a reserve for what it is for is normal, not a setback.
                </p>
              </>
            ) : (
              <p className="text-xs text-text-secondary">{progress.reason}</p>
            )}
            <Row
              label="Unfunded obligations change"
              value={formatCurrency(progress.unfundedChange)}
              tone={progress.unfundedChange > 0 ? 'neg' : undefined}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!canSave || busy} onClick={complete}>
            Mark review complete
          </Button>
          <span className="text-xs text-text-tertiary">
            Records today's figures for next time. It does not reconcile anything.
          </span>
        </div>
        {resume.reminder && (
          <p className="text-xs text-text-tertiary">
            Reminders: {resume.reminder.cadence}
            {resume.reminder.snoozedUntil
              ? ` · snoozed until ${formatDay(resume.reminder.snoozedUntil)}`
              : resume.reminder.dueSince && !resume.reminder.due
                ? ` · next ${formatDay(resume.reminder.dueSince)}`
                : ''}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}

export function ExtraIncome({ resilience }: { resilience: api.ResilienceState }) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const candidates = useQuery({ queryKey: ['review', 'income'], queryFn: api.getIncomeCandidates });
  const reserves = resilience.flexibility.categories;
  const [transactionId, setTransaction] = useState('');
  const [baseline, setBaseline] = useState('');
  const [percent, setPercent] = useState('50');
  const [categoryId, setCategory] = useState('');
  const [preview, setPreview] = useState<api.IncomePreview | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  if (!reserves.length) return null;
  const reserve = categoryId || reserves[0].categoryId;
  const split = (): api.IncomeSplit | null => {
    const pct = Number(percent);
    if (!transactionId || !Number.isInteger(pct) || pct < 0 || pct > 100) return null;
    if (baseline.trim() && isUnreadableAmount(baseline)) return null;
    return {
      transactionId,
      baseline: baseline.trim() ? parseCents(baseline) : 0,
      reservePercent: pct,
      categoryId: reserve,
    };
  };
  const reset = () => {
    setPreview(null);
    setMessage(null);
  };
  async function run(action: 'preview' | 'apply') {
    const s = split();
    if (!s) {
      setMessage({ tone: 'error', text: 'Choose a deposit, a usual amount and a 0–100% share.' });
      return;
    }
    try {
      if (action === 'preview') {
        setPreview(await api.previewIncome(s));
        setMessage(null);
      } else if (preview) {
        await api.applyIncome(s, preview);
        setPreview(null);
        setTransaction('');
        setMessage({ tone: 'ok', text: 'Assigned to your reserve. The rest stays unassigned.' });
        for (const key of FUNDING_VIEWS) await qc.invalidateQueries({ queryKey: [key] });
      }
    } catch (err) {
      setPreview(null);
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not split.' });
    }
  }
  const label = 'grid gap-1 text-xs font-medium text-text-secondary';
  return (
    <Card>
      <div className="space-y-3" aria-label="Extra income">
        <h2 className="text-base font-semibold text-text">Extra income</h2>
        <p className="text-xs text-text-secondary">
          After a raise or windfall, choose how much of the extra goes to your reserve. Nothing is
          assumed from a single large deposit: you confirm the usual amount.
        </p>
        <label className={label}>
          Deposit
          <Select
            aria-label="Income deposit"
            value={transactionId}
            onChange={(e) => {
              setTransaction(e.target.value);
              reset();
            }}
          >
            <option value="">Choose a received deposit…</option>
            {(candidates.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {formatDay(t.date)} · {t.payee ?? 'Income'} · {formatCurrency(t.amount)}
              </option>
            ))}
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <label className={label}>
            Usual amount (0 for a windfall)
            <Input
              aria-label="Usual amount"
              inputMode="decimal"
              placeholder="0.00"
              value={baseline}
              onChange={(e) => {
                setBaseline(e.target.value);
                reset();
              }}
            />
          </label>
          <label className={label}>
            Share of the extra to the reserve (%)
            <Input
              aria-label="Reserve share percent"
              inputMode="numeric"
              value={percent}
              onChange={(e) => {
                setPercent(e.target.value);
                reset();
              }}
            />
          </label>
        </div>
        {reserves.length > 1 && (
          <label className={label}>
            Reserve category
            <Select
              aria-label="Reserve category"
              value={reserve}
              onChange={(e) => {
                setCategory(e.target.value);
                reset();
              }}
            >
              {reserves.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={!transactionId}
          onClick={() => run('preview')}
        >
          Preview split
        </Button>
        {preview && (
          <div
            role="region"
            aria-label="Extra income preview"
            className="bg-surface-alt rounded-lg p-3 text-xs text-text-secondary space-y-1"
          >
            <p>Extra over the usual amount: {formatCurrency(preview.extra)}</p>
            <p>To the reserve: {formatCurrency(preview.proposed)}</p>
            {preview.shortfall > 0 && (
              <p className="text-caution">
                {formatCurrency(preview.shortfall)} more than is unassigned today; only{' '}
                {formatCurrency(preview.proposed)} can be assigned.
              </p>
            )}
            <p>The deposit is then used and cannot fund a payday plan as well.</p>
            <Button size="sm" disabled={!canSave} onClick={() => run('apply')}>
              Apply split
            </Button>
          </div>
        )}
        {message && (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={`text-xs ${message.tone === 'error' ? 'text-negative' : 'text-positive'}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </Card>
  );
}
