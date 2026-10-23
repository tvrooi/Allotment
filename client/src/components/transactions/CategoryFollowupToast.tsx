import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useFollowupStore } from '../../store/followupStore';
import { useUndoStore } from '../../store/undoStore';
import { useBulkEdit } from '../../hooks/useTransactionEdits';
import { useUpdatePayee } from '../../hooks/usePayees';
import { RuleEditorFlow } from '../rules/RuleEditorFlow';
import type { RuleInput } from '../../types';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const action =
  'font-medium text-brand-300 hover:text-brand-200 transition-colors whitespace-nowrap max-md:min-h-11';

/**
 * Fix the cause, not just the row: after a category change, change the payee's other
 * transactions too, make it the payee's default, or start a rule. Each choice can be undone
 * from here. It stays while the pointer or focus is on it.
 */
export function CategoryFollowupToast() {
  const offer = useFollowupStore((s) => s.offer);
  const clear = useFollowupStore((s) => s.clear);
  const undo = useUndoStore((s) => s.undo);
  const bulkEdit = useBulkEdit();
  const updatePayee = useUpdatePayee();
  const [done, setDone] = useState<string | null>(null);
  const [rule, setRule] = useState<RuleInput | null>(null);
  const [holding, setHolding] = useState(false);

  useEffect(() => setDone(null), [offer?.key]);
  useEffect(() => {
    if (!offer || holding) return;
    const t = setTimeout(clear, done ? 5000 : 12000);
    return () => clearTimeout(t);
  }, [offer, holding, done, clear]);

  const busy = bulkEdit.isPending || updatePayee.isPending;
  const after = (message: string) => ({ onSuccess: () => setDone(message) });

  return (
    <>
      {offer && (
        <div
          role="status"
          aria-label="Category follow-up"
          onPointerEnter={() => setHolding(true)}
          onPointerLeave={() => setHolding(false)}
          onFocus={() => setHolding(true)}
          onBlur={() => setHolding(false)}
          className="pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-1 max-w-[min(720px,100%)] bg-text text-surface rounded-lg shadow-lg px-4 py-2.5 text-sm"
        >
          {done ? (
            <>
              <span>{done}</span>
              <button
                className={action}
                onClick={() => {
                  clear();
                  undo();
                }}
              >
                Undo
              </button>
            </>
          ) : (
            <>
              <span className="min-w-0">
                <strong className="font-semibold">{offer.categoryName}</strong> for{' '}
                {offer.payeeName}.
              </span>
              {offer.others > 0 && (
                <button
                  className={action}
                  disabled={busy}
                  onClick={() =>
                    bulkEdit.mutate(
                      {
                        params: { payeeIds: [offer.payeeId] },
                        changes: { categoryId: offer.categoryId },
                        expectedCount: offer.matched,
                      },
                      {
                        onSuccess: (r) =>
                          setDone(
                            `Changed ${plural(r.changed, 'transaction')} to ${offer.categoryName}`,
                          ),
                        onError: () =>
                          setDone(
                            `${offer.payeeName}'s transactions changed meanwhile; nothing was changed`,
                          ),
                      },
                    )
                  }
                >
                  Also change {plural(offer.others, 'other')}
                </button>
              )}
              {!offer.isDefault && (
                <button
                  className={action}
                  disabled={busy}
                  onClick={() =>
                    updatePayee.mutate(
                      { id: offer.payeeId, defaultCategoryId: offer.categoryId },
                      after(`New ${offer.payeeName} transactions will use ${offer.categoryName}`),
                    )
                  }
                >
                  Always use for this payee
                </button>
              )}
              <button
                className={action}
                disabled={busy}
                onClick={() => {
                  setRule({
                    conditionsOp: 'and',
                    conditions: [{ field: 'payee', op: 'is', value: offer.payeeId }],
                    actions: [{ type: 'set_category', value: offer.categoryId }],
                    enabled: true,
                  });
                  clear();
                }}
              >
                Create rule
              </button>
              <button
                className="text-surface/70 hover:text-surface transition-colors whitespace-nowrap max-md:min-h-11"
                disabled={busy}
                onClick={() =>
                  updatePayee.mutate(
                    { id: offer.payeeId, skipCategoryFollowup: 1 },
                    after(`Won't ask again for ${offer.payeeName}`),
                  )
                }
              >
                Don't ask for this payee
              </button>
            </>
          )}
          <button
            aria-label="Dismiss"
            onClick={clear}
            className="ml-auto text-surface/60 hover:text-surface transition-colors max-md:min-h-11 max-md:min-w-11 flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {rule && (
        <RuleEditorFlow
          isOpen
          onClose={() => setRule(null)}
          initial={rule}
          title="New rule for this payee"
        />
      )}
    </>
  );
}
