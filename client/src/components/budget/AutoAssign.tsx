import { forwardRef, useImperativeHandle, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  applyAutoAssign,
  AVERAGE_MONTH_CHOICES,
  previewAutoAssign,
  type AutoAssignMode,
  type AutoAssignOptions,
  type AutoAssignPreview,
  type AutoAssignStrategy,
  type AverageMonths,
} from '../../api/budget';
import { useCanSave } from '../../hooks/useConnection';
import { useScopedPlan } from '../../hooks/useScopedPlan';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { FundingRows } from './FundingRows';

const STRATEGIES: { key: AutoAssignStrategy; label: string; hint: (months: number) => string }[] = [
  {
    key: 'overspent',
    label: 'Cover overspending',
    hint: () => 'Bring every negative envelope to $0',
  },
  { key: 'underfunded', label: 'Underfunded', hint: () => 'What each target still needs' },
  { key: 'assigned_last_month', label: 'Assigned last month', hint: () => 'Match last month' },
  {
    key: 'spent_last_month',
    label: 'Spent last month',
    hint: () => 'Match last month’s spending',
  },
  {
    key: 'average_spent',
    label: 'Average spent',
    hint: (months) => `Last ${months} months’ average spending`,
  },
  { key: 'zero', label: 'Set to zero', hint: () => 'Take back every assignment this month' },
];

/** Strategies that name an amount for each envelope, so they can add to what is there or replace it */
const HAS_MODE: AutoAssignStrategy[] = ['assigned_last_month', 'spent_last_month', 'average_spent'];

/** YNAB-style auto-assign with month quick fills: pick a strategy, review what it would do to each
 * envelope (additions capped at money unassigned today), untick any you want left alone, then
 * apply exactly that preview once. Assignments only go up unless you choose Replace or Set to
 * zero, which also take money back. */
export interface OpensDialog {
  open: () => void;
}

