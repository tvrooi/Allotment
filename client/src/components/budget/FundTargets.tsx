import { forwardRef, useImperativeHandle, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  applyTargetFunding,
  previewTargetFunding,
  type TargetFundingPreview,
} from '../../api/budget';
import { useCanSave } from '../../hooks/useConnection';
import type { BudgetGroup } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/** Previews assignments for underfunded targets, capped at unassigned money, then applies
 * exactly that preview once. Targets never assign money on their own. */
export const FundTargets = forwardRef<
  { open: () => void },
  { month: string; groups: BudgetGroup[]; hideButton?: boolean }
>(function FundTargets({ month, groups, hideButton = false }, ref) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const [preview, setPreview] = useState<TargetFundingPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const underfunded = groups
    .flatMap((g) => g.categories)
    .filter((c) => c.target?.underfunded).length;
  async function load() {
    setError(null);
    try {
      setPreview(await previewTargetFunding(month));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not preview target funding.');
    }
  }
  useImperativeHandle(ref, () => ({ open: () => void load() }));
  async function apply() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await applyTargetFunding(preview);
      setPreview(null);
      await qc.invalidateQueries({ queryKey: ['budget'] });
      await qc.invalidateQueries({ queryKey: ['budget-summary'] });
      await qc.invalidateQueries({ queryKey: ['review'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fund targets.');
      await load();
    } finally {
      setBusy(false);
    }
  }
  if (!underfunded) return null;
  return (
    <>
      {!hideButton && (
        <Button variant="secondary" size="sm" onClick={load} disabled={!canSave}>
          Fund targets ({underfunded})
        </Button>
      )}
      <Modal isOpen={!!preview} onClose={() => setPreview(null)} title="Fund targets">
        {preview && (
          <div className="space-y-3 text-sm" role="region" aria-label="Target funding preview">
            <p className="text-text-secondary">
              {formatCurrency(preview.available)} is unassigned today. Expected income is not
              counted. Nothing changes until you apply.
            </p>
            <ul className="space-y-1">
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
            <p className="font-medium text-text">
              Total {formatCurrency(preview.total)}
              {preview.shortfall > 0 &&
                ` · ${formatCurrency(preview.shortfall)} still needed when more money arrives`}
            </p>
            {!preview.complete && (
              <p className="text-negative">Add missing exchange rates before assigning money.</p>
            )}
            {error && (
              <p role="alert" className="text-negative">
                {error}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <Button onClick={apply} disabled={busy || !preview.total || !canSave}>
                Apply {formatCurrency(preview.total)}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {error && !preview && (
        <span role="alert" className="text-xs text-negative">
          {error}
        </span>
      )}
    </>
  );
});
