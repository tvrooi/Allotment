import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import {
  getLastReconciliation,
  undoLastReconciliation,
  type ReconciliationUndo,
} from '../../api/accounts';
import { useCanSave } from '../../hooks/useConnection';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';

function summary(result: ReconciliationUndo) {
  const parts = [`${result.unlocked} transaction${result.unlocked === 1 ? '' : 's'} unlocked`];
  if (result.adjustment === 'removed')
    parts.push(`the ${formatCurrency(result.adjustmentAmount)} adjustment removed`);
  if (result.adjustment === 'kept')
    parts.push('the adjustment was kept because it has been edited since');
  if (result.alreadyChanged)
    parts.push(
      `${result.alreadyChanged} left alone because ${result.alreadyChanged === 1 ? 'it was' : 'they were'} unlocked or moved since`,
    );
  return `Reconciliation undone: ${parts.join(', ')}.`;
}

/** "Undo last reconciliation" for an account: unlocks what it locked and removes its untouched adjustment */
export function UndoReconciliation({ accountId }: { accountId: string }) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const last = useQuery({
    queryKey: ['reconciliation-last', accountId],
    queryFn: () => getLastReconciliation(accountId),
  });
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const undo = useMutation({
    mutationFn: () => undoLastReconciliation(accountId),
    onSuccess: (result) => {
      setMessage(summary(result));
      for (const key of [
        'accounts',
        'transactions',
        'budget',
        'budget-summary',
        'reconciliation',
        'reconciliation-last',
        'review',
        'reports',
      ])
        qc.invalidateQueries({ queryKey: [key] });
    },
  });
  const data = last.data;
  return (
    <>
      {data && (
        <Button
          variant="secondary"
          size="sm"
          disabled={!canSave || undo.isPending}
          onClick={() => setConfirm(true)}
        >
          <Undo2 size={13} /> Undo last reconciliation
        </Button>
      )}
      {message && (
        <p role="status" className="basis-full text-xs text-text-secondary">
          {message}
        </p>
      )}
      {undo.error && (
        <p role="alert" className="basis-full text-xs text-negative">
          {undo.error.message}
        </p>
      )}
      <ConfirmModal
        isOpen={confirm}
        title="Undo last reconciliation"
        message={
          data
            ? `This unlocks the ${data.transactions} transaction${data.transactions === 1 ? '' : 's'} that reconciliation locked` +
              (data.adjustment
                ? ` and removes its ${formatCurrency(data.adjustment)} balance adjustment (if you have not changed it).`
                : '.') +
              ' Nothing else is changed.'
            : ''
        }
        confirmLabel="Undo reconciliation"
        onConfirm={() => {
          setConfirm(false);
          setMessage('');
          undo.mutate();
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
