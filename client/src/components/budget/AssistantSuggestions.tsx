import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Sparkles } from 'lucide-react';
import {
  applyBudgetProposal,
  dismissBudgetProposal,
  getBudgetProposals,
  type BudgetProposal,
} from '../../api/budget';
import { useCanSave } from '../../hooks/useConnection';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/** Assignments an assistant suggested (an organise token): nothing changes until you apply one */
export function AssistantSuggestions() {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const { data: proposals = [] } = useQuery({
    queryKey: ['budget-proposals'],
    queryFn: getBudgetProposals,
  });
  const [open, setOpen] = useState<BudgetProposal | null>(null);
  const done = () => {
    setOpen(null);
    void qc.invalidateQueries({ queryKey: ['budget-proposals'] });
    void qc.invalidateQueries({ queryKey: ['budget'] });
    void qc.invalidateQueries({ queryKey: ['budget-summary'] });
    void qc.invalidateQueries({ queryKey: ['review'] });
  };
  const apply = useMutation({ mutationFn: applyBudgetProposal, onSuccess: done });
  const dismiss = useMutation({ mutationFn: dismissBudgetProposal, onSuccess: done });
  if (!proposals.length) return null;

  return (
    <>
      {proposals.map((p) => (
        <div
          key={p.id}
          role="status"
          className="mx-6 mt-3 shrink-0 flex flex-wrap items-center gap-3 rounded-md border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-text-secondary"
        >
          <Sparkles size={16} className="text-brand-600 shrink-0" aria-hidden />
          <p className="flex-1 min-w-48">
            {p.tokenName} suggests assigning {formatCurrency(p.total)} to {p.rows.length}{' '}
            {p.rows.length === 1 ? 'envelope' : 'envelopes'} for{' '}
            {format(parseISO(`${p.month}-01`), 'MMMM')}.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setOpen(p)}>
            Review suggestion
          </Button>
        </div>
      ))}
      <Modal isOpen={!!open} onClose={() => setOpen(null)} title="Suggested assignments">
        {open && (
          <div className="space-y-3 text-sm" role="region" aria-label="Suggested assignments">
            {open.note && <p className="text-text-secondary">{open.note}</p>}
            <table className="w-full">
              <tbody>
                {open.rows.map((r) => (
                  <tr key={r.categoryId} className="border-b border-border-light align-top">
                    <td className="py-1.5 pr-3">
                      <p className="text-text">{r.categoryName ?? 'A deleted category'}</p>
                      {r.reason && <p className="text-xs text-text-tertiary">{r.reason}</p>}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">+{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-text-tertiary">
              Applying adds these amounts to what's assigned in{' '}
              {format(parseISO(`${open.month}-01`), 'MMMM yyyy')}, from money ready to assign now.
              If there isn't enough, nothing changes.
            </p>
            {(apply.error || dismiss.error) && (
              <p className="text-negative">{(apply.error || dismiss.error)?.message}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={dismiss.isPending || !canSave}
                onClick={() => dismiss.mutate(open.id)}
              >
                Dismiss
              </Button>
              <Button disabled={apply.isPending || !canSave} onClick={() => apply.mutate(open.id)}>
                Apply {formatCurrency(open.total)}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
