import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  applyAutoAssign,
  previewAutoAssign,
  type AutoAssignPreview,
  type AutoAssignStrategy,
} from '../../api/budget';
import { useCanSave } from '../../hooks/useConnection';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

const STRATEGIES: { key: AutoAssignStrategy; label: string; hint: string }[] = [
  { key: 'overspent', label: 'Cover overspending', hint: 'Bring every negative envelope to $0' },
  { key: 'underfunded', label: 'Underfunded', hint: 'What each target still needs' },
  { key: 'assigned_last_month', label: 'Assigned last month', hint: 'Match last month' },
  { key: 'spent_last_month', label: 'Spent last month', hint: 'Match last month’s spending' },
  { key: 'average_spent', label: 'Average spent', hint: 'Last 3 months’ average spending' },
];

/** YNAB-style auto-assign: pick a strategy, review what it would add to each envelope (capped
 * at money unassigned today), then apply exactly that preview once. Assignments only go up. */
export function AutoAssign({ month }: { month: string }) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const [open, setOpen] = useState(false);
  const [strategy, setStrategy] = useState<AutoAssignStrategy>('overspent');
  const [preview, setPreview] = useState<AutoAssignPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Only the latest request may set the preview, so an earlier strategy's slower answer can't
  // replace the one on screen
  const latest = useRef(0);

  async function load(next: AutoAssignStrategy) {
    const request = ++latest.current;
    setStrategy(next);
    setError(null);
    setPreview(null);
    try {
      const result = await previewAutoAssign(month, next);
      if (request === latest.current) setPreview(result);
    } catch (err) {
      if (request === latest.current)
        setError(err instanceof Error ? err.message : 'Could not preview auto-assign.');
    }
  }
  function show() {
    setOpen(true);
    void load(strategy);
  }
  async function apply() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await applyAutoAssign(preview);
      setOpen(false);
      setPreview(null);
      await qc.invalidateQueries({ queryKey: ['budget'] });
      await qc.invalidateQueries({ queryKey: ['budget-summary'] });
      await qc.invalidateQueries({ queryKey: ['review'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not auto-assign.');
      await load(strategy);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={show} disabled={!canSave}>
        Auto-assign
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Auto-assign" size="lg">
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
                  onChange={() => void load(s.key)}
                  className="accent-brand-600"
                />
                <span className="text-text">{s.label}</span>
                <span className="text-xs text-text-tertiary">{s.hint}</span>
              </label>
            ))}
          </div>
          {preview && (
            <div role="region" aria-label="Auto-assign preview" className="space-y-3">
              <p className="text-text-secondary">
                {formatCurrency(preview.available)} is unassigned today. Expected income is not
                counted, and no assignment is lowered. Nothing changes until you apply.
              </p>
              {preview.rows.length ? (
                <ul className="space-y-1 max-h-72 overflow-y-auto">
                  {preview.rows.map((r) => (
                    <li key={r.categoryId} className="flex justify-between gap-3 tabular-nums">
                      <span className="text-text">{r.name}</span>
                      <span className="text-text-secondary">
                        assign {formatCurrency(r.proposed)}
                        {r.shortfall > 0 && ` · ${formatCurrency(r.shortfall)} short`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-tertiary">Every envelope already has enough for this.</p>
              )}
              <p className="font-medium text-text">
                Total {formatCurrency(preview.total)}
                {preview.shortfall > 0 &&
                  ` · ${formatCurrency(preview.shortfall)} still needed when more money arrives`}
              </p>
              {!preview.complete && (
                <p className="text-negative">Add missing exchange rates before assigning money.</p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="text-negative">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={busy || !preview?.total || !canSave}>
              Assign {formatCurrency(preview?.total ?? 0)}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