export const AutoAssign = forwardRef<OpensDialog, { month: string; hideButton?: boolean }>(
  function AutoAssign({ month, hideButton = false }, ref) {
    const qc = useQueryClient();
    const canSave = useCanSave();
    const [open, setOpen] = useState(false);
    const [strategy, setStrategy] = useState<AutoAssignStrategy>('overspent');
    const [mode, setMode] = useState<AutoAssignMode>('add');
    const [months, setMonths] = useState<AverageMonths>(3);
    const [busy, setBusy] = useState(false);
    const plan = useScopedPlan<AutoAssignPreview>();
    const { preview } = plan;

    const optionsFor = (next: Partial<AutoAssignOptions> = {}): AutoAssignOptions => ({
      strategy,
      mode,
      months,
      ...next,
    });
    const fetcher = (options: AutoAssignOptions) => (categoryIds?: string[]) =>
      previewAutoAssign(month, { ...options, categoryIds });

    function choose(next: Partial<AutoAssignOptions>) {
      const options = optionsFor(next);
      setStrategy(options.strategy);
      setMode(options.mode ?? 'add');
      setMonths(options.months ?? 3);
      void plan.load(fetcher(options));
    }
    function show() {
      setOpen(true);
      void plan.load(fetcher(optionsFor()));
    }
    useImperativeHandle(ref, () => ({ open: show }));
    async function apply() {
      if (!preview) return;
      setBusy(true);
      plan.setError(null);
      try {
        await applyAutoAssign(preview, { ...optionsFor(), categoryIds: plan.scope });
        setOpen(false);
        plan.reset();
        await qc.invalidateQueries({ queryKey: ['budget'] });
        await qc.invalidateQueries({ queryKey: ['budget-summary'] });
        await qc.invalidateQueries({ queryKey: ['review'] });
      } catch (err) {
        await plan.load(fetcher(optionsFor()));
        plan.setError(err instanceof Error ? err.message : 'Could not auto-assign.');
      } finally {
        setBusy(false);
      }
    }
    const changes = preview?.rows.some((r) => r.proposed !== 0) ?? false;
    const total = preview?.total ?? 0;

    return (
      <>
        {!hideButton && (
          <Button variant="secondary" size="sm" onClick={show} disabled={!canSave}>
            Auto-assign
          </Button>
        )}
        <Modal
          isOpen={open}
          onClose={() => {
            setOpen(false);
            plan.reset();
          }}
          title="Auto-assign"
          size="lg"
        >
          <div className="space-y-3 text-sm">
            <div role="radiogroup" aria-label="Auto-assign option" className="grid gap-1">
              {STRATEGIES.map((s) => (
                <label
                  key={s.key}
                  className="flex items-baseline gap-2 rounded-md px-2 py-1 hover:bg-hover cursor-pointer"
                >
                  <input
                    type="radio"
                    name="auto-assign"
                    checked={strategy === s.key}
                    onChange={() => choose({ strategy: s.key })}
                    className="accent-brand-600"
                  />
                  <span className="text-text">{s.label}</span>
                  <span className="text-xs text-text-tertiary">{s.hint(months)}</span>
                </label>
              ))}
            </div>
            {strategy === 'average_spent' && (
              <label className="flex items-center gap-2 px-2 text-text-secondary">
                Months to average
                <select
                  value={months}
                  onChange={(e) => choose({ months: Number(e.target.value) as AverageMonths })}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-text"
                >
                  {AVERAGE_MONTH_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {n} months
                    </option>
                  ))}
                </select>
              </label>
            )}
            {HAS_MODE.includes(strategy) && (
              <div role="radiogroup" aria-label="How to apply" className="grid gap-1 px-2">
                {(
                  [
                    ['add', 'Add', 'Top up envelopes that have less; never lower one'],
                    ['replace', 'Replace', 'Set every envelope to this, taking money back'],
                  ] as const
                ).map(([key, label, hint]) => (
                  <label key={key} className="flex items-baseline gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="auto-assign-mode"
                      checked={mode === key}
                      onChange={() => choose({ mode: key })}
                      className="accent-brand-600"
                    />
                    <span className="text-text">{label}</span>
                    <span className="text-xs text-text-tertiary">{hint}</span>
                  </label>
                ))}
              </div>
            )}
            {preview && (
              <div role="region" aria-label="Auto-assign preview" className="space-y-3">
                <p className="text-text-secondary">
                  {formatCurrency(preview.available)} is ready to assign today. Expected income is
                  not counted.{' '}
                  {preview.mode === 'replace'
                    ? 'Money taken back becomes ready to assign.'
                    : 'No assignment is lowered.'}{' '}
                  Untick an envelope to leave it out. Nothing changes until you apply.
                </p>
                {plan.candidates.length ? (
                  <FundingRows
                    candidates={plan.candidates}
                    checked={plan.checked}
                    rows={preview.rows}
                    onToggle={(id) => void plan.toggle(id, fetcher(optionsFor()))}
                  />
                ) : (
                  <p className="text-text-tertiary">Every envelope already has enough for this.</p>
                )}
                <p className="font-medium text-text">
                  {total < 0 ? 'Taking back' : 'Total'} {formatCurrency(Math.abs(total))}
                  {preview.shortfall > 0 &&
                    ` · ${formatCurrency(preview.shortfall)} still needed when more money arrives`}
                </p>
                {!preview.complete && (
                  <p className="text-negative">
                    Add missing exchange rates before assigning money.
                  </p>
                )}
              </div>
            )}
            {plan.error && (
              <p role="alert" className="text-negative">
                {plan.error}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                  plan.reset();
                }}
              >
                Cancel
              </Button>
              <Button onClick={apply} disabled={busy || !changes || !canSave}>
                {total < 0 ? 'Take back' : 'Assign'} {formatCurrency(Math.abs(total))}
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  },
);
