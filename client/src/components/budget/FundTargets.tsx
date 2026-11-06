import { forwardRef, useImperativeHandle, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  applyTargetFunding,
  previewTargetFunding,
  type TargetFundingPreview,
} from '../../api/budget';
import { useCanSave } from '../../hooks/useConnection';
import { useScopedPlan } from '../../hooks/useScopedPlan';
import type { BudgetGroup } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { FundingRows } from './FundingRows';

/** Previews assignments for underfunded targets, capped at unassigned money, then applies
 * exactly that preview once. Targets never assign money on their own. */
export const FundTargets = forwardRef<
  /** `open(ids)` starts with only those categories ticked (the budget table's selection) */
  { open: (categoryIds?: string[]) => void },
  { month: string; groups: BudgetGroup[]; hideButton?: boolean }
>(function FundTargets({ month, groups, hideButton = false }, ref) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const [busy, setBusy] = useState(false);
  const plan = useScopedPlan<TargetFundingPreview>();
  const { preview } = plan;
  const underfunded = groups
    .flatMap((g) => g.categories)
    .filter((c) => c.target?.underfunded).length;
  const fetchPlan = (categoryIds?: string[]) => previewTargetFunding(month, categoryIds);
  useImperativeHandle(ref, () => ({
    open: (categoryIds) => void plan.load(fetchPlan, categoryIds),
  }));
  async function apply() {
    if (!preview) return;
    setBusy(true);
    plan.setError(null);
    try {
      await applyTargetFunding(preview, plan.scope);
      plan.reset();
      await qc.invalidateQueries({ queryKey: ['budget'] });
      await qc.invalidateQueries({ queryKey: ['budget-summary'] });
      await qc.invalidateQueries({ queryKey: ['review'] });
    } catch (err) {
      await plan.load(fetchPlan);
      plan.setError(err instanceof Error ? err.message : 'Could not fund targets.');
    } finally {
      setBusy(false);
    }
  }
  if (!underfunded) return null;
  return (
    <>
      {!hideButton && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void plan.load(fetchPlan)}
          disabled={!canSave}
        >
          Fund targets ({underfunded})
        </Button>
      )}
      <Modal isOpen={!!preview} onClose={plan.reset} title="Fund targets">
        {preview && (
          <div className="space-y-3 text-sm" role="region" aria-label="Target funding preview">
            <p className="text-text-secondary">
              {formatCurrency(preview.available)} is ready to assign today. Expected income is not
              counted. Untick a category to fund the rest only. Nothing changes until you apply.
            </p>
            <FundingRows
              candidates={plan.candidates}
              checked={plan.checked}
              rows={preview.rows}
              onToggle={(id) => void plan.toggle(id, fetchPlan)}
            />
            <p className="font-medium text-text">
              Total {formatCurrency(preview.total)}
              {preview.shortfall > 0 &&
                ` · ${formatCurrency(preview.shortfall)} still needed when more money arrives`}
            </p>
            {!preview.complete && (
              <p className="text-negative">Add missing exchange rates before assigning money.</p>
            )}
            {plan.error && (
              <p role="alert" className="text-negative">
                {plan.error}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={plan.reset}>
                Cancel
              </Button>
              <Button onClick={apply} disabled={busy || plan.pending || !preview.total || !canSave}>
                Apply {formatCurrency(preview.total)}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {plan.error && !preview && (
        <span role="alert" className="text-xs text-negative">
          {plan.error}
        </span>
      )}
    </>
  );
});
